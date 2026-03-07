"""
CryptoGuard — Risk Scoring Engine
Main entry point: score_transaction(tx, wallet_history)

Takes a normalized transaction dict, runs all 6 rules, sums the scores
(capped at 100), determines the risk tier, and returns a RiskResult dict.

This function MUST complete in <10ms.  No network calls.
"""

import time
from typing import Any

from blockchain.constants import (  # type: ignore
    RULE_WEIGHTS,
    TIER_LOW_MAX,
    TIER_MEDIUM_MAX,
)
from risk.rules import (  # type: ignore
    check_blacklist_hit,
    check_tornado_proximity,
    check_peel_chain,
    check_high_velocity,
    check_large_value,
    check_new_wallet,
)


from config import settings


def _determine_tier(score: int) -> str:
    """Map numeric score to risk tier string using configurable thresholds."""
    if score < settings.MONITOR_THRESHOLD:
        return "low"
    elif score < settings.HOLD_THRESHOLD:
        return "medium"
    else:
        return "critical"


async def score_transaction(
    tx: dict[str, Any],
    wallet_history: dict[str, Any] | None = None,
    blacklist: set[str] | None = None,
) -> dict[str, Any]:
    """
    Score a single transaction against all 6 risk rules.

    Args:
        tx: Normalized transaction dict with keys:
            - id, hash, from_address, to_address, eth_value,
              gas_price_gwei, nonce, timestamp
        wallet_history: Dict of recent transactions per wallet address.
        blacklist: Optional set of known-bad wallet addresses (MEW dark list).

    Returns:
        RiskResult dict matching the frontend's expected shape:
        {
            "id": str,
            "hash": str,
            "from_address": str,
            "to_address": str,
            "eth_value": float,
            "risk_score": int,        # 0–100
            "risk_tier": str,         # "low" | "medium" | "critical"
            "triggered_rules": list,  # e.g. ["BLACKLIST_HIT", "LARGE_VALUE"]
            "hop_chain": list | None,
            "ai_explanation": str | None,
            "timestamp": str,
            "scored_at_ms": int,
        }
    """
    if wallet_history is None:
        wallet_history = {}

    if blacklist is None:
        blacklist = set()

    start_ms = int(time.time() * 1000)
    
    # ------------------------------------------------------------------
    # Pre-scoring Edge Case Hardening (Phase 4)
    # ------------------------------------------------------------------
    # 1. Missing history
    if not wallet_history.get(tx.get("from_address", "")):
        pass  # Defaults empty, won't crash

    # 2 & 5. Empty destinations and array length mismatch
    base_score_modifier = 0
    to_w = tx.get("to_wallets", [])
    amts = tx.get("amounts", [])
    
    if not tx.get("to_address") and not tx.get("to") and not to_w:
        # No destination address specified — highly unusual structure
        base_score_modifier += 15
        
    if isinstance(to_w, list) and isinstance(amts, list):
        if to_w and len(to_w) != len(amts):
            import logging
            logging.warning("Transaction format error: amounts array length doesn't match to_wallets length. Scoring available data.")

    # 3. Missing age & 4. Missing value are naturally handled by our rules
    # which use .get() defaulting to 0 or None securely.
    
    tx["_base_modifier"] = base_score_modifier

    # ------------------------------------------------------------------
    # Run all 6 rules
    # ------------------------------------------------------------------
    rules = [
        ("BLACKLIST_HIT",      check_blacklist_hit(tx, wallet_history, blacklist)),
        ("TORNADO_PROXIMITY",  check_tornado_proximity(tx, wallet_history)),
        ("PEEL_CHAIN",         check_peel_chain(tx, wallet_history)),
        ("HIGH_VELOCITY",      check_high_velocity(tx, wallet_history)),
        ("LARGE_VALUE",        check_large_value(tx, wallet_history)),
        ("NEW_WALLET",         check_new_wallet(tx, wallet_history)),
    ]

    triggered_rules: list[str] = []
    total_score: int = int(tx.get("_base_modifier", 0))

    for rule_name, rule_coro in rules:
        triggered, contribution = await rule_coro
        if triggered:
            triggered_rules.append(rule_name)
            total_score += contribution  # type: ignore

    # Cap at 100
    total_score = min(total_score, 100)

    risk_tier = _determine_tier(total_score)

    # ------------------------------------------------------------------
    # Build RiskResult
    # ------------------------------------------------------------------
    result: dict[str, Any] = {
        "id":               tx.get("id", ""),
        "hash":             tx.get("hash", ""),
        "from_address":     tx.get("from_address", tx.get("from", "")),
        "to_address":       tx.get("to_address", tx.get("to", "")),
        "eth_value":        tx.get("eth_value", 0.0),
        "risk_score":       total_score,
        "risk_tier":        risk_tier,
        "triggered_rules":  triggered_rules,
        "hop_chain":        tx.get("hop_chain", None),
        "ai_explanation":   None,  # Filled later by explainer for medium/critical
        "timestamp":        tx.get("timestamp", ""),
        "scored_at_ms":     start_ms,
    }

    return result
