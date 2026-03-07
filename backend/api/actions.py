"""
CryptoGuard — Case Action API Routes
"""

from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["actions"])


@router.post("/actions")
async def create_action():
    """Create a new case action (stub for Phase 0)."""
    return {"detail": "Not implemented yet"}


@router.get("/actions")
async def get_actions():
    """Return all case actions (stub for Phase 0)."""
    return []
