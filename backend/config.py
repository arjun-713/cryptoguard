"""
CryptoGuard Backend Configuration
Reads all settings from .env — no other file should call os.getenv() directly.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)


class Settings:
    """Typed configuration object for the entire backend."""

    ALCHEMY_WSS_URL: str = os.getenv("ALCHEMY_WSS_URL", "")
    ALCHEMY_HTTP_URL: str = os.getenv("ALCHEMY_HTTP_URL", "")
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./cryptoguard.db")
    CORS_ORIGINS: list[str] = [
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
    ]
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    SIMULATION_MODE: bool = os.getenv("SIMULATION_MODE", "true").lower() == "true"
    SIMULATION_DATA_PATH: str = os.getenv("SIMULATION_DATA_PATH", "docs/simulation-data.json")
    
    # Feature Toggles (Fix 3 & 5)
    BROKER_WEBHOOK_URL: str = os.getenv("BROKER_WEBHOOK_URL", "")
    HOLD_THRESHOLD: int = int(os.getenv("HOLD_THRESHOLD", "80"))
    MONITOR_THRESHOLD: int = int(os.getenv("MONITOR_THRESHOLD", "40"))


settings = Settings()
