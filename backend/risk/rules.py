"""
CryptoGuard — Individual Risk Rules (Phase 1 — Real Implementations)

Each rule is an independent async function.
Input:  normalized transaction dict + wallet history dict
Output: tuple[bool, int] → (triggered, score_contribution)

Weights are LOCKED — imported from constants.py.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from backend.blockchain.constants import (  # type: ignore
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

    Checks three layers:
    1. Direct: from/to IS a Tornado Cash address
    2. Hop chain: any address in hop_chain is Tornado Cash
    3. History: wallet recently interacted with Tornado Cash
    """
    from_a = _addr(tx, "from")
    to_a = _addr(tx, "to")

    # Layer 1 — direct contact
    if from_a in TORNADO_CASH_ADDRESSES or to_a in TORNADO_CASH_ADDRESSES:
        return True, RULE_WEIGHTS["TORNADO_PROXIMITY"]

    # Layer 2 — hop chain contains mixer
    for addr in (tx.get("hop_chain") or []):
        if addr.lower() in TORNADO_CASH_ADDRESSES:
            return True, RULE_WEIGHTS["TORNADO_PROXIMITY"]

    # Layer 3 — wallet history touched a mixer
    for past_tx in wallet_history.get(from_a, []):
        if _addr(past_tx, "from") in TORNADO_CASH_ADDRESSES:
            return True, RULE_WEIGHTS["TORNADO_PROXIMITY"]
        if _addr(past_tx, "to") in TORNADO_CASH_ADDRESSES:
            return True, RULE_WEIGHTS["TORNADO_PROXIMITY"]
        for h in (past_tx.get("hop_chain") or []):
            if h.lower() in TORNADO_CASH_ADDRESSES:
                return True, RULE_WEIGHTS["TORNADO_PROXIMITY"]

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
    history = wallet_history.get(from_a, [])

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
    """>5 transactions in 60 seconds from the same wallet."""
    from_a = _addr(tx, "from")
    history = wallet_history.get(from_a, [])
    tx_time = _parse_ts(tx.get("timestamp"))

    if tx_time:
        # Count txs within the velocity window
        count = 1  # current tx
        for past in history:
            pt = _parse_ts(past.get("timestamp"))
            if pt and abs((tx_time - pt).total_seconds()) <= VELOCITY_WINDOW_SECONDS:
                count += 1  # type: ignore
        if count > VELOCITY_THRESHOLD:
            return True, RULE_WEIGHTS["HIGH_VELOCITY"]
    else:
        # No timestamp — fall back to raw history count
        if len(history) >= VELOCITY_THRESHOLD:
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
