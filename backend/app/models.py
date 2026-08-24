from sqlalchemy import Boolean, Column, DateTime, Float, Integer, JSON, String, Text
from sqlalchemy.sql import func

from app.database import Base


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(String, unique=True, index=True, nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    customer_name = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    currency = Column(String, default="INR")
    status = Column(String, default="Pending")
    gateway = Column(String, nullable=False)
    failure_reason = Column(String, default="None")
    retry_count = Column(Integer, default=0)
    subscription = Column(Boolean, default=False)
    recovery_eligible = Column(Boolean, default=False)
    risk_level = Column(String, default="Low")
    recovery_status = Column(String, default="Not Required")


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(String, unique=True, index=True, nullable=False)
    title = Column(String, nullable=False)
    severity = Column(String, default="Medium")
    detected_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    root_cause = Column(String, default="Unknown")
    confidence = Column(Float, default=0.0)
    revenue_at_risk = Column(Float, default=0.0)
    affected_transactions = Column(Integer, default=0)
    eligible_transactions = Column(Integer, default=0)
    status = Column(String, default="Open")
    recommended_action = Column(String, default="Review")
    recovered_amount = Column(Float, default=0.0)
    extra_data = Column("metadata", JSON, default=dict)


class RecoveryAction(Base):
    __tablename__ = "recovery_actions"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(String, nullable=True)
    strategy = Column(String, nullable=False)
    opportunity = Column(String, nullable=False)
    transactions = Column(Integer, default=0)
    revenue_at_risk = Column(Float, default=0.0)
    expected_recovery = Column(String, default="0")
    risk_level = Column(String, default="Low")
    status = Column(String, default="Ready")
    approved = Column(Boolean, default=False)
    executed_at = Column(DateTime(timezone=True), nullable=True)
    recovered_amount = Column(Float, default=0.0)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    actor = Column(String, default="System")
    event_type = Column(String, nullable=False)
    description = Column(String, nullable=False)
    incident_id = Column(String, nullable=True)
    transaction_id = Column(String, nullable=True)
    result = Column(String, default="Success")
    extra_data = Column("metadata", JSON, default=dict)


class Settings(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    merchant_name = Column(String, default="Demo Commerce Pvt. Ltd.")
    max_retry_attempts = Column(Integer, default=2)
    min_transaction_amount = Column(Float, default=500.0)
    risk_threshold = Column(String, default="High")
    failure_threshold = Column(Float, default=0.12)
    human_approval_required = Column(Boolean, default=True)
    notification_email = Column(String, default="ops@demo-commerce.com")
    ai_provider = Column(String, default="Local Deterministic Engine")
