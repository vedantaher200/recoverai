import os
from datetime import datetime
from typing import List

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.ai.recovery_engine import analyze_transactions, build_opportunities, create_demo_incident
from app.database import SessionLocal, init_db
from app.models import AuditLog, Incident, RecoveryAction, Settings, Transaction
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
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
        "database": "sqlite",
    }


@app.get("/api/dashboard")
def dashboard(db: Session = Depends(get_db)):
    transactions = db.query(Transaction).all()
    failed = [t for t in transactions if t.status == "Failed"]
    revenue_at_risk = round(sum(t.amount for t in failed), 2)
    eligible = [t for t in failed if t.recovery_eligible]
    revenue_recovered = 184500.0
    return {
        "transactions_analyzed": len(transactions),
        "revenue_at_risk": revenue_at_risk,
        "recovery_eligible": round(sum(t.amount for t in eligible), 2),
        "revenue_recovered": revenue_recovered,
        "recovery_rate": 63.6,
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
    db: Session = Depends(get_db),
):
    query = db.query(Transaction)
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
        Transaction.status == "Failed",
        Transaction.recovery_eligible.is_(True),
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
        "human_approval": bool(incident.status == "Recovery Ready"),
    }


@app.post("/api/recovery/execute")
def execute_recovery(payload: RecoveryExecuteRequest, db: Session = Depends(get_db)):
    if not payload.approved:
        raise HTTPException(status_code=400, detail="Recovery approval is required before execution.")

    settings = db.query(Settings).first()
    if settings and settings.human_approval_required and not payload.approved:
        raise HTTPException(status_code=400, detail="Human approval is required.")

    eligible = db.query(Transaction).filter(
        Transaction.status == "Failed",
        Transaction.recovery_eligible.is_(True),
        Transaction.risk_level.in_(["Low", "Medium"]),
        Transaction.retry_count < (settings.max_retry_attempts if settings else 2),
    ).all()

    if not eligible:
        raise HTTPException(status_code=400, detail="No eligible transactions were found for recovery.")

    recovered = 0
    recovered_count = 0
    for txn in eligible:
        if txn.amount <= (settings.min_transaction_amount if settings else 500.0):
            continue
        recovered += txn.amount * 0.9
        recovered_count += 1
        txn.recovery_status = "Recovered"
        txn.status = "Success"
        txn.failure_reason = "None"
        txn.retry_count += 1

        db.add(AuditLog(
            actor=payload.actor,
            event_type="Recovery Completed",
            description=f"Synthetic recovery executed for transaction {txn.transaction_id}",
            incident_id=payload.incident_id,
            transaction_id=txn.transaction_id,
            result="Success",
            metadata={"amount_recovered": round(txn.amount * 0.9, 2), "strategy": payload.strategy},
        ))

    incident = db.query(Incident).filter(Incident.incident_id == payload.incident_id).first()
    if incident:
        incident.recovered_amount = recovered
        incident.status = "Recovered"

    db.add(AuditLog(
        actor="AI Agent",
        event_type="Recovery Executed",
        description=f"Executed {payload.strategy} for incident {payload.incident_id}",
        incident_id=payload.incident_id,
        result="Success",
        metadata={"recovered_amount": round(recovered, 2), "transactions": recovered_count},
    ))

    db.commit()
    return {
        "status": "completed",
        "recovered_amount": round(recovered, 2),
        "transactions_recovered": recovered_count,
        "recovery_rate": round((recovered_count / max(1, len(eligible))) * 100, 1),
        "incident_id": payload.incident_id,
    }


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
    incident = create_demo_incident(db)
    return incident
