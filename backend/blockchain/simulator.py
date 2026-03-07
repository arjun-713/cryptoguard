"""
CryptoGuard — Simulation Engine

Reads transactions from docs/simulation-data.json and broadcasts them
via WebSocket at realistic intervals based on timestamp_offset_seconds.
"""

from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import WebSocket

import blockchain.wallet_store as wallet_store

# ---------------------------------------------------------------------------
# Module-level state
# ---------------------------------------------------------------------------

# Connected WebSocket clients
_ws_clients: set[WebSocket] = set()

# Loaded simulation data
_sim_data: dict[str, Any] | None = None

# Track how many transactions have been processed total
_tx_counter: int = 0

# Reference to the running background task
_sim_task: asyncio.Task | None = None


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------

def load_simulation_data(path: str = "docs/simulation-data.json") -> dict[str, Any]:
    """Load and cache the simulation dataset."""
    global _sim_data
    if _sim_data is None:
        data_path = Path(__file__).resolve().parent.parent.parent / path
        with open(data_path, "r") as f:
            _sim_data = json.load(f)
    return _sim_data


# ---------------------------------------------------------------------------
# WebSocket client management
# ---------------------------------------------------------------------------

def register_client(ws: WebSocket) -> None:
    """Add a WebSocket client to the broadcast list."""
    _ws_clients.add(ws)
    print(f"📡 WebSocket client connected ({len(_ws_clients)} total)")


def unregister_client(ws: WebSocket) -> None:
    """Remove a WebSocket client from the broadcast list."""
    _ws_clients.discard(ws)
    print(f"📡 WebSocket client disconnected ({len(_ws_clients)} total)")


async def broadcast(message: dict[str, Any]) -> None:
    """Send a JSON message to all connected WebSocket clients."""
    if not _ws_clients:
        return

    payload = json.dumps(message)
    disconnected: list[WebSocket] = []

    for ws in _ws_clients.copy():
        try:
            await ws.send_text(payload)
        except Exception:
            disconnected.append(ws)

    for ws in disconnected:
        unregister_client(ws)


# ---------------------------------------------------------------------------
# Simulation loop
# ---------------------------------------------------------------------------

def _enrich_transaction(raw_tx: dict[str, Any]) -> dict[str, Any]:
    """Convert a raw simulation transaction into a broadcast-ready dict."""
    now = datetime.now(timezone.utc).isoformat()

    return {
        "id": raw_tx.get("id", ""),
        "hash": raw_tx.get("hash", ""),
        "from_address": raw_tx.get("from", ""),
        "to_address": raw_tx.get("to", ""),
        "eth_value": raw_tx.get("eth_value", 0.0),
        "risk_score": raw_tx.get("risk_score", 0),
        "risk_tier": raw_tx.get("risk_tier", "low"),
        "triggered_rules": raw_tx.get("triggered_rules", []),
        "hop_chain": raw_tx.get("hop_chain"),
        "ai_explanation": raw_tx.get("ai_explanation"),
        "scenario": raw_tx.get("scenario", ""),
        "gas_price_gwei": raw_tx.get("gas_price_gwei", 0.0),
        "nonce": raw_tx.get("nonce", 0),
        "timestamp": now,
    }

# ---------------------------------------------------------------------------
# Demo Sequencer
# ---------------------------------------------------------------------------

_demo_lock = asyncio.Lock()

async def fire_demo_sequence() -> None:
    """
    Fires 4 specific transactions exactly 5 seconds apart:
    1. Normal: sim_001
    2. Peel chain: sim_007
    3. Mixer proximity: sim_006
    4. Velocity anomaly: sim_011
    """
    global _tx_counter

    sequence_ids = ["sim_001", "sim_007", "sim_006", "sim_011"]
    data = load_simulation_data()
    all_txs = {tx["id"]: tx for tx in data.get("transactions", [])}

    print("🚀 Firing demo sequence...")

    # Wait for lock to pause normal simulation
    async with _demo_lock:
        for i, tx_id in enumerate(sequence_ids):
            raw_tx = all_txs.get(tx_id)
            if not raw_tx:
                print(f"⚠️ Demo TX {tx_id} not found!")
                continue

            enriched = _enrich_transaction(raw_tx)
            wallet_store.record_transaction(enriched)
            _tx_counter += 1

            # FEATURE 1: AUTO-HOLD / MONITOR FOR SIMULATION
            from risk.scorer import _determine_tier
            from config import settings
            from api.actions import log_action
            from db.models import ActionType
            
            score = enriched.get("risk_score", 0)
            tx_id = enriched.get("id", "")
            
            if score >= settings.HOLD_THRESHOLD:
                notes = f"Automatically held by CryptoGuard risk engine. Score: {score}/100. Rules: {', '.join(enriched.get('triggered_rules', []))}"
                await log_action(tx_id, ActionType.AUTO_HOLD, notes, enriched)
                enriched["auto_held"] = True
            elif score >= settings.MONITOR_THRESHOLD:
                notes = f"Automatically monitored by CryptoGuard risk engine. Score: {score}/100. Rules: {', '.join(enriched.get('triggered_rules', []))}"
                await log_action(tx_id, ActionType.AUTO_MONITOR, notes, enriched)
                enriched["auto_monitored"] = True

            await broadcast({
                "type": "new_transaction",
                "data": enriched,
            })

            tier_emoji = {"low": "🟢", "medium": "🟡", "critical": "🔴"}.get(
                enriched["risk_tier"], "⚪"
            )
            print(
                f"[DEMO {i+1}/4] {tier_emoji} TX {enriched['id']} | "
                f"{enriched['eth_value']:.2f} ETH | "
                f"risk={enriched['risk_score']} ({enriched['risk_tier']}) | "
                f"clients={len(_ws_clients)}"
            )

            if i < len(sequence_ids) - 1:
                await asyncio.sleep(5.0)

        print("🏁 Demo sequence complete. Returning to background simulation.")


# ---------------------------------------------------------------------------
# Simulation loop
# ---------------------------------------------------------------------------

async def run_simulation_loop() -> None:
    """
    Main simulation loop. Replays transactions from simulation-data.json
    using timestamp_offset_seconds for realistic timing.
    Loops forever with a pause between cycles.
    """
    global _tx_counter

    data = load_simulation_data()
    transactions = data.get("transactions", [])
    playback = data.get("playback_config", {})
    loop_delay = playback.get("loop_delay_seconds", 15)

    if not transactions:
        print("⚠️  No transactions found in simulation data")
        return

    print(f"🎬 Simulation loaded: {len(transactions)} transactions")

    while True:
        prev_offset = 0

        for raw_tx in transactions:
            offset = raw_tx.get("timestamp_offset_seconds", 0)
            delay = max(offset - prev_offset, 1)  # at least 1 second between txs
            prev_offset = offset

            await asyncio.sleep(delay)

            # Check demo lock (pauses if demo is running)
            async with _demo_lock:
                # Enrich and broadcast
                enriched = _enrich_transaction(raw_tx)
                await wallet_store.record_transaction(enriched)
                _tx_counter += 1

                from risk.scorer import _determine_tier
                from config import settings
                from api.actions import log_action
                from db.models import ActionType
                
                score = enriched.get("risk_score", 0)
                tx_id = enriched.get("id", "")
                
                if score >= settings.HOLD_THRESHOLD:
                    notes = f"Automatically held by CryptoGuard risk engine. Score: {score}/100. Rules: {', '.join(enriched.get('triggered_rules', []))}"
                    await log_action(tx_id, ActionType.AUTO_HOLD, notes, enriched)
                    enriched["auto_held"] = True
                elif score >= settings.MONITOR_THRESHOLD:
                    notes = f"Automatically monitored by CryptoGuard risk engine. Score: {score}/100. Rules: {', '.join(enriched.get('triggered_rules', []))}"
                    await log_action(tx_id, ActionType.AUTO_MONITOR, notes, enriched)
                    enriched["auto_monitored"] = True

                await broadcast({
                    "type": "new_transaction",
                    "data": enriched,
                })

                tier_emoji = {"low": "🟢", "medium": "🟡", "critical": "🔴"}.get(
                    enriched["risk_tier"], "⚪"
                )
                print(
                    f"{tier_emoji} TX {enriched['id']} | "
                    f"{enriched['eth_value']:.2f} ETH | "
                    f"risk={enriched['risk_score']} ({enriched['risk_tier']}) | "
                    f"clients={len(_ws_clients)}"
                )

        print(f"🔄 Simulation cycle complete. Restarting in {loop_delay}s...")
        await asyncio.sleep(loop_delay)


# ---------------------------------------------------------------------------
# Start / stop helpers (called from main.py lifespan)
# ---------------------------------------------------------------------------

async def start_simulation() -> None:
    """Start the simulation as a background task."""
    global _sim_task
    load_simulation_data()
    _sim_task = asyncio.create_task(run_simulation_loop())
    print("🎬 Simulation background task started")


async def stop_simulation() -> None:
    """Cancel the simulation background task."""
    global _sim_task
    if _sim_task is not None:
        _sim_task.cancel()
        try:
            await _sim_task
        except asyncio.CancelledError:
            pass
        _sim_task = None
        print("🎬 Simulation background task stopped")


def get_tx_counter() -> int:
    """Return the total number of transactions processed."""
    return _tx_counter
