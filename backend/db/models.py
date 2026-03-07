"""
CryptoGuard Pydantic Models
These are the data contracts shared between backend and frontend.
"""

from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class RiskTier(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    CRITICAL = "critical"


class ActionType(str, Enum):
    HOLD = "hold"
    MONITOR = "monitor"
    ESCALATE = "escalate"
    AUTO_HOLD = "AUTO_HOLD"
    AUTO_MONITOR = "AUTO_MONITOR"


class RuleKey(str, Enum):
    BLACKLIST_HIT = "BLACKLIST_HIT"
    TORNADO_PROXIMITY = "TORNADO_PROXIMITY"
    PEEL_CHAIN = "PEEL_CHAIN"
    HIGH_VELOCITY = "HIGH_VELOCITY"
    LARGE_VALUE = "LARGE_VALUE"
    NEW_WALLET = "NEW_WALLET"


# ---------------------------------------------------------------------------
# Transaction Schema (incoming data from blockchain / simulation)
# ---------------------------------------------------------------------------

class TransactionInput(BaseModel):
    """Raw transaction as received from the mempool or simulation."""

    tx_id: str
    hash: str = ""
    from_address: str
    to_address: str
    eth_value: float = 0.0
    timestamp: str = ""

    # Wallet enrichment fields
    from_wallet_age_days: Optional[int] = None
    from_wallet_tx_count: Optional[int] = None
    from_wallet_avg_value: Optional[float] = None
    from_wallet_recent_txs: Optional[list] = None


# ---------------------------------------------------------------------------
# Risk Result (output from scoring engine → broadcast to frontend)
# ---------------------------------------------------------------------------

class RiskResult(BaseModel):
    """Scored transaction — this is what the frontend receives via WebSocket."""

    id: str
    hash: str
    from_address: str
    to_address: str
    eth_value: float
    risk_score: int = Field(ge=0, le=100)
    risk_tier: RiskTier
    triggered_rules: list[str] = []
    hop_chain: Optional[list[str]] = None
    ai_explanation: Optional[str] = None
    timestamp: str


# ---------------------------------------------------------------------------
# Case Action (analyst decisions)
# ---------------------------------------------------------------------------

class CaseActionCreate(BaseModel):
    """Request body for creating a case action."""

    tx_id: str
    action: ActionType
    analyst_notes: str = ""
    from_address: str = ""
    to_address: str = ""
    eth_value: float = 0.0
    risk_score: int = 0
    risk_tier: str = ""
    triggered_rules: list[str] = []
    ai_explanation: Optional[str] = None
    timestamp: str = ""


class CaseActionResponse(BaseModel):
    """Response after creating / fetching a case action."""

    id: int
    tx_id: str
    action: ActionType
    analyst_notes: str = ""
    actioned_at: str = ""
    actioned_by: str = "analyst_01"
    is_seed: int = 0
    from_address: str = ""
    to_address: str = ""
    eth_value: float = 0.0
    risk_score: int = 0
    risk_tier: str = ""
    triggered_rules: list[str] = []
    ai_explanation: Optional[str] = None
    tx_timestamp: str = ""


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

class HealthResponse(BaseModel):
    status: str = "ok"
    simulation_mode: bool = True
    transactions_processed: int = 0
    ofac_last_updated: str = "Never"
