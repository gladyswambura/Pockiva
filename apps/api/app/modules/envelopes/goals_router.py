from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.errors import not_found
from app.core.models import Goal, RoutineStep
from app.core.security import get_current_user_id

router = APIRouter(tags=["goals"])

# ---------------------------------------------------------------------------
# Goals
# ---------------------------------------------------------------------------

class GoalCreateIn(BaseModel):
    text_enc: str | None = None   # hex ciphertext
    section: str | None = None
    linked_account_id: str | None = None
    sort_order: int = 0


class GoalPatchIn(BaseModel):
    text_enc: str | None = None
    section: str | None = None
    linked_account_id: str | None = None
    done: bool | None = None
    sort_order: int | None = None


class GoalOut(BaseModel):
    id: str
    text_enc: str | None
    section: str | None
    linked_account_id: str | None
    done: bool
    sort_order: int
    created_at: str


@router.get("/goals", response_model=list[GoalOut])
async def list_goals(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> list[GoalOut]:
    rows = (await db.scalars(
        select(Goal).where(Goal.user_id == user_id).order_by(Goal.sort_order)
    )).all()
    return [_goal_out(g) for g in rows]


@router.post("/goals", status_code=201, response_model=GoalOut)
async def create_goal(
    body: GoalCreateIn,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> GoalOut:
    goal = Goal(
        id=str(uuid.uuid4()),
        user_id=user_id,
        text_enc=bytes.fromhex(body.text_enc) if body.text_enc else None,
        section=body.section,
        linked_account_id=body.linked_account_id,
        sort_order=body.sort_order,
    )
    db.add(goal)
    await db.commit()
    await db.refresh(goal)
    return _goal_out(goal)


@router.patch("/goals/{goal_id}", response_model=GoalOut)
async def patch_goal(
    goal_id: str,
    body: GoalPatchIn,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> GoalOut:
    goal = await db.scalar(select(Goal).where(Goal.id == goal_id, Goal.user_id == user_id))
    if not goal:
        raise not_found("Goal not found.")
    if body.text_enc is not None:
        goal.text_enc = bytes.fromhex(body.text_enc)
    if body.section is not None:
        goal.section = body.section
    if body.linked_account_id is not None:
        goal.linked_account_id = body.linked_account_id
    if body.done is not None:
        goal.done = body.done
    if body.sort_order is not None:
        goal.sort_order = body.sort_order
    await db.commit()
    await db.refresh(goal)
    return _goal_out(goal)


@router.delete("/goals/{goal_id}", status_code=204)
async def delete_goal(
    goal_id: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> Response:
    goal = await db.scalar(select(Goal).where(Goal.id == goal_id, Goal.user_id == user_id))
    if not goal:
        raise not_found("Goal not found.")
    await db.delete(goal)
    await db.commit()
    return Response(status_code=204)


def _goal_out(g: Goal) -> GoalOut:
    return GoalOut(
        id=g.id,
        text_enc=g.text_enc.hex() if g.text_enc else None,
        section=g.section,
        linked_account_id=g.linked_account_id,
        done=g.done,
        sort_order=g.sort_order,
        created_at=g.created_at.isoformat(),
    )


# ---------------------------------------------------------------------------
# Income routine
# ---------------------------------------------------------------------------

class RoutineStepOut(BaseModel):
    id: str
    label_enc: str | None
    sort_order: int
    done_this_month: bool


class RoutinePatchIn(BaseModel):
    steps: list[dict]  # [{id, done_this_month}]


_DEFAULT_ROUTINE = [
    "Check your bank balance",
    "Record income",
    "Fund all envelopes to plan",
    "Move to savings",
    "Review loans",
    "Check goals",
]


@router.get("/routine", response_model=list[RoutineStepOut])
async def get_routine(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> list[RoutineStepOut]:
    rows = (await db.scalars(
        select(RoutineStep).where(RoutineStep.user_id == user_id).order_by(RoutineStep.sort_order)
    )).all()

    if not rows:
        # Bootstrap default routine
        steps = []
        for i, label in enumerate(_DEFAULT_ROUTINE):
            step = RoutineStep(
                id=str(uuid.uuid4()),
                user_id=user_id,
                label_enc=label.encode(),  # plaintext for defaults; client encrypts custom steps
                sort_order=i,
            )
            db.add(step)
            steps.append(step)
        await db.commit()
        return [_step_out(s) for s in steps]

    return [_step_out(r) for r in rows]


@router.patch("/routine")
async def patch_routine(
    body: RoutinePatchIn,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> dict:
    ids = [s["id"] for s in body.steps]
    rows = (await db.scalars(
        select(RoutineStep).where(RoutineStep.id.in_(ids), RoutineStep.user_id == user_id)
    )).all()
    step_map = {r.id: r for r in rows}
    for s in body.steps:
        if s["id"] in step_map:
            step_map[s["id"]].done_this_month = s.get("done_this_month", False)
    await db.commit()
    return {"ok": True}


def _step_out(s: RoutineStep) -> RoutineStepOut:
    return RoutineStepOut(
        id=s.id,
        label_enc=s.label_enc.hex() if s.label_enc else None,
        sort_order=s.sort_order,
        done_this_month=s.done_this_month,
    )
