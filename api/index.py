"""Vercel serverless entrypoint for the existing FastAPI application."""
import os
from pathlib import Path
import shutil
import sys

BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Vercel functions may read the deployed bundle but cannot write alongside it.
# The application uses SQLite when DATABASE_URL is absent, so copy the included
# demo database into the function's writable temporary directory before FastAPI
# (and SQLAlchemy) are imported. A configured PostgreSQL/Neon URL always wins.
if not os.environ.get("DATABASE_URL") and os.environ.get("VERCEL"):
    demo_database = BACKEND_DIR / "recoverai.db"
    runtime_database = Path("/tmp/recoverai.db")
    if demo_database.exists() and not runtime_database.exists():
        shutil.copy2(demo_database, runtime_database)
    os.environ["DATABASE_URL"] = f"sqlite:///{runtime_database.as_posix()}"

from app.main import app
