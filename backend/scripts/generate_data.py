import random
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.database import SessionLocal, init_db
from app.models import Incident, RecoveryAction, Settings, Transaction

random.seed(42)

GATEWAYS = ["Razorpay", "Cashfree", "PayU", "Stripe", "Instamojo"]
FAILURES = [
    ("None", 0.72),
    ("Gateway Timeout", 0.13),
    ("Bank Declined", 0.09),
    ("Insufficient Funds", 0.03),
    ("Subscription Failed", 0.02),
    ("Card Expired", 0.01),
]


def _weighted_choice(options):
    total = sum(weight for _, weight in options)
    pick = random.random() * total
    cumulative = 0.0
    for value, weight in options:
        cumulative += weight
        if pick <= cumulative:
            return value
    return options[-1][0]


def generate_transactions(db: Session):
    existing = db.query(Transaction).count()
    if existing >= 5000:
        return

    # Create concentrated Stripe timeout incident: 127 transactions in last 30 minutes
    # with 94 eligible for recovery, ₹1,25,000 at risk
    stripe_timeout_count = 0
    target_stripe_timeout_amount = 125000
    target_stripe_timeout_count = 127
    target_eligible = 94
    
    for i in range(5000):
        # Recent window: last 30 minutes (for incident concentration)
        recent_prob = random.random()
        if recent_prob < 0.025:  # 2.5% in last 30 minutes
            ts = datetime.utcnow() - timedelta(minutes=random.randint(0, 30))
        else:
            ts = datetime.utcnow() - timedelta(minutes=random.randint(31, 2880))
        
        amount = round(random.uniform(500, 25000), 2)
        status = "Success"
        failure_reason = "None"
        gateway = random.choice(GATEWAYS)
        recovery_eligible = False
        risk_level = "Low"
        recovery_status = "Not Required"
        retry_count = 0

        # Inject concentrated Stripe timeout incident (first 127 transactions in recent window)
        if stripe_timeout_count < target_stripe_timeout_count and ts >= datetime.utcnow() - timedelta(minutes=30):
            gateway = "Stripe"
            status = "Failed"
            failure_reason = "Gateway Timeout"
            stripe_timeout_count += 1
            
            # Make 94 out of 127 eligible for recovery
            if stripe_timeout_count <= target_eligible:
                recovery_eligible = True
                risk_level = "Low"
                recovery_status = "Ready"
            else:
                recovery_eligible = False
                risk_level = "High"
                recovery_status = "Blocked"
        # Regular failure pattern (2.1% baseline failure rate for other gateways)
        elif gateway != "Stripe" and random.random() < 0.021:
            status = "Failed"
            failure_reason = random.choice(["Gateway Timeout", "Bank Declined", "Subscription Failed", "Card Expired", "Insufficient Funds"])
            if random.random() < 0.72:
                recovery_eligible = True
                if amount > 9000:
                    risk_level = "Medium"
                else:
                    risk_level = "Low"
                recovery_status = "Ready"
            else:
                risk_level = "High"
                recovery_status = "Blocked"
        # Stripe normal rate (1% baseline)
        elif gateway == "Stripe" and random.random() < 0.01:
            status = "Failed"
            failure_reason = random.choice(["Bank Declined", "Insufficient Funds", "Card Expired"])
            if random.random() < 0.72:
                recovery_eligible = True
                risk_level = "Low"
                recovery_status = "Ready"
            else:
                risk_level = "High"
                recovery_status = "Blocked"

        transaction = Transaction(
            transaction_id=f"TXN-{100000 + i}",
            timestamp=ts,
            customer_name=f"Customer {i % 250 + 1}",
            amount=amount,
            currency="INR",
            status=status,
            gateway=gateway,
            failure_reason=failure_reason,
            retry_count=retry_count,
            subscription=random.random() < 0.26,
            recovery_eligible=recovery_eligible,
            risk_level=risk_level,
            recovery_status=recovery_status,
        )
        db.add(transaction)

    db.commit()


def seed_settings(db: Session):
    settings = db.query(Settings).first()
    if settings:
        return settings
    settings = Settings(
        merchant_name="Demo Commerce Pvt. Ltd.",
        max_retry_attempts=2,
        min_transaction_amount=500.0,
        risk_threshold="High",
        failure_threshold=0.12,
        human_approval_required=True,
        notification_email="ops@demo-commerce.com",
        ai_provider="Local Deterministic Engine",
    )
    db.add(settings)
    db.commit()
    db.refresh(settings)
    return settings


def seed_incidents(db: Session):
    existing = db.query(Incident).count()
    if existing > 0:
        return
    trigger = Incident(
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
            "stopping_rule": "Stop after 2 retry attempts or when the configured gateway failure threshold is exceeded.",
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
    db.add(trigger)
    db.commit()


def seed_recovery_actions(db: Session):
    if db.query(RecoveryAction).first():
        return
    action = RecoveryAction(
        incident_id="INC-1042",
        strategy="Retry eligible transactions",
        opportunity="Gateway Timeout Recovery",
        transactions=94,
        revenue_at_risk=125000.0,
        expected_recovery="₹82K–₹105K",
        risk_level="Low",
        status="Ready",
        approved=True,
        recovered_amount=84500.0,
    )
    db.add(action)
    db.commit()


def main():
    init_db()
    db = SessionLocal()
    try:
        generate_transactions(db)
        seed_settings(db)
        seed_incidents(db)
        seed_recovery_actions(db)
        print("Synthetic data generation complete.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
