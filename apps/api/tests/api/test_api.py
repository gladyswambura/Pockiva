"""API integration tests — auth, envelopes, ledger, savings, loans."""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _key() -> str:
    return str(uuid.uuid4())


async def _register_and_login(client: AsyncClient, identifier: str = "+254700000001") -> str:
    """Returns a valid access token."""
    r = await client.post("/api/v1/auth/otp/request", json={"identifier": identifier})
    assert r.status_code == 202
    code = r.json()["_dev_code"]

    r = await client.post("/api/v1/auth/otp/verify", json={"identifier": identifier, "code": code})
    assert r.status_code == 200
    return r.json()["access_token"]


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_otp_flow(client: AsyncClient) -> None:
    token = await _register_and_login(client, "+254700000002")
    assert token

    r = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["phone_e164"] == "+254700000002"


@pytest.mark.asyncio
async def test_kes_50k_demo_creates_five_funded_envelopes(client: AsyncClient) -> None:
    token = await _register_and_login(client, "+254700000004")
    auth = {"Authorization": f"Bearer {token}"}
    names = [name.encode().hex() for name in ("Rent", "Food", "Transport and bills", "Family and personal", "Savings and goals")]

    response = await client.post("/api/v1/auth/demo-50k", json={"encrypted_names": names}, headers=auth)
    assert response.status_code == 201
    assert response.json() == {"created": True, "income_cents": 5_000_000, "envelopes_created": 5}

    summary = await client.get("/api/v1/summary", headers=auth)
    assert summary.status_code == 200
    assert summary.json()["bank_balance_cents"] == 5_000_000
    assert summary.json()["wallet_cents"] == 0

    envelopes = await client.get("/api/v1/envelopes", headers=auth)
    assert len(envelopes.json()) == 5
    assert sum(item["balance_cents"] for item in envelopes.json()) == 5_000_000


@pytest.mark.asyncio
async def test_refresh_token(client: AsyncClient) -> None:
    r = await client.post("/api/v1/auth/otp/request", json={"identifier": "+254700000003"})
    code = r.json()["_dev_code"]
    r = await client.post("/api/v1/auth/otp/verify", json={"identifier": "+254700000003", "code": code})
    refresh = r.json()["refresh_token"]

    r = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh})
    assert r.status_code == 200
    assert "access_token" in r.json()


# ---------------------------------------------------------------------------
# Summary (empty state)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_summary_empty(client: AsyncClient) -> None:
    token = await _register_and_login(client, "+254700000010")
    r = await client.get("/api/v1/summary", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    data = r.json()
    assert data["bank_balance_cents"] == 0
    assert data["wallet_cents"] == 0


# ---------------------------------------------------------------------------
# Deposit → allocate → spend
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_deposit_allocate_spend(client: AsyncClient) -> None:
    token = await _register_and_login(client, "+254700000020")
    auth = {"Authorization": f"Bearer {token}"}

    # Deposit KES 10,000
    r = await client.post(
        "/api/v1/ledger/deposit",
        json={"amount_cents": 1_000_000},
        headers={**auth, "Idempotency-Key": _key()},
    )
    assert r.status_code == 200
    assert r.json()["wallet"]["balance_cents"] == 1_000_000

    # Create envelope
    name_hex = "Rent".encode().hex()
    r = await client.post(
        "/api/v1/envelopes",
        json={"name_enc": name_hex, "plan_cents": 500_000, "group_code": "essentials"},
        headers=auth,
    )
    assert r.status_code == 201
    env_id = r.json()["id"]

    # Allocate KES 5,000
    r = await client.post(
        "/api/v1/ledger/allocate",
        json={"envelope_id": env_id, "amount_cents": 500_000},
        headers={**auth, "Idempotency-Key": _key()},
    )
    assert r.status_code == 200
    assert r.json()["envelope"]["balance_cents"] == 500_000
    assert r.json()["wallet"]["balance_cents"] == 500_000

    # Spend KES 2,000 from envelope
    r = await client.post(
        "/api/v1/ledger/spend",
        json={"account_id": env_id, "amount_cents": 200_000},
        headers={**auth, "Idempotency-Key": _key()},
    )
    assert r.status_code == 200
    assert r.json()["account"]["balance_cents"] == 300_000

    # Summary invariant
    r = await client.get("/api/v1/summary", headers=auth)
    data = r.json()
    assert data["bank_balance_cents"] == data["wallet_cents"] + data["envelopes_total_cents"] + data["savings_cents"]


# ---------------------------------------------------------------------------
# Idempotency: same key posted twice
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_idempotency(client: AsyncClient) -> None:
    token = await _register_and_login(client, "+254700000030")
    auth = {"Authorization": f"Bearer {token}"}
    key = _key()

    await client.post("/api/v1/ledger/deposit", json={"amount_cents": 500_000}, headers={**auth, "Idempotency-Key": key})
    r2 = await client.post("/api/v1/ledger/deposit", json={"amount_cents": 500_000}, headers={**auth, "Idempotency-Key": key})

    assert r2.status_code == 200
    # Balance should only reflect one deposit
    r = await client.get("/api/v1/summary", headers=auth)
    assert r.json()["wallet_cents"] == 500_000


# ---------------------------------------------------------------------------
# Over-allocation refused
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_over_allocate_refused(client: AsyncClient) -> None:
    token = await _register_and_login(client, "+254700000040")
    auth = {"Authorization": f"Bearer {token}"}

    await client.post("/api/v1/ledger/deposit", json={"amount_cents": 100_000}, headers={**auth, "Idempotency-Key": _key()})

    name_hex = "Food".encode().hex()
    r = await client.post("/api/v1/envelopes", json={"name_enc": name_hex}, headers=auth)
    env_id = r.json()["id"]

    r = await client.post(
        "/api/v1/ledger/allocate",
        json={"envelope_id": env_id, "amount_cents": 200_000},
        headers={**auth, "Idempotency-Key": _key()},
    )
    assert r.json()["error"]["code"] == "INSUFFICIENT_UNALLOCATED_FUNDS"


# ---------------------------------------------------------------------------
# Savings lock
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_savings_lock(client: AsyncClient) -> None:
    token = await _register_and_login(client, "+254700000050")
    auth = {"Authorization": f"Bearer {token}"}

    await client.post("/api/v1/ledger/deposit", json={"amount_cents": 500_000}, headers={**auth, "Idempotency-Key": _key()})
    await client.post("/api/v1/savings/move-in", json={"amount_cents": 200_000}, headers={**auth, "Idempotency-Key": _key()})
    await client.put("/api/v1/savings/lock", json={"lock_until": "2099-12-31"}, headers=auth)

    r = await client.post("/api/v1/savings/move-out", json={"amount_cents": 100_000}, headers={**auth, "Idempotency-Key": _key()})
    assert r.json()["error"]["code"] == "SAVINGS_LOCKED"


# ---------------------------------------------------------------------------
# Plan limit: free tier max 5 envelopes
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_free_plan_envelope_limit(client: AsyncClient) -> None:
    token = await _register_and_login(client, "+254700000060")
    auth = {"Authorization": f"Bearer {token}"}

    for i in range(5):
        r = await client.post("/api/v1/envelopes", json={"name_enc": f"env{i}".encode().hex()}, headers=auth)
        assert r.status_code == 201

    r = await client.post("/api/v1/envelopes", json={"name_enc": "env6".encode().hex()}, headers=auth)
    assert r.status_code == 403
    assert r.json()["detail"]["code"] == "PLAN_LIMIT_REACHED"


# ---------------------------------------------------------------------------
# Delete envelope returns balance to wallet
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_delete_envelope_returns_balance(client: AsyncClient) -> None:
    token = await _register_and_login(client, "+254700000070")
    auth = {"Authorization": f"Bearer {token}"}

    await client.post("/api/v1/ledger/deposit", json={"amount_cents": 1_000_000}, headers={**auth, "Idempotency-Key": _key()})
    r = await client.post("/api/v1/envelopes", json={"name_enc": "test".encode().hex()}, headers=auth)
    env_id = r.json()["id"]

    await client.post("/api/v1/ledger/allocate", json={"envelope_id": env_id, "amount_cents": 100_000}, headers={**auth, "Idempotency-Key": _key()})

    r = await client.delete(f"/api/v1/envelopes/{env_id}", headers={**auth, "Idempotency-Key": _key()})
    assert r.status_code == 200
    assert r.json()["returned_cents"] == 100_000

    r = await client.get("/api/v1/summary", headers=auth)
    assert r.json()["wallet_cents"] == 1_000_000  # back to full
