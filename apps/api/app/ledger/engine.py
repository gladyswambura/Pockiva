"""Pure ledger domain — no web, no database imports.

All amounts are integer cents. KES 750.50 = 75050.
This module is the single source of truth for money rules.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from enum import Enum
from typing import Literal


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------

class LedgerError(Exception):
    """Base for all ledger rule violations."""
    code: str = "LEDGER_ERROR"


class InsufficientFunds(LedgerError):
    code = "INSUFFICIENT_ENVELOPE_FUNDS"

    def __init__(self, available: int, requested: int) -> None:
        self.available = available
        self.requested = requested
        super().__init__(f"Need {requested} cents, only {available} available.")


class InsufficientWalletFunds(LedgerError):
    code = "INSUFFICIENT_UNALLOCATED_FUNDS"

    def __init__(self, available: int, requested: int) -> None:
        self.available = available
        self.requested = requested
        super().__init__(f"Wallet holds {available} cents, requested {requested}.")


class SavingsLocked(LedgerError):
    code = "SAVINGS_LOCKED"

    def __init__(self, locked_until: date) -> None:
        self.locked_until = locked_until
        super().__init__(f"Savings locked until {locked_until}.")


class NegativeAmount(LedgerError):
    code = "VALIDATION_ERROR"

    def __init__(self) -> None:
        super().__init__("Amount must be a positive integer number of cents.")


class LoanRepayBelowBorrowed(LedgerError):
    code = "VALIDATION_ERROR"

    def __init__(self) -> None:
        super().__init__("Total to repay must be at least the amount borrowed.")


# ---------------------------------------------------------------------------
# Value objects
# ---------------------------------------------------------------------------

class AccountKind(str, Enum):
    wallet = "wallet"
    savings = "savings"
    envelope = "envelope"


class EntryKind(str, Enum):
    deposit = "deposit"
    allocate = "allocate"
    release = "release"
    spend = "spend"
    save = "save"
    unsave = "unsave"
    loan_received = "loan_received"
    loan_payment = "loan_payment"


@dataclass
class AccountState:
    """In-memory snapshot of one account used by the pure ledger."""
    id: str
    user_id: str
    kind: AccountKind
    balance_cents: int = 0
    funded_cents: int = 0
    spent_cents: int = 0
    lock_until: date | None = None

    def __post_init__(self) -> None:
        if self.balance_cents < 0:
            raise ValueError("balance_cents cannot be negative")


@dataclass
class LoanState:
    id: str
    account_id: str
    borrowed_cents: int
    total_repay_cents: int
    owed_cents: int

    def __post_init__(self) -> None:
        if self.total_repay_cents < self.borrowed_cents:
            raise LoanRepayBelowBorrowed()


@dataclass
class EntryResult:
    """What the ledger returns after a successful posting."""
    kind: EntryKind
    from_account_id: str | None
    to_account_id: str | None
    amount_cents: int
    idempotency_key: str
    # Updated snapshots
    from_account: AccountState | None = None
    to_account: AccountState | None = None
    loan: LoanState | None = None


@dataclass
class FundAllResult:
    entries: list[EntryResult] = field(default_factory=list)
    short_cents: dict[str, int] = field(default_factory=dict)  # account_id -> shortfall


# ---------------------------------------------------------------------------
# Pure ledger functions
# ---------------------------------------------------------------------------

def _require_positive(amount_cents: int) -> None:
    if amount_cents <= 0:
        raise NegativeAmount()


def deposit(wallet: AccountState, amount_cents: int, key: str) -> EntryResult:
    """Add money from outside (salary, gift). Raises on non-positive amount."""
    _require_positive(amount_cents)
    wallet.balance_cents += amount_cents
    return EntryResult(
        kind=EntryKind.deposit,
        from_account_id=None,
        to_account_id=wallet.id,
        amount_cents=amount_cents,
        idempotency_key=key,
        to_account=wallet,
    )


def allocate(wallet: AccountState, envelope: AccountState, amount_cents: int, key: str) -> EntryResult:
    """Move money from wallet to envelope."""
    _require_positive(amount_cents)
    if wallet.balance_cents < amount_cents:
        raise InsufficientWalletFunds(available=wallet.balance_cents, requested=amount_cents)
    wallet.balance_cents -= amount_cents
    envelope.balance_cents += amount_cents
    envelope.funded_cents += amount_cents
    return EntryResult(
        kind=EntryKind.allocate,
        from_account_id=wallet.id,
        to_account_id=envelope.id,
        amount_cents=amount_cents,
        idempotency_key=key,
        from_account=wallet,
        to_account=envelope,
    )


def release(envelope: AccountState, wallet: AccountState, amount_cents: int, key: str) -> EntryResult:
    """Return money from envelope back to wallet."""
    _require_positive(amount_cents)
    if envelope.balance_cents < amount_cents:
        raise InsufficientFunds(available=envelope.balance_cents, requested=amount_cents)
    envelope.balance_cents -= amount_cents
    wallet.balance_cents += amount_cents
    return EntryResult(
        kind=EntryKind.release,
        from_account_id=envelope.id,
        to_account_id=wallet.id,
        amount_cents=amount_cents,
        idempotency_key=key,
        from_account=envelope,
        to_account=wallet,
    )


def spend(account: AccountState, amount_cents: int, key: str) -> EntryResult:
    """Spend from an envelope or wallet (money leaves the system)."""
    _require_positive(amount_cents)
    if account.balance_cents < amount_cents:
        raise InsufficientFunds(available=account.balance_cents, requested=amount_cents)
    account.balance_cents -= amount_cents
    account.spent_cents += amount_cents
    return EntryResult(
        kind=EntryKind.spend,
        from_account_id=account.id,
        to_account_id=None,
        amount_cents=amount_cents,
        idempotency_key=key,
        from_account=account,
    )


def move_to_savings(
    source: AccountState,
    savings: AccountState,
    amount_cents: int,
    key: str,
) -> EntryResult:
    """Move money from wallet or envelope into savings."""
    _require_positive(amount_cents)
    if source.balance_cents < amount_cents:
        raise InsufficientFunds(available=source.balance_cents, requested=amount_cents)
    source.balance_cents -= amount_cents
    savings.balance_cents += amount_cents
    return EntryResult(
        kind=EntryKind.save,
        from_account_id=source.id,
        to_account_id=savings.id,
        amount_cents=amount_cents,
        idempotency_key=key,
        from_account=source,
        to_account=savings,
    )


def move_from_savings(
    savings: AccountState,
    wallet: AccountState,
    amount_cents: int,
    key: str,
    today: date | None = None,
) -> EntryResult:
    """Move money out of savings into wallet. Blocked if locked."""
    _require_positive(amount_cents)
    today = today or date.today()
    if savings.lock_until and savings.lock_until > today:
        raise SavingsLocked(savings.lock_until)
    if savings.balance_cents < amount_cents:
        raise InsufficientFunds(available=savings.balance_cents, requested=amount_cents)
    savings.balance_cents -= amount_cents
    wallet.balance_cents += amount_cents
    return EntryResult(
        kind=EntryKind.unsave,
        from_account_id=savings.id,
        to_account_id=wallet.id,
        amount_cents=amount_cents,
        idempotency_key=key,
        from_account=savings,
        to_account=wallet,
    )


def record_loan(
    wallet: AccountState,
    loan_envelope: AccountState,
    loan: LoanState,
    received_cents: int,
    ring_fence: bool,
    deposit_key: str,
    fence_key: str,
) -> list[EntryResult]:
    """
    Record a loan received.
    1. Deposit received_cents into wallet (bank balance rises).
    2. If ring_fence, allocate received_cents from wallet to loan_envelope.
    Returns 1 or 2 entries.
    """
    _require_positive(received_cents)
    results: list[EntryResult] = []

    # Step 1: deposit
    wallet.balance_cents += received_cents
    results.append(EntryResult(
        kind=EntryKind.loan_received,
        from_account_id=None,
        to_account_id=wallet.id,
        amount_cents=received_cents,
        idempotency_key=deposit_key,
        to_account=wallet,
        loan=loan,
    ))

    # Step 2: ring-fence
    if ring_fence:
        if wallet.balance_cents < received_cents:
            raise InsufficientWalletFunds(available=wallet.balance_cents, requested=received_cents)
        wallet.balance_cents -= received_cents
        loan_envelope.balance_cents += received_cents
        loan_envelope.funded_cents += received_cents
        results.append(EntryResult(
            kind=EntryKind.allocate,
            from_account_id=wallet.id,
            to_account_id=loan_envelope.id,
            amount_cents=received_cents,
            idempotency_key=fence_key,
            from_account=wallet,
            to_account=loan_envelope,
        ))

    return results


def pay_loan(
    loan_envelope: AccountState,
    loan: LoanState,
    amount_cents: int,
    key: str,
) -> EntryResult:
    """Pay down a loan from its envelope. Reduces owed and bank balance."""
    _require_positive(amount_cents)
    if loan_envelope.balance_cents < amount_cents:
        raise InsufficientFunds(available=loan_envelope.balance_cents, requested=amount_cents)
    loan_envelope.balance_cents -= amount_cents
    loan_envelope.spent_cents += amount_cents
    loan.owed_cents = max(0, loan.owed_cents - amount_cents)
    return EntryResult(
        kind=EntryKind.loan_payment,
        from_account_id=loan_envelope.id,
        to_account_id=None,
        amount_cents=amount_cents,
        idempotency_key=key,
        from_account=loan_envelope,
        loan=loan,
    )


def delete_envelope(envelope: AccountState, wallet: AccountState, key: str) -> EntryResult | None:
    """
    Delete an envelope: return its balance to the wallet.
    Returns None if the envelope is already empty.
    """
    if envelope.balance_cents == 0:
        return None
    amount = envelope.balance_cents
    envelope.balance_cents = 0
    wallet.balance_cents += amount
    return EntryResult(
        kind=EntryKind.release,
        from_account_id=envelope.id,
        to_account_id=wallet.id,
        amount_cents=amount,
        idempotency_key=key,
        from_account=envelope,
        to_account=wallet,
    )


def fund_all(
    wallet: AccountState,
    envelopes: list[tuple[AccountState, int]],  # (envelope, plan_cents)
    key_prefix: str,
) -> FundAllResult:
    """
    Allocate from wallet to each envelope up to its plan, in order.
    Stops when wallet is empty. Reports shortfalls.
    """
    result = FundAllResult()
    for i, (env, plan) in enumerate(envelopes):
        needed = max(0, plan - env.funded_cents)
        if needed == 0:
            continue
        can_give = min(needed, wallet.balance_cents)
        if can_give > 0:
            key = f"{key_prefix}:{i}"
            entry = allocate(wallet, env, can_give, key)
            result.entries.append(entry)
        shortfall = needed - can_give
        if shortfall > 0:
            result.short_cents[env.id] = shortfall
        if wallet.balance_cents == 0:
            # Report remaining envelopes as short
            for j, (remaining_env, remaining_plan) in enumerate(envelopes[i + 1:], i + 1):
                still_needed = max(0, remaining_plan - remaining_env.funded_cents)
                if still_needed > 0:
                    result.short_cents[remaining_env.id] = still_needed
            break
    return result


# ---------------------------------------------------------------------------
# Invariant check (pure, for tests and nightly job)
# ---------------------------------------------------------------------------

def check_invariant(
    bank_balance_cents: int,
    wallet_cents: int,
    envelope_cents: list[int],
    savings_cents: int,
) -> bool:
    """
    Bank balance must equal wallet + sum(envelopes) + savings.
    Returns True if the invariant holds.
    """
    return bank_balance_cents == wallet_cents + sum(envelope_cents) + savings_cents


def net_position(bank_balance_cents: int, total_owed_cents: int) -> int:
    return bank_balance_cents - total_owed_cents


def reset_month(envelopes: list[AccountState]) -> None:
    """Reset funded and spent counters at the start of a new month. Never touches balances."""
    for env in envelopes:
        env.funded_cents = 0
        env.spent_cents = 0
