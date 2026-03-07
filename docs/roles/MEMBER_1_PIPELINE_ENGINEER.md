# MEMBER 1 — DATA PIPELINE ENGINEER
## CryptoGuard Hackathon | Your Personal Claude Code Playbook

> **How to use this file:** Open this in Claude Code and say `"do phase 0"` or `"do phase 1"` etc. Each phase has exact tasks, file paths, and the code Claude Code needs to build for you.

---

## YOUR ROLE IN ONE LINE
You are the **plumbing**. You own all blockchain data ingestion, the API server, the data schemas, and the environment setup. Without your pipeline running and your schema frozen, Member 2 and Member 3 cannot build anything. **Speed in Hour 0 is your superpower.**

---

## YOUR FOLDER OWNERSHIP
```
/backend/ingestion/         ← YOURS ONLY
/backend/models/            ← YOURS ONLY (schema = law for everyone)
/backend/server.js          ← YOURS ONLY
/backend/api/routes.js      ← SHARED (announce in group chat before editing)
/.env                       ← YOU MANAGE (others read, you write)
/config.js                  ← YOURS
```
**Do NOT touch:** `/backend/risk-engine/`, `/backend/graph/`, `/backend/explainability/`, `/frontend/`

---

## YOUR GIT BRANCH
```bash
git checkout -b m1-pipeline
```
Only merge to `main` during team sync points. Never push directly to `main` alone.

---

## THE DATA CONTRACT — FROZEN FROM HOUR 1
This is the JSON schema every transaction object must follow. **Share this with Member 2 and Member 3 before you write any business logic.** They will build against this shape.

```json
{
  "tx_id": "abc123def456...",
  "from_wallet": "1A2B3C4D...",
  "to_wallets": ["1X2Y3Z...", "4A5B6C..."],
  "amounts": [0.45, 0.05],
  "total_value_usd": 18500,
  "timestamp": 1709800000,
  "mempool_entry_time": 1709800001,
  "from_wallet_age_days": 142,
  "from_wallet_tx_count": 34,
  "from_wallet_avg_value": 2200,
  "from_wallet_recent_txs": [],
  "chain": "bitcoin"
}
```

---

## YOUR API SURFACE — EXPOSE THESE ENDPOINTS

| Method | Endpoint | What it does |
|--------|----------|-------------|
| `GET` | `/transactions/recent` | Last 20 transactions |
| `WS` | `/stream` | Live mempool transaction stream |
| `POST` | `/transactions/score` | Accepts tx_id, calls M2's scorer, returns result |
| `POST` | `/actions/hold` | Broker holds a transaction |
| `POST` | `/actions/monitor` | Broker monitors a transaction |
| `POST` | `/actions/escalate` | Broker escalates a transaction |
| `GET` | `/wallet/:address/history` | Returns wallet's last 10 transactions |
| `GET` | `/health` | Returns `{ status: "ok" }` — for debugging |

---

---

# PHASE 0 — Hours 0 to 1 | KICKOFF & FOUNDATION

**Goal:** Server running, schema shared, team unblocked within 60 minutes.

### Tasks
- [ ] Create the full project folder structure (even empty folders)
- [ ] Initialize package.json, install dependencies
- [ ] Create `.env` with port and config vars
- [ ] Build a skeleton Express/FastAPI server that starts without errors
- [ ] Write the transaction schema as a JS/Python model file
- [ ] Expose `GET /health` returning `{ status: "ok" }`
- [ ] Share `localhost:PORT` + endpoint list in group chat

### Say to Claude Code:
```
"Do phase 0. Set up the full project folder structure, initialize a Node.js/Express 
server (or Python/FastAPI — pick the fastest), create the .env file, and expose a 
/health endpoint. Use this transaction schema: [paste schema above]. Create the schema 
as a models/transaction.js file that exports the shape."
```

### Deliverable
✅ `npm start` (or `python main.py`) runs without errors  
✅ `GET /health` returns 200  
✅ Schema file exists at `/backend/models/transaction.js`  
✅ You've sent the localhost URL to the group chat

---

# PHASE 1 — Hours 1 to 4 | MOCK MEMPOOL STREAM

**Goal:** Live fake transaction data flowing from your server so M3 can start building the UI immediately.

### Tasks
- [ ] Build a transaction generator that creates realistic-looking tx objects every 2–5 seconds
- [ ] Include **normal** transactions (old wallet, small amount, 1-2 destinations)
- [ ] Include **suspicious** transactions (fresh wallet, high value, 10+ destinations, rapid timing)
- [ ] Wire the generator to a WebSocket endpoint at `/stream`
- [ ] Build a wallet history store (in-memory object: `{ walletAddress: [lastTxs] }`)
- [ ] Add 10 hardcoded "known bad actor" wallet addresses to a constants file
- [ ] Write 3 unit tests confirming output matches the schema

### Say to Claude Code:
```
"Do phase 1. Build a mock mempool transaction stream for our CryptoGuard project.
Create a transaction generator in /backend/ingestion/generator.js that emits 
realistic Bitcoin-like transactions every 3 seconds via WebSocket at /stream.
Include a mix of normal transactions and suspicious ones (high-value wallet 
splitting to 12+ destinations simultaneously, wallets that are only 2 days old, 
rapid-fire transactions). Use this schema: [paste schema]. Also create a wallet 
history store in /backend/ingestion/walletHistory.js and a known bad actors list 
in /backend/ingestion/badActors.js with 10 hardcoded wallet addresses."
```

### Pre-scripted suspicious transactions to hardcode (for demo use):
```
DEMO_TX_1 — Peel chain: wallet age 1 day, sends 95% to new wallet, 5% to another, repeats 7 hops
DEMO_TX_2 — Mixer adjacent: from_wallet is 2 hops from a known bad actor address
DEMO_TX_3 — Velocity anomaly: same wallet sends 15 transactions in 4 minutes
DEMO_TX_4 — Normal control: wallet age 340 days, small value, 1 destination
```

### Deliverable
✅ `ws://localhost:PORT/stream` emits a new transaction every 3 seconds  
✅ M3 can connect and see live data in their frontend  
✅ Both normal and suspicious transactions appear in the stream  
✅ Wallet history store populates as transactions come through

---

# PHASE 2 — Hours 4 to 8 | API HARDENING

**Goal:** Full API surface complete. M2 and M3 can both call your endpoints without asking you for anything.

### Tasks
- [ ] Implement `GET /transactions/recent` returning last 20 transactions
- [ ] Implement `GET /wallet/:address/history` pulling from the wallet history store
- [ ] Implement `POST /transactions/score` — accepts `{ tx_id }`, enriches with wallet history, calls M2's scoring function (or returns mock score if M2 isn't ready yet)
- [ ] Implement broker action endpoints: `POST /actions/hold`, `POST /actions/monitor`, `POST /actions/escalate` — log the action and return confirmation
- [ ] Add CORS headers so M3's frontend can hit your backend
- [ ] Add basic request logging middleware (just `console.log` is fine)
- [ ] Write an `api-contracts.md` — one-page doc of every endpoint with request/response examples

### Say to Claude Code:
```
"Do phase 2. Harden the API for our CryptoGuard backend. Add these endpoints to 
/backend/server.js: GET /transactions/recent, GET /wallet/:address/history, 
POST /transactions/score (which should enrich the transaction with wallet history 
and call a scoreTransaction function — stub that function for now returning a mock 
score of 75 if the wallet is under 7 days old, 20 otherwise), POST /actions/hold, 
POST /actions/monitor, POST /actions/escalate. Add CORS middleware. Add a request 
logger. Then write /backend/api-contracts.md documenting every endpoint with 
example request and response bodies."
```

### Deliverable
✅ All 8 endpoints respond correctly  
✅ CORS works — M3 can call from their frontend without errors  
✅ `api-contracts.md` written and shared with M2 and M3  
✅ Broker actions log to console with timestamp and action type

---

# PHASE 3 — Hours 8 to 14 | INTEGRATION SUPPORT

**Goal:** Be the integration glue. Fix bugs that trace back to your API. Build the demo seed script.

### Tasks
- [ ] Attend Hour 8 sync — fix any schema mismatches M2 or M3 found
- [ ] Wire M2's real `scoreTransaction()` into `POST /transactions/score` (replacing the stub)
- [ ] Fix any CORS or connection issues M3 is hitting
- [ ] **Build the demo seed script** — a script that fires specific pre-scripted transactions in a fixed order on command
- [ ] Test the full pipeline: seed script fires → transaction streams → M2 scores it → M3 displays it
- [ ] If ahead of schedule: add a real blockchain data source (BlockCypher free API for live mempool data)

### Say to Claude Code:
```
"Do phase 3. Build a demo seed script at /backend/ingestion/demoSeed.js that when 
run fires these 4 specific transactions in sequence with 5-second gaps between them:
1. A normal transaction (wallet age 200 days, 0.1 BTC, 1 destination, risk score should be low)
2. A peel chain transaction (wallet age 1 day, splits to 8 wallets, amounts decreasing by ~5% each hop)
3. A mixer-adjacent transaction (from_wallet listed in our bad actors list 2 hops away)
4. A velocity anomaly (same wallet as transaction 2, fires again 30 seconds later with 12 destinations)
Make the seed script triggerable via POST /demo/start endpoint. Also wire Member 2's 
scoreTransaction function into the POST /transactions/score endpoint — the function 
lives at /backend/risk-engine/scorer.js and exports scoreTransaction(tx)."
```

### Deliverable
✅ `POST /demo/start` fires the scripted demo sequence  
✅ M2's real scorer is wired in (not the stub)  
✅ Full pipeline tested end-to-end by all 3 members together  
✅ Demo sequence produces correct scores on M3's dashboard

---

# PHASE 4 — Hours 14 to 20 | DEMO POLISH & PITCH PREP

**Goal:** Demo is bulletproof. You can explain the entire architecture confidently.

### Tasks
- [ ] Run the demo seed script 5 times — confirm it produces the same visual output each time
- [ ] Write a single startup command in README: `npm start` should bring everything up
- [ ] Take backup screenshots of every demo state (terminal showing server logs is good too)
- [ ] Prepare your spoken explanation of the pipeline for the pitch
- [ ] Read Q3–Q10 from the 50 Questions doc — these technical questions are yours to answer

### Your Pitch Section (memorize this):
> *"Our pipeline ingests transactions directly from the mempool — the waiting room before blockchain confirmation. Every transaction is enriched with the sending wallet's behavioral history and immediately handed to the risk engine. The entire flow from transaction arrival to scored output takes under 100 milliseconds."*

### Say to Claude Code:
```
"Do phase 4. Write a clean README.md for the project root with:
1. One-command startup instructions
2. Architecture overview (3 sentences)
3. API endpoint reference table
4. How to trigger the demo seed sequence
5. Environment variable list with descriptions
Also add a /backend/ingestion/healthCheck.js that verifies all services are running 
and returns a status object. Wire it to GET /health."
```

### Deliverable
✅ `npm start` in project root starts everything  
✅ Demo seed fires reliably 5/5 times  
✅ README is clear enough for a judge to understand the architecture  
✅ You can say your pipeline explanation without looking at anything

---

# PHASE 5 — Hours 20 to 24 | FULL FREEZE

**Goal:** Nothing new. Just pitch prep and rest.

### Tasks
- [ ] **CODE FREEZE** — no new features, only critical bug fixes
- [ ] Load demo on the presentation device and leave it open
- [ ] Rehearse your pipeline explanation section of the pitch (2 minutes max)
- [ ] Brief Member 3 on any last technical details they need to narrate the demo
- [ ] Read Red Flag responses #1, #2, #3 from the Red Flag doc — own those answers
- [ ] Sleep/rest if time allows. A rested brain outperforms a tired one every time.

### Say to Claude Code (only if a critical bug surfaces):
```
"There's a bug in [specific file]. [Describe the symptom exactly]. 
Fix only this bug, do not refactor anything else."
```

---

## YOUR QUICK-REFERENCE ANSWERS FOR THE PITCH

**"How fast is real-time?"**
> "Under 100 milliseconds from transaction arrival to risk score. We're co-located with the data stream — no round trips."

**"What is the mempool?"**
> "The waiting room before blockchain confirmation. Every unconfirmed transaction lives here for seconds to minutes. It's the only window where interception is possible."

**"How do you simulate blockchain data?"**
> "Our prototype uses a mock stream that mirrors real mempool patterns — pre-scripted with known fraud signatures for the demo. A production system connects directly to blockchain nodes."

**"What data does your pipeline ingest?"**
> "Transaction metadata, wallet behavioral history, known bad actor lists, and mempool timing data. All public on-chain data — no personal information stored."

---

*Branch: m1-pipeline | Sync points: Hours 0, 4, 8, 12, 16, 20, 22*
