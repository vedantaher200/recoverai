# RecoverAI

RecoverAI is an AI-powered payment revenue recovery platform designed for the Razorpay Buildathon 2026 AI Revenue Recovery track. It detects payment failures, identifies their root causes, estimates revenue at risk, recommends bounded recovery actions, simulates execution safely, and creates a full audit trail.

This implementation uses synthetic payment data and simulated recovery execution only. It does not process real financial transactions or recover real money.

## Problem Statement

Online merchants lose revenue when payments fail for reasons such as gateway degradation, bank declines, subscription payment issues, and retryable errors. Without visibility into failure patterns, a merchant cannot decide which failed transactions are recoverable and which recovery actions are safe.

## Solution

RecoverAI combines deterministic analytics with an AI-style decision engine to:

- monitor payment failure patterns,
- identify dominant root causes,
- calculate revenue at risk,
- find eligible transactions,
- recommend safe recovery strategies,
- simulate recovery execution without executing real payments,
- record a complete audit trail for compliance and review.

## Key Features

- Dashboard with KPIs and trends
- Transaction search, filter, and detail views
- AI Recovery Agent with an observe → reason → decide → act → verify lifecycle
- Incident detection and management
- Recovery Center with recovery opportunities
- Analytics panels using Recharts
- SQLite-backed persistence
- Safety policies for retry attempts and high-risk transactions
- Demo mode with a known gateway-degradation incident

## Architecture

- Frontend: React + Vite + React Router + Recharts + Axios
- Backend: FastAPI + SQLAlchemy + SQLite + Pydantic
- AI layer: local deterministic decision engine with optional external LLM integration via environment variable
- Data layer: synthetic transaction generation and database seeding

## Technology Stack

- React
- Vite
- JavaScript
- React Router
- Axios
- Recharts
- Lucide React
- FastAPI
- SQLAlchemy
- SQLite
- Pandas
- NumPy

## AI Workflow

OBSERVE → REASON → DECIDE → ACT → VERIFY

1. Observe transaction patterns and failure spikes
2. Reason over root causes and affected gateways
3. Decide the likely revenue risk and action
4. Act through a safe simulated recovery workflow
5. Verify recovery metrics and log every event

## Recovery Workflow

Payment Data → Observe → Detect Revenue Risk → Analyze Failure Pattern → Identify Root Cause → Calculate Revenue at Risk → Select Recovery Strategy → Validate Eligibility → Review Recovery Action → Execute Safe Simulation → Measure Revenue Recovered → Create Audit Trail

## Safety Rules

The system enforces safe backend rules:

- maximum 2 retry attempts
- only eligible transactions may be retried
- successful transactions are never retried
- high-risk transactions are blocked
- recovery stops when the configured failure threshold is exceeded
- every action is logged with actor, event, and result metadata
- human approval is required before execution

## Synthetic Data

The application uses synthetic data only. Demo transactions include realistic trends such as gateway timeout spikes, bank decline patterns, subscription payment issues, and checkout abandonment. This allows full local demo operation without exposing real customer financial information.

## Local Setup

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Environment Variables

Copy the root `.env.example` to `.env` for a local configuration. The backend also accepts a `backend/.env` file for backward-compatible local development.

```env
DATABASE_URL=sqlite:///./recoverai.db
APP_ENV=development
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:5176,http://127.0.0.1:5176
VITE_API_BASE_URL=
```

`DATABASE_URL` may use a managed PostgreSQL database in production (for example `postgresql+psycopg://...`). Leave `VITE_API_BASE_URL` blank on Vercel to use same-origin `/api` routes.

## Vercel Deployment

The included `vercel.json` explicitly selects Vite for the frontend, installs and builds it from `frontend/`, and bundles `backend/` with the FastAPI serverless function. The SPA fallback intentionally excludes `/api/*`, which Vercel routes to `api/index.py`.

1. Push this repository to GitHub and import it in Vercel. Keep the Vercel project root at the repository root.
2. Create or connect a persistent PostgreSQL database (Vercel Postgres or another managed provider).
3. Create a Neon project, select **Connect**, enable **Connection pooling**, and copy its connection string. In Vercel **Settings → Environment Variables**, add it as `DATABASE_URL` for Production, Preview, and Development. Replace the scheme with `postgresql+psycopg://`, keeping the `-pooler` hostname plus `sslmode=require` and `channel_binding=require` query parameters. If using Vercel Postgres instead, its `POSTGRES_URL` is also detected automatically. Without either variable, RecoverAI runs its synthetic demo using a SQLite database in Vercel's temporary function storage; it resets when the instance is replaced.
4. Optionally set `APP_ENV=production`. Leave `VITE_API_BASE_URL` blank for this single Vercel deployment, since the client uses same-origin `/api` requests.
5. Deploy. The first API request creates the tables and seeds the synthetic demo data.

Set `CORS_ORIGINS` only when the frontend is hosted separately from the API. Add the exact frontend origin, for example `https://your-app.vercel.app`.

## API Documentation

FastAPI auto-generates OpenAPI docs at:

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Demo Instructions

1. Start backend and frontend.
2. Open the Dashboard.
3. Review the revenue-risk KPIs and chart.
4. Open AI Recovery Agent.
5. Click Analyze.
6. Confirm the detected gateway degradation incident.
7. Review the recovery plan.
8. Approve and execute the simulated recovery.
9. Open Audit Trail to review all decisions and results.

## Future Improvements

- integrate real LLM provider abstraction for deeper explanations,
- add merchant account management and role-based access,
- expand analytics with historical trend forecasting,
- support multiple payment gateways and richer incident taxonomy,
- connect to real payment event streams in a production environment.

## Important Note

This project is a demo-grade fintech prototype built for local testing and presentation. It simulates recovery actions and uses synthetic data only.
