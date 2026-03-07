"""
CryptoGuard — Transaction API Routes
"""

from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["transactions"])


@router.get("/transactions")
async def get_transactions():
    """Return last 50 transactions (stub for Phase 0)."""
    return []


@router.get("/transactions/{tx_id}")
async def get_transaction(tx_id: str):
    """Return a single transaction by ID (stub for Phase 0)."""
    return {"detail": "Not implemented yet", "tx_id": tx_id}
