# CryptoGuard — Agent Build Instructions

> **THIS DOCUMENT IS FOR THE AI AGENT. NOT FOR HUMANS.**
> Every instruction here is written assuming the reader is an AI coding agent with access to a terminal, file system, and the internet. Follow every step in sequence. Do not summarize, skip, or reorder steps. When a step says "verify", stop and verify before continuing.

---

## Agent Identity & Mission

You are the primary build agent for CryptoGuard. Your mission is to produce a fully working, deployable, demo-ready full-stack application. The output will be demonstrated live at a hackathon in front of judges. Every decision you make should optimize for: **it works perfectly in the demo** and **it looks like a real professional product**.

You have access to: terminal, file system, npm, pip, Python 3.11+, Node 20+.

---

## Phase 0 — Orientation (Do This Before Anything Else)

### 0.1 — Read Project Context

Read these files in order. Do not proceed to Phase 1 until all four are read:

```
READ: docs/project-overview.md
READ: docs/simulation-data.json
READ: .agent/skills/cryptoguard-master-setup/SKILL.md
READ: .agent/skills/cryptoguard-risk-engine/SKILL.md
READ: .agent/skills/cryptoguard-frontend-language/SKILL.md
READ: .agent/skills/cryptoguard-blockchain-data/SKILL.md
```

### 0.2 — Load All Available Skills

Run this command to detect all installed skills:

```bash
ls .agent/skills/
```

For each skill directory found, read its `SKILL.md`. You must know every skill available before making decisions.

### 0.3 — Understand the Data Flow

Commit this data flow to working memory. Every component you build must fit into it:

```
[Ethereum mempool OR simulation-data.json]
       ↓
backend/blockchain/stream.py or simulation.py
       ↓ normalize_tx()
backend/risk/scorer.py → RiskResult
       ↓ broadcast via WebSocket /ws
frontend LiveFeed component
       ↓ (if medium/critical)
backend/ai/explainer.py → Claude API (streaming)
       ↓ SSE stream to frontend
frontend AIExplanation component (types in real-time)
       ↓ (analyst clicks action)
POST /api/actions → SQLite case_actions table
       ↓
frontend CaseLog page
```

---

## Phase 1 — Environment & Scaffolding

### 1.1 — Create `.env`

Create `.env` in the project root with these values. Replace placeholder values:

```env
ALCHEMY_WSS_URL=wss://eth-mainnet.g.alchemy.com/v2/REPLACE_WITH_REAL_KEY
ANTHROPIC_API_KEY=sk-ant-REPLACE_WITH_REAL_KEY
DATABASE_URL=sqlite+aiosqlite:///./cryptoguard.db
CORS_ORIGINS=http://localhost:5173
HOST=0.0.0.0
PORT=8000
SIMULATION_MODE=true
SIMULATION_DATA_PATH=docs/simulation-data.json
```

Create `.env.example` with the same keys but empty values. Add `.env` to `.gitignore` immediately.

### 1.2 — Create Project Structure

Create all directories from the structure defined in `.agent/skills/cryptoguard-master-setup/SKILL.md` → Step 3. Use `mkdir -p` for nested paths.

Verify:
```bash
find . -type d | grep -v node_modules | grep -v __pycache__ | grep -v .git | sort
```

### 1.3 — Install Backend Dependencies

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install fastapi uvicorn[standard] websockets httpx aiosqlite pydantic python-dotenv anthropic
pip freeze > ../requirements.txt
```

Verify installation:
```bash
python -c "import fastapi, uvicorn, websockets, httpx, aiosqlite, pydantic, anthropic; print('All imports OK')"
```

### 1.4 — Install Frontend Dependencies

```bash
cd frontend
npm create vite@latest . -- --template react-ts --force
npm install
npm install tailwindcss @tailwindcss/vite
npm install lucide-react recharts react-router-dom
npm install react-force-graph-2d
npm install ai @ai-sdk/react @ai-sdk/anthropic
npx shadcn-ui@latest init --yes --base-color slate --css-variables true
```

Verify:
```bash
npm run build 2>&1 | tail -5
```

---

## Phase 2 — Backend Core

Build these files in this exact order. Each depends on the previous.

### 2.1 — `backend/config.py`

Read from `.env` using `python-dotenv`. Expose typed config object. All other backend files import from here — no file should call `os.getenv()` directly except this one.

Keys to expose:
- `ALCHEMY_WSS_URL: str`
- `ANTHROPIC_API_KEY: str`
- `DATABASE_URL: str`
- `CORS_ORIGINS: list[str]`
- `SIMULATION_MODE: bool`
- `SIMULATION_DATA_PATH: str`

### 2.2 — `backend/db/database.py`

Use `aiosqlite` for async SQLite. Create two tables:

**`transactions` table:**
- `id TEXT PRIMARY KEY`
- `hash TEXT NOT NULL`
- `from_address TEXT NOT NULL`
- `to_address TEXT NOT NULL`
- `eth_value REAL`
- `risk_score INTEGER`
- `risk_tier TEXT` — values: `'low'`, `'medium'`, `'critical'`
- `triggered_rules TEXT` — JSON-serialized list
- `hop_chain TEXT` — JSON-serialized list, nullable
- `ai_explanation TEXT` — nullable
- `timestamp TEXT`

**`case_actions` table:**
- `id INTEGER PRIMARY KEY AUTOINCREMENT`
- `tx_id TEXT NOT NULL`
- `action TEXT NOT NULL` — values: `'hold'`, `'monitor'`, `'escalate'`
- `analyst_notes TEXT`
- `actioned_at TEXT`
- `actioned_by TEXT DEFAULT 'analyst_01'`
- `is_seed INTEGER DEFAULT 0`

After creating tables, call `seed_case_log()`. This function reads `docs/simulation-data.json` → `seeded_case_log` array and inserts all entries if the table is empty.

Expose a `get_db()` async context manager and a `get_db_stats()` function.

### 2.3 — `backend/db/models.py`

Define all Pydantic models from the schema in `.agent/skills/cryptoguard-master-setup/SKILL.md` → Step 7. The `RiskResult` model and `CaseAction` model must exactly match the TypeScript types in the frontend.

### 2.4 — `backend/blockchain/constants.py`

Define these constants (do not fetch at import time):

```python
TORNADO_CASH_ADDRESSES = frozenset({
    "0xd4b88df4d29f5cedd6857912842cff3b20c8cfa3",
    "0x910cbd523d972eb0a6f4cae4618ad62622b39dbf",
    "0xfd8610d20aa15b7b2e3be39b396a1bc3516c7144",
    "0x07687e702b410fa43f4cb4af7fa097918ffd2730",
})

DEX_ROUTER_ADDRESSES = frozenset({
    "0x7a250d5630b4cf539739df2c5dacb4c659f2488d",  # Uniswap V2
    "0xe592427a0aece92de3edee1f18e0157c05861564",  # Uniswap V3
    "0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f",  # Sushiswap
    "0x1111111254fb6c44bac0bed2854e76f90643097d",  # 1inch
})

MEW_DARK_LIST_URL = "https://raw.githubusercontent.com/MyEtherWallet/ethereum-lists/master/src/addresses/addresses-darklist.json"

MIN_ETH_VALUE_FILTER = 0.1
VELOCITY_WINDOW_SECONDS = 60
VELOCITY_THRESHOLD = 5
PEEL_CHAIN_THRESHOLD_PERCENT = 0.80
LARGE_VALUE_ETH = 10.0
NEW_WALLET_AGE_DAYS = 7
```

### 2.5 — `backend/risk/rules.py`

Implement each rule as an independent async function. Each function receives the normalized transaction dict and a `WalletHistory` object (last 20 transactions for each wallet). Each returns a `tuple[bool, int]` — triggered flag and score contribution.

Implement all 6 rules from `.agent/skills/cryptoguard-risk-engine/SKILL.md`. Weights are locked — do not change them.

### 2.6 — `backend/risk/scorer.py`

`score_transaction(tx: dict, wallet_history: dict) -> RiskResult`

Call all 6 rules. Sum scores, cap at 100. Determine tier. Return `RiskResult`.

This function must complete in under 10ms for a typical transaction. Do not make any network calls here.

### 2.7 — `backend/blockchain/stream.py`

Connects to Alchemy WebSocket. Implements:

```python
async def start_blockchain_listener():
    # If SIMULATION_MODE: call simulation.start_simulation() instead
    # If live: connect to ALCHEMY_WSS_URL
    # Subscribe to alchemy_pendingTransactions
    # For each incoming tx:
    #   1. Call normalize_tx(raw)
    #   2. Filter with is_interesting(normalized)
    #   3. Score with scorer.score_transaction()
    #   4. Store in database
    #   5. Broadcast RiskResult to all WebSocket clients
    #   6. If medium/critical: trigger async AI explanation (non-blocking)
```

Reconnect logic: if connection drops, wait 5 seconds and retry. Maximum 10 retries.

### 2.8 — `backend/blockchain/simulation.py`

Reads `docs/simulation-data.json`. Replays transactions with `asyncio.sleep()` between each based on `timestamp_offset_seconds` differences. After last transaction, sleep 15 seconds then loop. Broadcasts same format as live stream.

### 2.9 — `backend/ai/explainer.py`

```python
async def generate_explanation(risk_result: RiskResult) -> AsyncGenerator[str, None]:
    # Only call if risk_tier in ['medium', 'critical']
    # Build prompt from risk_result fields
    # Stream Claude API response
    # Yield text chunks as they arrive
    # On error: yield fallback explanation string
```

Prompt template:
```
You are a cryptocurrency compliance officer. A transaction has been flagged by our automated risk system.

Transaction Details:
- From: {from_address}
- To: {to_address}  
- Value: {eth_value:.3f} ETH
- Risk Score: {risk_score}/100
- Risk Tier: {risk_tier.upper()}
- Triggered Rules: {', '.join(triggered_rules)}
{hop_chain_section}

Write exactly 2-3 sentences explaining why this transaction is suspicious and what action should be taken. 
Write for a compliance officer, not a developer. Be specific about the risk pattern detected.
Do not use bullet points. Do not start with "I". Be direct and professional.
```

If `hop_chain` is present, add: `- Fund Hop Chain: {len(hop_chain)} wallets deep`

### 2.10 — `backend/api/transactions.py`

Routes:
- `GET /health` — returns `{"status": "ok", "simulation_mode": bool, "transactions_processed": int}`
- `WebSocket /ws` — broadcasts `RiskResult` JSON to all connected clients
- `GET /api/transactions` — last 50 transactions from database, ordered by timestamp desc
- `GET /api/transactions/{tx_id}` — single transaction with full detail
- `GET /api/explain/{tx_id}` — SSE endpoint that streams AI explanation for a transaction

### 2.11 — `backend/api/actions.py`

Routes:
- `POST /api/actions` — create a new case action
  - Body: `{tx_id, action, analyst_notes}`
  - Returns: created action with id and timestamp
- `GET /api/actions` — all case actions with joined transaction data, ordered by actioned_at desc
- `GET /api/actions/{tx_id}` — action for specific transaction

### 2.12 — `backend/main.py`

Assemble the FastAPI app per `.agent/skills/cryptoguard-master-setup/SKILL.md` → Step 4. Include CORS, both routers, lifespan context manager.

**Verify backend works:**
```bash
cd backend && source venv/bin/activate && uvicorn main:app --reload &
sleep 3
curl http://localhost:8000/health
# Must return: {"status": "ok", ...}
```

---

## Phase 3 — Frontend Core

Build in this order. Activate the `cryptoguard-frontend-language` skill for every component.

### 3.1 — `frontend/src/types/index.ts`

Copy the TypeScript types exactly from `.agent/skills/cryptoguard-master-setup/SKILL.md` → Step 7. Add nothing, remove nothing.

### 3.2 — `frontend/src/lib/utils.ts`

Implement these utility functions. They are used across multiple components:

```typescript
// Format wallet address for display: 0xABCD...1234
export const formatAddress = (address: string): string =>
  `${address.slice(0, 6)}...${address.slice(-4)}`;

// Format ETH value: 2 decimal places + " ETH"
export const formatEth = (value: number): string =>
  `${value.toFixed(3)} ETH`;

// Etherscan links
export const etherscanAddress = (addr: string): string =>
  `https://etherscan.io/address/${addr}`;
export const etherscanTx = (hash: string): string =>
  `https://etherscan.io/tx/${hash}`;

// Risk tier to color CSS variable
export const riskColor = (tier: 'low' | 'medium' | 'critical'): string => ({
  low: 'var(--risk-safe)',
  medium: 'var(--risk-medium)',
  critical: 'var(--risk-critical)',
}[tier]);

// Relative timestamp: "3s ago", "2m ago"
export const relativeTime = (isoString: string): string => { /* implement */ };
```

### 3.3 — `frontend/src/lib/api.ts`

```typescript
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const WS_URL = API_BASE.replace('http', 'ws') + '/ws';

export const api = {
  getTransactions: () => fetch(`${API_BASE}/api/transactions`).then(r => r.json()),
  getTransaction: (id: string) => fetch(`${API_BASE}/api/transactions/${id}`).then(r => r.json()),
  getActions: () => fetch(`${API_BASE}/api/actions`).then(r => r.json()),
  createAction: (data: { tx_id: string; action: string; analyst_notes: string }) =>
    fetch(`${API_BASE}/api/actions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(r => r.json()),
  explainStream: (tx_id: string) => new EventSource(`${API_BASE}/api/explain/${tx_id}`),
};

export { WS_URL };
```

### 3.4 — `frontend/src/hooks/useWebSocket.ts`

Custom hook that:
- Connects to `WS_URL` on mount
- Stores last 100 transactions in state (oldest removed when limit hit)
- Exposes: `{ transactions, isConnected, criticalCount, totalScanned }`
- Auto-reconnects on disconnect with exponential backoff
- Parses incoming JSON and validates against `RiskResult` type

### 3.5 — `frontend/src/components/RuleBadge.tsx`

Small pill component. Takes a `RuleKey` and renders a badge with:
- Short human label (e.g., `BLACKLIST_HIT` → "Blacklist")
- Background color matching severity (BLACKLIST_HIT and TORNADO_PROXIMITY → red, others → amber)
- Monospace font

### 3.6 — `frontend/src/components/RiskGauge.tsx`

SVG circular gauge. Props: `{ score: number, tier: string, animated?: boolean }`.

Requirements:
- Circular track (gray) with colored arc that fills based on score
- Arc color: green 0–39, amber 40–69, red 70–100
- Score number in center, counts up from 0 on mount (CSS animation)
- Tier label below score
- Pulsing outer ring when tier === 'critical'
- Do not use any chart library for this — pure SVG

### 3.7 — `frontend/src/components/LiveFeed.tsx`

The main transaction table. Props: `{ transactions: RiskResult[], onSelect: (tx: RiskResult) => void }`.

Requirements:
- Each row: risk indicator bar (left border, colored), from/to addresses (formatted + clickable), ETH value, risk score, triggered rule badges, timestamp
- New rows appear at top with slide-in animation (translateY from -20px, opacity 0→1, 300ms)
- CRITICAL rows have: red left border (4px), subtle red radial glow on background
- Clicking a row calls `onSelect`
- Selected row has highlighted border
- Show max 50 rows, fade out oldest
- "LIVE" indicator with pulsing green dot in header

### 3.8 — `frontend/src/components/AIExplanation.tsx`

Props: `{ tx_id: string | null, explanation?: string }`.

Behavior:
- If `explanation` already exists (from simulation data): type it in character by character using `setInterval`, 30ms per character
- If no explanation: call `api.explainStream(tx_id)` SSE endpoint, render text as it streams in
- Show blinking cursor while text is streaming
- Monospace font, muted green color (`#00ff88` at 80% opacity)
- "Generating compliance analysis..." placeholder while waiting for first token
- Wrap in a panel with "AI ANALYSIS" label in the top-left corner

### 3.9 — `frontend/src/components/WalletGraph.tsx`

Props: `{ hopChain: string[], highlightAddress?: string }`.

Uses `react-force-graph-2d`.

Requirements:
- Each wallet address is a node (abbreviated label)
- Edges represent the fund flow direction (arrows)
- Node color: 
  - Tornado Cash addresses → `#ff3366` (bright red)
  - The originating suspicious address → `#ff8800` (orange)
  - Intermediate hop wallets → `#ffaa00` (amber)  
  - Final destination → `#00ff88` (green)
- Edge thickness proportional to value
- Physics simulation active — nodes should settle naturally
- Click a node → open Etherscan address in new tab
- Show ETH amounts on edges if available
- Dark background matching dashboard theme

### 3.10 — `frontend/src/components/ActionButtons.tsx`

Props: `{ tx_id: string, onAction: (action: string) => void }`.

Three buttons: HOLD (red), MONITOR (amber), ESCALATE (purple).
Each button: icon + label, confirm on click (brief visual flash before submitting).
Shows current action status if already actioned.
Calls `api.createAction()` on click, then calls `onAction` callback.

### 3.11 — `frontend/src/components/StatsBar.tsx`

Props: `{ totalScanned: number, critical: number, held: number, isConnected: boolean }`.

Top bar showing: connection status dot (green/red), total scanned (animated counter), critical alerts (red badge), held transactions count. Refreshes every 5 seconds from `/api/actions` count.

### 3.12 — `frontend/src/pages/Dashboard.tsx`

Main page layout:

```
┌─────────────────────────────────────────────────┐
│ StatsBar (connection, counters)                 │
├────────────────────────┬────────────────────────┤
│                        │  Selected TX Detail:   │
│  LiveFeed              │  RiskGauge             │
│  (left, ~60% width)    │  RuleBadges            │
│                        │  AIExplanation         │
│                        │  ActionButtons         │
└────────────────────────┴────────────────────────┘
```

State: `selectedTx: RiskResult | null`. When LiveFeed row clicked → set selectedTx → right panel updates.

### 3.13 — `frontend/src/pages/CaseDetail.tsx`

Route: `/case/:tx_id`

Full-page view of one transaction:
- Full transaction metadata
- WalletGraph (if hop_chain present)
- Risk score timeline (recharts LineChart showing score changes if multiple events for same wallet)
- Full AIExplanation
- ActionButtons
- Back button to dashboard

### 3.14 — `frontend/src/pages/CaseLog.tsx`

Route: `/cases`

Table of all actioned transactions fetched from `/api/actions`.
Columns: timestamp, wallet from/to, ETH value, risk score, action taken (color-coded), analyst notes.
Filter bar: by action type (hold/monitor/escalate), by date, by risk tier.
Stats at top: total cases, breakdown by action type.

### 3.15 — `frontend/src/App.tsx`

React Router setup with these routes:
- `/` → Dashboard
- `/case/:tx_id` → CaseDetail
- `/cases` → CaseLog

Navigation bar: CryptoGuard logo, "Live Monitor" link, "Case Log" link.

---

## Phase 4 — Integration & Wiring

### 4.1 — Connect WebSocket to Dashboard

In `Dashboard.tsx`, import and use `useWebSocket()`. Pass `transactions` to `LiveFeed`. Pass `totalScanned` and `criticalCount` to `StatsBar`.

### 4.2 — Wire AI Explanation

When `selectedTx` is set and `risk_tier` is `medium` or `critical`:
- If `selectedTx.ai_explanation` exists → pass to `AIExplanation` directly
- Otherwise → pass `tx_id` to `AIExplanation` to trigger SSE fetch

### 4.3 — Wire Action Buttons

When an action is submitted from `ActionButtons`, optimistically update the UI and re-fetch `StatsBar` counts.

### 4.4 — Tailwind Config

In `tailwind.config.ts`, define these CSS custom properties in the theme extension. They must match exactly what `cryptoguard-frontend-language/SKILL.md` defines:

```typescript
extend: {
  colors: {
    'bg-base': '#0a0e1a',
    'bg-surface': '#111827',
    'bg-elevated': '#1a2235',
    'risk-critical': '#ff3366',
    'risk-medium': '#ffaa00',
    'risk-safe': '#00ff88',
  },
  fontFamily: {
    mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
  },
  animation: {
    'slide-in': 'slideIn 300ms ease-out',
    'pulse-glow': 'pulseGlow 2s infinite',
  },
}
```

Add `@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&display=swap')` to `index.css`.

Set `html, body { background: #0a0e1a; }` globally.

---

## Phase 5 — Verification

Run every check in `.agent/skills/cryptoguard-master-setup/SKILL.md` → Step 12.

Additionally:

### 5.1 — End-to-End Flow Test
1. Start backend: `cd backend && uvicorn main:app --reload`
2. Start frontend: `cd frontend && npm run dev`
3. Open `http://localhost:5173`
4. Verify: transactions appear in LiveFeed within 10 seconds
5. Verify: CRITICAL rows have red styling
6. Click a critical transaction
7. Verify: RiskGauge shows correct score
8. Verify: AIExplanation appears (typed in)
9. Click "HOLD" button
10. Navigate to `/cases`
11. Verify: the actioned transaction appears in case log

### 5.2 — Edge Case Checks
- WebSocket disconnect: manually kill backend → verify "Reconnecting..." indicator appears in StatsBar → restart backend → verify reconnects automatically
- Empty state: on first load before any transactions, verify LiveFeed shows a loading skeleton, not broken UI
- Long addresses: verify all addresses are abbreviated in every location they appear

### 5.3 — Performance Check
Open browser DevTools → Network tab. Verify:
- WebSocket messages are arriving (not polling)
- No failed network requests in console
- No TypeScript errors in console

---

## Phase 6 — Demo Preparation

### 6.1 — Seed Database

Ensure `seeded_case_log` from `docs/simulation-data.json` is loaded in SQLite. Verify with:
```bash
sqlite3 backend/cryptoguard.db "SELECT COUNT(*) FROM case_actions WHERE is_seed=1;"
# Must return: 5
```

### 6.2 — Set Simulation Mode

Confirm `.env` has `SIMULATION_MODE=true`. The simulation plays the peel chain scenario starting from `sim_001`, building to the dramatic `sim_020` final hop. The full cycle is 91 seconds.

For demo: start the backend 30 seconds before the presentation begins so that there are already some transactions in the feed when judges walk up.

### 6.3 — Pre-configure Browser

Open Chrome. Go to `http://localhost:5173`. 

Arrange the window so the following is visible without scrolling:
- StatsBar at top (showing live connection + counts)
- At least 10 rows in LiveFeed
- Right panel ready (nothing selected yet)

When demonstrating: click transaction `sim_006` (the Tornado Cash one) first. The AIExplanation for that one is the most dramatic and clear.

### 6.4 — Build for Production (Optional)

```bash
# Build frontend
cd frontend && npm run build
# Serves at backend as static files

# In backend/main.py, add static file serving:
from fastapi.staticfiles import StaticFiles
app.mount("/", StaticFiles(directory="../frontend/dist", html=True), name="static")
```

---

## What the Agent Should Do When Stuck

1. Read the relevant skill file again — the answer is usually there
2. Run the verification command for the broken component
3. Check if the error is a type mismatch between frontend `RiskResult` and Python `RiskResult` model — this is the most common integration bug
4. Check if CORS is blocking the request — verify `CORS_ORIGINS` in `.env`
5. If WebSocket isn't connecting — verify backend is running and check browser console for the exact error URL being attempted
6. If Tailwind classes aren't applying — run `npm run build` to force CSS regeneration

---

## Final Output Checklist

Before declaring the build complete, verify every item:

- [ ] `http://localhost:8000/health` returns 200 OK
- [ ] `http://localhost:5173` loads without console errors  
- [ ] LiveFeed populates with transactions within 10 seconds
- [ ] Low-risk transactions are green, critical are red
- [ ] Clicking a critical transaction shows RiskGauge + AI explanation
- [ ] AI explanation types in character-by-character
- [ ] WalletGraph renders for transactions with hop_chain
- [ ] All wallet addresses open Etherscan in new tab when clicked
- [ ] HOLD button submits and appears in `/cases` log
- [ ] Case Log has at least 5 seeded entries
- [ ] No `any` types in TypeScript
- [ ] No hardcoded API keys anywhere
- [ ] `.env` is in `.gitignore`
- [ ] `npm run build` succeeds with no errors
- [ ] `docker-compose up` starts both services (if Docker available)
