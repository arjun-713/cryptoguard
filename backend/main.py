"""
CryptoGuard — FastAPI Application Entry Point

Start with:
    uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
"""

import asyncio
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from db.models import HealthResponse
from api.transactions import router as transactions_router
from api.actions import router as actions_router
from api.demo import router as demo_router
from api.broker import router as broker_router
from blockchain import simulator


# ---------------------------------------------------------------------------
# Lifespan — startup / shutdown hooks
# ---------------------------------------------------------------------------

async def score_and_broadcast(tx: dict):
    from risk.scorer import score_transaction, _determine_tier
    from ai.explainer import generate_explanation
    from blockchain import wallet_store
    from db.suspicious_addresses import record_suspicious_address, is_known_suspicious
    from api.actions import log_action
    from blockchain.enricher import enrich_transaction
    from db.models import ActionType

    # FEATURE: Real-world Enrichment (Hop Chain)
    if not settings.SIMULATION_MODE and settings.ALCHEMY_HTTP_URL:
        tx = await enrich_transaction(tx, settings.ALCHEMY_HTTP_URL)

    from_addr = tx.get("from_address", "")
    to_addr = tx.get("to_address", "")
    
    # Check for REPEAT_OFFENDER penalty (Feature 2)
    repeat_offender = False
    for addr in [from_addr, to_addr]:
        if addr and await is_known_suspicious(addr):
            repeat_offender = True
            break
            
    history = wallet_store.get_wallet_history(from_addr, limit=10)
    wallet_history_dict = {from_addr: history}
    
    result = await score_transaction(tx, wallet_history_dict)
    
    # Apply penalty if address is known suspicious
    if repeat_offender:
        result["risk_score"] = min(100, result["risk_score"] + 10)
        if "REPEAT_OFFENDER" not in result["triggered_rules"]:
            result["triggered_rules"].append("REPEAT_OFFENDER")
        # Re-map tier based on updated score
        result["risk_tier"] = _determine_tier(result["risk_score"])

    score = result.get("risk_score", 0)
    tier = result.get("risk_tier", "low")
    tx_hash = result.get("id") or result.get("hash") or result.get("tx_id", "unknown")

    # Record suspicious address if above threshold (Feature 2)
    if score >= 40:
        await record_suspicious_address(from_addr, score, result["triggered_rules"])

    # FEATURE 1 — AUTO-HOLD / MONITOR
    result["auto_held"] = False
    result["auto_monitored"] = False

    from db.stats import increment_stat

    # 1. Total volume stat
    await increment_stat("total_scored")

    # 2. Threshold checks
    if score >= settings.HOLD_THRESHOLD:
        notes = f"Automatically held by CryptoGuard risk engine. Score: {score}/100. Rules: {', '.join(result['triggered_rules'])}"
        await log_action(tx_hash, ActionType.AUTO_HOLD, notes, result)
        result["auto_held"] = True
        await increment_stat("auto_held")
        print(f"🔴 AUTO-HOLD triggered for tx {tx_hash} score {score}/100")

    # AI Explanation
    if tier in ("medium", "critical"):
        explanation = ""
        async for chunk in generate_explanation(result):
            explanation += chunk
        result["ai_explanation"] = explanation

    await wallet_store.record_transaction(result)
    simulator._tx_counter += 1
    await simulator.broadcast({"type": "new_transaction", "data": result})

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Runs on startup and shutdown."""
    print("🚀 CryptoGuard backend starting...")
    
    # Initialize database tables
    from db.database import init_db
    await init_db()
    
    # Load historical wallet data (Fix 2)
    from blockchain.wallet_store import load_wallet_history_from_db, run_nightly_cleanup
    await load_wallet_history_from_db()
    asyncio.create_task(run_nightly_cleanup())
    
    # OFAC List Refresh (Fix 4)
    from blockchain.constants import refresh_ofac_list, periodic_ofac_refresh
    await refresh_ofac_list()
    asyncio.create_task(periodic_ofac_refresh(86400))
    
    print(f"   Simulation mode: {settings.SIMULATION_MODE}")
    print(f"   CORS origins:    {settings.CORS_ORIGINS}")
    print(f"   Database:        {settings.DATABASE_URL}")

    import logging
    logging.basicConfig(level=logging.INFO)
    if settings.SIMULATION_MODE:
        import logging
        logging.info("Starting in SIMULATION MODE")
        asyncio.create_task(simulator.start_simulation())
    else:
        import logging
        logging.info("Starting in LIVE MODE — connecting to Ethereum mempool")
        from blockchain.stream import start_blockchain_listener
        asyncio.create_task(
            start_blockchain_listener(
                alchemy_wss_url=settings.ALCHEMY_WSS_URL,
                score_and_broadcast=score_and_broadcast,
            )
        )

    yield

    # Shut down simulation
    await simulator.stop_simulation()
    print("🛑 CryptoGuard backend shutting down...")


# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(
    title="CryptoGuard API",
    description="Real-time cryptocurrency scam interception platform",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request logging middleware
# ---------------------------------------------------------------------------

@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log every HTTP request with method, path, status, and response time."""
    start = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - start) * 1000
    print(
        f"📋 {request.method} {request.url.path} → "
        f"{response.status_code} ({elapsed_ms:.1f}ms)"
    )
    return response


# Routers
app.include_router(transactions_router)
app.include_router(actions_router)
app.include_router(demo_router)
app.include_router(broker_router)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health", response_model=HealthResponse, tags=["system"])
async def health_check():
    """System health check — judges/mentors can hit this to confirm backend is alive."""
    from blockchain.constants import ofac_last_updated
    return HealthResponse(
        status="ok",
        simulation_mode=settings.SIMULATION_MODE,
        transactions_processed=simulator.get_tx_counter(),
        ofac_last_updated=ofac_last_updated
    )


# ---------------------------------------------------------------------------
# WebSocket — live transaction stream
# ---------------------------------------------------------------------------

@app.websocket("/ws")
async def websocket_stream(ws: WebSocket):
    """
    Live transaction stream.
    Connect at ws://localhost:8000/ws to receive real-time transactions.
    """
    await ws.accept()
    simulator.register_client(ws)
    try:
        # Keep the connection alive — wait for client disconnect
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        simulator.unregister_client(ws)
