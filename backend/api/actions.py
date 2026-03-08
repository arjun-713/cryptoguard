"""
CryptoGuard — Broker Action API Routes

Endpoints for hold, monitor, and escalate actions on flagged transactions.
Actions are logged to console and stored in-memory for the case log.
"""

from datetime import datetime, timezone
import json
import aiosqlite
from fastapi import APIRouter
from config import settings

from db.models import ActionType

router = APIRouter(prefix="/api", tags=["actions"])
DB_PATH = settings.DATABASE_URL.replace("sqlite+aiosqlite:///", "")


# ---------------------------------------------------------------------------
# In-memory action log
# ---------------------------------------------------------------------------

_action_log: list[dict] = []
_action_counter: int = 0


async def log_action(tx_id: str, action: ActionType, analyst_notes: str = "", tx_data: dict = None) -> dict:
    """Create and store an action record, log to console."""
    if tx_data is None:
        tx_data = {}
        
    global _action_counter
    _action_counter += 1

    now = datetime.now(timezone.utc)
    
    from_address = tx_data.get("from_address", "")
    to_address = tx_data.get("to_address", "")
    eth_value = tx_data.get("eth_value", 0.0)
    risk_score = tx_data.get("risk_score", 0)
    risk_tier = tx_data.get("risk_tier", "")
    triggered_rules = tx_data.get("triggered_rules", [])
    ai_explanation = tx_data.get("ai_explanation", "")
    tx_timestamp = tx_data.get("timestamp", "")
    actioned_by = "analyst_01"

    record = {
        "id": _action_counter,
        "tx_id": tx_id,
        "action": action.value,
        "analyst_notes": analyst_notes,
        "actioned_at": now.isoformat(),
        "actioned_by": actioned_by,
        "tx_details": {
            "id": tx_id,
            "hash": tx_id,
            "from": from_address,
            "to": to_address,
            "eth_value": eth_value,
            "risk_score": risk_score,
            "risk_tier": risk_tier,
            "triggered_rules": triggered_rules,
            "ai_explanation": ai_explanation,
            "timestamp": tx_timestamp
        }
    }
    _action_log.append(record)

    # Persist to SQLite
    try:
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute("""
                INSERT INTO case_actions (
                    tx_id, action, analyst_notes, actioned_at, actioned_by,
                    from_address, to_address, eth_value, risk_score, risk_tier,
                    triggered_rules, ai_explanation, tx_timestamp
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                tx_id, action.value, analyst_notes, now.isoformat(), actioned_by,
                from_address, to_address, eth_value, risk_score, risk_tier,
                json.dumps(triggered_rules), ai_explanation, tx_timestamp
            ))
            
            # CHANGE 3: Handle missed scams for high-risk manual authorizations
            if action == ActionType.AUTHORIZE and risk_score >= 70:
                notes = f"Broker authorized despite CRITICAL risk score: {analyst_notes}"
                await db.execute("""
                    INSERT INTO missed_scams (
                        tx_id, risk_score, triggered_rules, analyst_notes
                    ) VALUES (?, ?, ?, ?)
                """, (tx_id, risk_score, json.dumps(triggered_rules), notes))
            
            await db.commit()
    except Exception as e:
        print(f"❌ Failed to insert action to db: {e}")

    # Console log with timestamp and action type
    emoji = {
        "hold": "🛑", 
        "monitor": "👁️", 
        "authorize": "✅",
        "AUTO_HOLD": "🤖🛑",
        "AUTO_MONITOR": "🤖👁️"
    }.get(action.value, "📋")
    print(
        f"{emoji} ACTION [{now.strftime('%H:%M:%S')}] "
        f"{action.value.upper()} on tx={tx_id} "
        f"| notes: {analyst_notes or '(none)'}"
    )

    return record


# ---------------------------------------------------------------------------
# POST /api/actions/hold — hold a transaction
# ---------------------------------------------------------------------------

@router.post("/actions/hold")
async def hold_transaction(body: dict):
    """Place a hold on a flagged transaction."""
    tx_id = body.get("tx_id") or body.get("tx_hash", "")
    notes = body.get("analyst_notes") or body.get("notes", "")

    if not tx_id:
        return {"detail": "tx_id is required"}

    record = await log_action(tx_id, ActionType.HOLD, notes, body)
    return {"status": "held", **record}


# ---------------------------------------------------------------------------
# POST /api/actions/monitor — monitor a transaction
# ---------------------------------------------------------------------------

@router.post("/actions/monitor")
async def monitor_transaction(body: dict):
    """Flag a transaction for ongoing monitoring."""
    tx_id = body.get("tx_id") or body.get("tx_hash", "")
    notes = body.get("analyst_notes") or body.get("notes", "")

    if not tx_id:
        return {"detail": "tx_id is required"}

    record = await log_action(tx_id, ActionType.MONITOR, notes, body)
    return {"status": "monitoring", **record}


# ---------------------------------------------------------------------------
# POST /api/actions/escalate — escalate a transaction
# ---------------------------------------------------------------------------

@router.post("/actions/authorize")
async def authorize_transaction(body: dict):
    """Manually authorize a transaction despite risk markers."""
    tx_id = body.get("tx_id") or body.get("tx_hash", "")
    notes = body.get("analyst_notes") or body.get("notes", "")

    if not tx_id:
        return {"detail": "tx_id is required"}

    record = await log_action(tx_id, ActionType.AUTHORIZE, notes, body)
    return {"status": "authorized", **record}


# ---------------------------------------------------------------------------
# GET /api/actions — all case actions
# ---------------------------------------------------------------------------

@router.get("/actions")
async def get_actions():
    """Return all case actions (most recent first) along with full tx details from the DB."""
    actions = []
    try:
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute("SELECT * FROM case_actions ORDER BY actioned_at DESC") as cursor:
                rows = await cursor.fetchall()
                for row in rows:
                    rules_str = row["triggered_rules"]
                    try:
                        rules = json.loads(rules_str) if rules_str else []
                    except:
                        rules = []
                        
                    actions.append({
                        "id": row["id"],
                        "tx_id": row["tx_id"],
                        "action": row["action"],
                        "status": dict(row).get("status", "ACTIVE"),
                        "analyst_notes": row["analyst_notes"],
                        "actioned_at": row["actioned_at"],
                        "actioned_by": row["actioned_by"],
                        "tx_details": {
                            "id": row["tx_id"],
                            "hash": row["tx_id"],
                            "from": row["from_address"],
                            "to": row["to_address"],
                            "eth_value": row["eth_value"],
                            "risk_score": row["risk_score"],
                            "risk_tier": row["risk_tier"],
                            "triggered_rules": rules,
                            "ai_explanation": row["ai_explanation"],
                            "timestamp": row["tx_timestamp"]
                        }
                    })
        return actions
    except Exception as e:
        print(f"❌ Failed to fetch actions from DB: {e}")
        return list(reversed(_action_log))


# ---------------------------------------------------------------------------
# GET /api/stats — System Precision Statistics (Fix 5)
# ---------------------------------------------------------------------------

@router.get("/stats")
async def get_stats():
    """Return precision metrics, false positive rates, and total volume."""
    from db.stats import get_current_stats
    return get_current_stats()


# ---------------------------------------------------------------------------
# POST /api/actions/release — Release an AUTO-HOLD (Fix 5)
# ---------------------------------------------------------------------------

@router.post("/actions/release")
async def release_transaction(body: dict):
    """Mark an auto-held transaction as a false positive and release it."""
    from db.stats import increment_stat
    tx_id = body.get("tx_id") or body.get("tx_hash", "")
    
    if not tx_id:
        return {"error": "tx_id is required"}

    # 1. Increment manual_releases counter
    await increment_stat("manual_releases")

    # 2. Update the case record status
    released = False
    for action in _action_log:
        if action["tx_id"] == tx_id:
            action["status"] = "RELEASED"
            action["analyst_notes"] = (action.get("analyst_notes") or "") + " [ANALYST RELEASED]"
            released = True
            
    return {"status": "released" if released else "stat_recorded", "tx_id": tx_id}


# ---------------------------------------------------------------------------
# POST /api/actions/confirm — Confirm a scam (Fix 5)
# ---------------------------------------------------------------------------

@router.post("/actions/confirm")
async def confirm_transaction(body: dict):
    """Manually confirm that an AUTO-HOLD was correct."""
    from db.stats import increment_stat
    await increment_stat("confirmed_scams")
    return {"status": "confirmed"}

# ---------------------------------------------------------------------------
# GET /api/missed_scams — Pull from missed_scams table (CHANGE 3)
# ---------------------------------------------------------------------------

@router.get("/missed_scams")
async def get_missed_scams():
    """Return all transactions that were manually authorized despite high risk."""
    missed = []
    try:
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute("SELECT * FROM missed_scams ORDER BY recorded_at DESC") as cursor:
                rows = await cursor.fetchall()
                for row in rows:
                    rules_str = row["triggered_rules"]
                    try:
                        rules = json.loads(rules_str) if rules_str else []
                    except:
                        rules = []
                    missed.append({
                        "id": row["id"],
                        "tx_id": row["tx_id"],
                        "risk_score": row["risk_score"],
                        "triggered_rules": rules,
                        "analyst_notes": row["analyst_notes"],
                        "recorded_at": row["recorded_at"]
                    })
        return missed
    except Exception as e:
        print(f"❌ Failed to fetch missed scams from DB: {e}")
        return []
