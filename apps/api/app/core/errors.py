"""Shared error shapes and helpers.

All errors follow: {"error": {"code": "...", "message": "...", "details": {...}}}
"""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException, Request, status
from fastapi.responses import JSONResponse

from app.ledger.engine import (
    InsufficientFunds,
    InsufficientWalletFunds,
    LedgerError,
    SavingsLocked,
)


def error_body(code: str, message: str, details: dict[str, Any] | None = None) -> dict[str, Any]:
    return {"error": {"code": code, "message": message, "details": details or {}}}


def ledger_error_response(exc: LedgerError) -> JSONResponse:
    if isinstance(exc, InsufficientWalletFunds):
        body = error_body(
            exc.code,
            "The wallet holds less than the amount requested.",
            {"requested_cents": exc.requested, "available_cents": exc.available},
        )
    elif isinstance(exc, InsufficientFunds):
        body = error_body(
            exc.code,
            "That envelope does not have enough money.",
            {"requested_cents": exc.requested, "available_cents": exc.available},
        )
    elif isinstance(exc, SavingsLocked):
        body = error_body(
            exc.code,
            f"Savings are locked until {exc.locked_until}.",
            {"locked_until": str(exc.locked_until)},
        )
    else:
        body = error_body(exc.code, str(exc))
    return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content=body)


async def ledger_exception_handler(request: Request, exc: LedgerError) -> JSONResponse:
    return ledger_error_response(exc)


def not_found(detail: str = "Not found") -> HTTPException:
    return HTTPException(status_code=404, detail=error_body("NOT_FOUND", detail))


def plan_limit_reached(detail: str) -> HTTPException:
    return HTTPException(
        status_code=403,
        detail=error_body("PLAN_LIMIT_REACHED", detail),
    )
