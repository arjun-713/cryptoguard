"""
CryptoGuard — In-Memory Wallet History Store

Tracks per-wallet transaction history so endpoints like
GET /wallet/:address/history can return recent activity.
"""

import aiosqlite
import asyncio
from collections import defaultdict
from typing import Any
from datetime import datetime, timedelta, timezone
from config import settings

DB_PATH = settings.DATABASE_URL.replace("sqlite+aiosqlite:///", "")

# Maximum transactions to keep per wallet in memory
MAX_HISTORY_PER_WALLET = 50

# Global in-memory store: { wallet_address: [tx_dicts] }
_wallet_history: dict[str, list[dict[str, Any]]] = defaultdict(list)

# Global ordered list of all transactions (most recent first)
_all_transactions: list[dict[str, Any]] = []

# Maximum total transactions to keep in memory
MAX_TOTAL_TRANSACTIONS = 500


async def record_transaction(tx: dict[str, Any]) -> None:
    """Record a transaction for both the sender and receiver wallets in memory and SQLite."""
    from_addr = tx.get("from") or tx.get("from_address", "")
    to_addr = tx.get("to") or tx.get("to_address", "")
    tx_hash = tx.get("id") or tx.get("hash") or tx.get("tx_id", "unknown")
    timestamp = tx.get("timestamp") or datetime.now(timezone.utc).isoformat()
    # In case timestamp is numeric (from some simulators)
    if isinstance(timestamp, (int, float)):
        timestamp = datetime.fromtimestamp(timestamp, timezone.utc).isoformat()
    eth_value = tx.get("eth_value", 0.0)
    risk_score = tx.get("risk_score", 0)

    # 1. Update in-memory stores
    for addr in (from_addr, to_addr):
        if addr:
            addr_lower = addr.lower()
            _wallet_history[addr_lower].append(tx)
            # Trim to max
            if len(_wallet_history[addr_lower]) > MAX_HISTORY_PER_WALLET:
                _wallet_history[addr_lower] = _wallet_history[addr_lower][-MAX_HISTORY_PER_WALLET:]

    # Add to global transaction list (prepend — newest first)
    _all_transactions.insert(0, tx)
    if len(_all_transactions) > MAX_TOTAL_TRANSACTIONS:
        _all_transactions.pop()

    # 2. Write to SQLite (Fix 2)
    try:
        async with aiosqlite.connect(DB_PATH) as db:
            # We record for BOTH from and to in the database so we can easily query history for either
            for addr in set(filter(None, [from_addr, to_addr])):
                await db.execute("""
                    INSERT INTO wallet_history (address, tx_hash, timestamp, eth_value, risk_score)
                    VALUES (?, ?, ?, ?, ?)
                """, (addr.lower(), tx_hash, timestamp, eth_value, risk_score))
            await db.commit()
    except Exception as e:
        print(f"❌ Database error in record_transaction: {e}")


async def load_wallet_history_from_db():
    """Load last 90 days of history from SQLite into memory on startup (Fix 2)."""
    ninety_days_ago = (datetime.now(timezone.utc) - timedelta(days=90)).isoformat()
    
    try:
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute("""
                SELECT * FROM wallet_history 
                WHERE timestamp >= ? 
                ORDER BY timestamp ASC
            """, (ninety_days_ago,)) as cursor:
                rows = await cursor.fetchall()
                
                count = 0
                for row in rows:
                    tx = {
                        "id": row["tx_hash"],
                        "hash": row["tx_hash"],
                        "from_address": row["address"],
                        "timestamp": row["timestamp"],
                        "eth_value": row["eth_value"],
                        "risk_score": row["risk_score"]
                    }
                    # Note: This is an approximation as we don't have full tx objects in DB
                    _wallet_history[row["address"].lower()].append(tx)
                    
                    # Also add to all_transactions (at the end since we are ordering ASC)
                    _all_transactions.insert(0, tx)
                    count += 1
                
                # Trim memory stores
                for addr in _wallet_history:
                    if len(_wallet_history[addr]) > MAX_HISTORY_PER_WALLET:
                        _wallet_history[addr] = _wallet_history[addr][-MAX_HISTORY_PER_WALLET:]
                
                if len(_all_transactions) > MAX_TOTAL_TRANSACTIONS:
                    _all_transactions[:] = _all_transactions[:MAX_TOTAL_TRANSACTIONS]
                
                print(f"✅ Loaded {count} historical transactions from SQLite")
    except Exception as e:
        print(f"⚠️ Failed to load wallet history from DB: {e}")


async def run_nightly_cleanup():
    """Delete records older than 90 days (Fix 2)."""
    while True:
        # Run once a day
        await asyncio.sleep(86400)
        ninety_days_ago = (datetime.now(timezone.utc) - timedelta(days=90)).isoformat()
        try:
            async with aiosqlite.connect(DB_PATH) as db:
                await db.execute("DELETE FROM wallet_history WHERE timestamp < ?", (ninety_days_ago,))
                await db.commit()
                print(f"🧹 Purged wallet history older than {ninety_days_ago}")
        except Exception as e:
            print(f"⚠️ Nightly cleanup failed: {e}")


def get_wallet_history(address: str, limit: int = 10) -> list[dict[str, Any]]:
    """Return the last `limit` transactions involving this wallet from memory."""
    return _wallet_history.get(address.lower(), [])[-limit:]


def get_recent_transactions(limit: int = 50) -> list[dict[str, Any]]:
    """Return the most recent `limit` transactions across all wallets from memory."""
    return _all_transactions[:limit]


def get_transaction_by_id(tx_id: str) -> dict[str, Any] | None:
    """Look up a single transaction by its ID from memory."""
    for tx in _all_transactions:
        if tx.get("id") == tx_id or tx.get("tx_id") == tx_id:
            return tx
    return None


def get_transaction_count() -> int:
    """Return the total number of transactions in memory."""
    return len(_all_transactions)


def clear() -> None:
    """Reset all memory stores (useful for testing)."""
    _wallet_history.clear()
    _all_transactions.clear()
