#!/usr/bin/env python
"""Initialize demo data for RecoverAI application."""

from app.database import SessionLocal
from scripts.generate_data import (
    generate_transactions,
    seed_settings,
    seed_incidents,
    seed_recovery_actions,
)
from app.models import Incident, Transaction

db = SessionLocal()
try:
    generate_transactions(db)
    print("✓ Generated 5000 transactions with concentrated Stripe timeout incident")
    
    seed_settings(db)
    print("✓ Seeded settings")
    
    seed_incidents(db)
    print("✓ Seeded demo incident INC-1042")
    
    seed_recovery_actions(db)
    print("✓ Seeded recovery actions")
    
    # Verify the incident was created
    incident = db.query(Incident).filter(Incident.incident_id == "INC-1042").first()
    if incident:
        print(f"\n✓ Incident {incident.incident_id}: {incident.title}")
        print(f"  Revenue at Risk: ₹{incident.revenue_at_risk:,.0f}")
        print(f"  Affected: {incident.affected_transactions}, Eligible: {incident.eligible_transactions}")
    
    # Count Stripe timeout transactions
    stripe_timeouts = db.query(Transaction).filter(
        Transaction.gateway == "Stripe",
        Transaction.failure_reason == "Gateway Timeout",
        Transaction.status == "Failed",
    ).all()
    print(f"\n✓ Stripe timeout transactions: {len(stripe_timeouts)}")
    print(f"  Total amount at risk: ₹{sum(t.amount for t in stripe_timeouts):,.2f}")
    
    eligible_stripe = [t for t in stripe_timeouts if t.recovery_eligible]
    print(f"  Eligible for recovery: {len(eligible_stripe)}")
    print(f"  Eligible amount: ₹{sum(t.amount for t in eligible_stripe):,.2f}")
    
    print("\n✓ Demo data initialization complete!")

finally:
    db.close()
