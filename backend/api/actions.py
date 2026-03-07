"""
CryptoGuard — Broker Action API Routes

Endpoints for hold, monitor, and escalate actions on flagged transactions.
Actions are logged to console and stored in-memory for the case log.
"""

from datetime import datetime, timezone
from fastapi import APIRouter

from db.models import ActionType

router = APIRouter(prefix="/api", tags=["actions"])


# ---------------------------------------------------------------------------
# In-memory action log
# ---------------------------------------------------------------------------

_action_log: list[dict] = []
_action_counter: int = 0


def log_action(tx_id: str, action: ActionType, analyst_notes: str = "") -> dict:
    """Create and store an action record, log to console."""
    global _action_counter
    _action_counter += 1

    now = datetime.now(timezone.utc)
    record = {
        "id": _action_counter,
        "tx_id": tx_id,
        "action": action.value,
        "analyst_notes": analyst_notes,
        "actioned_at": now.isoformat(),
        "actioned_by": "analyst_01",
    }
    _action_log.append(record)

    # Console log with timestamp and action type
    emoji = {
        "hold": "🛑", 
        "monitor": "👁️", 
        "escalate": "🚨",
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

    record = log_action(tx_id, ActionType.HOLD, notes)
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

    record = log_action(tx_id, ActionType.MONITOR, notes)
    return {"status": "monitoring", **record}


# ---------------------------------------------------------------------------
# POST /api/actions/escalate — escalate a transaction
# ---------------------------------------------------------------------------

@router.post("/actions/escalate")
async def escalate_transaction(body: dict):
    """Escalate a transaction for compliance review."""
    tx_id = body.get("tx_id") or body.get("tx_hash", "")
    notes = body.get("analyst_notes") or body.get("notes", "")

    if not tx_id:
        return {"detail": "tx_id is required"}

    record = log_action(tx_id, ActionType.ESCALATE, notes)
    return {"status": "escalated", **record}


# ---------------------------------------------------------------------------
# GET /api/actions — all case actions
# ---------------------------------------------------------------------------

@router.get("/actions")
async def get_actions():
    """Return all case actions (most recent first)."""
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
