"""
CryptoGuard — FastAPI Application Entry Point

Start with:
    uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
"""

import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from db.models import HealthResponse
from api.transactions import router as transactions_router
from api.actions import router as actions_router
from api.demo import router as demo_router
from blockchain import simulator


# ---------------------------------------------------------------------------
# Lifespan — startup / shutdown hooks
# ---------------------------------------------------------------------------

async def score_and_broadcast(tx: dict):
    from risk.scorer import score_transaction
    from ai.explainer import generate_explanation
    from blockchain import wallet_store

    wallet_address = tx.get("from_address", "")
    history = wallet_store.get_wallet_history(wallet_address, limit=10)
    wallet_history_dict = {wallet_address: history}
    
    result = await score_transaction(tx, wallet_history_dict)
    
    if result.get("risk_tier") in ("medium", "critical"):
        explanation = ""
        async for chunk in generate_explanation(result):
            explanation += chunk
        result["ai_explanation"] = explanation

    wallet_store.record_transaction(result)
    simulator._tx_counter += 1
    await simulator.broadcast({"type": "new_transaction", "data": result})

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Runs on startup and shutdown."""
    print("🚀 CryptoGuard backend starting...")
    print(f"   Simulation mode: {settings.SIMULATION_MODE}")
    print(f"   CORS origins:    {settings.CORS_ORIGINS}")
    print(f"   Database:        {settings.DATABASE_URL}")

    import asyncio
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


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health", response_model=HealthResponse, tags=["system"])
async def health_check():
    """System health check — judges/mentors can hit this to confirm backend is alive."""
    return HealthResponse(
        status="ok",
        simulation_mode=settings.SIMULATION_MODE,
        transactions_processed=simulator.get_tx_counter(),
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
