"""
CryptoGuard — Phase 1 Unit Tests

Tests for simulation data schema conformance, wallet store, and bad actor detection.
"""

import json
from pathlib import Path

import pytest

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def simulation_data():
    """Load the simulation dataset."""
    data_path = Path(__file__).resolve().parent.parent / "docs" / "simulation-data.json"
    with open(data_path, "r") as f:
        return json.load(f)


@pytest.fixture
def sample_tx():
    """A single enriched transaction dict (as the simulator would produce)."""
    return {
        "id": "test_001",
        "hash": "0xaaaa",
        "from_address": "0x1111111111111111111111111111111111111111",
        "to_address": "0x2222222222222222222222222222222222222222",
        "eth_value": 1.5,
        "risk_score": 10,
        "risk_tier": "low",
        "triggered_rules": [],
        "hop_chain": None,
        "ai_explanation": None,
        "timestamp": "2026-03-07T09:00:00+00:00",
    }


# ---------------------------------------------------------------------------
# Test 1: Schema conformance — every simulation tx has required fields
# ---------------------------------------------------------------------------

REQUIRED_FIELDS = {"id", "hash", "from", "to", "eth_value", "risk_score", "risk_tier"}


def test_schema_conformance(simulation_data):
    """Every transaction in simulation-data.json must have the required fields."""
    transactions = simulation_data["transactions"]
    assert len(transactions) > 0, "No transactions found in simulation data"

    for tx in transactions:
        missing = REQUIRED_FIELDS - set(tx.keys())
        assert not missing, (
            f"Transaction {tx.get('id', '???')} is missing fields: {missing}"
        )
        # Value checks
        assert isinstance(tx["eth_value"], (int, float)), f"eth_value must be numeric in {tx['id']}"
        assert 0 <= tx["risk_score"] <= 100, f"risk_score out of range in {tx['id']}"
        assert tx["risk_tier"] in ("low", "medium", "critical"), (
            f"Invalid risk_tier '{tx['risk_tier']}' in {tx['id']}"
        )


# ---------------------------------------------------------------------------
# Test 2: Wallet store records and retrieves correctly
# ---------------------------------------------------------------------------

def test_wallet_store_records(sample_tx):
    """After recording a transaction, both wallets should appear in history."""
    from backend.blockchain import wallet_store

    wallet_store.clear()

    wallet_store.record_transaction(sample_tx)

    # From-wallet history
    from_hist = wallet_store.get_wallet_history(sample_tx["from_address"])
    assert len(from_hist) == 1
    assert from_hist[0]["id"] == "test_001"

    # To-wallet history
    to_hist = wallet_store.get_wallet_history(sample_tx["to_address"])
    assert len(to_hist) == 1
    assert to_hist[0]["id"] == "test_001"

    # Global store
    recent = wallet_store.get_recent_transactions()
    assert len(recent) == 1

    # Lookup by ID
    found = wallet_store.get_transaction_by_id("test_001")
    assert found is not None
    assert found["eth_value"] == 1.5

    wallet_store.clear()


# ---------------------------------------------------------------------------
# Test 3: Bad actor detection
# ---------------------------------------------------------------------------

def test_bad_actor_detection():
    """Known suspicious addresses should be flagged; clean addresses should not."""
    from backend.blockchain.bad_actors import is_bad_actor, get_bad_actor_label

    # Known bad actors
    assert is_bad_actor("0xd4b88df4d29f5cedd6857912842cff3b20c8cfa3")  # Tornado Cash Pool
    assert is_bad_actor("0xef56ab78cd90ef56ab78cd90ef56ab78cd90ef56")  # Rug Pull Deployer

    # Case-insensitive
    assert is_bad_actor("0xD4B88DF4D29F5CEDD6857912842CFF3B20C8CFA3")

    # Clean address — NOT a bad actor
    assert not is_bad_actor("0x4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e")

    # Label lookup
    label = get_bad_actor_label("0xd4b88df4d29f5cedd6857912842cff3b20c8cfa3")
    assert label == "Tornado Cash Pool"

    assert get_bad_actor_label("0x0000000000000000000000000000000000000000") is None
