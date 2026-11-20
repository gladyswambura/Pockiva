from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Header
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.errors import ledger_error_response, not_found
from app.core.models import Account, Loan
from app.core.security import get_current_user_id
from app.ledger.engine import LedgerError
from app.modules.ledger_api.service import NotFound, get_wallet, post_entry

router = APIRouter(prefix="/loans", tags=["loans"])


class LoanCreateIn(BaseModel):
    lender_enc: str | None = None   # hex ciphertext
    borrowed_cents: int
    total_repay_cents: int
    monthly_cents: int = 0
    due_day: int | None = None
    ring_fence: bool = True
    color: str | None = None
    icon: str | None = None
    name_enc: str | None = None     # envelope name ciphertext

    @field_validator("borrowed_cents", "total_repay_cents", "monthly_cents")
    @classmethod
    def positive(cls, v: int) -> int:
        if v < 0:
            raise ValueError("Must be non-negative.")
        return v


class LoanPayIn(BaseModel):
    amount_cents: int


class LoanOut(BaseModel):
    id: str
    account_id: str
    lender_enc: str | None
    borrowed_cents: int
    total_repay_cents: int
    owed_cents: int
    monthly_cents: int
    due_day: int | None
    envelope_balance_cents: int
    created_at: str


@router.get("", response_model=list[LoanOut])
async def list_loans(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> list[LoanOut]:
    loans = (await db.scalars(select(Loan).where(Loan.user_id == user_id))).all()
    result = []
    for loan in loans:
        env = await db.get(Account, loan.account_id)
        result.append(LoanOut(
            id=loan.id,
            account_id=loan.account_id,
            lender_enc=loan.lender_enc.hex() if loan.lender_enc else None,
            borrowed_cents=loan.borrowed_cents,
            total_repay_cents=loan.total_repay_cents,
            owed_cents=loan.owed_cents,
            monthly_cents=loan.monthly_cents,
            due_day=loan.due_day,
            envelope_balance_cents=env.balance_cents if env else 0,
            created_at=loan.created_at.isoformat(),
        ))
    return result


@router.post("", status_code=201)
async def create_loan(
    body: LoanCreateIn,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> dict:
    if body.total_repay_cents < body.borrowed_cents:
        return {"error": {"code": "VALIDATION_ERROR", "message": "Total to repay must be at least the amount borrowed."}}

    key_base = idempotency_key or str(uuid.uuid4())

    # Create the loan envelope
    name_bytes = bytes.fromhex(body.name_enc) if body.name_enc else None
    loan_env = Account(
        id=str(uuid.uuid4()),
        user_id=user_id,
        kind="envelope",
        group_code="debt",
        name_enc=name_bytes,
        color=body.color or "#D64545",
        icon=body.icon or "credit-card",
    )
    db.add(loan_env)
    await db.flush()

    # Create the loan record
    loan = Loan(
        id=str(uuid.uuid4()),
        user_id=user_id,
        account_id=loan_env.id,
        lender_enc=bytes.fromhex(body.lender_enc) if body.lender_enc else None,
        borrowed_cents=body.borrowed_cents,
        total_repay_cents=body.total_repay_cents,
        owed_cents=body.total_repay_cents,
        monthly_cents=body.monthly_cents,
        due_day=body.due_day,
    )
    db.add(loan)
    await db.flush()

    # Deposit received amount into wallet
    wallet = await get_wallet(db, user_id)
    try:
        await post_entry(db, user_id, "loan_received", None, wallet.id, body.borrowed_cents, f"{key_base}:deposit")

        # Ring-fence: move from wallet to loan envelope
        if body.ring_fence:
            await post_entry(db, user_id, "allocate", wallet.id, loan_env.id, body.borrowed_cents, f"{key_base}:fence")

        await db.commit()
        await db.refresh(loan_env)
        await db.refresh(wallet)

        return {
            "loan_id": loan.id,
            "envelope_id": loan_env.id,
            "owed_cents": loan.owed_cents,
            "wallet_cents": wallet.balance_cents,
            "envelope_balance_cents": loan_env.balance_cents,
        }
    except LedgerError as e:
        return ledger_error_response(e)


@router.post("/{loan_id}/pay")
async def pay_loan(
    loan_id: str,
    body: LoanPayIn,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> dict:
    loan = await db.scalar(select(Loan).where(Loan.id == loan_id, Loan.user_id == user_id))
    if not loan:
        raise not_found("Loan not found.")

    key = idempotency_key or str(uuid.uuid4())
    try:
        entry = await post_entry(
            db, user_id, "loan_payment",
            loan.account_id, None,
            body.amount_cents, key,
            loan_id=loan.id,
        )
        await db.commit()
        await db.refresh(loan)
        env = await db.get(Account, loan.account_id)
        return {
            "entry_id": entry.id,
            "owed_cents": loan.owed_cents,
            "envelope_balance_cents": env.balance_cents if env else 0,
        }
    except LedgerError as e:
        return ledger_error_response(e)
    except NotFound:
        raise not_found("Loan envelope not found.")
