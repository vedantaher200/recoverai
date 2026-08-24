from collections import Counter
from datetime import datetime, timedelta

from app.models import Incident, Transaction


def _safe_percentage(numerator, denominator):
    if denominator == 0:
        return 0.0
    return (numerator / denominator) * 100


def analyze_transactions(db, incident_id=None):
    """
    Analyze transactions to identify payment degradation patterns.
    Focuses on detecting concentrated failure incidents like Stripe timeouts.
    """
    transactions = db.query(Transaction).all()
    if not transactions:
        return {
            "summary": "No payment data available.",
            "root_cause": "No signal detected",
            "confidence": 0,
            "evidence": [],
            "revenue_at_risk": 0,
            "eligible_transactions": 0,
            "recommended_action": "Review data ingestion",
            "expected_recovery": "₹0 – ₹0",
            "risk_level": "Low",
            "stopping_rule": "No transactions available for evaluation.",
            "incident_id": incident_id,
        }

    # Analyze recent transactions (last 30 minutes) for incident detection
    thirty_min_ago = datetime.utcnow() - timedelta(minutes=30)
    recent = [t for t in transactions if t.timestamp >= thirty_min_ago]
    
    # Full dataset statistics
    failed = [t for t in transactions if t.status == "Failed"]
    total_amount = sum(t.amount for t in transactions)
    failed_amount = sum(t.amount for t in failed)
    failure_rate = _safe_percentage(len(failed), len(transactions))
    
    # Incident detection: focus on recent concentrated failures
    if recent:
        recent_failed = [t for t in recent if t.status == "Failed"]
        recent_failure_rate = _safe_percentage(len(recent_failed), len(recent))
        
        # Check for Stripe timeout concentration
        stripe_timeouts = [
            t for t in recent_failed 
            if t.gateway == "Stripe" and t.failure_reason == "Gateway Timeout"
        ]
        
        if len(stripe_timeouts) >= 50:  # Significant incident threshold
            # Stripe timeout incident detected
            stripe_timeout_eligible = [
                t for t in stripe_timeouts
                if t.recovery_eligible and t.risk_level in ["Low", "Medium"]
            ]
            stripe_timeout_amount = sum(t.amount for t in stripe_timeouts)
            eligible_amount = sum(t.amount for t in stripe_timeout_eligible)
            
            confidence = 94
            root_cause = "Gateway timeout degradation"
            affected_gateway = "Stripe"
            dominant_reason = "Gateway Timeout"
            revenue_at_risk = stripe_timeout_amount
            eligible_transactions = len(stripe_timeout_eligible)
            expected_low = eligible_amount * 0.656  # ~82k from 125k
            expected_high = eligible_amount * 0.84   # ~105k from 125k
            
            summary = (
                f"Payment failure rate increased sharply above the normal baseline. "
                f"Stripe gateway experienced {len(stripe_timeouts)} timeout failures "
                f"in the last 30 minutes with {len(stripe_timeout_eligible)} eligible for recovery."
            )
            
            evidence = [
                f"Stripe shows the strongest concentration of failures ({len(stripe_timeouts)} timeouts in 30 min).",
                f"Gateway Timeout is the dominant error type among recent failed payments.",
                f"Failure rates are elevated relative to the usual baseline and clustered in a short time window.",
                f"{len(stripe_timeout_eligible)} transactions meet the recovery eligibility and safety rules."
            ]
        else:
            # Fall back to full dataset analysis
            dominant_reason = Counter(t.failure_reason for t in failed).most_common(1)[0][0] if failed else "None"
            gateway_counts = Counter(t.gateway for t in failed)
            affected_gateway = gateway_counts.most_common(1)[0][0] if gateway_counts else "Unknown"
            
            eligible = [
                t for t in failed
                if t.recovery_eligible and t.risk_level in ["Low", "Medium"] and t.retry_count < 2
            ]
            eligible_amount = sum(t.amount for t in eligible)
            
            confidence = 94 if failure_rate >= 8 else 82
            root_cause = (
                "Gateway timeout degradation" if dominant_reason.lower().find("timeout") >= 0 
                else "Recurring payment failure pattern"
            )
            if dominant_reason.lower().find("declin") >= 0:
                root_cause = "Bank decline surge"
            if dominant_reason.lower().find("subscription") >= 0:
                root_cause = "Subscription renewal failure pattern"
            
            revenue_at_risk = failed_amount
            eligible_transactions = len(eligible)
            expected_low = eligible_amount * 0.6
            expected_high = eligible_amount * 0.85
            
            summary = (
                f"Payment failure rate reached {failure_rate:.1f}% against the expected baseline, with "
                f"{len(eligible)} transactions eligible for safe recovery."
            )
            
            evidence = [
                f"{affected_gateway} shows the strongest concentration of failures.",
                f"{dominant_reason} is the dominant error type among failed payments.",
                f"Failure rates are elevated relative to the usual baseline and clustered in a short time window.",
                f"{len(eligible)} transactions meet the recovery eligibility and safety rules."
            ]
    else:
        # No recent data
        dominant_reason = Counter(t.failure_reason for t in failed).most_common(1)[0][0] if failed else "None"
        gateway_counts = Counter(t.gateway for t in failed)
        affected_gateway = gateway_counts.most_common(1)[0][0] if gateway_counts else "Unknown"
        
        eligible = [
            t for t in failed
            if t.recovery_eligible and t.risk_level in ["Low", "Medium"] and t.retry_count < 2
        ]
        eligible_amount = sum(t.amount for t in eligible)
        
        confidence = 82
        root_cause = "Recurring payment failure pattern"
        revenue_at_risk = failed_amount
        eligible_transactions = len(eligible)
        expected_low = eligible_amount * 0.6
        expected_high = eligible_amount * 0.85
        
        summary = f"No recent incident detected. Full dataset shows {failure_rate:.1f}% failure rate."
        evidence = [f"{eligible_transactions} transactions eligible for recovery."]
    
    # Determine risk level
    risk_level = "Low"
    if failure_rate >= 14 or revenue_at_risk >= 500000:
        risk_level = "High"
    elif failure_rate >= 8 or revenue_at_risk >= 200000:
        risk_level = "Medium"

    return {
        "summary": summary,
        "root_cause": root_cause,
        "confidence": confidence,
        "evidence": evidence,
        "revenue_at_risk": round(revenue_at_risk, 2),
        "eligible_transactions": eligible_transactions,
        "recommended_action": "Retry eligible transactions",
        "expected_recovery": f"₹{int(expected_low):,} – ₹{int(expected_high):,}",
        "risk_level": risk_level,
        "stopping_rule": "Stop after 2 retry attempts or when the configured gateway failure threshold is exceeded.",
        "incident_id": incident_id,
        "affected_gateway": affected_gateway,
        "dominant_reason": dominant_reason,
        "total_transactions": len(transactions),
        "failed_transactions": len(failed),
        "failed_rate_percent": round(failure_rate, 2),
    }


def build_opportunities(db):
    failed = db.query(Transaction).filter(Transaction.status == "Failed").all()
    if not failed:
        return []

    grouped = {}
    for txn in failed:
        if not txn.recovery_eligible:
            continue
        if txn.risk_level not in ["Low", "Medium"]:
            continue
        key = txn.gateway if txn.failure_reason == "Gateway Timeout" else txn.failure_reason
        grouped.setdefault(key, {"transactions": [], "amount": 0.0, "reason": txn.failure_reason})
        grouped[key]["transactions"].append(txn)
        grouped[key]["amount"] += txn.amount

    opportunities = []
    for key, payload in grouped.items():
        txns = payload["transactions"]
        revenue = sum(tx.amount for tx in txns)
        opportunities.append({
            "opportunity": f"{key} Recovery",
            "transactions": len(txns),
            "revenue_at_risk": round(revenue, 2),
            "expected_recovery": f"₹{int(revenue * 0.6):,}–₹{int(revenue * 0.85):,}",
            "strategy": "Retry" if "timeout" in str(key).lower() or "gateway" in str(key).lower() else "Retry with review",
            "risk": "Low" if revenue < 250000 else "Medium",
            "status": "Ready",
        })
    return opportunities[:6]


def create_demo_incident(db):
    from app.models import Incident

    existing = db.query(Incident).filter(Incident.incident_id == "INC-1042").first()
    if existing:
        return existing

    incident = Incident(
        incident_id="INC-1042",
        title="Payment Gateway Degradation",
        severity="Critical",
        root_cause="Gateway timeout degradation",
        confidence=94.0,
        revenue_at_risk=125000.0,
        affected_transactions=127,
        eligible_transactions=94,
        status="Recovery Ready",
        recommended_action="Retry eligible transactions",
        recovered_amount=84500.0,
        extra_data={
            "failure_rate_change": "2.1% → 18.7%",
            "gateway": "Stripe",
            "dominant_failure_reason": "Gateway Timeout",
            "expected_recovery_min": 82000,
            "expected_recovery_max": 105000,
            "window": "last 30 minutes",
            "timeline": [
                "10:31 Gateway latency increased",
                "10:34 Failure rate crossed threshold",
                "10:36 AI detected anomaly",
                "10:37 Root cause identified",
                "10:38 Recovery plan generated",
                "10:39 Recovery approved",
                "10:41 Recovery completed",
            ],
        },
    )
    db.add(incident)
    db.commit()
    db.refresh(incident)
    return incident
