# Pockiva

Privacy-first envelope budgeting for Kenya.

## Quick start

```bash
docker compose -f infra/docker-compose.yml up -d db redis api
docker compose -f infra/docker-compose.yml exec api alembic upgrade head
cd apps/web && npm install && npm run dev
```

Start Docker Desktop before running Compose. The API container serves the web app through the Vite development proxy at `http://localhost:5173`. If you run the API directly on the host instead, copy `apps/api/.env.example` to `apps/api/.env`, install `apps/api` with its dev extras, run `alembic upgrade head`, then run Uvicorn from the `apps/api` directory.

## Structure

```
pockiva/
  apps/api/          FastAPI service (Python 3.12)
  apps/web/          Customer PWA (TypeScript + React)
  apps/admin/        Admin console
  packages/design-tokens/  Shared colours, spacing, icons
  docs/              ADRs, OpenAPI export, runbooks
  infra/             Docker Compose, deployment
```

## Parts built so far

- **Part 1** — Foundations: ledger core, DB schema, migrations, acceptance tests, docker compose
- **Part 2** — API layer: auth, envelopes, ledger endpoints, savings, loans, summary
- **Part 3** — PWA: React app, all screens, offline support, client-side encryption
- **Part 4** — Notifications, subscriptions, admin console

## Local admin console

The admin UI is available at `http://localhost:5173/admin` while the web dev server is running. It uses the normal OTP identity flow, but only accounts explicitly listed in `ADMIN_USER_IDS` are authorised for admin API access.

When running the API on the host, use `localhost` for the database and Redis URLs in `apps/api/.env`. Docker Compose overrides those URLs with its internal service names.

1. Start the database and API using the Quick start steps above, then start the web app with `cd apps/web && npm install && npm run dev`.
2. Open `/admin`, enter the email or phone number for the admin account, and request a code. With `APP_ENV=local`, the API displays the development verification code in the page.
3. Verify the code. If this account is not allowlisted yet, the page reports its user ID.
4. Add that ID to `ADMIN_USER_IDS` in `apps/api/.env`, then restart the API and sign in again.

The console shows user/payment metrics, limited account lookup data and recent admin audit activity. It intentionally excludes customer envelope names and notes. Do not use the development OTP-code response or example secrets in production; production OTP delivery and admin access controls must be configured first.

## Ledger invariant

`Bank balance = Wallet + Σ envelopes + Savings`

All money is stored as integer cents. No floats.
