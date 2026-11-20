from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, field_validator
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.db import get_db
from app.core.models import Account, LedgerEntry, User
from app.core.security import get_current_user_id
from app.modules.auth import schemas, service
from app.modules.ledger_api.service import get_wallet, post_entry

router = APIRouter(prefix="/auth", tags=["auth"])


class Demo50kIn(BaseModel):
    encrypted_names: list[str]

    @field_validator("encrypted_names")
    @classmethod
    def validate_names(cls, values: list[str]) -> list[str]:
        if len(values) != 5:
            raise ValueError("Exactly five encrypted envelope names are required.")
        try:
            for value in values:
                bytes.fromhex(value)
        except ValueError as exc:
            raise ValueError("Envelope names must be hex-encoded ciphertext.") from exc
        return values


class SetupPlanIn(BaseModel):
    encrypted_names: list[str]
    income_cents: int = 5_000_000
    template: str = "starter_50k"


@router.post("/setup-plan", status_code=201)
async def setup_plan(
    body: SetupPlanIn,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> dict:
    """Create starter envelopes from a template. Idempotent — skips if envelopes already exist."""
    existing = await db.scalar(
        select(Account.id).where(Account.user_id == user_id, Account.kind == "envelope")
    )
    if existing:
        return {"created": False, "reason": "plan_exists"}

    if not body.encrypted_names:
        return {"created": False, "reason": "no_names"}

    # Proportional split: 18 weights matching the frontend label order
    weights = [16, 20, 10, 6, 4, 6, 5, 3, 8, 5, 4, 3, 2, 3, 2, 2, 1]
    # Pad or trim to match however many names were sent
    n = len(body.encrypted_names)
    w = (weights + [1] * n)[:n]
    total_w = sum(w)
    income = body.income_cents

    colors = ["#2F6FED", "#2E9E6B", "#E08A1E", "#7C4DDB", "#C79A45",
              "#D6457F", "#5B5BD6", "#0F9FB5", "#E4572E", "#7BA428",
              "#8D6E4F", "#5B6B86", "#2F6FED", "#E08A1E", "#2E9E6B",
              "#C79A45", "#596781", "#16213A"]
    icons = ["home", "shopping-cart", "bus", "heart", "piggy-bank",
             "gift", "book", "activity", "credit-card", "shield",
             "shirt", "wifi", "droplets", "utensils", "plane",
             "smartphone", "more-horizontal", "wallet"]

    wallet = await get_wallet(db, user_id)
    total_cents = sum(round(income * wi / total_w) for wi in w)
    accounts: list[Account] = []
    for i, enc_name in enumerate(body.encrypted_names):
        try:
            name_bytes = bytes.fromhex(enc_name)
        except ValueError:
            name_bytes = enc_name.encode()
        plan = round(income * w[i] / total_w)
        account = Account(
            id=str(uuid.uuid4()), user_id=user_id, kind="envelope",
            name_enc=name_bytes, color=colors[i % len(colors)],
            icon=icons[i % len(icons)], sort_order=i, plan_cents=plan,
        )
        db.add(account)
        accounts.append(account)
    await db.flush()

    await post_entry(db, user_id, "deposit", None, wallet.id, total_cents, f"setup-plan:{user_id}:deposit")
    for idx, account in enumerate(accounts):
        await post_entry(
            db, user_id, "allocate", wallet.id, account.id, account.plan_cents,
            f"setup-plan:{user_id}:allocate:{idx}",
        )
    await db.commit()
    return {"created": True, "income_cents": income, "envelopes_created": len(accounts)}


@router.post("/otp/request", status_code=202)
async def otp_request(
    body: schemas.OtpRequestIn,
    db: AsyncSession = Depends(get_db),
) -> dict:
    code = await service.request_otp(db, body.identifier)
    # In production: send via SMS/email. In local/dev: return in response.
    response = {"detail": "Code sent."}
    if settings.app_env == "local":
        response["_dev_code"] = code
    return response


@router.post("/otp/verify", response_model=schemas.TokenOut)
async def otp_verify(
    body: schemas.OtpVerifyIn,
    db: AsyncSession = Depends(get_db),
) -> schemas.TokenOut:
    access, refresh = await service.verify_otp(db, body.identifier, body.code)
    return schemas.TokenOut(access_token=access, refresh_token=refresh)


@router.post("/refresh", response_model=schemas.TokenOut)
async def refresh(
    body: schemas.RefreshIn,
    db: AsyncSession = Depends(get_db),
) -> schemas.TokenOut:
    access, refresh = await service.refresh_tokens(db, body.refresh_token)
    return schemas.TokenOut(access_token=access, refresh_token=refresh)


@router.post("/demo-50k", status_code=201)
async def create_demo_50k(
    body: Demo50kIn,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> dict:
    """Create the sample KES 50,000 plan for a new account, in one transaction."""
    existing = await db.scalar(
        select(Account.id).where(Account.user_id == user_id, Account.kind == "envelope")
    )
    if existing:
        return {"created": False, "reason": "plan_exists"}

    definitions = [
        ("Rent", "essentials", 800_000, "#2F6FED", "home"),
        ("Food", "essentials", 1_000_000, "#2E9E6B", "shopping-cart"),
        ("Transport and bills", "essentials", 800_000, "#E08A1E", "bus"),
        ("Family and personal", "personal", 900_000, "#7C4DDB", "heart"),
        ("Savings and goals", "goals", 1_500_000, "#C79A45", "piggy-bank"),
    ]
    total_cents = sum(item[2] for item in definitions)
    wallet = await get_wallet(db, user_id)
    accounts: list[Account] = []
    for sort_order, (definition, encrypted_name) in enumerate(zip(definitions, body.encrypted_names, strict=True)):
        _, group, plan, color, icon = definition
        account = Account(
            id=str(uuid.uuid4()), user_id=user_id, kind="envelope", group_code=group,
            name_enc=bytes.fromhex(encrypted_name), color=color, icon=icon,
            sort_order=sort_order, plan_cents=plan,
        )
        db.add(account)
        accounts.append(account)
    await db.flush()

    await post_entry(db, user_id, "deposit", None, wallet.id, total_cents, f"demo-50k:{user_id}:deposit")
    for index, (account, definition) in enumerate(zip(accounts, definitions, strict=True)):
        await post_entry(
            db, user_id, "allocate", wallet.id, account.id, definition[2],
            f"demo-50k:{user_id}:allocate:{index}",
        )
    await db.commit()
    return {"created": True, "income_cents": total_cents, "envelopes_created": len(accounts)}


@router.post("/logout", status_code=204)
async def logout(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> Response:
    await service.logout_all(db, user_id)
    return Response(status_code=204)


# ---------------------------------------------------------------------------
# /me
# ---------------------------------------------------------------------------

@router.get("/me", response_model=schemas.UserOut)
async def get_me(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> schemas.UserOut:
    user = await db.get(User, user_id)
    if not user:
        return JSONResponse(status_code=404, content={"error": {"code": "NOT_FOUND", "message": "User not found."}})
    return schemas.UserOut.model_validate(user)


@router.patch("/me", response_model=schemas.UserOut)
async def patch_me(
    body: schemas.UserPatchIn,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> schemas.UserOut:
    user = await db.get(User, user_id)
    if not user:
        return JSONResponse(status_code=404, content={"error": {"code": "NOT_FOUND", "message": "User not found."}})
    if body.display_name is not None:
        user.display_name = body.display_name.strip() or None
    if body.locale is not None:
        user.locale = body.locale
    if body.currency is not None:
        user.currency = body.currency
    await db.commit()
    return schemas.UserOut.model_validate(user)


@router.get("/me/export")
async def export_me(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> JSONResponse:
    """Export all user data as JSON. Always available on every plan."""
    user = await db.get(User, user_id)
    accounts = (await db.scalars(select(Account).where(Account.user_id == user_id))).all()
    entries = (await db.scalars(select(LedgerEntry).where(LedgerEntry.user_id == user_id))).all()

    data = {
        "exported_at": datetime.now(UTC).isoformat(),
        "schema_version": 1,
        "user": {
            "id": user.id,
            "locale": user.locale,
            "currency": user.currency,
            "plan_tier": user.plan_tier,
            "created_at": user.created_at.isoformat(),
        },
        "accounts": [
            {
                "id": a.id,
                "kind": a.kind,
                "group_code": a.group_code,
                "name_enc": a.name_enc.hex() if a.name_enc else None,
                "color": a.color,
                "icon": a.icon,
                "sort_order": a.sort_order,
                "plan_cents": a.plan_cents,
                "balance_cents": a.balance_cents,
                "funded_cents": a.funded_cents,
                "spent_cents": a.spent_cents,
                "lock_until": str(a.lock_until) if a.lock_until else None,
            }
            for a in accounts
        ],
        "ledger_entries": [
            {
                "id": e.id,
                "kind": e.kind,
                "from_account_id": e.from_account_id,
                "to_account_id": e.to_account_id,
                "amount_cents": e.amount_cents,
                "note_enc": e.note_enc.hex() if e.note_enc else None,
                "created_at": e.created_at.isoformat(),
            }
            for e in entries
        ],
    }
    return JSONResponse(content=data, headers={"Content-Disposition": "attachment; filename=pockiva-export.json"})


@router.delete("/me", status_code=204)
async def delete_me(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> Response:
    """Soft-delete. A retention job purges after 30 days."""
    user = await db.get(User, user_id)
    if user:
        user.deleted_at = datetime.now(UTC)
        await db.commit()
    return Response(status_code=204)


@router.delete("/reset-account", status_code=200)
async def reset_account(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> dict:
    """Hard reset: delete all user data but keep the account. User can start fresh."""
    # Delete ledger entries
    await db.execute(delete(LedgerEntry).where(LedgerEntry.user_id == user_id))
    # Delete accounts (envelopes, wallet, savings)
    await db.execute(delete(Account).where(Account.user_id == user_id))
    # Delete loans, goals, routine steps
    from app.core.models import Goal, Loan, RoutineStep
    await db.execute(delete(Loan).where(Loan.user_id == user_id))
    await db.execute(delete(Goal).where(Goal.user_id == user_id))
    await db.execute(delete(RoutineStep).where(RoutineStep.user_id == user_id))
    # Reset user fields
    user = await db.get(User, user_id)
    if user:
        user.display_name = None
        user.locale = 'en'
        user.currency = 'KES'
        user.plan_tier = 'free'
        user.deleted_at = None
    await db.commit()
    return {"reset": True}


# ---------------------------------------------------------------------------
# Envelope bulk actions
# ---------------------------------------------------------------------------

@router.post("/envelopes/clear-all", status_code=200)
async def clear_all_envelopes(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> dict:
    """Zero out all envelope balances, releasing funds back to wallet."""
    from app.modules.ledger_api.service import get_wallet, post_entry
    wallet = await get_wallet(db, user_id)
    envelopes = (await db.scalars(
        select(Account).where(
            Account.user_id == user_id,
            Account.kind == "envelope",
            Account.archived_at.is_(None),
        )
    )).all()
    released = 0
    for i, env in enumerate(envelopes):
        if env.balance_cents > 0:
            await post_entry(db, user_id, "release", env.id, wallet.id, env.balance_cents, f"clear-all:{user_id}:{i}")
            released += env.balance_cents
    await db.commit()
    await db.refresh(wallet)
    return {"released_cents": released, "wallet_cents": wallet.balance_cents}


@router.delete("/envelopes/delete-all", status_code=200)
async def delete_all_envelopes(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> dict:
    """Release all envelope balances to wallet then delete all envelopes."""
    from app.modules.ledger_api.service import get_wallet, post_entry
    wallet = await get_wallet(db, user_id)
    envelopes = (await db.scalars(
        select(Account).where(
            Account.user_id == user_id,
            Account.kind == "envelope",
        )
    )).all()
    released = 0
    for i, env in enumerate(envelopes):
        if env.balance_cents > 0:
            await post_entry(db, user_id, "release", env.id, wallet.id, env.balance_cents, f"delete-all:{user_id}:{i}")
            released += env.balance_cents
    await db.flush()
    await db.execute(delete(Account).where(Account.user_id == user_id, Account.kind == "envelope"))
    await db.commit()
    await db.refresh(wallet)
    return {"deleted": len(envelopes), "released_cents": released, "wallet_cents": wallet.balance_cents}
