from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, cast, Enum
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.errors import ledger_error_response, not_found
from app.core.models import Account, LedgerEntry, Loan, User
from app.core.security import get_current_user_id
from app.ledger.engine import LedgerError
from app.modules.ledger_api import schemas
from app.modules.ledger_api.service import (
    NotFound,
    get_envelope,
    get_savings,
    get_wallet,
    post_entry,
)

router = APIRouter(tags=["ledger"])

ACCOUNT_KIND = cast(Account.kind, Enum("wallet", "savings", "envelope", name="account_kind"))


# ---------------------------------------------------------------------------
# Shared input/output models
# ---------------------------------------------------------------------------

class DepositIn(BaseModel):
    amount_cents: int
    note: str | None = None


class AllocateIn(BaseModel):
    envelope_id: str
    amount_cents: int
    note: str | None = None


class ReleaseIn(BaseModel):
    envelope_id: str
    amount_cents: int
    note: str | None = None


class SpendIn(BaseModel):
    account_id: str  # envelope or wallet id
    amount_cents: int
    note: str | None = None


class EntryOut(BaseModel):
    entry_id: str
    created_at: str


def _note_bytes(note: str | None) -> bytes | None:
    return note.encode() if note else None


def _require_key(idempotency_key: str | None) -> str:
    if not idempotency_key:
        raise HTTPException(status_code=400, detail={"code": "VALIDATION_ERROR", "message": "Idempotency-Key header required."})
    return idempotency_key


# ---------------------------------------------------------------------------
# POST /ledger/deposit
# ---------------------------------------------------------------------------

@router.post("/ledger/deposit")
async def deposit(
    body: DepositIn,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> dict:
    key = _require_key(idempotency_key)
    try:
        wallet = await get_wallet(db, user_id)
        entry = await post_entry(db, user_id, "deposit", None, wallet.id, body.amount_cents, key, _note_bytes(body.note))
        await db.commit()
        await db.refresh(wallet)
        return {"entry_id": entry.id, "wallet": {"balance_cents": wallet.balance_cents}, "created_at": entry.created_at.isoformat()}
    except LedgerError as e:
        return ledger_error_response(e)
    except NotFound:
        raise not_found("Wallet not found.")


# ---------------------------------------------------------------------------
# POST /ledger/allocate
# ---------------------------------------------------------------------------

@router.post("/ledger/allocate")
async def allocate(
    body: AllocateIn,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> dict:
    key = _require_key(idempotency_key)
    try:
        wallet = await get_wallet(db, user_id)
        envelope = await get_envelope(db, user_id, body.envelope_id)
        entry = await post_entry(db, user_id, "allocate", wallet.id, envelope.id, body.amount_cents, key, _note_bytes(body.note))
        await db.commit()
        await db.refresh(wallet)
        await db.refresh(envelope)
        return {
            "entry_id": entry.id,
            "envelope": {"id": envelope.id, "balance_cents": envelope.balance_cents, "funded_cents": envelope.funded_cents},
            "wallet": {"balance_cents": wallet.balance_cents},
            "created_at": entry.created_at.isoformat(),
        }
    except LedgerError as e:
        return ledger_error_response(e)
    except NotFound:
        raise not_found("Account not found.")


# ---------------------------------------------------------------------------
# POST /ledger/release
# ---------------------------------------------------------------------------

@router.post("/ledger/release")
async def release(
    body: ReleaseIn,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> dict:
    key = _require_key(idempotency_key)
    try:
        wallet = await get_wallet(db, user_id)
        envelope = await get_envelope(db, user_id, body.envelope_id)
        entry = await post_entry(db, user_id, "release", envelope.id, wallet.id, body.amount_cents, key, _note_bytes(body.note))
        await db.commit()
        await db.refresh(wallet)
        await db.refresh(envelope)
        return {
            "entry_id": entry.id,
            "envelope": {"id": envelope.id, "balance_cents": envelope.balance_cents},
            "wallet": {"balance_cents": wallet.balance_cents},
            "created_at": entry.created_at.isoformat(),
        }
    except LedgerError as e:
        return ledger_error_response(e)
    except NotFound:
        raise not_found("Account not found.")


# ---------------------------------------------------------------------------
# POST /ledger/spend
# ---------------------------------------------------------------------------

@router.post("/ledger/spend")
async def spend(
    body: SpendIn,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> dict:
    key = _require_key(idempotency_key)
    try:
        acc = await db.scalar(
            select(Account).where(Account.id == body.account_id, Account.user_id == user_id)
        )
        if not acc:
            raise not_found("Account not found.")
        entry = await post_entry(db, user_id, "spend", acc.id, None, body.amount_cents, key, _note_bytes(body.note))
        await db.commit()
        await db.refresh(acc)
        return {
            "entry_id": entry.id,
            "account": {"id": acc.id, "balance_cents": acc.balance_cents, "spent_cents": acc.spent_cents},
            "created_at": entry.created_at.isoformat(),
        }
    except LedgerError as e:
        return ledger_error_response(e)


# ---------------------------------------------------------------------------
# POST /ledger/fund-all
# ---------------------------------------------------------------------------

@router.post("/ledger/fund-all")
async def fund_all(
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> dict:
    key_prefix = _require_key(idempotency_key)
    try:
        wallet = await get_wallet(db, user_id)
        envelopes = (await db.scalars(
            select(Account)
            .where(Account.user_id == user_id, ACCOUNT_KIND == "envelope", Account.archived_at.is_(None))
            .order_by(Account.sort_order)
        )).all()

        funded: list[dict] = []
        short: list[dict] = []

        for i, env in enumerate(envelopes):
            needed = max(0, env.plan_cents - env.funded_cents)
            if needed == 0:
                continue
            can_give = min(needed, wallet.balance_cents)
            if can_give > 0:
                sub_key = f"{key_prefix}:{i}"
                await post_entry(db, user_id, "allocate", wallet.id, env.id, can_give, sub_key)
                funded.append({"envelope_id": env.id, "amount_cents": can_give})
            shortfall = needed - can_give
            if shortfall > 0:
                short.append({"envelope_id": env.id, "short_cents": shortfall})
            if wallet.balance_cents == 0:
                # Mark remaining as short
                for rem in envelopes[i + 1:]:
                    rem_needed = max(0, rem.plan_cents - rem.funded_cents)
                    if rem_needed > 0:
                        short.append({"envelope_id": rem.id, "short_cents": rem_needed})
                break

        await db.commit()
        await db.refresh(wallet)
        return {"wallet_cents": wallet.balance_cents, "funded": funded, "short": short}
    except LedgerError as e:
        return ledger_error_response(e)


# ---------------------------------------------------------------------------
# GET /ledger — history with cursor pagination
# ---------------------------------------------------------------------------

@router.get("/ledger")
async def get_ledger(
    limit: int = Query(default=50, le=200),
    cursor: str | None = Query(default=None),
    envelope_id: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> dict:
    q = select(LedgerEntry).where(LedgerEntry.user_id == user_id)
    if envelope_id:
        q = q.where(
            (LedgerEntry.from_account_id == envelope_id) | (LedgerEntry.to_account_id == envelope_id)
        )
    if cursor:
        q = q.where(LedgerEntry.created_at < cursor)
    q = q.order_by(LedgerEntry.created_at.desc()).limit(limit + 1)

    entries = (await db.scalars(q)).all()
    has_more = len(entries) > limit
    items = entries[:limit]

    return {
        "items": [
            {
                "id": e.id,
                "kind": e.kind,
                "from_account_id": e.from_account_id,
                "to_account_id": e.to_account_id,
                "amount_cents": e.amount_cents,
                "note_enc": e.note_enc.hex() if e.note_enc else None,
                "created_at": e.created_at.isoformat(),
            }
            for e in items
        ],
        "next_cursor": items[-1].created_at.isoformat() if has_more and items else None,
    }


# ---------------------------------------------------------------------------
# GET /summary
# ---------------------------------------------------------------------------

@router.get("/summary", response_model=schemas.SummaryOut)
async def summary(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> schemas.SummaryOut:
    user = await db.get(User, user_id)
    accounts = (await db.scalars(
        select(Account).where(Account.user_id == user_id, Account.archived_at.is_(None))
    )).all()

    wallet_cents = next((a.balance_cents for a in accounts if a.kind == "wallet"), 0)
    savings_cents = next((a.balance_cents for a in accounts if a.kind == "savings"), 0)
    envelopes = [a for a in accounts if a.kind == "envelope"]
    envelopes_total = sum(e.balance_cents for e in envelopes)

    bank_balance = wallet_cents + envelopes_total + savings_cents

    # Owed = sum of all loan owed_cents
    loans = (await db.scalars(select(Loan).where(Loan.user_id == user_id))).all()
    total_owed = sum(l.owed_cents for l in loans)

    monthly_plan = sum(e.plan_cents for e in envelopes)
    still_to_fund = sum(max(0, e.plan_cents - e.funded_cents) for e in envelopes)

    return schemas.SummaryOut(
        bank_balance_cents=bank_balance,
        wallet_cents=wallet_cents,
        envelopes_total_cents=envelopes_total,
        savings_cents=savings_cents,
        total_owed_cents=total_owed,
        net_position_cents=bank_balance - total_owed,
        monthly_plan_cents=monthly_plan,
        still_to_fund_cents=still_to_fund,
        currency=user.currency if user else "KES",
    )
