# CryptoGuard — Live Blockchain Feature
## Agent Build Instructions: `feature/live-blockchain`

> **WHO THIS IS FOR:** This document is for the AI coding agent (Claude Code). Read every word before writing a single line of code. Follow every step in exact sequence. Do not skip, reorder, or summarize any step. When a step says "verify", stop and verify before continuing.

---

## Context — What You Are Building and Why

CryptoGuard currently runs in simulation mode — it replays 20 pre-scripted transactions from `docs/simulation-data.json` in a loop. This works perfectly and must continue to work perfectly after this feature is built.

What you are adding is a **live mode** — a real Ethereum mempool stream via Alchemy WebSocket that feeds actual pending transactions into the existing risk scoring pipeline. When `SIMULATION_MODE=false` in `.env`, the system switches from replaying simulation data to ingesting real Ethereum transactions.

**Critical rule: You are only adding two new files and modifying one existing file. Nothing else changes.**

```
FILES YOU CREATE:
  backend/blockchain/stream.py
  backend/blockchain/normalizer.py

FILES YOU MODIFY:
  .env  (add ALCHEMY_WSS_URL and set SIMULATION_MODE=false)

FILES YOU DO NOT TOUCH (ever, for any reason):
  backend/risk/scorer.py
  backend/risk/rules.py
  backend/ai/explainer.py
  backend/blockchain/simulation.py
  backend/blockchain/constants.py
  backend/db/database.py
  backend/db/models.py
  backend/api/transactions.py
  backend/api/actions.py
  backend/main.py
  frontend/ (entire directory)
  docs/ (entire directory)
```

---

## Architecture — How Live Mode Fits In

This is the complete data flow. Your two new files fill the gap marked with `←— YOU BUILD THIS`:

```
Ethereum Network
      ↓
Alchemy WebSocket (wss://eth-mainnet.g.alchemy.com/v2/KEY)
      ↓
backend/blockchain/stream.py          ←— YOU BUILD THIS
      ↓ raw Alchemy transaction dict
backend/blockchain/normalizer.py      ←— YOU BUILD THIS
      ↓ normalized transaction dict (matches existing schema)
backend/risk/scorer.py                ←— ALREADY BUILT, DO NOT TOUCH
      ↓ RiskResult dict
FastAPI WebSocket /ws                 ←— ALREADY BUILT, DO NOT TOUCH
      ↓
React Dashboard                       ←— ALREADY BUILT, DO NOT TOUCH
      ↓ (if medium/critical)
backend/ai/explainer.py               ←— ALREADY BUILT, DO NOT TOUCH
```

The normalizer is the critical bridge. Raw Alchemy data does not match the schema that `scorer.py` expects. The normalizer's only job is to convert one format to the other.

---

## The Schema Contract — Read This Before Writing Any Code

### What Alchemy sends you (raw format):
```json
{
  "hash": "0xabc123...",
  "from": "0xSenderAddress",
  "to": "0xReceiverAddress",
  "value": "0xde0b6b3a7640000",
  "gas": "0x5208",
  "gasPrice": "0x3b9aca00",
  "nonce": "0x4",
  "blockHash": null,
  "blockNumber": null,
  "transactionIndex": null,
  "input": "0x",
  "type": "0x0",
  "v": "0x1",
  "r": "0x...",
  "s": "0x..."
}
```

### What `scorer.py` expects (normalized format):
```json
{
  "hash": "0xabc123...",
  "from_address": "0xSenderAddress",
  "to_address": "0xReceiverAddress",
  "eth_value": 1.0,
  "timestamp": "2024-01-01T00:00:00Z",
  "wallet_age_days": null,
  "nonce": 4,
  "hop_chain": [],
  "from_wallet_recent_txs": []
}
```

### Key differences to handle in normalizer:
- `"from"` → `"from_address"` (field rename)
- `"to"` → `"to_address"` (field rename)
- `"value"` is a hex string like `"0xde0b6b3a7640000"` → convert to ETH float: `int(value, 16) / 1e18`
- `"nonce"` is a hex string like `"0x4"` → convert to int: `int(nonce, 16)`
- `"gas"` and `"gasPrice"` → not needed by scorer, drop them
- `"timestamp"` → not in raw data, use `datetime.utcnow().isoformat() + "Z"`
- `"wallet_age_days"` → not available from mempool, set to `null`
- `"hop_chain"` → not available from mempool, set to `[]`
- `"from_wallet_recent_txs"` → not available from mempool, set to `[]`

---

## Phase 0 — Branch Setup

### Step 0.1 — Create the branch

```bash
git checkout main
git pull origin main
git checkout -b feature/live-blockchain
```

Verify you are on the correct branch:
```bash
git branch --show-current
# Must output: feature/live-blockchain
```

### Step 0.2 — Verify existing system still works on this branch

```bash
cd backend
source venv/bin/activate
python -c "from risk.scorer import score_transaction; print('scorer import OK')"
python -c "from ai.explainer import generate_explanation; print('explainer import OK')"
python -c "from blockchain.simulation import start_simulation; print('simulation import OK')"
```

All three must print OK. If any fail, stop and fix the import error before continuing. Do not proceed to Phase 1 until all three pass.

### Step 0.3 — Add Alchemy key to .env

Open `.env` and add/update these two lines:
```env
ALCHEMY_WSS_URL=wss://eth-mainnet.g.alchemy.com/v2/YOUR_ACTUAL_KEY_HERE
SIMULATION_MODE=false
```

**Important:** Do not remove any existing `.env` variables. Only add these two lines. If `SIMULATION_MODE` already exists, update its value to `false`.

Verify `.env` is in `.gitignore`:
```bash
grep ".env" .gitignore
# Must show .env in the output
```

---

## Phase 1 — Build the Normalizer

Build `normalizer.py` first. The stream depends on it. Never build them in reverse order.

### Step 1.1 — Create the file

Create `backend/blockchain/normalizer.py` with this exact implementation:

```python
"""
backend/blockchain/normalizer.py

Converts raw Alchemy pending transaction format into the normalized
transaction dict that scorer.py expects.

DO NOT import from scorer.py here — this file has no dependencies
on the rest of the risk engine. It only does data transformation.
"""

import time
from datetime import datetime, timezone
from typing import Optional


# Minimum ETH value to process — imported from constants
# Transactions below this threshold are ignored entirely
from blockchain.constants import MIN_ETH_VALUE_FILTER


def hex_to_eth(hex_value: str) -> float:
    """
    Convert a hex Wei string to a float ETH value.

    Example:
        "0xde0b6b3a7640000" → 1.0 ETH
        "0x0" → 0.0 ETH
        "" → 0.0 ETH
    """
    if not hex_value or hex_value == "0x":
        return 0.0
    try:
        return int(hex_value, 16) / 1e18
    except (ValueError, TypeError):
        return 0.0


def hex_to_int(hex_value: str) -> int:
    """
    Convert a hex string to an integer.

    Example:
        "0x4" → 4
        "0x0" → 0
        "" → 0
    """
    if not hex_value or hex_value == "0x":
        return 0
    try:
        return int(hex_value, 16)
    except (ValueError, TypeError):
        return 0


def normalize_tx(raw_tx: dict) -> Optional[dict]:
    """
    Convert a raw Alchemy pending transaction into the normalized
    format expected by scorer.py.

    Returns None if the transaction should be filtered out (value
    too low, missing required fields, or malformed data).

    Args:
        raw_tx: Raw transaction dict from Alchemy WebSocket stream

    Returns:
        Normalized transaction dict or None if transaction should
        be filtered
    """

    # --- Guard: required fields must exist ---
    # A transaction without a hash or sender address is unusable
    if not raw_tx.get("hash"):
        return None
    if not raw_tx.get("from"):
        return None

    # --- Extract and convert ETH value ---
    raw_value = raw_tx.get("value", "0x0")
    eth_value = hex_to_eth(raw_value)

    # --- Filter: ignore low-value transactions ---
    # The mempool produces ~120 tx/second. Without this filter
    # the risk engine gets flooded with dust transactions.
    # MIN_ETH_VALUE_FILTER is defined in constants.py (default: 0.1)
    if eth_value < MIN_ETH_VALUE_FILTER:
        return None

    # --- Extract and convert nonce ---
    raw_nonce = raw_tx.get("nonce", "0x0")
    nonce = hex_to_int(raw_nonce)

    # --- Handle missing "to" address ---
    # Contract creation transactions have no "to" field
    # Set to empty string so scorer.py doesn't crash
    to_address = raw_tx.get("to") or ""

    # --- Build normalized transaction ---
    normalized = {
        # Identity
        "hash": raw_tx["hash"],
        "tx_id": raw_tx["hash"],          # scorer.py uses tx_id

        # Addresses — renamed from Alchemy's "from"/"to" format
        "from_address": raw_tx["from"].lower(),
        "to_address": to_address.lower() if to_address else "",

        # Value
        "eth_value": round(eth_value, 6),

        # Timing — mempool txs have no timestamp, use current UTC
        "timestamp": datetime.now(timezone.utc).isoformat(),

        # Nonce — used by NEW_WALLET rule (nonce <= 2 = new wallet)
        "nonce": nonce,

        # Fields not available from mempool data
        # scorer.py handles None/empty gracefully
        "wallet_age_days": None,
        "hop_chain": [],
        "from_wallet_recent_txs": [],

        # Chain identifier
        "chain": "ethereum",
    }

    return normalized


def is_interesting(normalized_tx: dict) -> bool:
    """
    Secondary filter applied after normalization.
    Returns True if the transaction is worth scoring.

    This catches edge cases that normalize_tx doesn't filter:
    - Contract creation (empty to_address)
    - Suspiciously malformed transactions
    """
    if not normalized_tx:
        return False

    # Skip pure contract creations with no destination
    # (these are not scam/laundering targets)
    if not normalized_tx.get("to_address"):
        return False

    return True
```

### Step 1.2 — Verify normalizer in isolation

```bash
cd backend
source venv/bin/activate
python -c "
from blockchain.normalizer import normalize_tx, hex_to_eth, hex_to_int

# Test 1: hex conversion
assert hex_to_eth('0xde0b6b3a7640000') == 1.0, 'hex_to_eth failed'
assert hex_to_int('0x4') == 4, 'hex_to_int failed'
print('Conversion functions: OK')

# Test 2: normal transaction
raw = {
    'hash': '0xabc123',
    'from': '0xSender',
    'to': '0xReceiver',
    'value': '0x1bc16d674ec80000',  # 2.0 ETH
    'nonce': '0x5',
}
result = normalize_tx(raw)
assert result is not None, 'normalize_tx returned None for valid tx'
assert result['eth_value'] == 2.0, f'ETH value wrong: {result[\"eth_value\"]}'
assert result['from_address'] == '0xsender', 'from_address wrong'
assert result['nonce'] == 5, 'nonce wrong'
print('Normal transaction: OK')

# Test 3: low value filtered out
raw_low = {
    'hash': '0xlow',
    'from': '0xSender',
    'to': '0xReceiver',
    'value': '0x1',  # almost 0 ETH
    'nonce': '0x1',
}
result_low = normalize_tx(raw_low)
assert result_low is None, 'Low value tx should be filtered'
print('Low value filter: OK')

# Test 4: missing hash filtered
raw_no_hash = {'from': '0xSender', 'value': '0xde0b6b3a7640000'}
assert normalize_tx(raw_no_hash) is None, 'Missing hash should return None'
print('Missing hash filter: OK')

# Test 5: missing to address (contract creation)
raw_contract = {
    'hash': '0xcontract',
    'from': '0xSender',
    'to': None,
    'value': '0x1bc16d674ec80000',
    'nonce': '0x1',
}
result_contract = normalize_tx(raw_contract)
print(f'Contract creation handled: {result_contract}')

print()
print('All normalizer tests passed.')
"
```

All tests must pass before moving to Phase 2. Fix any failures before continuing.

---

## Phase 2 — Build the Stream

### Step 2.1 — Install websockets if not already installed

```bash
cd backend
source venv/bin/activate
pip show websockets
```

If not installed:
```bash
pip install websockets
pip freeze > ../requirements.txt
```

### Step 2.2 — Create the file

Create `backend/blockchain/stream.py` with this exact implementation:

```python
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
```

### Step 2.3 — Verify stream imports cleanly

```bash
cd backend
source venv/bin/activate
python -c "
from blockchain.stream import start_blockchain_listener
from blockchain.normalizer import normalize_tx
print('stream.py imports: OK')
print('normalizer.py imports: OK')
"
```

Must print both OK lines. If any import fails, fix it before continuing.

---

## Phase 3 — Wire Into main.py

### Step 3.1 — Read main.py first

Before editing `main.py`, read its entire contents. Understand how `simulation.py` is currently called. You are adding a parallel path — when `SIMULATION_MODE=false`, call `stream.py` instead of `simulation.py`.

### Step 3.2 — Locate the simulation startup code

Find the section in `main.py` that looks something like this:

```python
# Something like this already exists in main.py:
@asynccontextmanager
async def lifespan(app: FastAPI):
    # startup
    asyncio.create_task(start_simulation(...))
    yield
    # shutdown
```

### Step 3.3 — Add live mode branch

Modify ONLY the lifespan startup section. Add the import at the top of main.py and add the conditional branch. Do not change anything else in main.py.

Add this import at the top of main.py (with the other blockchain imports):
```python
from blockchain.stream import start_blockchain_listener
```

Modify the lifespan startup to look like this:
```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database
    await init_db()

    # Start blockchain data source based on config
    if config.SIMULATION_MODE:
        logger.info("Starting in SIMULATION MODE")
        asyncio.create_task(start_simulation(score_and_broadcast))
    else:
        logger.info("Starting in LIVE MODE — connecting to Ethereum mempool")
        asyncio.create_task(
            start_blockchain_listener(
                alchemy_wss_url=config.ALCHEMY_WSS_URL,
                score_and_broadcast=score_and_broadcast,
            )
        )

    yield

    # Shutdown cleanup (keep whatever was here before)
```

**Important:** The `score_and_broadcast` function already exists in `main.py`. You are not creating it. You are just passing it to `start_blockchain_listener` the same way it was being passed to `start_simulation`.

### Step 3.4 — Verify main.py still imports cleanly

```bash
cd backend
source venv/bin/activate
python -c "import main; print('main.py imports: OK')"
```

Must print OK. Fix any import errors before continuing.

---

## Phase 4 — End-to-End Verification

### Step 4.1 — Test with SIMULATION_MODE=true first

Before testing live mode, confirm simulation still works perfectly.

In `.env`, temporarily set:
```
SIMULATION_MODE=true
```

Start the backend:
```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload
```

Wait 10 seconds. You should see simulation transactions appearing in the logs. Verify the health endpoint:
```bash
curl http://localhost:8000/health
# Must return: {"status": "ok", "simulation_mode": true, ...}
```

Stop the server with Ctrl+C.

### Step 4.2 — Test with SIMULATION_MODE=false (live mode)

In `.env`, set:
```
SIMULATION_MODE=false
```

Start the backend:
```bash
uvicorn main:app --reload
```

Watch the logs. You should see:
```
INFO: Starting in LIVE MODE — connecting to Ethereum mempool
INFO: Connecting to Alchemy WebSocket... (attempt 1/10)
INFO: Subscribed successfully. Subscription ID: 0x...
INFO: Live mempool stream active. Processing transactions...
```

Wait 30 seconds. You should start seeing transactions being processed. Check the health endpoint:
```bash
curl http://localhost:8000/health
# Must return: {"status": "ok", "simulation_mode": false, ...}
```

### Step 4.3 — Verify transactions are being scored

After 60 seconds in live mode, check the transactions endpoint:
```bash
curl http://localhost:8000/api/transactions | python -m json.tool | head -50
```

You should see real Ethereum transaction hashes (0x...) with risk scores. Verify on Etherscan:
- Take one transaction hash from the response
- Go to https://etherscan.io/tx/HASH
- Confirm it is a real pending or recent transaction

### Step 4.4 — Verify fallback to simulation still works

Set `SIMULATION_MODE=true` in `.env` again. Restart backend. Confirm simulation transactions appear. This confirms both modes work.

---

## Phase 5 — Write the Quick-Switch Script

Create `scripts/toggle_mode.py` — a utility that makes it easy to switch between live and simulation mode without manually editing `.env`.

```python
"""
scripts/toggle_mode.py

Toggles CryptoGuard between SIMULATION_MODE=true and SIMULATION_MODE=false.
Run this script instead of manually editing .env.

Usage:
    python scripts/toggle_mode.py live        # Switch to live Ethereum mode
    python scripts/toggle_mode.py simulation  # Switch to simulation mode
    python scripts/toggle_mode.py status      # Show current mode
"""

import sys
import os
from pathlib import Path

ENV_PATH = Path(__file__).parent.parent / ".env"


def read_env():
    if not ENV_PATH.exists():
        print(f"Error: .env not found at {ENV_PATH}")
        sys.exit(1)
    return ENV_PATH.read_text()


def write_env(content):
    ENV_PATH.write_text(content)


def get_current_mode(env_content):
    for line in env_content.splitlines():
        if line.startswith("SIMULATION_MODE="):
            value = line.split("=", 1)[1].strip().lower()
            return "simulation" if value == "true" else "live"
    return "unknown"


def set_mode(mode: str):
    env_content = read_env()
    current = get_current_mode(env_content)

    if mode == "status":
        print(f"Current mode: {current.upper()}")
        return

    if mode not in ("live", "simulation"):
        print("Usage: python toggle_mode.py [live|simulation|status]")
        sys.exit(1)

    new_value = "false" if mode == "live" else "true"

    if "SIMULATION_MODE=" in env_content:
        lines = env_content.splitlines()
        new_lines = []
        for line in lines:
            if line.startswith("SIMULATION_MODE="):
                new_lines.append(f"SIMULATION_MODE={new_value}")
            else:
                new_lines.append(line)
        new_content = "\n".join(new_lines)
    else:
        new_content = env_content.rstrip() + f"\nSIMULATION_MODE={new_value}\n"

    write_env(new_content)
    print(f"Switched from {current.upper()} → {mode.upper()} mode")
    print("Restart the backend for changes to take effect:")
    print("  cd backend && uvicorn main:app --reload")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python toggle_mode.py [live|simulation|status]")
        sys.exit(1)
    set_mode(sys.argv[1].lower())
```

Verify it works:
```bash
python scripts/toggle_mode.py status
python scripts/toggle_mode.py simulation
python scripts/toggle_mode.py status
python scripts/toggle_mode.py live
python scripts/toggle_mode.py status
```

---

## Phase 6 — Commit and Push

### Step 6.1 — Final check before committing

```bash
cd backend
source venv/bin/activate

# Verify all existing tests still pass
python -m pytest risk/test_rules.py -v
# Must show: all tests passing, 0 failures

# Verify new files import cleanly
python -c "
from blockchain.stream import start_blockchain_listener
from blockchain.normalizer import normalize_tx, is_interesting, hex_to_eth, hex_to_int
print('All new imports: OK')
"
```

### Step 6.2 — Confirm untouched files are unchanged

```bash
git diff --name-only
```

The output must only show:
```
.env
backend/blockchain/stream.py        (new file)
backend/blockchain/normalizer.py    (new file)
backend/main.py                     (modified — lifespan only)
scripts/toggle_mode.py              (new file)
requirements.txt                    (if websockets was added)
```

If you see ANY other file in this list — especially anything in `backend/risk/`, `backend/ai/`, or `frontend/` — stop immediately and revert those changes with `git checkout -- <filename>`.

### Step 6.3 — Commit

```bash
git add backend/blockchain/stream.py
git add backend/blockchain/normalizer.py
git add scripts/toggle_mode.py
git add backend/main.py
git add requirements.txt
git add .env.example   # if you updated it with ALCHEMY_WSS_URL

# Do NOT git add .env — it is in .gitignore for a reason

git commit -m "feat: live Ethereum mempool stream via Alchemy WebSocket

- Add backend/blockchain/stream.py: Alchemy WebSocket listener
  with auto-reconnect (10 retries, 5s delay between attempts)
- Add backend/blockchain/normalizer.py: converts raw Alchemy tx
  format to scorer.py schema (hex conversion, field renaming,
  MIN_ETH_VALUE_FILTER applied)
- Add scripts/toggle_mode.py: CLI to switch live/simulation mode
- Wire into main.py lifespan: SIMULATION_MODE env flag controls
  which data source starts on boot
- Simulation mode unchanged and fully functional as fallback"
```

### Step 6.4 — Notify Member 1

After pushing, send this message to Member 1:

```
Hey M1 — finished feature/live-blockchain branch.
Added stream.py and normalizer.py in /backend/blockchain/.
Modified only the lifespan startup in main.py (5 lines).
All existing tests still pass. Simulation mode untouched.
When you're ready, review and merge into main.
To switch modes: python scripts/toggle_mode.py live/simulation
```

---

## What to Do If Things Break

### Problem: WebSocket connection refused / timeout
```
Check: Is ALCHEMY_WSS_URL correct in .env?
Check: Is the Alchemy API key valid? Test at console.alchemy.com
Check: Are you behind a firewall that blocks WebSocket connections?
Fix: Run python scripts/toggle_mode.py simulation to fall back immediately
```

### Problem: Transactions not appearing after 60 seconds
```
Check: Is the filter threshold too high?
       Look at MIN_ETH_VALUE_FILTER in constants.py
       Try lowering it to 0.01 temporarily
Check: Is the stream actually receiving messages?
       Add a debug print inside the while loop temporarily
Fix: Check Alchemy dashboard for WebSocket connection activity
```

### Problem: scorer.py crashes on live data
```
This means a real Ethereum transaction has a field format
normalizer.py didn't anticipate.
Check: What field caused the crash? (read the error traceback)
Fix: Add a defensive check in normalizer.py for that field
The _safe_score_and_broadcast wrapper prevents stream crashes
but the error will appear in logs
```

### Problem: main.py import error after modification
```
Check: Did you accidentally indent incorrectly?
Check: Is the import statement at the top of the file?
Fix: git diff backend/main.py to see exactly what changed
     Revert with: git checkout -- backend/main.py and try again
```

### Problem: Simulation mode broken after changes
```
This means main.py was modified incorrectly.
Fix: git checkout -- backend/main.py
     Re-read Step 3.2 and Step 3.3 carefully
     The simulation path must be completely unchanged
```

---

## Demo Usage on Presentation Day

### For maximum demo impact — use LIVE mode:
```bash
python scripts/toggle_mode.py live
cd backend && uvicorn main:app --reload
```
Start 30 seconds before judges arrive so transactions are already in the feed.
Real transaction hashes judges can verify on Etherscan.

### If Wi-Fi is unreliable — switch to simulation:
```bash
python scripts/toggle_mode.py simulation
cd backend && uvicorn main:app --reload
```
Simulation runs on a 91-second loop with 20 pre-scripted transactions.
Works with zero internet connection.

### The toggle takes effect on next server restart — not live.

---

## Final Checklist Before Declaring Complete

- [ ] `feature/live-blockchain` branch exists
- [ ] `backend/blockchain/normalizer.py` created and all tests pass
- [ ] `backend/blockchain/stream.py` created and imports cleanly
- [ ] `scripts/toggle_mode.py` works for live/simulation/status
- [ ] `main.py` modified only in lifespan startup section
- [ ] `SIMULATION_MODE=true` → simulation works exactly as before
- [ ] `SIMULATION_MODE=false` → live Ethereum transactions appear within 60s
- [ ] Real transaction hash verified on Etherscan
- [ ] All 23 existing unit tests still pass
- [ ] `.env` is NOT committed to git
- [ ] Branch committed with descriptive message
- [ ] Member 1 notified to review and merge