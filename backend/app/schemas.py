from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class TransactionBase(BaseModel):
    transaction_id: str
    timestamp: datetime
    customer_name: str
    amount: float
    currency: str = "INR"
    status: str
    gateway: str
    failure_reason: str = "None"
    retry_count: int = 0
    subscription: bool = False
    recovery_eligible: bool = False
    risk_level: str = "Low"
    recovery_status: str = "Not Required"


class TransactionRead(TransactionBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


class IncidentBase(BaseModel):
    incident_id: str
    title: str
    severity: str = "Medium"
    detected_at: datetime
    root_cause: str = "Unknown"
    confidence: float = 0.0
    revenue_at_risk: float = 0.0
    affected_transactions: int = 0
    eligible_transactions: int = 0
    status: str = "Open"
    recommended_action: str = "Review"
    recovered_amount: float = 0.0
    metadata: Dict[str, Any] = Field(default_factory=dict, alias="extra_data")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class IncidentRead(IncidentBase):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
    id: int

    @field_validator('metadata', mode='before')
    @classmethod
    def validate_metadata(cls, v):
        if v is None:
            return {}
        if isinstance(v, dict):
            return v
        return {}


class AuditLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
    id: int
    timestamp: datetime
    actor: str
    event_type: str
    description: str
    incident_id: Optional[str] = None
    transaction_id: Optional[str] = None
    result: str = "Success"
    metadata: Dict[str, Any] = Field(default_factory=dict, alias="extra_data")

    @field_validator('metadata', mode='before')
    @classmethod
    def validate_metadata(cls, v):
        if v is None:
            return {}
        if isinstance(v, dict):
            return v
        return {}


class SettingsRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    merchant_name: str
    max_retry_attempts: int
    min_transaction_amount: float
    risk_threshold: str
    failure_threshold: float
    human_approval_required: bool
    notification_email: str
    ai_provider: str


class SettingsUpdate(BaseModel):
    merchant_name: Optional[str] = None
    max_retry_attempts: Optional[int] = None
    min_transaction_amount: Optional[float] = None
    risk_threshold: Optional[str] = None
    failure_threshold: Optional[float] = None
    human_approval_required: Optional[bool] = None
    notification_email: Optional[str] = None
    ai_provider: Optional[str] = None


class AnalyzeRequest(BaseModel):
    incident_id: Optional[str] = None


class RecoveryPreviewRequest(BaseModel):
    incident_id: Optional[str] = None
    strategy: str = "Retry eligible transactions"


class RecoveryExecuteRequest(BaseModel):
    incident_id: str
    strategy: str = "Retry eligible transactions"
    approved: bool = False
    actor: str = "Merchant"


class RecoveryOpportunity(BaseModel):
    opportunity: str
    transactions: int
    revenue_at_risk: float
    expected_recovery: str
    strategy: str
    risk: str
    status: str


class HealthResponse(BaseModel):
    status: str
    mode: str
    database: str
