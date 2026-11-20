# ADR-002: Tech stack

**Date:** 2026-10-29  
**Status:** Decided

## Decisions

| Layer | Choice | Reason |
|---|---|---|
| Backend language | Python 3.12 | Readable, strong testing, large Kenyan developer pool |
| API | FastAPI + Pydantic v2 | Fast, typed, auto-generates OpenAPI docs |
| Database | PostgreSQL 16 | Money needs transactions and constraints |
| ORM + migrations | SQLAlchemy 2 async + Alembic | Safe parameterised queries, versioned schema |
| Queue + cache | Redis + Celery | Reminders, retries, rate limiting |
| Auth | OTP (SMS/email) → JWT access + rotating refresh | Matches how Kenyans sign in |
| Client | PWA (React + TypeScript + IndexedDB) | Offline-first, installable, no app store needed for MVP |
| Testing | pytest + Hypothesis + Playwright | Ledger must never be wrong |

## Client framework: React (not Svelte)

React chosen over Svelte for:
- Larger ecosystem and more Kenyan developers familiar with it
- Better PWA tooling (Vite + Workbox)
- Easier to hire for

Switch to native (Flutter/React Native) only if the PWA hits real limits.
