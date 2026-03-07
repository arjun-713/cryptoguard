"""
CryptoGuard — Demo Integration API

Trigger the demo sequence for pitches and presentations.
"""

from fastapi import APIRouter
from blockchain import simulator

router = APIRouter(prefix="/api", tags=["demo"])


# ---------------------------------------------------------------------------
# POST /api/demo/start
# ---------------------------------------------------------------------------

@router.post("/demo/start")
async def start_demo_sequence():
    """
    Fire the pre-scripted 4-transaction demo sequence.
    This sequence is guaranteed to run with 5-second gaps and overrides
    the normal simulation loop briefly to ensure a clean demo.
    """
    try:
        await simulator.fire_demo_sequence()
        return {
            "status": "demo_started",
            "sequence": [
                "sim_001 (Normal)",
                "sim_007 (Peel Chain)",
                "sim_006 (Mixer)",
                "sim_011 (Velocity Anomaly)",
            ],
            "gap_seconds": 5,
        }
    except Exception as e:
        return {"status": "error", "detail": str(e)}
