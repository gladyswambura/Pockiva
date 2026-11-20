from __future__ import annotations

from pydantic import BaseModel, field_validator


class EnvelopeCreateIn(BaseModel):
    name_enc: str          # base64 ciphertext from client
    group_code: str | None = None
    color: str | None = None
    icon: str | None = None
    plan_cents: int = 0
    goal_cents: int = 0
    kind: str = "bill"     # bill | goal | system
    sort_order: int = 0

    @field_validator("plan_cents", "goal_cents")
    @classmethod
    def non_negative(cls, v: int) -> int:
        if v < 0:
            raise ValueError("Must be non-negative.")
        return v


class EnvelopePatchIn(BaseModel):
    name_enc: str | None = None
    group_code: str | None = None
    color: str | None = None
    icon: str | None = None
    plan_cents: int | None = None
    goal_cents: int | None = None
    sort_order: int | None = None


class EnvelopeOut(BaseModel):
    id: str
    kind: str
    group_code: str | None
    name_enc: str | None      # hex-encoded ciphertext
    color: str | None
    icon: str | None
    sort_order: int
    plan_cents: int
    goal_cents: int
    balance_cents: int
    funded_cents: int
    spent_cents: int
    lock_until: str | None
    archived_at: str | None

    model_config = {"from_attributes": True}


class ReorderIn(BaseModel):
    ordered_ids: list[str]


class TemplateEnvelopeIn(BaseModel):
    name_enc: str
    group_code: str | None = None
    color: str | None = None
    icon: str | None = None
    plan_cents: int = 0
    sort_order: int | None = None


class TemplateApplyIn(BaseModel):
    envelopes: list[TemplateEnvelopeIn]
    replace_existing: bool = False
