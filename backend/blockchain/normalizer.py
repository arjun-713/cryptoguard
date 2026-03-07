"""
backend/blockchain/normalizer.py

Converts raw Alchemy pending transaction format into the normalized
transaction dict that scorer.py expects.

DO NOT import from scorer.py here — this file has no dependencies
on the rest of the risk engine. It only does data transformation.
"""

import time
from datetime import datetime, timezone
from typing import Optional


# Minimum ETH value to process — imported from constants
# Transactions below this threshold are ignored entirely
from blockchain.constants import MIN_ETH_VALUE_FILTER


def hex_to_eth(hex_value: str) -> float:
    """
    Convert a hex Wei string to a float ETH value.
    
    Example:
        "0xde0b6b3a7640000" → 1.0 ETH
        "0x0" → 0.0 ETH
        "" → 0.0 ETH
    """
    if not hex_value or hex_value == "0x":
        return 0.0
    try:
        return int(hex_value, 16) / 1e18
    except (ValueError, TypeError):
        return 0.0


def hex_to_int(hex_value: str) -> int:
    """
    Convert a hex string to an integer.
    
    Example:
        "0x4" → 4
        "0x0" → 0
        "" → 0
    """
    if not hex_value or hex_value == "0x":
        return 0
    try:
        return int(hex_value, 16)
    except (ValueError, TypeError):
        return 0


def normalize_tx(raw_tx: dict) -> Optional[dict]:
    """
    Convert a raw Alchemy pending transaction into the normalized
    format expected by scorer.py.

    Returns None if the transaction should be filtered out (value
    too low, missing required fields, or malformed data).

    Args:
        raw_tx: Raw transaction dict from Alchemy WebSocket stream

    Returns:
        Normalized transaction dict or None if transaction should 
        be filtered
    """

    # --- Guard: required fields must exist ---
    # A transaction without a hash or sender address is unusable
    if not raw_tx.get("hash"):
        return None
    if not raw_tx.get("from"):
        return None

    # --- Extract and convert ETH value ---
    raw_value = raw_tx.get("value", "0x0")
    eth_value = hex_to_eth(raw_value)

    # --- Filter: ignore low-value transactions ---
    # The mempool produces ~120 tx/second. Without this filter
    # the risk engine gets flooded with dust transactions.
    # MIN_ETH_VALUE_FILTER is defined in constants.py (default: 0.1)
    if eth_value < MIN_ETH_VALUE_FILTER:
        return None

    # --- Extract and convert nonce ---
    raw_nonce = raw_tx.get("nonce", "0x0")
    nonce = hex_to_int(raw_nonce)

    # --- Handle missing "to" address ---
    # Contract creation transactions have no "to" field
    # Set to empty string so scorer.py doesn't crash
    to_address = raw_tx.get("to") or ""

    # --- Build normalized transaction ---
    normalized = {
        # Identity
        "hash": raw_tx["hash"],
        "tx_id": raw_tx["hash"],          # scorer.py uses tx_id

        # Addresses — renamed from Alchemy's "from"/"to" format
        "from_address": raw_tx["from"].lower(),
        "to_address": to_address.lower() if to_address else "",

        # Value
        "eth_value": round(eth_value, 6),

        # Timing — mempool txs have no timestamp, use current UTC
        "timestamp": datetime.now(timezone.utc).isoformat(),

        # Nonce — used by NEW_WALLET rule (nonce <= 2 = new wallet)
        "nonce": nonce,

        # Fields not available from mempool data
        # scorer.py handles None/empty gracefully
        "wallet_age_days": None,
        "hop_chain": [],
        "from_wallet_recent_txs": [],

        # Chain identifier
        "chain": "ethereum",
    }

    return normalized


def is_interesting(normalized_tx: dict) -> bool:
    """
    Secondary filter applied after normalization.
    Returns True if the transaction is worth scoring.

    This catches edge cases that normalize_tx doesn't filter:
    - Contract creation (empty to_address)  
    - Suspiciously malformed transactions
    """
    if not normalized_tx:
        return False

    # Skip pure contract creations with no destination
    # (these are not scam/laundering targets)
    if not normalized_tx.get("to_address"):
        return False

    return True
