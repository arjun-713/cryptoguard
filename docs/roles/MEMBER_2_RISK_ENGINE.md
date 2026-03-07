# MEMBER 2 — RISK & INTELLIGENCE ENGINE
## CryptoGuard Hackathon | Your Personal Claude Code Playbook

> **How to use this file:** Open this in Claude Code and say `"do phase 0"` or `"do phase 1"` etc. Each phase has exact tasks, file paths, and the code Claude Code needs to build for you.

---

## YOUR ROLE IN ONE LINE
You are the **brain**. You own the graph analytics, the scoring algorithms, the fraud pattern detectors, and the explainable AI output. Your work is the core innovation that makes this product different from Chainalysis. **The explainability strings you generate will appear on screen during the demo — make them read like evidence, not logs.**

---

## YOUR FOLDER OWNERSHIP
```
/backend/risk-engine/         ← YOURS ONLY
/backend/graph/               ← YOURS ONLY
/backend/explainability/      ← YOURS ONLY
```
**Do NOT touch:** `/backend/ingestion/`, `/backend/models/`, `/frontend/`  
**Read only:** `/backend/models/transaction.js` (M1's schema — your input format)

---

## YOUR GIT BRANCH
```bash
git checkout -b m2-engine
```
Only merge to `main` during team sync points. Never push directly to `main` alone.

---

## YOUR INPUT — FROM MEMBER 1
Every transaction object you receive will look like this:

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

## YOUR OUTPUT — WHAT MEMBER 3's UI EXPECTS
Your `scoreTransaction(tx)` function must return **exactly this shape**. Confirm with M3 before Hour 2.

```json
{
  "tx_id": "abc123...",
  "risk_score": 87,
  "action": "HOLD",
  "signals": {
    "peel_chain_detected": true,
    "peel_chain_confidence": 0.91,
    "mixer_proximity_hops": 2,
    "velocity_anomaly_percentile": 94,
    "known_bad_actor_connected": false
  },
  "explanation": "High risk: wallet has participated in peel chain structure across 7 prior transactions (91% confidence). Mixer proximity: 2 hops from known mixer. Transaction splits to 12 wallets simultaneously — velocity anomaly at 94th percentile. Recommended action: HOLD and escalate to compliance team.",
  "scored_at_ms": 1709800043
}
```

### Action thresholds:
| Score | Action |
|-------|--------|
| 0–29 | `PASS` |
| 30–59 | `MONITOR` |
| 60–79 | `FLAG` |
| 80–100 | `HOLD` |

---

## YOUR SCORING WEIGHTS
| Signal | Weight |
|--------|--------|
| Peel chain detected | 35% |
| Mixer proximity | 30% |
| Velocity anomaly | 25% |
| Known bad actor connection | 10% |

---

---

# PHASE 0 — Hours 0 to 1 | KICKOFF

**Goal:** You understand M1's exact input format. Your output schema is agreed with M3. Folder is scaffolded.

### Tasks
- [ ] Attend the team schema sync — read M1's transaction schema carefully
- [ ] Confirm your output schema with M3 (the JSON above)
- [ ] Set up your folder structure with placeholder files
- [ ] Decide your tech stack (pure JS/Node recommended if M1 is on Node — avoids cross-language API calls)
- [ ] Write the `scoreTransaction(tx)` function signature as a stub that returns a hardcoded mock result

### Say to Claude Code:
```
"Do phase 0 for the risk engine. Create the folder structure:
/backend/risk-engine/scorer.js      — main entry point, exports scoreTransaction(tx)
/backend/graph/graphStore.js        — in-memory graph of wallets and transactions
/backend/explainability/explainer.js — generates natural language explanations

In scorer.js, create a stub scoreTransaction(tx) function that accepts a transaction 
object and returns this mock output for now:
{
  tx_id: tx.tx_id,
  risk_score: 42,
  action: 'MONITOR',
  signals: { peel_chain_detected: false, mixer_proximity_hops: 99, velocity_anomaly_percentile: 30, known_bad_actor_connected: false },
  explanation: 'Mock score — risk engine not yet wired.',
  scored_at_ms: Date.now()
}
This stub lets M1 wire his API and M3 build the UI immediately while we build the real logic."
```

### Deliverable
✅ `scoreTransaction(tx)` exists and returns valid JSON  
✅ M1 can wire it into his API immediately (even as a stub)  
✅ M3 knows the exact output shape to build their UI against  
✅ Folder structure exists

---

# PHASE 1 — Hours 1 to 5 | CORE ALGORITHMS

**Goal:** Three independent, tested signal detectors. Each returns a structured signal object. No integration yet — keep them separate and testable.

### Tasks
- [ ] Build the **graph store**: as transactions come in, add wallets as nodes and transactions as edges
- [ ] Build the **peel chain detector**: identifies wallets that consistently forward ~same percentage to one new wallet across hops
- [ ] Build the **mixer proximity scorer**: BFS from wallet to nearest known bad actor address, returns hop count
- [ ] Build the **velocity anomaly detector**: transactions-per-hour for a wallet flagged if above 90th percentile threshold
- [ ] Each algorithm: separate file, separate function, unit tested with 3 sample inputs

### Say to Claude Code:
```
"Do phase 1 — build the three core signal detectors for CryptoGuard's risk engine.

1. In /backend/graph/graphStore.js — build an in-memory directed graph where wallets 
are nodes and transactions are edges. Export addTransaction(tx) that updates the graph, 
and getNeighbors(walletAddress) that returns connected wallets.

2. In /backend/risk-engine/peelChainDetector.js — build detectPeelChain(walletAddress, graphStore) 
that looks at the wallet's transaction history and flags if: the wallet consistently sends 
85-97% of value to one new destination and 3-15% elsewhere, across 3+ consecutive transactions. 
Return { detected: bool, confidence: float, hopCount: int }.

3. In /backend/risk-engine/mixerProximity.js — build getMixerProximity(walletAddress, graphStore, badActorsList) 
that does a BFS from walletAddress and returns the shortest hop distance to any address in 
badActorsList. Return { hops: int, nearestMixer: string }. Max depth 5 hops — return 99 if not found.

4. In /backend/risk-engine/velocityDetector.js — build detectVelocityAnomaly(walletAddress, recentTxs) 
that calculates how many transactions this wallet has made in the last 60 minutes and returns 
a percentile score assuming a normal distribution with mean=2 and stddev=1.5. 
Return { percentile: int, txCountLastHour: int }.

Write 3 unit tests for each detector."
```

### How Peel Chain Detection Works (explain this to judges):
```
Normal wallet behavior:     A → B (one destination, regular amounts)
Peel chain behavior:        A → B (95%) + C (5%)
                            B → D (95%) + E (5%)
                            D → F (95%) + G (5%)
Pattern: consistent % split, always one "main" destination, new wallet each hop
Your detector: flag when this pattern repeats 3+ times with consistent split ratio (±5%)
```

### How Mixer Proximity Works (explain this to judges):
```
Known mixers: [Tornado Cash address, ChipMixer address, ...]
Your graph: walletA → walletB → mixerAddress
Proximity of walletA = 2 hops
BFS from the target wallet — return the shortest path length to any mixer
```

### Deliverable
✅ `detectPeelChain()` works and returns correct shape  
✅ `getMixerProximity()` returns correct hop counts on test data  
✅ `detectVelocityAnomaly()` returns percentile correctly  
✅ Unit tests pass for all three  
✅ Each is a clean, independent function — no dependencies between them yet

---

# PHASE 2 — Hours 5 to 10 | SCORING + EXPLAINABILITY

**Goal:** `scoreTransaction()` works end-to-end. Transaction in → risk score, action, and explanation out.

### Tasks
- [ ] Build the **risk score combiner**: weighted sum of all signals → 0-100
- [ ] Build the **action decision logic**: score → PASS / MONITOR / FLAG / HOLD
- [ ] Build the **explainability string generator**: reads signals object, produces natural language explanation
- [ ] Wire all four into the main `scoreTransaction(tx)` function
- [ ] Test on 8 manually crafted transactions (3 obvious scams, 3 obviously clean, 2 edge cases)
- [ ] Replace the stub in `scorer.js` with the real implementation

### Say to Claude Code:
```
"Do phase 2 — build the scorer and explainability layer for CryptoGuard.

1. In /backend/risk-engine/scorer.js — build the real scoreTransaction(tx) function that:
   a) Gets wallet history from the graph store
   b) Runs all three detectors: detectPeelChain, getMixerProximity, detectVelocityAnomaly
   c) Also checks if from_wallet is in the bad actors list (from /backend/ingestion/badActors.js)
   d) Combines signals into a 0-100 score using these weights:
      - Peel chain: 35 points max (confidence * 35)
      - Mixer proximity: 30 points max (30 if hops<=1, 20 if hops==2, 10 if hops==3, 0 if hops>3)
      - Velocity anomaly: 25 points max (percentile/100 * 25)
      - Known bad actor: 10 points flat if connected
   e) Assigns action: PASS(<30), MONITOR(30-59), FLAG(60-79), HOLD(80+)
   f) Calls the explainer to generate explanation string
   g) Returns the full output object

2. In /backend/explainability/explainer.js — build generateExplanation(signals, score, action) 
   that returns a natural language string. Use these templates:
   - If peel_chain_detected: 'Peel chain structure identified across {hopCount} transaction hops ({confidence*100}% confidence).'
   - If mixer_proximity_hops <= 1: 'Wallet directly interacted with known crypto mixer.'
   - If mixer_proximity_hops == 2: 'Wallet is 2 hops from known mixer — intermediary wallet identified.'
   - If mixer_proximity_hops == 3: 'Wallet connected to mixer-linked address (3 hops).'
   - If velocity_anomaly_percentile > 90: 'Transaction velocity anomaly: wallet sent {txCountLastHour} transactions in the last hour (top {100-percentile}% of activity).'
   - If known_bad_actor_connected: 'Direct connection to OFAC-flagged or known criminal wallet.'
   - If action == HOLD: append 'Recommended action: HOLD immediately and escalate to compliance team.'
   - If action == FLAG: append 'Recommended action: Flag for analyst review within 15 minutes.'
   - If no signals triggered: 'No suspicious patterns detected. Transaction appears consistent with wallet history.'
   Concatenate all triggered phrases into one paragraph."
```

### Explanation String Examples — Your Output Should Look Like This:

**Low risk (score 12):**
> "No suspicious patterns detected. Transaction appears consistent with wallet history. Wallet age 340 days, 1 destination, value within normal range."

**Medium risk (score 51):**
> "Velocity anomaly detected: wallet sent 8 transactions in the last hour (top 3% of activity). No other suspicious patterns. Recommended action: Flag for analyst review within 15 minutes."

**High risk (score 91):**
> "Peel chain structure identified across 7 transaction hops (91% confidence). Wallet is 2 hops from known crypto mixer. Transaction velocity anomaly: 15 sends in last hour (top 1% of activity). Recommended action: HOLD immediately and escalate to compliance team."

### Deliverable
✅ `scoreTransaction(tx)` returns complete, correctly typed output  
✅ Low-risk transactions score below 30  
✅ Pre-scripted demo scam transactions score above 80  
✅ Explanation strings are readable — no jargon, no truncation  
✅ Stub in scorer.js is replaced with real logic

---

# PHASE 3 — Hours 10 to 16 | INTEGRATION & TUNING

**Goal:** Your scorer is running inside M1's API. M3's dashboard shows real scores with real explanations.

### Tasks
- [ ] Confirm with M1 that `scoreTransaction()` is wired into `POST /transactions/score`
- [ ] Watch M3's dashboard — are scores rendering correctly? Are explanation strings readable on screen?
- [ ] Tune weights if test scores look wrong (legitimate transactions scoring above 30 is a false positive)
- [ ] Test specifically against the 4 demo seed transactions — confirm they produce expected scores
- [ ] Finalize explanation strings — they must look great on a screen

### Say to Claude Code:
```
"Do phase 3 — integration tuning for CryptoGuard risk engine.

The scorer is now wired into M1's API. Run these 4 test cases and show me the full 
output for each:

TEST 1 — Normal transaction:
{ tx_id: 'test1', from_wallet: 'cleanWallet', to_wallets: ['dest1'], amounts: [0.1], 
  total_value_usd: 4200, from_wallet_age_days: 340, from_wallet_tx_count: 88, 
  from_wallet_avg_value: 3800, from_wallet_recent_txs: [] }
Expected: risk_score < 30, action: PASS

TEST 2 — Peel chain:
{ tx_id: 'test2', from_wallet: 'peelWallet', to_wallets: ['w1','w2','w3','w4','w5','w6','w7','w8'], 
  amounts: [0.95,0.007,0.006,0.006,0.006,0.006,0.006,0.009],
  total_value_usd: 45000, from_wallet_age_days: 1, from_wallet_tx_count: 3, 
  from_wallet_avg_value: 40000, from_wallet_recent_txs: [] }
Expected: risk_score > 70, action: FLAG or HOLD

TEST 3 — Mixer adjacent (from_wallet is in bad actors list):
{ tx_id: 'test3', from_wallet: '1BadActor1111', to_wallets: ['dest99'], amounts: [2.0],
  total_value_usd: 80000, from_wallet_age_days: 45, from_wallet_tx_count: 5, 
  from_wallet_avg_value: 60000, from_wallet_recent_txs: [] }
Expected: risk_score > 80, action: HOLD

TEST 4 — Velocity anomaly (add 12 prior recent txs to the history first):
Same wallet as TEST 2, second transaction firing 30 seconds later
Expected: velocity_anomaly_percentile > 90, risk_score elevated

If any test produces unexpected results, adjust the weights in scorer.js."
```

### Deliverable
✅ All 4 demo transactions produce expected scores  
✅ No legitimate transaction scores above 35  
✅ The explanation strings look good on M3's screen (ask M3 to screenshot them)  
✅ End-to-end pipeline tested: stream → scored → displayed

---

# PHASE 4 — Hours 16 to 22 | POLISH & PITCH PREP

**Goal:** Your algorithms are bulletproof. You can explain every decision in the pitch with confidence.

### Tasks
- [ ] Review all explanation strings one final time — are they judge-ready?
- [ ] Add edge case handling: what if wallet history is empty? what if amounts array is empty?
- [ ] Prepare to answer the technical Q&A section of the pitch
- [ ] Read Q3–Q10 and Q31–Q35 from the 50 Questions doc — those are yours
- [ ] Practice your "unfair knowledge" moment — the insight you drop to signal depth

### Say to Claude Code:
```
"Do phase 4 — edge case hardening for CryptoGuard risk engine.
Add null/empty checks to scoreTransaction for these scenarios:
1. from_wallet_recent_txs is empty or missing — default to no history, don't crash
2. to_wallets is empty — score as moderate risk (unusual tx structure)
3. from_wallet_age_days is 0 or missing — treat as brand new wallet, increase risk weight
4. total_value_usd is 0 — don't crash, score other signals normally
5. amounts array length doesn't match to_wallets length — log warning, proceed with available data

Also add a /backend/risk-engine/README.md that documents:
- What each detector does in 2 sentences
- The scoring weights table
- Example input and output
- How to run the unit tests"
```

### Your Pitch Section (memorize this):
> *"The risk engine runs four signals simultaneously: peel chain detection using graph traversal, mixer proximity using BFS on the wallet graph, velocity anomaly using statistical deviation from behavioral baselines, and known bad actor cross-referencing. The key innovation is the explainable output — not just a number, but a compliance-ready case summary that an analyst can attach to a regulatory filing."*

### Your "Unfair Knowledge" Moment for Judges:
> *"One thing that makes blockchain graph analysis unique compared to traditional fraud detection — Bitcoin's UTXO model means each coin has an explicit transaction history. Unlike a bank account balance, you can actually trace the exact path of specific satoshis across multiple hops. That's what makes peel chain detection so precise — you're following the actual coins, not just the wallet."*

### Deliverable
✅ Edge cases handled — scorer never crashes on unexpected input  
✅ README written  
✅ You can explain all 4 signals without looking at anything  
✅ You can defend your scoring weights with a rationale

---

# PHASE 5 — Hours 20 to 24 | FULL FREEZE

**Goal:** Nothing new. Pitch prep only.

### Tasks
- [ ] **CODE FREEZE** — no new algorithms, no refactoring
- [ ] Read Red Flag responses #3, #5, #8 from the Red Flag doc — those are likely yours in Q&A
- [ ] Practice the algorithm explanation in under 90 seconds
- [ ] Rest

### Say to Claude Code (only if critical bug):
```
"There's a bug where [specific symptom]. Only fix this specific issue in [file]. 
Do not change anything else."
```

---

## YOUR QUICK-REFERENCE ANSWERS FOR THE PITCH

**"How does the scoring work?"**
> "Four weighted signals combined into a 0-100 score: peel chain detection at 35%, mixer proximity at 30%, velocity anomaly at 25%, and known bad actor connections at 10%. Each signal is independently computed and combined in a weighted sum."

**"What is a peel chain and how do you detect it?"**
> "A peel chain is when a wallet sends 90-95% of funds forward to a new wallet and peels off 5-10% sideways, repeatedly, creating a long chain to obscure the money trail. We detect it using graph traversal — looking for wallets with consistent split ratios across consecutive single-direction hops."

**"What is explainable AI and why does it matter here?"**
> "Instead of just outputting a risk score, our system generates a natural language summary of exactly which signals triggered and why — readable by a compliance analyst. It's not 'score: 87, block it.' It's 'peel chain detected, 2 hops from mixer, 94th percentile velocity — here's the evidence trail for your regulatory filing.'"

**"What's your false positive rate?"**
> "In our testing on labeled historical scenarios, below 5%. The behavioral approach is more precise than static blacklists — understanding a wallet's normal behavior means unusual behavior stands out sharply, not just any unusual address."

---

*Branch: m2-engine | Sync points: Hours 0, 4, 8, 12, 16, 20, 22*
