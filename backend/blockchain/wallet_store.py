"""
CryptoGuard — In-Memory Wallet History Store

Tracks per-wallet transaction history so endpoints like
GET /wallet/:address/history can return recent activity.
"""

from __future__ import annotations
from collections import defaultdict
from typing import Any

# Maximum transactions to keep per wallet
MAX_HISTORY_PER_WALLET = 50

# Global in-memory store: { wallet_address: [tx_dicts] }
_wallet_history: dict[str, list[dict[str, Any]]] = defaultdict(list)

# Global ordered list of all transactions (most recent first)
_all_transactions: list[dict[str, Any]] = []

# Maximum total transactions to keep in memory
MAX_TOTAL_TRANSACTIONS = 500


def record_transaction(tx: dict[str, Any]) -> None:
    """Record a transaction for both the sender and receiver wallets."""
    from_addr = tx.get("from") or tx.get("from_address", "")
    to_addr = tx.get("to") or tx.get("to_address", "")

    # Add to per-wallet history
    for addr in (from_addr, to_addr):
        if addr:
            _wallet_history[addr.lower()].append(tx)
            # Trim to max
            if len(_wallet_history[addr.lower()]) > MAX_HISTORY_PER_WALLET:
                _wallet_history[addr.lower()] = _wallet_history[addr.lower()][-MAX_HISTORY_PER_WALLET:]

    # Add to global transaction list (prepend — newest first)
    _all_transactions.insert(0, tx)
    if len(_all_transactions) > MAX_TOTAL_TRANSACTIONS:
        _all_transactions.pop()


def get_wallet_history(address: str, limit: int = 10) -> list[dict[str, Any]]:
    """Return the last `limit` transactions involving this wallet."""
    return _wallet_history.get(address.lower(), [])[-limit:]


def get_recent_transactions(limit: int = 50) -> list[dict[str, Any]]:
    """Return the most recent `limit` transactions across all wallets."""
    return _all_transactions[:limit]


def get_transaction_by_id(tx_id: str) -> dict[str, Any] | None:
    """Look up a single transaction by its ID."""
    for tx in _all_transactions:
        if tx.get("id") == tx_id or tx.get("tx_id") == tx_id:
            return tx
    return None


def get_transaction_count() -> int:
    """Return the total number of transactions in the store."""
    return len(_all_transactions)


def clear() -> None:
    """Reset all stores (useful for testing)."""
    _wallet_history.clear()
    _all_transactions.clear()
