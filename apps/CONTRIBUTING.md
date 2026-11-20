# Local native development — no Docker required

## First-time setup (one-time, ~5 minutes)

### 1. Backend (FastAPI + SQLite)

```powershell
# From the repo root: install runtime dependencies into the shared venv
.venv\Scripts\python.exe -m pip install fastapi "uvicorn[standard]" "pydantic>=2.7" "pydantic-settings>=2.2" "sqlalchemy[asyncio]>=2.0" "alembic>=1.13" aiosqlite "python-jose[cryptography]" "passlib[bcrypt]" "bcrypt<4" "cryptography>=42" "httpx>=0.27" "structlog>=24.1" "python-multipart" africastalking pywebpush celery
```

`apps/api/.env` is already configured for SQLite:

```
DATABASE_URL=sqlite+aiosqlite:///./pockiva_local.db
```

Create the tables (idempotent — safe to re-run):

```powershell
cd apps\api
$env:PYTHONPATH='.'
..\..\.venv\Scripts\python.exe -m alembic upgrade head
```

### 2. Frontend (Vite dev server)

```powershell
cd apps\web
npm install        # first time only
npm run dev        # serves http://localhost:5173
```

Vite proxies `/api` and `/admin/v1` to `http://localhost:8000`, so the SPA needs no CORS setup.

## Everyday run (after the one-time setup)

Two terminals, always in this order:

```powershell
# Terminal 1 — API (must be running before signing in)
cd C:\Users\gladyswahito\Documents\Pockiva\apps\api
$env:PYTHONPATH='.'
..\..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

```powershell
# Terminal 2 — web app
cd C:\Users\gladyswahito\Documents\Pockiva\apps\web
npm run dev
```

Then open http://localhost:5173.

## How OTP works locally (no SMS/email credentials)

`request_otp` returns the plaintext code in the API response (HTTP 202). When SMS (Africa's Talking) or SMTP credentials are absent, the send is skipped and the code is only visible:

- in the API response JSON (`code` field), and
- in the `otp_tokens` table (`code_hash` — hashed, so use the response value).

To sign in with an email: request a code (the UI shows "code sent"), read the `code` from the response, and enter it in the app.

## What still needs Docker (optional, not required for local dev)

- **Celery workers + Redis** (scheduled reminders/dunning). The API runs without them; scheduled notification tasks simply don't fire.
- **PostgreSQL** — production-equivalent database. SQLite is used for local development.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Could not send code (HTTP 502). Check the API connection.` | The API is not running. Start Terminal 1 above and confirm `http://localhost:8000/health` returns `{"status":"ok"}`. |
| `ModuleNotFoundError` from uvicorn | Re-run the pip install command in step 1. |
| OTP request times out | SMTP is unconfigured and the mail server is unreachable — harmless; the code is still returned in the response. |
| Port 8000 already in use | Another API instance is running (`Get-Process python \| Stop-Process`) or Docker's API container is up (`docker compose -f infra/docker-compose.yml down`). |