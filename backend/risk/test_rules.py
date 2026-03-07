"""
Phase 1 — Rule Tests Against Simulation Data Patterns.

Tests each rule against realistic scenarios matching docs/simulation-data.json.
Run: python -m pytest backend/risk/test_rules.py -v
"""

import asyncio
import pytest

from backend.risk.rules import (
    check_blacklist_hit,
    check_tornado_proximity,
    check_peel_chain,
    check_high_velocity,
    check_large_value,
    check_new_wallet,
)
from backend.blockchain.constants import TORNADO_CASH_ADDRESSES, RULE_WEIGHTS


# ── Helpers ──────────────────────────────────────────────────────────────

def run(coro):
    """Run async function in sync context."""
    return asyncio.run(coro)


TORNADO_ADDR = list(TORNADO_CASH_ADDRESSES)[0]  # 0xd4b88df4...


# ── Test BLACKLIST_HIT (+40) ─────────────────────────────────────────────

class TestBlacklistHit:

    def test_from_tornado_cash(self):
        """sim_006: from_address IS a Tornado Cash contract."""
        tx = {"from": TORNADO_ADDR, "to": "0xab12", "eth_value": 49.8}
        triggered, score = run(check_blacklist_hit(tx, {}, None))
        assert triggered is True
        assert score == 40

    def test_clean_wallet(self):
        """sim_001: normal tx, neither address in any blacklist."""
        tx = {"from": "0xclean1", "to": "0xclean2", "eth_value": 0.25}
        triggered, _ = run(check_blacklist_hit(tx, {}, None))
        assert triggered is False

    def test_external_blacklist(self):
        """sim_014: from_address in the MEW dark list (loaded externally)."""
        rug_pull = "0xef56ab78cd90ef56ab78cd90ef56ab78cd90ef56"
        tx = {"from": rug_pull, "to": "0xbinance", "eth_value": 87.4}
        blacklist = {rug_pull}
        triggered, score = run(check_blacklist_hit(tx, {}, blacklist))
        assert triggered is True
        assert score == 40

    def test_to_address_in_blacklist(self):
        """Edge case: recipient is blacklisted."""
        tx = {"from": "0xclean", "to": TORNADO_ADDR, "eth_value": 5.0}
        triggered, _ = run(check_blacklist_hit(tx, {}, None))
        assert triggered is True


# ── Test TORNADO_PROXIMITY (+35) ─────────────────────────────────────────

class TestTornadoProximity:

    def test_direct_from_tornado(self):
        """sim_006: from_address IS Tornado Cash."""
        tx = {"from": TORNADO_ADDR, "to": "0xab12", "eth_value": 49.8}
        triggered, score = run(check_tornado_proximity(tx, {}))
        assert triggered is True
        assert score == 35

    def test_hop_chain_contains_tornado(self):
        """sim_007: hop_chain starts with Tornado Cash address."""
        tx = {
            "from": "0xab12", "to": "0xbc23", "eth_value": 24.9,
            "hop_chain": [TORNADO_ADDR, "0xab12", "0xbc23"],
        }
        triggered, score = run(check_tornado_proximity(tx, {}))
        assert triggered is True
        assert score == 35

    def test_wallet_history_touched_tornado(self):
        """Wallet previously received from Tornado Cash (not in hop_chain)."""
        tx = {"from": "0xab12", "to": "0xsome_dest", "eth_value": 10.0}
        history = {
            "0xab12": [
                {"from": TORNADO_ADDR, "to": "0xab12", "eth_value": 49.8}
            ],
        }
        triggered, score = run(check_tornado_proximity(tx, history))
        assert triggered is True
        assert score == 35

    def test_clean_no_proximity(self):
        """sim_001: no mixer connection at any layer."""
        tx = {"from": "0xclean", "to": "0xclean2", "eth_value": 0.25}
        triggered, _ = run(check_tornado_proximity(tx, {}))
        assert triggered is False


# ── Test PEEL_CHAIN (+30) ────────────────────────────────────────────────

class TestPeelChain:

    def test_hop_chain_3_plus(self):
        """sim_007: hop_chain has 3 entries → fast-path trigger."""
        tx = {
            "id": "sim_007", "from": "0xab12", "to": "0xbc23",
            "eth_value": 24.9,
            "hop_chain": [TORNADO_ADDR, "0xab12", "0xbc23"],
        }
        triggered, score = run(check_peel_chain(tx, {}))
        assert triggered is True
        assert score == 30

    def test_hop_chain_5_entries(self):
        """sim_020: 5-hop chain → fast-path trigger."""
        tx = {
            "id": "sim_020", "from": "0xde45", "to": "0x1a2b",
            "eth_value": 24.3,
            "hop_chain": [TORNADO_ADDR, "0xab12", "0xbc23", "0xde45", "0x1a2b"],
        }
        triggered, score = run(check_peel_chain(tx, {}))
        assert triggered is True
        assert score == 30

    def test_hop_chain_too_short(self):
        """sim_006: hop_chain has only 2 entries → no fast-path trigger."""
        tx = {
            "id": "sim_006", "from": TORNADO_ADDR, "to": "0xab12",
            "eth_value": 49.8,
            "hop_chain": [TORNADO_ADDR, "0xab12"],
        }
        triggered, _ = run(check_peel_chain(tx, {}))
        assert triggered is False

    def test_slow_path_forward_ratio(self):
        """Wallet received 50 ETH, now forwarding 45 ETH (90%) → trigger."""
        tx = {
            "id": "tx_out", "from": "0xab12", "to": "0xdest",
            "eth_value": 45.0, "timestamp": "2025-03-01T00:05:00Z",
        }
        history = {
            "0xab12": [
                {"id": "tx_in", "from": "0xsrc", "to": "0xab12",
                 "eth_value": 50.0, "timestamp": "2025-03-01T00:00:00Z"},
            ],
        }
        triggered, score = run(check_peel_chain(tx, history))
        assert triggered is True
        assert score == 30

    def test_no_peel_chain_normal(self):
        """Normal tx, no hop chain, no forwarding history → no trigger."""
        tx = {"id": "normal", "from": "0xclean", "to": "0xclean2", "eth_value": 0.5}
        triggered, _ = run(check_peel_chain(tx, {}))
        assert triggered is False


# ── Test HIGH_VELOCITY (+25) ─────────────────────────────────────────────

class TestHighVelocity:

    def test_six_txs_in_window(self):
        """sim_011-013 pattern: same wallet fires 6+ txs in 60 seconds."""
        base = "2025-03-01T00:00:"
        tx = {"from": "0xcd34", "eth_value": 4.1, "timestamp": f"{base}58Z"}
        history = {
            "0xcd34": [
                {"from": "0xcd34", "to": "0xa", "timestamp": f"{base}00Z", "eth_value": 1},
                {"from": "0xcd34", "to": "0xb", "timestamp": f"{base}10Z", "eth_value": 2},
                {"from": "0xcd34", "to": "0xc", "timestamp": f"{base}20Z", "eth_value": 3},
                {"from": "0xcd34", "to": "0xd", "timestamp": f"{base}30Z", "eth_value": 4},
                {"from": "0xcd34", "to": "0xe", "timestamp": f"{base}40Z", "eth_value": 5},
            ],
        }
        triggered, score = run(check_high_velocity(tx, history))
        assert triggered is True
        assert score == 25

    def test_two_txs_no_trigger(self):
        """Only 2 txs in window → below threshold."""
        tx = {"from": "0xwallet", "eth_value": 1.0, "timestamp": "2025-03-01T00:01:00Z"}
        history = {
            "0xwallet": [
                {"from": "0xwallet", "to": "0xa", "timestamp": "2025-03-01T00:00:30Z"},
            ],
        }
        triggered, _ = run(check_high_velocity(tx, history))
        assert triggered is False

    def test_outside_window(self):
        """6 txs but spread over 10 minutes → no trigger."""
        tx = {"from": "0xw", "eth_value": 1.0, "timestamp": "2025-03-01T00:10:00Z"}
        history = {
            "0xw": [
                {"from": "0xw", "timestamp": f"2025-03-01T00:0{i}:00Z"} for i in range(6)
            ],
        }
        triggered, _ = run(check_high_velocity(tx, history))
        assert triggered is False


# ── Test LARGE_VALUE (+20) ───────────────────────────────────────────────

class TestLargeValue:

    def test_above_threshold(self):
        """sim_006: 49.8 ETH ≥ 10 ETH → trigger."""
        tx = {"eth_value": 49.8}
        triggered, score = run(check_large_value(tx, {}))
        assert triggered is True
        assert score == 20

    def test_exactly_threshold(self):
        """10 ETH exactly → trigger."""
        tx = {"eth_value": 10.0}
        triggered, _ = run(check_large_value(tx, {}))
        assert triggered is True

    def test_below_threshold(self):
        """sim_001: 0.25 ETH → no trigger."""
        tx = {"eth_value": 0.25}
        triggered, _ = run(check_large_value(tx, {}))
        assert triggered is False


# ── Test NEW_WALLET (+10) ────────────────────────────────────────────────

class TestNewWallet:

    def test_low_nonce_high_value(self):
        """sim_004: nonce=1, 12.5 ETH → trigger."""
        tx = {"from": "0xnew", "eth_value": 12.5, "nonce": 1}
        triggered, score = run(check_new_wallet(tx, {}))
        assert triggered is True
        assert score == 10

    def test_explicit_age(self):
        """Wallet age 3 days, 15 ETH → trigger."""
        tx = {"from": "0xnew", "eth_value": 15.0, "from_wallet_age_days": 3}
        triggered, score = run(check_new_wallet(tx, {}))
        assert triggered is True
        assert score == 10

    def test_new_but_low_value(self):
        """New wallet with 0.5 ETH → no trigger (not high value)."""
        tx = {"from": "0xnew", "eth_value": 0.5, "nonce": 0}
        triggered, _ = run(check_new_wallet(tx, {}))
        assert triggered is False

    def test_old_wallet(self):
        """Wallet with high nonce and old age → no trigger."""
        tx = {"from": "0xold", "eth_value": 50.0, "nonce": 500,
              "from_wallet_age_days": 365}
        triggered, _ = run(check_new_wallet(tx, {}))
        assert triggered is False
