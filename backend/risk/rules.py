"""
CryptoGuard — Individual Risk Rules (Phase 1 — Real Implementations)

Each rule is an independent async function.
Input:  normalized transaction dict + wallet history dict
Output: tuple[bool, int] → (triggered, score_contribution)

Weights are LOCKED — imported from constants.py.
"""

from __future__ import annotations

import math
from collections import deque
from datetime import datetime, timezone
from typing import Any

from blockchain.constants import (  # type: ignore
    TORNADO_CASH_ADDRESSES,
    RULE_WEIGHTS,
    VELOCITY_WINDOW_SECONDS,
    VELOCITY_THRESHOLD,
    PEEL_CHAIN_THRESHOLD_PERCENT,
    PEEL_CHAIN_WINDOW_SECONDS,
    LARGE_VALUE_ETH,
    NEW_WALLET_AGE_DAYS,
)


# ── Helpers ─────────────────────────────────────────────────────────────


def _addr(tx: dict, key: str) -> str:
    """Get address field, handling 'from'/'from_address' key variants."""
    val = tx.get(f"{key}_address") or tx.get(key) or ""
    return val.lower().strip()


def _parse_ts(raw: Any) -> datetime | None:
    """Best-effort ISO / epoch timestamp → UTC datetime."""
    if raw is None:
        return None
    try:
        if isinstance(raw, (int, float)):
            return datetime.fromtimestamp(raw, tz=timezone.utc)
        s = str(raw).strip()
        if not s:
            return None
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except (ValueError, TypeError, OSError):
        return None


def _get_history(tx: dict, wallet_history: dict, addr: str) -> list:
    """Get history for an address, merging wallet_history dict and inline tx data."""
    history = wallet_history.get(addr, [])
    # If this is the sender, also consider any history attached to the transaction itself
    if addr == _addr(tx, "from"):
        inline = tx.get("from_wallet_recent_txs", [])
        if inline:
            # Simple concat is enough for rule logic as they handle duplicates/IDs
            return list(history) + list(inline)
    return history


# ── Rule 1: BLACKLIST_HIT  (+40) ────────────────────────────────────────


async def check_blacklist_hit(
    tx: dict[str, Any],
    wallet_history: dict[str, Any],
    blacklist: set[str] | None = None,
) -> tuple[bool, int]:
    """Wallet appears in OFAC sanctions list or MEW dark list."""
    from_a = _addr(tx, "from")
    to_a = _addr(tx, "to")

    # Tornado Cash contracts are always blacklisted
    combined = set(TORNADO_CASH_ADDRESSES)
    if blacklist:
        combined |= {a.lower() for a in blacklist}

    if from_a in combined or to_a in combined:
        return True, RULE_WEIGHTS["BLACKLIST_HIT"]

    return False, 0


# ── Rule 2: TORNADO_PROXIMITY  (+35) ────────────────────────────────────


async def check_tornado_proximity(
    tx: dict[str, Any],
    wallet_history: dict[str, Any],
) -> tuple[bool, int]:
    """Funds routed through or directly from a known mixer address.

    Implementation: Breadth-First Search (BFS) up to 3 hops deep using
    wallet_history as the adjacency list.
    """
    from_a = _addr(tx, "from")
    to_a = _addr(tx, "to")
    hop_chain = [a.lower() for a in (tx.get("hop_chain") or [])]

    # BFS Initialization
    queue = deque()
    visited = set()

    # Starting nodes (depth 0)
    start_nodes = {from_a, to_a} | set(hop_chain)
    for node in start_nodes:
        if not node:
            continue
        if node in TORNADO_CASH_ADDRESSES:
            return True, RULE_WEIGHTS["TORNADO_PROXIMITY"]
        queue.append((node, 0))
        visited.add(node)

    while queue:
        current_node, depth = queue.popleft()
        if depth >= 3:
            continue

        # Explore neighbors from provided history
        # wallet_history keys are addresses, values are lists of transactions
        for past_tx in _get_history(tx, wallet_history, current_node):
            # Potential neighbors: from, to, and any hops in past transaction
            potential_neighbors = {
                _addr(past_tx, "from"),
                _addr(past_tx, "to")
            } | {a.lower() for a in (past_tx.get("hop_chain") or [])}

            for neighbor in potential_neighbors:
                if not neighbor or neighbor in visited:
                    continue
                if neighbor in TORNADO_CASH_ADDRESSES:
                    return True, RULE_WEIGHTS["TORNADO_PROXIMITY"]
                queue.append((neighbor, depth + 1))
                visited.add(neighbor)

    return False, 0


# ── Rule 3: PEEL_CHAIN  (+30) ──────────────────────────────────────────


async def check_peel_chain(
    tx: dict[str, Any],
    wallet_history: dict[str, Any],
) -> tuple[bool, int]:
    """Received + re-sent >80% within 10 minutes.

    Fast path: hop_chain with ≥3 entries means the tx is part of a
    documented multi-hop fund flow (origin → intermediary → current).

    Slow path: check the wallet's cumulative inflow vs outflow within
    the PEEL_CHAIN_WINDOW to detect receive-and-forward behaviour.
    """
    # ── fast path: documented hop chain ──
    hop_chain = tx.get("hop_chain") or []
    if len(hop_chain) >= 3:
        return True, RULE_WEIGHTS["PEEL_CHAIN"]

    # ── slow path: inflow / outflow ratio ──
    from_a = _addr(tx, "from")
    eth_out = tx.get("eth_value", 0.0)
    tx_time = _parse_ts(tx.get("timestamp"))
    history = _get_history(tx, wallet_history, from_a)

    if not history:
        return False, 0

    def _in_window(past: dict) -> bool:
        if tx_time is None:
            return True  # no timestamp → assume recent
        pt = _parse_ts(past.get("timestamp"))
        if pt is None:
            return True
        return abs((tx_time - pt).total_seconds()) <= PEEL_CHAIN_WINDOW_SECONDS

    # Sum inflows (wallet was recipient)
    total_in = sum(
        past.get("eth_value", 0.0)
        for past in history
        if _addr(past, "to") == from_a and _in_window(past)
    )

    if total_in <= 0:
        return False, 0

    # Sum outflows (wallet was sender), including current tx
    total_out = eth_out + sum(
        past.get("eth_value", 0.0)
        for past in history
        if _addr(past, "from") == from_a
        and past.get("id") != tx.get("id")
        and _in_window(past)
    )

    if total_out / total_in >= PEEL_CHAIN_THRESHOLD_PERCENT:
        return True, RULE_WEIGHTS["PEEL_CHAIN"]

    return False, 0


# ── Rule 4: HIGH_VELOCITY  (+25) ───────────────────────────────────────


async def check_high_velocity(
    tx: dict[str, Any],
    wallet_history: dict[str, Any],
) -> tuple[bool, int]:
    """Detect unusual transaction frequency using statistical Z-score deviation."""
    from_a = _addr(tx, "from")
    history = _get_history(tx, wallet_history, from_a)
    tx_time = _parse_ts(tx.get("timestamp"))

    if not tx_time:
        tx_time = datetime.now(timezone.utc)

    # Need at least 5 historical transactions with timestamps to calculate Z-score
    timestamps = sorted([
        _parse_ts(p.get("timestamp"))
        for p in history[-20:]
        if _parse_ts(p.get("timestamp"))
    ])

    # 1. Baseline Safety: Always check static volume threshold first
    count = 1
    for past in history:
        pt = _parse_ts(past.get("timestamp"))
        if pt and abs((tx_time - pt).total_seconds()) <= VELOCITY_WINDOW_SECONDS:
            count += 1
    if count > VELOCITY_THRESHOLD:
        return True, RULE_WEIGHTS["HIGH_VELOCITY"]

    # 2. Statistical Z-score deviation check (detecting spikes)
    # If we have enough history, check if this specific tx is anomalously fast
    if len(timestamps) >= 5:
        # Calculate inter-arrival time gaps (seconds)
        gaps = []
        for i in range(1, len(timestamps)):
            gap = (timestamps[i] - timestamps[i - 1]).total_seconds()
            gaps.append(max(gap, 0.001))

        # Current gap (between previous and now)
        current_gap = (tx_time - timestamps[-1]).total_seconds()
        current_gap = max(current_gap, 0.001)

        mean_gap = sum(gaps) / len(gaps)
        variance = sum((g - mean_gap) ** 2 for g in gaps) / len(gaps)
        std_dev = math.sqrt(variance)

        if std_dev >= 0.001:
            # Look for "Faster than normal" (Small current_gap -> high positive Z)
            z_score = (mean_gap - current_gap) / std_dev
            if z_score > 2.0:
                return True, RULE_WEIGHTS["HIGH_VELOCITY"]

    return False, 0


# ── Rule 5: LARGE_VALUE  (+20) ─────────────────────────────────────────


async def check_large_value(
    tx: dict[str, Any],
    wallet_history: dict[str, Any],
) -> tuple[bool, int]:
    """Transaction value ≥ 10 ETH."""
    if tx.get("eth_value", 0.0) >= LARGE_VALUE_ETH:
        return True, RULE_WEIGHTS["LARGE_VALUE"]
    return False, 0


# ── Rule 6: NEW_WALLET  (+10) ──────────────────────────────────────────


async def check_new_wallet(
    tx: dict[str, Any],
    wallet_history: dict[str, Any],
) -> tuple[bool, int]:
    """Wallet age <7 days AND high-value transaction."""
    eth_value = tx.get("eth_value", 0.0)
    nonce = tx.get("nonce")
    age_days = tx.get("from_wallet_age_days")

    is_new = False
    if age_days is not None and age_days < NEW_WALLET_AGE_DAYS:
        is_new = True
    elif nonce is not None and nonce <= 2:
        # Very low nonce = strong signal of new wallet
        is_new = True

    if is_new and eth_value >= LARGE_VALUE_ETH:
        return True, RULE_WEIGHTS["NEW_WALLET"]

    return False, 0
