from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter, Depends, Header
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.errors import ledger_error_response, not_found
from app.core.models import Account, LedgerEntry
from app.core.security import get_current_user_id
from app.ledger.engine import LedgerError
from app.modules.ledger_api.service import NotFound, get_savings, get_wallet, post_entry

router = APIRouter(prefix="/savings", tags=["savings"])


class MoveIn(BaseModel):
    amount_cents: int
    source_account_id: str | None = None  # wallet if None


class MoveOut(BaseModel):
    amount_cents: int


class LockIn(BaseModel):
    lock_until: date | None  # None = remove lock


class SavingsOut(BaseModel):
    balance_cents: int
    lock_until: str | None
    history: list[dict]


@router.get("", response_model=SavingsOut)
async def get_savings_state(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> SavingsOut:
    savings = await get_savings(db, user_id)
    entries = (await db.scalars(
        select(LedgerEntry)
        .where(
            LedgerEntry.user_id == user_id,
            (LedgerEntry.from_account_id == savings.id) | (LedgerEntry.to_account_id == savings.id),
        )
        .order_by(LedgerEntry.created_at.desc())
        .limit(50)
    )).all()
    return SavingsOut(
        balance_cents=savings.balance_cents,
        lock_until=str(savings.lock_until) if savings.lock_until else None,
        history=[
            {
                "id": e.id,
                "kind": e.kind,
                "amount_cents": e.amount_cents,
                "created_at": e.created_at.isoformat(),
            }
            for e in entries
        ],
    )


@router.post("/move-in")
async def move_in(
    body: MoveIn,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> dict:
    key = idempotency_key or str(uuid.uuid4())
    try:
        savings = await get_savings(db, user_id)
        if body.source_account_id:
            source = await db.scalar(
                select(Account).where(Account.id == body.source_account_id, Account.user_id == user_id)
            )
            if not source:
                raise not_found("Source account not found.")
        else:
            source = await get_wallet(db, user_id)

        entry = await post_entry(db, user_id, "save", source.id, savings.id, body.amount_cents, key)
        await db.commit()
        await db.refresh(savings)
        return {"entry_id": entry.id, "savings": {"balance_cents": savings.balance_cents}}
    except LedgerError as e:
        return ledger_error_response(e)
    except NotFound:
        raise not_found("Account not found.")


@router.post("/move-out")
async def move_out(
    body: MoveOut,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> dict:
    key = idempotency_key or str(uuid.uuid4())
    try:
        savings = await get_savings(db, user_id)
        wallet = await get_wallet(db, user_id)
        entry = await post_entry(db, user_id, "unsave", savings.id, wallet.id, body.amount_cents, key)
        await db.commit()
        await db.refresh(savings)
        await db.refresh(wallet)
        return {
            "entry_id": entry.id,
            "savings": {"balance_cents": savings.balance_cents},
            "wallet": {"balance_cents": wallet.balance_cents},
        }
    except LedgerError as e:
        return ledger_error_response(e)
    except NotFound:
        raise not_found("Account not found.")


@router.put("/lock")
async def set_lock(
    body: LockIn,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> dict:
    savings = await get_savings(db, user_id)
    savings.lock_until = body.lock_until
    await db.commit()
    return {"lock_until": str(savings.lock_until) if savings.lock_until else None}
