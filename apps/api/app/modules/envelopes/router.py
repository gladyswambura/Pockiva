from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import select, cast, Enum
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.entitlements import get_entitlements
from app.core.errors import not_found, plan_limit_reached
from app.core.models import Account, User
from app.core.security import get_current_user_id
from app.modules.envelopes import schemas
from app.modules.ledger_api.service import NotFound, get_wallet, post_entry

router = APIRouter(prefix="/envelopes", tags=["envelopes"])

ENVELOPE_KIND = cast(Account.kind, Enum("wallet", "savings", "envelope", name="account_kind"))


@router.get("", response_model=list[schemas.EnvelopeOut])
async def list_envelopes(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> list[schemas.EnvelopeOut]:
    rows = (await db.scalars(
        select(Account)
        .where(Account.user_id == user_id, ENVELOPE_KIND == "envelope", Account.archived_at.is_(None))
        .order_by(Account.sort_order)
    )).all()
    return [_to_out(r) for r in rows]


@router.post("/apply-template", response_model=list[schemas.EnvelopeOut], status_code=201)
async def apply_template(
    body: schemas.TemplateApplyIn,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> list[schemas.EnvelopeOut]:
    """Create multiple envelopes from a template in one request."""
    # Archive any existing envelopes first if replace=True
    if body.replace_existing:
        from datetime import UTC, datetime
        existing = (await db.scalars(
            select(Account).where(Account.user_id == user_id, ENVELOPE_KIND == "envelope", Account.archived_at.is_(None))
        )).all()
        for acc in existing:
            acc.archived_at = datetime.now(UTC)

    created = []
    for i, item in enumerate(body.envelopes):
        name_bytes = bytes.fromhex(item.name_enc) if item.name_enc else None
        acc = Account(
            id=str(uuid.uuid4()),
            user_id=user_id,
            kind="envelope",
            group_code=item.group_code,
            name_enc=name_bytes,
            color=item.color,
            icon=item.icon,
            sort_order=item.sort_order if item.sort_order is not None else i,
            plan_cents=item.plan_cents,
            goal_cents=0,
        )
        db.add(acc)
        created.append(acc)

    await db.commit()
    for acc in created:
        await db.refresh(acc)
    return [_to_out(a) for a in created]


@router.post("", response_model=schemas.EnvelopeOut, status_code=201)
async def create_envelope(
    body: schemas.EnvelopeCreateIn,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> schemas.EnvelopeOut:
    user = await db.get(User, user_id)
    ent = get_entitlements(user.plan_tier if user else "free")

    if ent.max_envelopes is not None:
        count = len((await db.scalars(
            select(Account).where(Account.user_id == user_id, ENVELOPE_KIND == "envelope", Account.archived_at.is_(None))
        )).all())
        if count >= ent.max_envelopes:
            raise plan_limit_reached(f"Free plan allows {ent.max_envelopes} envelopes. Upgrade to Plus for unlimited.")

    name_bytes = bytes.fromhex(body.name_enc) if body.name_enc else None
    acc = Account(
        id=str(uuid.uuid4()),
        user_id=user_id,
        kind="envelope",
        group_code=body.group_code,
        name_enc=name_bytes,
        color="#D64545" if body.group_code == "debt" else body.color,
        icon=body.icon,
        sort_order=body.sort_order,
        plan_cents=body.plan_cents,
        goal_cents=body.goal_cents,
    )
    db.add(acc)
    await db.commit()
    await db.refresh(acc)
    return _to_out(acc)


@router.patch("/{envelope_id}", response_model=schemas.EnvelopeOut)
async def patch_envelope(
    envelope_id: str,
    body: schemas.EnvelopePatchIn,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> schemas.EnvelopeOut:
    acc = await db.scalar(
        select(Account).where(Account.id == envelope_id, Account.user_id == user_id, ENVELOPE_KIND == "envelope")
    )
    if not acc:
        raise not_found("Envelope not found.")

    if body.name_enc is not None:
        acc.name_enc = bytes.fromhex(body.name_enc)
    if body.group_code is not None:
        acc.group_code = body.group_code
        if body.group_code == "debt":
            acc.color = "#D64545"
    if body.color is not None:
        acc.color = body.color
    if body.icon is not None:
        acc.icon = body.icon
    if body.plan_cents is not None:
        acc.plan_cents = body.plan_cents
    if body.goal_cents is not None:
        acc.goal_cents = body.goal_cents
    if body.sort_order is not None:
        acc.sort_order = body.sort_order
    if acc.group_code == "debt":
        acc.color = "#D64545"

    await db.commit()
    await db.refresh(acc)
    return _to_out(acc)


@router.delete("/{envelope_id}", status_code=200)
async def delete_envelope(
    envelope_id: str,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> dict:
    """Archive the envelope and return its balance to the wallet."""
    from datetime import UTC, datetime
    acc = await db.scalar(
        select(Account).where(Account.id == envelope_id, Account.user_id == user_id, ENVELOPE_KIND == "envelope", Account.archived_at.is_(None))
    )
    if not acc:
        raise not_found("Envelope not found.")

    wallet = await get_wallet(db, user_id)
    returned = 0

    if acc.balance_cents > 0:
        key = idempotency_key or str(uuid.uuid4())
        await post_entry(db, user_id, "release", acc.id, wallet.id, acc.balance_cents, key)
        returned = acc.balance_cents

    acc.archived_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(wallet)
    return {"returned_cents": returned, "wallet": {"balance_cents": wallet.balance_cents}}


@router.post("/reorder", status_code=200)
async def reorder_envelopes(
    body: schemas.ReorderIn,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> dict:
    rows = (await db.scalars(
        select(Account).where(Account.id.in_(body.ordered_ids), Account.user_id == user_id)
    )).all()
    acc_map = {a.id: a for a in rows}
    for i, eid in enumerate(body.ordered_ids):
        if eid in acc_map:
            acc_map[eid].sort_order = i
    await db.commit()
    return {"ok": True}


def _to_out(a: Account) -> schemas.EnvelopeOut:
    return schemas.EnvelopeOut(
        id=a.id,
        kind=a.kind,
        group_code=a.group_code,
        name_enc=a.name_enc.hex() if a.name_enc else None,
        color=a.color,
        icon=a.icon,
        sort_order=a.sort_order,
        plan_cents=a.plan_cents,
        goal_cents=a.goal_cents,
        balance_cents=a.balance_cents,
        funded_cents=a.funded_cents,
        spent_cents=a.spent_cents,
        lock_until=str(a.lock_until) if a.lock_until else None,
        archived_at=a.archived_at.isoformat() if a.archived_at else None,
    )
