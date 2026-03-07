from fastapi import APIRouter
from pydantic import BaseModel
from typing import List
from db.broker_registry import register_wallet, get_registered_wallets

router = APIRouter(prefix="/api/broker", tags=["broker"])

class RegisterWalletRequest(BaseModel):
    address: str
    name: str
    account_type: str

@router.post("/register-wallet")
async def register_wallet_endpoint(req: RegisterWalletRequest):
    await register_wallet(req.address, req.name, req.account_type)
    return {"status": "success"}

@router.get("/customers")
async def get_customers():
    return await get_registered_wallets()

class WithdrawRequest(BaseModel):
    from_address: str
    to_address: str
    eth_value: float
    wallet_age_days: int
    nonce: int
    hop_chain: List[str]

@router.post("/withdraw")
async def broker_withdraw(req: WithdrawRequest):
    from risk.scorer import score_transaction
    from blockchain import wallet_store, simulator
    from api.actions import log_action
    from db.models import ActionType
    from config import settings
    from datetime import datetime, timezone
    import uuid
    
    tx = {
        "id": f"broker_demo_{uuid.uuid4().hex[:6]}",
        "hash": f"0x{req.from_address[2:12]}withdraw{req.to_address[-4:]}",
        "from_address": req.from_address,
        "to_address": req.to_address,
        "eth_value": req.eth_value,
        "gas_price_gwei": 50.0,
        "nonce": req.nonce,
        "scenario": "broker_demo_withdraw",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "hop_chain": req.hop_chain,
        "from_wallet_age_days": req.wallet_age_days
    }
    
    history = wallet_store.get_wallet_history(req.from_address, limit=10)
    wallet_history_dict = {req.from_address: history}
    
    result = await score_transaction(tx, wallet_history_dict)
    
    score = result.get("risk_score", 0)
    result["auto_held"] = False
    result["auto_monitored"] = False
    
    if score >= settings.HOLD_THRESHOLD:
        notes = f"Automatically held by CryptoGuard risk engine. Score: {score}/100."
        await log_action(result["id"], ActionType.AUTO_HOLD, notes, result)
        result["auto_held"] = True
        
    await wallet_store.record_transaction(result)
    simulator._tx_counter += 1
    
    await simulator.broadcast({"type": "new_transaction", "data": result})
    
    return {"status": "broadcasted", "data": result}
