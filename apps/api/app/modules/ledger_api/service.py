"""Ledger service — the single posting function.

All money movement goes through post_entry().
Nothing else may change a balance.
"""

from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import cast, Enum

from app.core.models import Account, LedgerEntry, Loan
from app.ledger.engine import (
    InsufficientFunds,
    InsufficientWalletFunds,
    SavingsLocked,
)


class NotFound(Exception):
    pass


async def post_entry(
    session: AsyncSession,
    user_id: str,
    kind: str,
    from_id: str | None,
    to_id: str | None,
    amount_cents: int,
    key: str,
    note_enc: bytes | None = None,
    loan_id: str | None = None,
) -> LedgerEntry:
    """
    Atomically move money. Raises on any rule break.
    Retrying with the same key is safe (idempotent).
    """
    # Idempotency check
    existing = await session.scalar(
        select(LedgerEntry).where(
            LedgerEntry.user_id == user_id,
            LedgerEntry.idempotency_key == key,
        )
    )
    if existing:
        return existing

    # Lock accounts in a fixed order to prevent deadlocks
    ids = sorted({i for i in (from_id, to_id) if i})
    rows = (
        await session.scalars(
            select(Account)
            .where(Account.id.in_(ids), Account.user_id == user_id)
            .order_by(Account.id)
            .with_for_update()
        )
    ).all()

    acc: dict[str, Account] = {a.id: a for a in rows}
    if len(acc) != len(ids):
        raise NotFound()

    # Rule checks and balance mutations
    if from_id:
        src = acc[from_id]
        if src.kind == "savings" and src.lock_until and src.lock_until > date.today():
            raise SavingsLocked(src.lock_until)
        if src.balance_cents < amount_cents:
            if src.kind == "wallet":
                raise InsufficientWalletFunds(available=src.balance_cents, requested=amount_cents)
            raise InsufficientFunds(available=src.balance_cents, requested=amount_cents)
        src.balance_cents -= amount_cents
        src.version += 1

    if to_id:
        dst = acc[to_id]
        dst.balance_cents += amount_cents
        dst.version += 1

    # Envelope bookkeeping
    if kind == "allocate" and to_id:
        acc[to_id].funded_cents += amount_cents
    if kind == "spend" and from_id:
        acc[from_id].spent_cents += amount_cents

    # Loan bookkeeping
    if kind == "loan_payment" and loan_id:
        loan = await session.get(Loan, loan_id)
        if loan and loan.user_id == user_id:
            loan.owed_cents = max(0, loan.owed_cents - amount_cents)

    entry = LedgerEntry(
        user_id=user_id,
        kind=kind,
        from_account_id=from_id,
        to_account_id=to_id,
        amount_cents=amount_cents,
        note_enc=note_enc,
        idempotency_key=key,
    )
    session.add(entry)
    return entry  # caller commits


async def get_wallet(session: AsyncSession, user_id: str) -> Account:
    acc = await session.scalar(
        select(Account).where(
            Account.user_id == user_id,
            cast(Account.kind, Enum("wallet", "savings", "envelope", name="account_kind")) == "wallet"
        )
    )
    if not acc:
        raise NotFound()
    return acc


async def get_savings(session: AsyncSession, user_id: str) -> Account:
    acc = await session.scalar(
        select(Account).where(
            Account.user_id == user_id,
            cast(Account.kind, Enum("wallet", "savings", "envelope", name="account_kind")) == "savings"
        )
    )
    if not acc:
        raise NotFound()
    return acc


async def get_envelope(session: AsyncSession, user_id: str, envelope_id: str) -> Account:
    acc = await session.scalar(
        select(Account).where(
            Account.id == envelope_id,
            Account.user_id == user_id,
            cast(Account.kind, Enum("wallet", "savings", "envelope", name="account_kind")) == "envelope",
            Account.archived_at.is_(None),
        )
    )
    if not acc:
        raise NotFound()
    return acc
