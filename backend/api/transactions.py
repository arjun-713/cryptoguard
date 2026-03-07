"""
CryptoGuard — Transaction API Routes

Endpoints for transaction listing, lookup, wallet history, and scoring.
"""

from datetime import datetime, timezone
from fastapi import APIRouter

from blockchain import wallet_store
from blockchain.bad_actors import is_bad_actor

router = APIRouter(prefix="/api", tags=["transactions"])


# ---------------------------------------------------------------------------
# GET /api/transactions — last 50 transactions
# ---------------------------------------------------------------------------

@router.get("/transactions")
async def get_transactions():
    """Return last 50 transactions from the in-memory store."""
    return wallet_store.get_recent_transactions(limit=50)


# ---------------------------------------------------------------------------
# GET /api/transactions/recent — last 20 transactions (Phase 2)
# ---------------------------------------------------------------------------

@router.get("/transactions/recent")
async def get_recent_transactions():
    """Return last 20 transactions (compact endpoint for dashboards)."""
    return wallet_store.get_recent_transactions(limit=20)


# ---------------------------------------------------------------------------
# GET /api/transactions/{tx_id} — single transaction
# ---------------------------------------------------------------------------

@router.get("/transactions/{tx_id}")
async def get_transaction(tx_id: str):
    """Return a single transaction by ID."""
    tx = wallet_store.get_transaction_by_id(tx_id)
    if tx is None:
        return {"detail": "Transaction not found", "tx_id": tx_id}
    return tx


# ---------------------------------------------------------------------------
# POST /api/transactions/score — score a transaction (stub scorer)
# ---------------------------------------------------------------------------

@router.post("/transactions/score")
async def score_transaction(body: dict):
    """
    Accept { tx_id } and return a risk score.
    Wires into M2's backend.risk.scorer.scoreTransaction if available.
    Otherwise gracefully falls back to stub_v1 logic.
    """
    tx_id = body.get("tx_id", "")
    tx = wallet_store.get_transaction_by_id(tx_id)

    if tx is None:
        return {"detail": "Transaction not found", "tx_id": tx_id}

    # Enrich with wallet history
    from_address = tx.get("from_address", "")
    wallet_history = wallet_store.get_wallet_history(from_address, limit=10)

    # 1. Try to use M2's real scorer
    try:
        from risk.scorer import score_transaction as m2_score_transaction
        
        # Prepare the correctly formatted wallet history dict
        wallet_history_dict = {from_address: wallet_history}
        
        # Call the real scorer (async)
        res = await m2_score_transaction(tx, wallet_history_dict)
        
        # Update our record with real rules if it triggered any
        tx["risk_score"] = res.get("risk_score", 0)
        tx["risk_tier"] = res.get("risk_tier", "low")
        tx["triggered_rules"] = res.get("triggered_rules", [])

        return {
            "tx_id": tx_id,
            "risk_score": res.get("risk_score", 0),
            "risk_tier": res.get("risk_tier", "low"),
            "triggered_rules": res.get("triggered_rules", []),
            "from_address": from_address,
            "wallet_history_count": len(wallet_history),
            "is_known_bad_actor": is_bad_actor(from_address),
            "scored_at": datetime.now(timezone.utc).isoformat(),
            "scorer": "m2_live",
        }
    except (ImportError, ModuleNotFoundError, Exception) as e:
        # It's okay if M2 isn't ready, we'll use our stub.
        pass

    # 2. Stub scoring fallback logic
    from_wallet_age_days = tx.get("from_wallet_age_days")
    is_known_bad = is_bad_actor(from_address)

    if is_known_bad:
        score = 90
        tier = "critical"
    elif from_wallet_age_days is not None and from_wallet_age_days < 7:
        score = 75
        tier = "critical"
    else:
        # Use pre-scored value from simulation data if available, else default
        score = tx.get("risk_score", 20)
        tier = tx.get("risk_tier", "low")

    return {
        "tx_id": tx_id,
        "risk_score": score,
        "risk_tier": tier,
        "triggered_rules": tx.get("triggered_rules", []),
        "from_address": from_address,
        "wallet_history_count": len(wallet_history),
        "is_known_bad_actor": is_known_bad,
        "scored_at": datetime.now(timezone.utc).isoformat(),
        "scorer": "stub_v1",
    }


# ---------------------------------------------------------------------------
# GET /api/wallet/{address}/history — wallet transaction history
# ---------------------------------------------------------------------------

@router.get("/wallet/{address}/history")
async def get_wallet_history(address: str):
    """Return the last 10 transactions involving this wallet."""
    return wallet_store.get_wallet_history(address, limit=10)
