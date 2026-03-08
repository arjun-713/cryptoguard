"""
CryptoGuard — Transaction API Routes

Endpoints for transaction listing, lookup, wallet history, and scoring.
"""

from datetime import datetime, timezone
from fastapi import APIRouter

from blockchain import wallet_store
from blockchain.bad_actors import is_bad_actor
from db.suspicious_addresses import get_suspicious_addresses

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


# ---------------------------------------------------------------------------
# GET /api/suspicious-addresses — suspicious address list
# ---------------------------------------------------------------------------

@router.get("/suspicious-addresses")
async def get_suspicious_list():
    """Return the full list of blacklisted or recurring suspicious addresses."""
    return await get_suspicious_addresses()


# ---------------------------------------------------------------------------
# POST /api/broker/withdraw — External Broker Withdrawal (Fix 3)
# ---------------------------------------------------------------------------

@router.post("/broker/withdraw")
async def broker_withdraw(body: dict):
    """
    Simulate a withdrawal attempt from an external broker.
    Validates against CryptoGuard's risk engine.
    """
    from uuid import uuid4
    import httpx
    from config import settings
    from risk.scorer import score_transaction as risk_score_transaction
    from blockchain.enricher import enrich_transaction
    from api.actions import log_action
    from db.models import ActionType

    sender = body.get("sender") or body.get("from_address")
    receiver = body.get("receiver") or body.get("to_address")
    amount = body.get("amount") or body.get("eth_value", 0.0)
    customer_id = body.get("customer_id", "anon")

    if not sender or not receiver:
        return {"error": "sender and receiver are required"}

    # Mock tx object for the scorer
    tx = {
        "id": f"wd-{uuid4().hex[:8]}",
        "hash": f"wd-{uuid4().hex[:8]}",
        "from_address": sender,
        "to_address": receiver,
        "eth_value": float(amount),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "wallet_history_count": 0,
        "hop_chain": body.get("hop_chain", []),
        "from_wallet_age_days": body.get("wallet_age_days"),
        "from_wallet_recent_txs": body.get("from_wallet_recent_txs", []),
        "nonce": body.get("nonce")
    }

    # 1. Enrich (if live)
    if not settings.SIMULATION_MODE and settings.ALCHEMY_HTTP_URL:
        tx = await enrich_transaction(tx, settings.ALCHEMY_HTTP_URL)

    # 2. Score
    # Fetch local history for enrichment
    from blockchain.bad_actors import BAD_ACTORS
    from db.stats import increment_stat
    await increment_stat("total_scored")

    history = wallet_store.get_wallet_history(sender, limit=10)
    result = await risk_score_transaction(tx, {sender: history}, blacklist=BAD_ACTORS)

    score = result.get("risk_score", 0)
    tier = result.get("risk_tier", "low")
    triggered = result.get("triggered_rules", [])

    # 3. Decision logic
    status = "APPROVED"
    if score >= settings.HOLD_THRESHOLD:
        status = "HELD"
        await increment_stat("auto_held")
    elif score >= settings.MONITOR_THRESHOLD:
        status = "MONITOR"
        await increment_stat("auto_monitored")

    # 4. Persistence and Broadcasting
    enriched_tx = {
        **tx,
        "risk_score": score,
        "risk_tier": tier,
        "triggered_rules": triggered,
        "ai_explanation": result.get("ai_explanation", "Simulated scam withdrawal detected."),
        "auto_held": status == "HELD",
        "auto_monitored": status == "MONITOR"
    }
    
    # Store in memory feed
    wallet_store.record_transaction(enriched_tx)
    
    # Broadcast to WebSocket
    from blockchain import simulator
    await simulator.broadcast({
        "type": "new_transaction",
        "data": enriched_tx
    })

    action_id = None
    if status == "HELD":
        notes = f"Auto-held via Broker API. Score: {score}. Customer: {customer_id}"
        record = await log_action(tx["id"], ActionType.AUTO_HOLD, notes, enriched_tx)
        action_id = record["id"]

    # 5. Optional Webhook Decision
    if settings.BROKER_WEBHOOK_URL:
        try:
            async with httpx.AsyncClient() as client:
                await client.post(settings.BROKER_WEBHOOK_URL, json={
                    "tx_id": tx["id"],
                    "status": status,
                    "score": score,
                    "customer_id": customer_id
                }, timeout=2.0)
        except Exception as e:
            print(f"⚠️ Webhook failed for {tx['id']}: {e}")

    return {
        "status": status,
        "score": score,
        "tier": tier,
        "risk_score": score,
        "risk_tier": tier,
        "reason": f"Transaction score is {score}/100 based on {len(triggered)} suspicious signals.",
        "action_id": action_id,
        "triggered_rules": triggered
    }


# ---------------------------------------------------------------------------
# Broker Registry — Register and List Customer Wallets
# ---------------------------------------------------------------------------

_registered_wallets: list[dict] = []

@router.post("/broker/register-wallet")
async def register_wallet(body: dict):
    """Register a customer wallet with the broker."""
    address = body.get("address", "")
    name = body.get("name", "")
    account_type = body.get("account_type", "customer")

    if not address:
        return {"error": "address is required"}

    record = {
        "wallet_address": address.lower(),
        "name": name,
        "account_type": account_type,
        "registered_at": datetime.now(timezone.utc).isoformat()
    }
    _registered_wallets.append(record)
    return {"status": "registered", **record}


@router.get("/broker/customers")
async def get_broker_customers():
    """Return all registered customer wallets."""
    return _registered_wallets
