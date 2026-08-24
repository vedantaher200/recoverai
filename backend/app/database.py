import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./recoverai.db")
# SQLite needs this flag for local FastAPI threads; managed PostgreSQL must not
# receive SQLite-specific connection options.
engine_options = {"pool_pre_ping": True}
if DATABASE_URL.startswith("sqlite"):
    engine_options["connect_args"] = {"check_same_thread": False}
engine = create_engine(DATABASE_URL, **engine_options)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    from app.models import AdminProfile, AuditLog, Incident, RecoveryAction, Settings, Transaction

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
        profile = db.query(AdminProfile).first()
        if not profile:
            db.add(AdminProfile(full_name="Vedant Aher", email="vedantaher2003@gmail.com"))
            db.commit()
        elif profile.full_name == "RecoverAI Administrator" and profile.email == "admin@recoverai.demo":
            # Migrate the prior seeded demo identity without touching user-edited profiles.
            profile.full_name = "Vedant Aher"
            profile.email = "vedantaher2003@gmail.com"
            db.commit()
        # Fresh installs are immediately demo-ready without manual seeding.
        if db.query(Transaction).count() < 5000:
            from scripts.generate_data import generate_transactions, seed_incidents, seed_recovery_actions
            generate_transactions(db)
            seed_incidents(db)
            seed_recovery_actions(db)
    finally:
        db.close()
