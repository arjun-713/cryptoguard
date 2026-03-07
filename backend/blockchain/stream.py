"""
backend/blockchain/stream.py

Connects to the Ethereum mempool via Alchemy WebSocket and feeds
live pending transactions into CryptoGuard's risk scoring pipeline.

This file is the entry point for live mode. It is only called when
SIMULATION_MODE=false in .env. If SIMULATION_MODE=true, main.py
calls simulation.py instead — this file is not touched.

Connection behavior:
- Connects to Alchemy WebSocket on startup
- Subscribes to alchemy_pendingTransactions (full tx objects)
- On each transaction: normalize → filter → score → broadcast
- If connection drops: waits 5 seconds, retries up to MAX_RETRIES
- After MAX_RETRIES failures: logs error and exits gracefully
"""

import asyncio
import json
import logging
from datetime import datetime, timezone

import websockets
from websockets.exceptions import ConnectionClosed, WebSocketException

from blockchain.normalizer import normalize_tx, is_interesting
from blockchain.constants import MIN_ETH_VALUE_FILTER

# Configure logger for this module
logger = logging.getLogger(__name__)

# Retry configuration
MAX_RETRIES = 10
RETRY_DELAY_SECONDS = 5

# Subscription message sent to Alchemy after connecting
# alchemy_pendingTransactions returns FULL transaction objects
# (not just hashes — this is the key difference from eth_newPendingTransactions)
SUBSCRIPTION_MESSAGE = json.dumps({
    "jsonrpc": "2.0",
    "id": 1,
    "method": "eth_subscribe",
    "params": ["alchemy_pendingTransactions"]
})


async def start_blockchain_listener(
    alchemy_wss_url: str,
    score_and_broadcast,
):
    """
    Main entry point. Connects to Alchemy and processes live transactions.

    Args:
        alchemy_wss_url: Full Alchemy WebSocket URL including API key
                         e.g. wss://eth-mainnet.g.alchemy.com/v2/abc123
        score_and_broadcast: Async callable that accepts a normalized tx dict.
                             This is provided by main.py and handles:
                             scoring → database storage → WebSocket broadcast
                             → AI explanation trigger
    """

    retries = 0

    while retries < MAX_RETRIES:

        try:
            logger.info(f"Connecting to Alchemy WebSocket... (attempt {retries + 1}/{MAX_RETRIES})")

            async with websockets.connect(
                alchemy_wss_url,
                ping_interval=30,       # Send ping every 30s to keep connection alive
                ping_timeout=10,        # Wait 10s for pong before considering dead
                close_timeout=5,        # Wait 5s for clean close
                max_size=2**20,         # 1MB max message size
            ) as websocket:

                # Send subscription request
                await websocket.send(SUBSCRIPTION_MESSAGE)
                logger.info("Subscription sent. Waiting for confirmation...")

                # First message back is the subscription confirmation
                # It looks like: {"jsonrpc":"2.0","id":1,"result":"0xSUBID"}
                confirmation = await websocket.recv()
                confirmation_data = json.loads(confirmation)

                if "result" in confirmation_data:
                    sub_id = confirmation_data["result"]
                    logger.info(f"Subscribed successfully. Subscription ID: {sub_id}")
                else:
                    logger.error(f"Subscription failed: {confirmation_data}")
                    raise ConnectionError("Alchemy subscription rejected")

                # Reset retry counter on successful connection
                retries = 0
                tx_count = 0
                filtered_count = 0

                logger.info("Live mempool stream active. Processing transactions...")

                # Main receive loop
                while True:

                    try:
                        raw_message = await websocket.recv()
                    except ConnectionClosed as e:
                        logger.warning(f"WebSocket connection closed: {e}")
                        break

                    # Parse the incoming message
                    try:
                        message = json.loads(raw_message)
                    except json.JSONDecodeError:
                        logger.debug("Received non-JSON message, skipping")
                        continue

                    # Only process subscription event messages
                    # Ignore pings, pongs, and other control messages
                    if "params" not in message:
                        continue

                    # Extract the raw transaction from the subscription event
                    raw_tx = message.get("params", {}).get("result")
                    if not raw_tx or not isinstance(raw_tx, dict):
                        continue

                    tx_count += 1

                    # --- Normalize raw Alchemy format to scorer format ---
                    normalized = normalize_tx(raw_tx)

                    # normalize_tx returns None for transactions that should
                    # be filtered (low value, missing fields, etc.)
                    if normalized is None:
                        filtered_count += 1
                        continue

                    # Feature 1: Broker Registry check
                    from db.broker_registry import get_registered_wallets
                    registered_wallets = await get_registered_wallets()
                    if registered_wallets:
                        registered_addresses = {w["wallet_address"] for w in registered_wallets}
                        from_addr = normalized.get("from_address", "")
                        to_addr = normalized.get("to_address", "")
                        if from_addr not in registered_addresses and to_addr not in registered_addresses:
                            filtered_count += 1
                            continue

                    # Secondary interest filter
                    if not is_interesting(normalized):
                        filtered_count += 1
                        continue

                    # --- Log progress every 100 transactions ---
                    if tx_count % 100 == 0:
                        logger.info(
                            f"Stream stats: {tx_count} received, "
                            f"{filtered_count} filtered, "
                            f"{tx_count - filtered_count} processed"
                        )

                    # --- Hand off to the scoring and broadcasting pipeline ---
                    # This is fire-and-forget — we don't wait for scoring to
                    # complete before reading the next transaction. This keeps
                    # the stream from falling behind during high-volume periods.
                    asyncio.create_task(
                        _safe_score_and_broadcast(normalized, score_and_broadcast)
                    )

        except ConnectionClosed as e:
            retries += 1
            logger.warning(
                f"Connection closed unexpectedly: {e}. "
                f"Retry {retries}/{MAX_RETRIES} in {RETRY_DELAY_SECONDS}s..."
            )
            await asyncio.sleep(RETRY_DELAY_SECONDS)

        except WebSocketException as e:
            retries += 1
            logger.error(
                f"WebSocket error: {e}. "
                f"Retry {retries}/{MAX_RETRIES} in {RETRY_DELAY_SECONDS}s..."
            )
            await asyncio.sleep(RETRY_DELAY_SECONDS)

        except ConnectionError as e:
            retries += 1
            logger.error(
                f"Connection error: {e}. "
                f"Retry {retries}/{MAX_RETRIES} in {RETRY_DELAY_SECONDS}s..."
            )
            await asyncio.sleep(RETRY_DELAY_SECONDS)

        except Exception as e:
            retries += 1
            logger.error(
                f"Unexpected error in blockchain listener: {e}. "
                f"Retry {retries}/{MAX_RETRIES} in {RETRY_DELAY_SECONDS}s..."
            )
            await asyncio.sleep(RETRY_DELAY_SECONDS)

    logger.error(
        f"Blockchain listener failed after {MAX_RETRIES} retries. "
        f"Check your ALCHEMY_WSS_URL and API key. Falling back to simulation mode."
    )


async def _safe_score_and_broadcast(normalized_tx: dict, score_and_broadcast):
    """
    Wrapper that calls score_and_broadcast safely.
    Catches and logs any exception without crashing the stream.
    
    This is critical — if scoring crashes for one transaction,
    the stream must continue processing the next one.
    """
    try:
        await score_and_broadcast(normalized_tx)
    except Exception as e:
        logger.error(
            f"Error scoring transaction {normalized_tx.get('hash', 'unknown')}: {e}"
        )
