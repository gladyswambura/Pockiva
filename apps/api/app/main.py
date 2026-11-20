from contextlib import asynccontextmanager
from typing import AsyncGenerator

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.db import engine
from app.core.logging import configure_logging

configure_logging(settings.app_env)
log = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    log.info("pockiva_api_starting", env=settings.app_env)
    yield
    await engine.dispose()
    log.info("pockiva_api_stopped")


app = FastAPI(
    title="Pockiva API",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers — imported here to avoid circular imports
from app.modules.auth.router import router as auth_router  # noqa: E402
from app.modules.envelopes.router import router as envelopes_router  # noqa: E402
from app.modules.envelopes.goals_router import router as goals_router  # noqa: E402
from app.modules.ledger_api.router import router as ledger_router  # noqa: E402
from app.modules.loans.router import router as loans_router  # noqa: E402
from app.modules.savings.router import router as savings_router  # noqa: E402
from app.modules.subscriptions.router import router as subscriptions_router  # noqa: E402
from app.modules.notifications.router import router as notifications_router  # noqa: E402
from app.modules.admin.router import router as admin_router  # noqa: E402

PREFIX = "/api/v1"

app.include_router(auth_router, prefix=PREFIX)
app.include_router(envelopes_router, prefix=PREFIX)
app.include_router(ledger_router, prefix=PREFIX)
app.include_router(loans_router, prefix=PREFIX)
app.include_router(savings_router, prefix=PREFIX)
app.include_router(subscriptions_router, prefix=PREFIX)
app.include_router(notifications_router, prefix=PREFIX)
app.include_router(goals_router, prefix=PREFIX)
app.include_router(admin_router, prefix="/admin/v1")


@app.get("/health", tags=["system"])
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "pockiva-api"}


@app.get("/api/v1/summary-health", tags=["system"])
async def api_health() -> dict[str, str]:
    return {"status": "ok"}
