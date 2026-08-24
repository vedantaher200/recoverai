import os
from datetime import datetime
from typing import Any, Dict, List

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.ai.recovery_engine import analyze_transactions, build_opportunities, create_demo_incident
from app.database import SessionLocal, init_db
from app.models import AdminProfile, AuditLog, Incident, RecoveryAction, Settings, Transaction
from app.schemas import (
    AnalyzeRequest,
    AuditLogRead,
    HealthResponse,
    IncidentRead,
    RecoveryExecuteRequest,
    RecoveryOpportunity,
    RecoveryPreviewRequest,
    SettingsRead,
    SettingsUpdate,
    TransactionRead,
)

app = FastAPI(title="RecoverAI API", version="1.0.0")

allowed_origins = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5176,http://127.0.0.1:5176").split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event():
    init_db()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.get("/api/health", response_model=HealthResponse)
def health_check():
    return {
        "status": "ok",
        "mode": "demo",
        "database": "sqlite" if os.getenv("DATABASE_URL", "sqlite").startswith("sqlite") else "postgresql",
    }


@app.get("/api/dashboard")
def dashboard(period: str = Query(default="30 days"), merchant: str = Query(default="Demo Commerce"), db: Session = Depends(get_db)):
    transactions = _scoped_transactions(db, period, merchant)
    failed = [t for t in transactions if t.status == "Failed"]
    revenue_at_risk = round(sum(t.amount for t in failed), 2)
    eligible = [t for t in failed if t.recovery_eligible]
    revenue_recovered = 100000.0 + sum(action.recovered_amount for action in db.query(RecoveryAction).all())
    return {
        "transactions_analyzed": len(transactions),
        "revenue_at_risk": revenue_at_risk,
        "recovery_eligible": round(sum(t.amount for t in eligible), 2),
        "revenue_recovered": revenue_recovered,
        "recovery_rate": round((revenue_recovered / max(1.0, revenue_recovered + revenue_at_risk)) * 100, 1),
        "active_incidents": db.query(Incident).count(),
        "trend": [
            {"name": "Jan", "revenue_at_risk": 250000, "recovery_eligible": 175000, "revenue_recovered": 98000},
            {"name": "Feb", "revenue_at_risk": 300000, "recovery_eligible": 210000, "revenue_recovered": 125000},
            {"name": "Mar", "revenue_at_risk": 420000, "recovery_eligible": 265000, "revenue_recovered": 160500},
            {"name": "Apr", "revenue_at_risk": 510000, "recovery_eligible": 330000, "revenue_recovered": 182400},
            {"name": "May", "revenue_at_risk": 485000, "recovery_eligible": 290000, "revenue_recovered": 184500},
        ],
        "ai_summary": {
            "summary": "Payment failures increased by 34% during the last 30 minutes. Gateway timeout errors are the strongest correlated failure pattern.",
            "confidence": 94,
            "revenue_at_risk": 125000,
            "eligible_transactions": 127,
        },
    }


@app.get("/api/transactions", response_model=list[TransactionRead])
def list_transactions(
    search: str = Query(default=""),
    status: str = Query(default=""),
    gateway: str = Query(default=""),
    risk: str = Query(default=""),
    eligible: str = Query(default=""),
    merchant: str = Query(default="Demo Commerce"),
    db: Session = Depends(get_db),
):
    query = db.query(Transaction)
    gateways = MERCHANT_GATEWAYS.get(merchant)
    if gateways:
        query = query.filter(Transaction.gateway.in_(gateways))
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (Transaction.transaction_id.ilike(search_term))
            | (Transaction.customer_name.ilike(search_term))
            | (Transaction.failure_reason.ilike(search_term))
        )
    if status:
        query = query.filter(Transaction.status == status)
    if gateway:
        query = query.filter(Transaction.gateway == gateway)
    if risk:
        query = query.filter(Transaction.risk_level == risk)
    if eligible:
        if eligible.lower() == "eligible":
            query = query.filter(Transaction.recovery_eligible.is_(True))
        else:
            query = query.filter(Transaction.recovery_eligible.is_(False))
    return query.order_by(Transaction.timestamp.desc()).all()


@app.get("/api/transactions/{transaction_id}", response_model=TransactionRead)
def get_transaction(transaction_id: str, db: Session = Depends(get_db)):
    tx = db.query(Transaction).filter(Transaction.transaction_id == transaction_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return tx


def serialize_incident(incident: Incident):
    return {
        "id": incident.id,
        "incident_id": incident.incident_id,
        "title": incident.title,
        "severity": incident.severity,
        "detected_at": incident.detected_at,
        "root_cause": incident.root_cause,
        "confidence": incident.confidence,
        "revenue_at_risk": incident.revenue_at_risk,
        "affected_transactions": incident.affected_transactions,
        "eligible_transactions": incident.eligible_transactions,
        "status": incident.status,
        "recommended_action": incident.recommended_action,
        "recovered_amount": incident.recovered_amount,
        "metadata": incident.extra_data or {},
    }


@app.get("/api/incidents", response_model=list[IncidentRead])
def list_incidents(db: Session = Depends(get_db)):
    incidents = db.query(Incident).order_by(Incident.detected_at.desc()).all()
    return [serialize_incident(incident) for incident in incidents]


@app.get("/api/incidents/{incident_id}", response_model=IncidentRead)
def get_incident(incident_id: str, db: Session = Depends(get_db)):
    incident = db.query(Incident).filter(Incident.incident_id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return serialize_incident(incident)


@app.post("/api/ai/analyze")
def analyze_incident(payload: AnalyzeRequest, db: Session = Depends(get_db)):
    incident_id = payload.incident_id or "INC-1042"
    
    # Perform AI analysis on transaction data
    result = analyze_transactions(db, incident_id)
    
    # Create or update incident based on analysis
    incident = db.query(Incident).filter(Incident.incident_id == incident_id).first()
    if not incident:
        incident = Incident(
            incident_id=incident_id,
            title="Payment Gateway Degradation",
            severity="Critical" if result["revenue_at_risk"] > 100000 else "Medium",
            root_cause=result["root_cause"],
            confidence=float(result["confidence"]),
            revenue_at_risk=float(result["revenue_at_risk"]),
            affected_transactions=result.get("total_transactions", 0),
            eligible_transactions=result["eligible_transactions"],
            status="Analysis Complete",
            recommended_action=result["recommended_action"],
            recovered_amount=0.0,
        )
    else:
        incident.root_cause = result["root_cause"]
        incident.confidence = float(result["confidence"])
        incident.revenue_at_risk = float(result["revenue_at_risk"])
        incident.eligible_transactions = result["eligible_transactions"]
        incident.status = "Analysis Complete"
        incident.recommended_action = result["recommended_action"]
    
    # Store analysis metadata
    if not incident.extra_data:
        incident.extra_data = {}
    incident.extra_data.update({
        "analysis_timestamp": datetime.utcnow().isoformat(),
        "affected_gateway": result.get("affected_gateway", "Unknown"),
        "dominant_failure_reason": result.get("dominant_reason", "Unknown"),
        "failure_rate_percent": result.get("failed_rate_percent", 0),
        "expected_recovery_min": 82000,
        "expected_recovery_max": 105000,
        "stopping_rule": result["stopping_rule"],
    })
    
    db.add(incident)
    
    # Create audit log for analysis
    db.add(AuditLog(
        actor="AI Agent",
        event_type="Analysis Executed",
        description=f"AI analysis identified {result['root_cause']} with {result['confidence']}% confidence",
        incident_id=incident_id,
        result="Success",
        metadata={
            "revenue_at_risk": float(result["revenue_at_risk"]),
            "eligible_transactions": result["eligible_transactions"],
            "affected_gateway": result.get("affected_gateway", "Unknown"),
            "dominant_reason": result.get("dominant_reason", "Unknown"),
        },
    ))
    
    db.commit()
    return result


@app.get("/api/recovery/opportunities", response_model=list[RecoveryOpportunity])
def get_opportunities(db: Session = Depends(get_db)):
    return build_opportunities(db)


@app.post("/api/recovery/preview")
def preview_recovery(payload: RecoveryPreviewRequest, db: Session = Depends(get_db)):
    incident = db.query(Incident).filter(Incident.incident_id == (payload.incident_id or "INC-1042")).first()
    if not incident:
        incident = create_demo_incident(db)

    eligible = db.query(Transaction).filter(
        Transaction.status == "Failed", Transaction.gateway == "Stripe",
        Transaction.failure_reason == "Gateway Timeout", Transaction.recovery_eligible.is_(True),
        Transaction.risk_level.in_(["Low", "Medium"]),
    ).count()

    return {
        "incident": incident.incident_id,
        "strategy": payload.strategy,
        "eligible_transactions": eligible,
        "maximum_retry_attempts": 2,
        "expected_recovery": "₹82K–₹105K",
        "safety_rule": "Only eligible transactions with a low/medium risk profile are retried; stop after 2 attempts or when failure threshold exceeds policy.",
        "audit_logging": "Enabled",
        "human_approval": bool(settings.human_approval_required) if (settings := db.query(Settings).first()) else True,
    }


@app.post("/api/recovery/execute")
def execute_recovery(payload: RecoveryExecuteRequest, db: Session = Depends(get_db)):
    """Run a bounded, deterministic simulation only; no payment provider is called."""
    if not payload.approved:
        raise HTTPException(status_code=400, detail="Recovery approval is required before execution.")
    incident = db.query(Incident).filter(Incident.incident_id == payload.incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    settings = db.query(Settings).first()
    if settings and settings.human_approval_required and not payload.approved:
        raise HTTPException(status_code=400, detail="Human approval is required.")
    prior = db.query(RecoveryAction).filter(RecoveryAction.incident_id == payload.incident_id, RecoveryAction.status == "Completed").first()
    if prior:
        return {"status": "already_completed", "recovered_amount": prior.recovered_amount, "transactions_recovered": 78, "recovery_rate": 89.4, "incident_id": payload.incident_id}

    candidates = db.query(Transaction).filter(
        Transaction.status == "Failed", Transaction.gateway == "Stripe",
        Transaction.failure_reason == "Gateway Timeout", Transaction.recovery_eligible.is_(True),
        Transaction.risk_level.in_(["Low", "Medium"]),
        Transaction.retry_count < (settings.max_retry_attempts if settings else 2),
    ).order_by(Transaction.transaction_id).all()
    if len(candidates) < 94:
        raise HTTPException(status_code=400, detail="The 94 safe demo transactions are no longer available for recovery.")

    # Safety: only failed, policy-eligible, below retry limit candidates reach this point.
    recovered, unsuccessful = candidates[:78], candidates[78:94]
    for txn in recovered:
        txn.retry_count += 1
        txn.status = "Success"
        txn.failure_reason = "None"
        txn.recovery_status = "Recovered"
    for txn in unsuccessful:
        txn.retry_count += 1
        txn.recovery_status = "Unsuccessful"
        txn.recovery_eligible = False

    recovered_amount = 84500.0
    incident.recovered_amount = recovered_amount
    incident.status = "Recovered"
    action = RecoveryAction(incident_id=payload.incident_id, strategy=payload.strategy,
        opportunity="Gateway Timeout Recovery", transactions=94, revenue_at_risk=125000.0,
        expected_recovery="₹82K–₹105K", risk_level="Low", status="Completed", approved=True,
        executed_at=datetime.utcnow(), recovered_amount=recovered_amount)
    db.add(action)
    db.add(AuditLog(actor=payload.actor, event_type="Recovery Approved", description="Merchant approved the simulated retry plan.", incident_id=payload.incident_id, result="Success", metadata={"strategy": payload.strategy}))
    db.add(AuditLog(actor="System", event_type="Recovery Completed", description="Simulated recovery completed: 78 recovered, 16 unsuccessful.", incident_id=payload.incident_id, result="Success", metadata={"recovered_amount": recovered_amount, "recovered_transactions": 78, "unsuccessful_transactions": 16, "simulation": True}))
    db.commit()
    return {"status": "completed", "recovered_amount": recovered_amount, "transactions_recovered": 78, "unsuccessful_transactions": 16, "recovery_rate": 89.4, "incident_id": payload.incident_id}

def serialize_audit_log(log: AuditLog):
    return {
        "id": log.id,
        "timestamp": log.timestamp,
        "actor": log.actor,
        "event_type": log.event_type,
        "description": log.description,
        "incident_id": log.incident_id,
        "transaction_id": log.transaction_id,
        "result": log.result,
        "metadata": log.extra_data or {},
    }


@app.get("/api/audit-logs", response_model=list[AuditLogRead])
def get_audit_logs(
    actor: str = Query(default=""),
    event_type: str = Query(default=""),
    incident: str = Query(default=""),
    db: Session = Depends(get_db),
):
    query = db.query(AuditLog)
    if actor:
        query = query.filter(AuditLog.actor.ilike(f"%{actor}%"))
    if event_type:
        query = query.filter(AuditLog.event_type.ilike(f"%{event_type}%"))
    if incident:
        query = query.filter(AuditLog.incident_id.ilike(f"%{incident}%"))
    logs = query.order_by(AuditLog.timestamp.desc()).all()
    return [serialize_audit_log(log) for log in logs]


@app.get("/api/analytics")
def get_analytics(db: Session = Depends(get_db)):
    return {
        "recovery_trend": [
            {"name": "Jan", "revenue_at_risk": 240000, "revenue_recovered": 125000, "remaining_recoverable": 115000},
            {"name": "Feb", "revenue_at_risk": 310000, "revenue_recovered": 148000, "remaining_recoverable": 162000},
            {"name": "Mar", "revenue_at_risk": 390000, "revenue_recovered": 194500, "remaining_recoverable": 195500},
            {"name": "Apr", "revenue_at_risk": 470000, "revenue_recovered": 223000, "remaining_recoverable": 247000},
            {"name": "May", "revenue_at_risk": 485000, "revenue_recovered": 184500, "remaining_recoverable": 300500},
        ],
        "by_failure_reason": [
            {"name": "Gateway Timeout", "value": 180000},
            {"name": "Bank Declined", "value": 120000},
            {"name": "Subscription Failed", "value": 95000},
        ],
        "by_gateway": [
            {"name": "Razorpay", "value": 190000},
            {"name": "Cashfree", "value": 94000},
            {"name": "PayU", "value": 78000},
        ],
        "strategy_performance": [
            {"name": "Retry", "recovered": 84.5, "target": 72},
            {"name": "Retry + Review", "recovered": 68.2, "target": 60},
            {"name": "Hold", "recovered": 24.1, "target": 15},
        ],
        "summary": {
            "total_revenue_at_risk": 485000,
            "revenue_recovered": 184500,
            "remaining_recoverable": 300500,
            "average_recovery_time": "4.2 hours",
        },
    }


@app.get("/api/settings", response_model=SettingsRead)
def get_settings(db: Session = Depends(get_db)):
    settings = db.query(Settings).first()
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found")
    return settings


@app.put("/api/settings", response_model=SettingsRead)
def update_settings(payload: SettingsUpdate, db: Session = Depends(get_db)):
    settings = db.query(Settings).first()
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(settings, field, value)
    db.commit()
    db.refresh(settings)
    return settings


@app.get("/api/load-demo-incident")
def load_demo_incident(db: Session = Depends(get_db)):
    """Reset only the synthetic INC-1042 simulation so the presentation can be replayed."""
    incident = create_demo_incident(db)
    demo_transactions = db.query(Transaction).filter(
        Transaction.gateway == "Stripe", ((Transaction.failure_reason == "Gateway Timeout") | (Transaction.recovery_status.in_(["Recovered", "Unsuccessful"])) | ((Transaction.status == "Failed") & (Transaction.failure_reason == "None") & (Transaction.recovery_status == "Ready")))
    ).order_by(Transaction.transaction_id).all()
    # Explicitly separate the 94 retry-safe records from the 33 high-risk records.
    for index, txn in enumerate(demo_transactions[:127]):
        txn.status, txn.failure_reason, txn.retry_count = "Failed", "Gateway Timeout", 0
        if index < 94:
            txn.recovery_eligible, txn.risk_level, txn.recovery_status = True, "Low", "Ready"
        else:
            txn.recovery_eligible, txn.risk_level, txn.recovery_status = False, "High", "Blocked"
    db.query(RecoveryAction).filter(RecoveryAction.incident_id == "INC-1042", RecoveryAction.status == "Completed").delete(synchronize_session=False)
    incident.status, incident.recovered_amount = "Recovery Ready", 0.0
    db.add(AuditLog(actor="System", event_type="Demo Incident Loaded", description="Reset synthetic INC-1042 for a repeatable demo.", incident_id="INC-1042", result="Success", metadata={"simulation": True}))
    db.commit()
    db.refresh(incident)
    return serialize_incident(incident)

MERCHANT_GATEWAYS = {
    "Demo Commerce": None,
    "Demo Retail": ["Razorpay", "Cashfree", "PayU", "Instamojo"],
    "Demo SaaS": ["Stripe"],
}


def _scoped_transactions(db: Session, period: str, merchant: str):
    query = db.query(Transaction)
    gateways = MERCHANT_GATEWAYS.get(merchant)
    if gateways:
        query = query.filter(Transaction.gateway.in_(gateways))
    days = {"7 days": 7, "30 days": 30, "90 days": 90}.get(period)
    if days:
        from datetime import timedelta
        query = query.filter(Transaction.timestamp >= datetime.utcnow() - timedelta(days=days))
    return query.all()


@app.get("/api/header-context")
def get_header_context(period: str = Query(default="30 days"), merchant: str = Query(default="Demo Commerce"), db: Session = Depends(get_db)):
    transactions = _scoped_transactions(db, period, merchant)
    failed = [transaction for transaction in transactions if transaction.status == "Failed"]
    incidents = db.query(Incident).filter(Incident.status != "Recovered").count()
    last_analysis = db.query(AuditLog).filter(AuditLog.actor == "AI Agent").order_by(AuditLog.timestamp.desc()).first()
    return {
        "merchant": merchant, "period": period,
        "merchants": list(MERCHANT_GATEWAYS),
        "agent": {"status": "Online", "mode": "Autonomous Recovery Analysis", "last_analysis": last_analysis.timestamp if last_analysis else None, "current_incidents": incidents, "recoverable_transactions": sum(1 for transaction in failed if transaction.recovery_eligible), "revenue_at_risk": round(sum(transaction.amount for transaction in failed), 2)},
    }


@app.get("/api/notifications")
def get_notifications(db: Session = Depends(get_db)):
    logs = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(12).all()
    notices = [{"id": f"audit-{log.id}", "title": log.event_type, "message": log.description, "timestamp": log.timestamp, "read": False, "incident_id": log.incident_id} for log in logs]
    if not notices:
        notices = [{"id": "demo-incident", "title": "Payment gateway incident detected", "message": "Stripe timeout degradation has a recovery opportunity.", "timestamp": datetime.utcnow(), "read": False, "incident_id": "INC-1042"}]
    return notices
@app.get("/api/profile")
def get_profile(db: Session = Depends(get_db)):
    profile = db.query(AdminProfile).first()
    if not profile:
        profile = AdminProfile(full_name="Vedant Aher", email="vedantaher2003@gmail.com")
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return {
        "full_name": profile.full_name, "email": profile.email,
        "role": "Merchant Admin", "organization": "Demo Commerce",
        "account_status": "Active", "ai_recovery_access": "Enabled",
        "last_login": profile.last_login, "notification_preference": profile.notification_preference,
        "session_status": "Active", "current_device": "Local demo workspace",
    }


@app.patch("/api/profile")
def update_profile(payload: Dict[str, Any], db: Session = Depends(get_db)):
    profile = db.query(AdminProfile).first() or AdminProfile()
    for field in ("full_name", "email", "notification_preference"):
        if field in payload and isinstance(payload[field], str) and payload[field].strip():
            setattr(profile, field, payload[field].strip())
    db.add(profile)
    db.add(AuditLog(actor="Admin", event_type="Profile Updated", description="Demo administrator profile preferences were updated.", result="Success", metadata={"fields": [key for key in payload if key in {"full_name", "email", "notification_preference"}]}))
    db.commit()
    return get_profile(db)


@app.post("/api/logout")
def demo_logout(db: Session = Depends(get_db)):
    db.add(AuditLog(actor="Admin", event_type="Demo Logout", description="Administrator ended the local demo session.", result="Success", metadata={"simulation": True}))
    db.commit()
    return {"status": "logged_out", "mode": "demo"}


@app.post("/api/assistant")
def recoverai_assistant(payload: Dict[str, Any], db: Session = Depends(get_db)):
    """A deterministic, data-aware assistant for the RecoverAI product UI."""
    question = str(payload.get("message", "")).strip()
    if not question:
        raise HTTPException(status_code=422, detail="Please enter a question for RecoverAI Assistant.")
    text = question.lower()
    period = str(payload.get("period", "30 days"))
    merchant = str(payload.get("merchant", "Demo Commerce"))
    transactions = _scoped_transactions(db, period, merchant)
    failed = [transaction for transaction in transactions if transaction.status == "Failed"]
    active_incidents = db.query(Incident).filter(Incident.status != "Recovered").count()
    dashboard = {
        "recovery_rate": round((100000 + sum(action.recovered_amount for action in db.query(RecoveryAction).all())) / max(1, 100000 + sum(action.recovered_amount for action in db.query(RecoveryAction).all()) + sum(transaction.amount for transaction in failed)) * 100, 1),
        "revenue_at_risk": round(sum(transaction.amount for transaction in failed), 2),
        "active_incidents": active_incidents,
    }
    knowledge = [
        (("transaction", "failed payment", "payment failed"), "Transactions lists every payment with search, gateway, risk, and recovery filters. Select Transactions to review a failed payment.", "/transactions", "Open Transactions"),
        (("recovery center", "recovery plan", "recovery workflow"), "Recovery Center shows safe recovery opportunities. The workflow is Analyze → Review preview → Approve → Execute simulated retry → Verify in Audit Trail.", "/recovery", "Open Recovery Center"),
        (("incident",), f"There {'is' if active_incidents == 1 else 'are'} {active_incidents} active incident{'s' if active_incidents != 1 else ''} in this demo workspace. Incidents contains root-cause evidence and the recommended action.", "/incidents", "Open Incidents"),
        (("analytic",), "Analytics summarizes recovery trends, failure reasons, gateway performance, and strategy effectiveness.", "/analytics", "Open Analytics"),
        (("audit",), "Audit Trail records analysis, approval, execution, reset, and profile events for review.", "/audit", "Open Audit Trail"),
        (("setting",), "Settings contains merchant configuration and the bounded recovery policy, including retry and approval controls.", "/settings", "Open Settings"),
        (("profile", "administrator", "my account"), "Your administrator profile contains your RecoverAI access, workspace details, session information, and notification preference.", "/profile", "Open profile"),
        (("recovery eligible", "eligible mean"), "Recovery Eligible means a failed payment meets the configured safety rules: it is low or medium risk, eligible for recovery, and below the retry limit.", "/recovery", "Review eligible opportunities"),
        (("revenue at risk",), "Revenue at Risk is the value of failed payments in the selected workspace and time range that still needs attention. It is not a confirmed loss.", "/dashboard", "View dashboard"),
        (("ai recovery agent", "what does the ai", "ai agent do"), "The AI Recovery Agent analyzes failure patterns, identifies a likely root cause, proposes a bounded strategy, and keeps execution subject to safety policy and approval.", "/agent", "Open AI Recovery Agent"),
        (("dashboard", "recovery status"), "Dashboard provides the selected period's analyzed transactions, revenue at risk, eligible value, recovered revenue, recovery rate, and active incidents.", "/dashboard", "Open dashboard"),
    ]
    for phrases, answer, path, action in knowledge:
        if any(phrase in text for phrase in phrases):
            return {"answer": answer, "action": {"label": action, "path": path}, "data": dashboard}
    if "recovery rate" in text or "current rate" in text:
        return {"answer": f"The current recovery rate for {merchant} over {period} is {dashboard['recovery_rate']}%. Revenue at risk is ₹{dashboard['revenue_at_risk']:,.0f}.", "action": {"label": "View dashboard", "path": "/dashboard"}, "data": dashboard}
    return {"answer": "I can help you navigate RecoverAI, explain recovery metrics, and summarize the current demo data. Try asking about transactions, Recovery Center, active incidents, revenue at risk, or the recovery rate.", "action": None, "data": dashboard}
