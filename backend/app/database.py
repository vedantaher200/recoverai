import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./recoverai.db")
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    from app.models import AuditLog, Incident, RecoveryAction, Settings, Transaction

    Base.metadata.create_all(bind=engine)
    
    # Seed default settings if not exist
    db = SessionLocal()
    try:
        settings = db.query(Settings).first()
        if not settings:
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
    finally:
        db.close()
