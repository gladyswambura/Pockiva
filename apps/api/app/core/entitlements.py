"""Entitlements — plan limits in one place.

Change prices and perks here; no other file needs to change.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Entitlements:
    max_envelopes: int | None  # None = unlimited
    savings_wallets: int
    loan_payoff_plan: bool
    sync_devices: int
    export_data: bool
    shared_envelopes: bool
    partner_branding: bool


_PLANS: dict[str, Entitlements] = {
    "free": Entitlements(
        max_envelopes=5,
        savings_wallets=1,
        loan_payoff_plan=False,
        sync_devices=1,
        export_data=True,
        shared_envelopes=False,
        partner_branding=False,
    ),
    "plus": Entitlements(
        max_envelopes=None,
        savings_wallets=3,
        loan_payoff_plan=True,
        sync_devices=3,
        export_data=True,
        shared_envelopes=False,
        partner_branding=False,
    ),
    "family": Entitlements(
        max_envelopes=None,
        savings_wallets=3,
        loan_payoff_plan=True,
        sync_devices=5,
        export_data=True,
        shared_envelopes=True,
        partner_branding=False,
    ),
    "partner": Entitlements(
        max_envelopes=None,
        savings_wallets=3,
        loan_payoff_plan=True,
        sync_devices=10,
        export_data=True,
        shared_envelopes=False,
        partner_branding=True,
    ),
}


def get_entitlements(tier: str) -> Entitlements:
    return _PLANS.get(tier, _PLANS["free"])


# Pricing (KES cents) — hypotheses to test, not final
PLAN_PRICES: dict[str, dict[str, int]] = {
    "plus": {"monthly": 9_900, "yearly": 99_000},
    "family": {"monthly": 24_900, "yearly": 249_000},
}
