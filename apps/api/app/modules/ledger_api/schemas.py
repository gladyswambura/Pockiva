from pydantic import BaseModel


class SummaryOut(BaseModel):
    bank_balance_cents: int
    wallet_cents: int
    envelopes_total_cents: int
    savings_cents: int
    total_owed_cents: int
    net_position_cents: int
    monthly_plan_cents: int
    still_to_fund_cents: int
    currency: str
