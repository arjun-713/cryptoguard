"""
CryptoGuard — FastAPI Application Entry Point

Start with:
    uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import settings
from backend.db.models import HealthResponse
from backend.api.transactions import router as transactions_router
from backend.api.actions import router as actions_router


# ---------------------------------------------------------------------------
# Global state (transaction counter, WebSocket clients, etc.)
# ---------------------------------------------------------------------------

app_state = {
    "transactions_processed": 0,
}


# ---------------------------------------------------------------------------
# Lifespan — startup / shutdown hooks
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Runs on startup and shutdown."""
    print("🚀 CryptoGuard backend starting...")
    print(f"   Simulation mode: {settings.SIMULATION_MODE}")
    print(f"   CORS origins:    {settings.CORS_ORIGINS}")
    print(f"   Database:        {settings.DATABASE_URL}")
    yield
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

# Routers
app.include_router(transactions_router)
app.include_router(actions_router)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health", response_model=HealthResponse, tags=["system"])
async def health_check():
    """System health check — judges/mentors can hit this to confirm backend is alive."""
    return HealthResponse(
        status="ok",
        simulation_mode=settings.SIMULATION_MODE,
        transactions_processed=app_state["transactions_processed"],
    )
