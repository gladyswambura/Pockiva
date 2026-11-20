"""Demo template: KSh 83,000 across 34 envelopes.

Used for acceptance tests (section 19) and the in-app demo.
All amounts in cents (KES * 100).
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class EnvelopeDef:
    name: str
    group: str
    plan_cents: int
    kind: str = "bill"  # bill | debt | goal | system
    color: str = "#2F6FED"
    icon: str = "home"


@dataclass
class LoanDef:
    envelope_name: str
    lender: str
    borrowed_cents: int
    total_repay_cents: int
    monthly_cents: int


@dataclass
class DemoTemplate:
    income_cents: int
    envelopes: list[EnvelopeDef]
    loans: list[LoanDef]


DEMO_83K = DemoTemplate(
    income_cents=8_300_000,  # KES 83,000
    envelopes=[
        # Essentials
        EnvelopeDef("Rent",          "essentials", 1_215_000, color="#2F6FED", icon="home"),
        EnvelopeDef("Food",          "essentials",   800_000, color="#2F6FED", icon="shopping-cart"),
        EnvelopeDef("Transport",     "essentials",   300_000, color="#2F6FED", icon="bus"),
        EnvelopeDef("Electricity",   "essentials",   200_000, color="#2F6FED", icon="zap"),
        EnvelopeDef("Water",         "essentials",    50_000, color="#2F6FED", icon="droplets"),
        EnvelopeDef("Airtime & Data","essentials",   100_000, color="#2F6FED", icon="wifi"),
        EnvelopeDef("Toiletries",    "essentials",    80_000, color="#2F6FED", icon="package"),
        EnvelopeDef("Household",     "essentials",   150_000, color="#2F6FED", icon="tool"),
        # Education
        EnvelopeDef("School Fees",   "education",    500_000, color="#7C4DDB", icon="book-open"),
        EnvelopeDef("Stationery",    "education",     30_000, color="#7C4DDB", icon="pen"),
        # Family support
        EnvelopeDef("Mum",           "family",       300_000, color="#D6457F", icon="heart"),
        EnvelopeDef("Aggie",         "family",       120_000, color="#D6457F", icon="heart"),
        # Debts (kind=debt, color locked to danger red)
        EnvelopeDef("Equity Loan",   "debt",         500_000, "debt", "#D64545", "credit-card"),
        EnvelopeDef("Chama Loan",    "debt",         300_000, "debt", "#D64545", "users"),
        EnvelopeDef("HELB",          "debt",         200_000, "debt", "#D64545", "graduation-cap"),
        EnvelopeDef("Aggie Debt",    "debt",         120_000, "debt", "#D64545", "heart"),
        # Emergency
        EnvelopeDef("Emergency",     "emergency",    500_000, "goal", "#2E9E6B", "shield"),
        # Goals (10 × KES 100)
        EnvelopeDef("Goal 1",        "goals",         10_000, "goal", "#2E9E6B", "star"),
        EnvelopeDef("Goal 2",        "goals",         10_000, "goal", "#2E9E6B", "star"),
        EnvelopeDef("Goal 3",        "goals",         10_000, "goal", "#2E9E6B", "star"),
        EnvelopeDef("Goal 4",        "goals",         10_000, "goal", "#2E9E6B", "star"),
        EnvelopeDef("Goal 5",        "goals",         10_000, "goal", "#2E9E6B", "star"),
        EnvelopeDef("Goal 6",        "goals",         10_000, "goal", "#2E9E6B", "star"),
        EnvelopeDef("Goal 7",        "goals",         10_000, "goal", "#2E9E6B", "star"),
        EnvelopeDef("Goal 8",        "goals",         10_000, "goal", "#2E9E6B", "star"),
        EnvelopeDef("Goal 9",        "goals",         10_000, "goal", "#2E9E6B", "star"),
        EnvelopeDef("Goal 10",       "goals",         10_000, "goal", "#2E9E6B", "star"),
        # Tithe / giving
        EnvelopeDef("Tithe",         "giving",       830_000, color="#C79A45", icon="gift"),
        EnvelopeDef("Offering",      "giving",        50_000, color="#C79A45", icon="gift"),
        # Personal
        EnvelopeDef("Clothing",      "personal",     200_000, color="#5B5BD6", icon="shirt"),
        EnvelopeDef("Health",        "personal",     150_000, color="#5B5BD6", icon="activity"),
        EnvelopeDef("Entertainment", "personal",     100_000, color="#5B5BD6", icon="music"),
        # Savings (system)
        EnvelopeDef("Pockiva",       "system",        99_00,  "system", "#C79A45", "pocket"),
        # Miscellaneous
        EnvelopeDef("Miscellaneous", "essentials",   200_000, color="#5B6B86", icon="more-horizontal"),
    ],
    loans=[
        LoanDef("Equity Loan", "Equity Bank",  500_000,  600_000, 500_000),
        LoanDef("Chama Loan",  "Chama",         300_000,  330_000, 300_000),
        LoanDef("HELB",        "HELB",          800_000, 1_000_000, 200_000),
        LoanDef("Aggie Debt",  "Aggie",         120_000,  120_000, 120_000),
    ],
)

# ---------------------------------------------------------------------------
# KES 50,000 starter template — globally-relevant envelopes
# ---------------------------------------------------------------------------

STARTER_50K = DemoTemplate(
    income_cents=5_000_000,  # KES 50,000
    envelopes=[
        # Housing
        EnvelopeDef("Rent",            "essentials",   800_000, color="#2F6FED", icon="home"),
        # Food
        EnvelopeDef("Groceries",       "essentials",   600_000, color="#2E9E6B", icon="cart"),
        EnvelopeDef("Eating out",      "essentials",   150_000, color="#2E9E6B", icon="cart"),
        # Transport
        EnvelopeDef("Transport",       "essentials",   300_000, color="#E08A1E", icon="bus"),
        # Utilities
        EnvelopeDef("Electricity",     "essentials",   150_000, color="#0F9FB5", icon="bolt"),
        EnvelopeDef("Water",           "essentials",    50_000, color="#0F9FB5", icon="droplets"),
        EnvelopeDef("Airtime & Data",  "essentials",   100_000, color="#0F9FB5", icon="wifi"),
        # Health
        EnvelopeDef("Health",          "personal",     150_000, color="#5B5BD6", icon="activity"),
        # Personal care
        EnvelopeDef("Toiletries",      "personal",      80_000, color="#5B5BD6", icon="package"),
        EnvelopeDef("Clothing",        "personal",     100_000, color="#5B5BD6", icon="shirt"),
        # Family
        EnvelopeDef("Family support",  "family",       200_000, color="#D6457F", icon="heart"),
        # Education
        EnvelopeDef("Education",       "education",    200_000, color="#7C4DDB", icon="book-open"),
        # Giving
        EnvelopeDef("Tithe / Giving",  "giving",       500_000, color="#C79A45", icon="gift"),
        # Debt
        EnvelopeDef("Loan repayment",  "debt",         300_000, "debt", "#D64545", "credit-card"),
        # Savings
        EnvelopeDef("Emergency fund",  "emergency",    300_000, "goal", "#2E9E6B", "shield"),
        # Goals
        EnvelopeDef("Holiday",         "goals",        100_000, "goal", "#E4572E", "star"),
        EnvelopeDef("New phone",       "goals",         50_000, "goal", "#E4572E", "phone"),
        # Misc
        EnvelopeDef("Miscellaneous",   "essentials",   170_000, color="#5B6B86", icon="more-horizontal"),
    ],
    loans=[
        LoanDef("Loan repayment", "Bank", 300_000, 360_000, 300_000),
    ],
)

# Acceptance test constants (section 19)
DEMO_BANK_BALANCE_CENTS = 8_300_000
DEMO_DEBTS_OWED_CENTS = 2_420_000   # 24,200 KES
DEMO_NET_POSITION_CENTS = DEMO_BANK_BALANCE_CENTS - DEMO_DEBTS_OWED_CENTS  # 58,800 KES
DEMO_ENVELOPE_COUNT = 34
DEMO_MONTHLY_PLAN_CENTS = 8_300_000
