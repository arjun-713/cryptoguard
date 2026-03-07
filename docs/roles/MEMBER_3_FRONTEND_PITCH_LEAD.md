# MEMBER 3 — FRONTEND & PITCH LEAD
## CryptoGuard Hackathon | Your Personal Claude Code Playbook

> **How to use this file:** Open this in Claude Code and say `"do phase 0"` or `"do phase 1"` etc. Each phase has exact tasks, file paths, and the code Claude Code needs to build for you.

---

## YOUR ROLE IN ONE LINE
You are the **face**. You own everything judges see — the dashboard, the demo, and the pitch. Your frontend is the demo. Your pitch is the trophy. You're also the team's coordination layer: you notice when the build is drifting from the demo story and pull everyone back. **Build with mock data from minute one — do NOT wait for M1 or M2.**

---

## YOUR FOLDER OWNERSHIP
```
/frontend/                    ← YOURS ONLY
/demo/                        ← YOURS ONLY
/pitch/                       ← YOURS ONLY
/docs/                        ← YOURS ONLY
```
**Do NOT touch:** `/backend/ingestion/`, `/backend/risk-engine/`, `/backend/graph/`, `/backend/explainability/`  
**Can call (read only):** M1's API endpoints as a consumer

---

## YOUR GIT BRANCH
```bash
git checkout -b m3-frontend
```
Only merge to `main` during team sync points. Never push directly to `main` alone.

---

## THE GOLDEN RULE — MOCK FIRST, WIRE LATER

```
❌ WRONG:  Wait for M1's API to be ready before building UI
           Result: You're idle for 4 hours, then panicking at the end

✅ RIGHT:  Build UI with hardcoded objects matching the agreed schema
           Result: UI is done by Hour 6. You just swap the data source when M1 is ready.
```

---

## WHAT DATA YOUR UI WILL CONSUME

### From M1's WebSocket (`ws://localhost:PORT/stream`):
```json
{
  "tx_id": "abc123...",
  "from_wallet": "1A2B3C4D...",
  "to_wallets": ["1X2Y3Z...", "4A5B6C..."],
  "amounts": [0.45, 0.05],
  "total_value_usd": 18500,
  "timestamp": 1709800000,
  "from_wallet_age_days": 142,
  "chain": "bitcoin"
}
```

### From M2's scorer (via M1's API `POST /transactions/score`):
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
  "explanation": "Peel chain structure identified. Wallet is 2 hops from known mixer. Velocity anomaly at 94th percentile. Recommended action: HOLD and escalate.",
  "scored_at_ms": 1709800043
}
```

---

## YOUR FIVE UI COMPONENTS

| Component | What it shows |
|-----------|--------------|
| `TransactionFeed` | Scrolling live list of incoming mempool transactions |
| `RiskCard` | Big score display (0-100), color-coded, action badge |
| `ExplanationPanel` | Full AI-generated explanation text for selected transaction |
| `ActionButtons` | HOLD / MONITOR / ESCALATE buttons with confirmation state |
| `AlertSidebar` | Last 5 flagged transactions with quick-glance badges |

### Risk Score Color Coding:
| Score | Color | Action Badge |
|-------|-------|-------------|
| 0–29 | 🟢 Green | PASS |
| 30–59 | 🟡 Yellow | MONITOR |
| 60–79 | 🟠 Orange | FLAG |
| 80–100 | 🔴 Red | HOLD |

---

---

# PHASE 0 — Hours 0 to 1 | KICKOFF & SCAFFOLD

**Goal:** Frontend running with hardcoded data. M2 knows your output schema so they can format their response correctly.

### Tasks
- [ ] Attend team schema sync — understand both M1's transaction format AND M2's scoring output
- [ ] Confirm M2's output schema — you need to know it to build the RiskCard
- [ ] Set up React app (or plain HTML if faster — pick what you're fastest with)
- [ ] Create all 5 component files as empty stubs
- [ ] Build the app shell: header, two-column layout, sidebar
- [ ] Confirm the app runs at `localhost:3000`

### Say to Claude Code:
```
"Do phase 0 for CryptoGuard frontend. Set up a React app (using Vite or Create React App) 
with this layout:
- Left panel (60% width): TransactionFeed at top, RiskCard below it
- Right panel (40% width): ExplanationPanel at top, ActionButtons below it  
- Fixed right sidebar (280px): AlertSidebar
- Top header bar: 'CryptoGuard — Real-Time Scam Interception' with a live green pulsing dot

Create these 5 empty component files:
/frontend/src/components/TransactionFeed.jsx
/frontend/src/components/RiskCard.jsx
/frontend/src/components/ExplanationPanel.jsx
/frontend/src/components/ActionButtons.jsx
/frontend/src/components/AlertSidebar.jsx

Use a dark theme: background #0D1117, card background #161B22, accent blue #2E86AB.
Make it look like a real enterprise compliance dashboard, not a student project."
```

### Deliverable
✅ App runs at `localhost:3000`  
✅ Layout is visible with placeholder content in each panel  
✅ Dark theme is applied  
✅ Component files all exist

---

# PHASE 1 — Hours 1 to 6 | FULL UI BUILD WITH MOCK DATA

**Goal:** Every panel is built and looks like a real product. All with hardcoded data — no backend calls yet.

### Tasks
- [ ] `TransactionFeed` — scrolling list, new items appear at top, shows wallet, amount, chain, timestamp
- [ ] `RiskCard` — large score number, color coded background, action badge, signal breakdown list
- [ ] `ExplanationPanel` — paragraph of explanation text, scrollable, clear typography
- [ ] `ActionButtons` — three buttons that change state on click (HOLD goes red/disabled after clicked)
- [ ] `AlertSidebar` — list of last 5 flagged txs with score badge, truncated wallet address, time ago
- [ ] Hardcode 3 mock transactions in the feed: one green (score 12), one orange (score 67), one red (score 91)
- [ ] Clicking a transaction in the feed selects it and shows its details in RiskCard and ExplanationPanel

### Say to Claude Code:
```
"Do phase 1 — build all 5 UI components for CryptoGuard with hardcoded mock data.

TransactionFeed: A scrolling list. Each row shows: truncated wallet address (first 6 + last 4 chars), 
total_value_usd formatted as currency, chain badge (BTC/ETH), and a relative timestamp ('2s ago'). 
New transactions animate in from the top. Clicking a row selects it (highlights it) and updates 
RiskCard and ExplanationPanel.

RiskCard: Large centered risk score number (0-100). Background color changes based on score:
- 0-29: dark green (#1A4731), score text: #4ADE80
- 30-59: dark yellow (#3D2E00), score text: #FBBF24
- 60-79: dark orange (#3D1800), score text: #FB923C  
- 80-100: dark red (#3D0000), score text: #F87171
Below the score: a large action badge (PASS / MONITOR / FLAG / HOLD) in matching color.
Below that: a small breakdown list of the 4 signals with icons (✓ or ⚠) and values.

ExplanationPanel: A card with title 'AI Analysis' and the full explanation paragraph below it. 
Use readable font size (15px), line height 1.6, subtle left border in the risk color.

ActionButtons: Three buttons — HOLD (red), MONITOR (yellow), ESCALATE (orange).
When clicked, show a confirmation toast ('Transaction marked as HOLD'), disable the clicked button.

AlertSidebar: Title 'Active Alerts'. List of up to 5 transactions. Each shows: 
risk score badge (color coded), first 6 chars of wallet, score, and 'Xs ago' timestamp.
Animate in new alerts from the top.

Use these 3 hardcoded transactions:
1. { tx_id: 'clean1', from_wallet: '1CleanWallet999', total_value_usd: 4200, chain: 'bitcoin', 
   risk_score: 12, action: 'PASS', explanation: 'No suspicious patterns detected. Wallet age 340 days. Transaction consistent with historical behavior.' }
2. { tx_id: 'flag1', from_wallet: '1SuspectWallet01', total_value_usd: 45000, chain: 'bitcoin',
   risk_score: 67, action: 'FLAG', explanation: 'Velocity anomaly detected: 8 transactions in last hour. No other patterns confirmed. Flag for analyst review.' }
3. { tx_id: 'hold1', from_wallet: '1DangerWallet99X', total_value_usd: 89000, chain: 'bitcoin',
   risk_score: 91, action: 'HOLD', explanation: 'Peel chain structure identified across 7 transaction hops (91% confidence). Wallet 2 hops from known mixer. Velocity anomaly at 94th percentile. Recommended action: HOLD and escalate to compliance team immediately.' }
"
```

### Deliverable
✅ All 5 components visible and styled  
✅ Clicking transactions shows correct details  
✅ Color coding works for all 3 risk levels  
✅ Looks like a real compliance product — show M1 and M2 a screenshot

---

# PHASE 2 — Hours 6 to 10 | WIRE REAL DATA

**Goal:** Replace hardcoded data with live backend. First real integration with M1 and M2.

### Tasks
- [ ] Connect to M1's WebSocket at `ws://localhost:PORT/stream` — transactions stream live
- [ ] For each incoming transaction, call M1's `POST /transactions/score` to get M2's risk score
- [ ] Update `TransactionFeed` with live transactions
- [ ] Update `RiskCard` and `ExplanationPanel` when a transaction is auto-selected or clicked
- [ ] Add loading state: show "Scoring..." spinner on RiskCard while waiting for score API
- [ ] Add error state: if backend is unreachable, show "Backend offline — running on demo data" and fall back to mock data gracefully
- [ ] Test full pipeline: trigger a transaction from M1's stream, watch it score and display

### Say to Claude Code:
```
"Do phase 2 — wire real backend data into the CryptoGuard frontend.

1. Create /frontend/src/hooks/useTransactionStream.js — a custom React hook that:
   - Connects to WebSocket at ws://localhost:4000/stream (make port configurable via .env)
   - On each message, parses the JSON transaction
   - Calls POST localhost:4000/transactions/score with { tx_id: tx.tx_id }
   - Returns { transactions: [], latestScore: null, isConnected: bool, error: null }

2. Update TransactionFeed to use this hook — show real transactions as they arrive, 
   most recent at top, keep last 50 in memory.

3. Update RiskCard to show a spinning 'Scoring...' state while the POST request is pending, 
   then show the real score when it returns.

4. Add a connection status indicator in the header — green dot + 'Live' when connected, 
   red dot + 'Offline' when disconnected.

5. Add error boundary: if WebSocket fails, fall back to the hardcoded mock transactions 
   from phase 1 with a banner saying 'Demo mode — backend offline'.
   This is CRITICAL — it means the demo works even if the backend crashes during the pitch.
"
```

### Deliverable
✅ Live transactions appearing in the feed from M1's stream  
✅ Each transaction auto-scored by M2's engine  
✅ Score and explanation showing correctly on screen  
✅ Demo mode fallback works when backend is off  
✅ Full pipeline tested: M1 seed → M2 score → M3 display

---

# PHASE 3 — Hours 10 to 16 | DEMO SCRIPT & PITCH DECK

**Goal:** Demo is scripted and rehearsed. Pitch deck is complete.

### Tasks
- [ ] Work with M1 to confirm the demo seed script fires transactions in the right order
- [ ] Write the demo walkthrough script (exact words for each step)
- [ ] Build the pitch deck (slides in Google Slides, Canva, or PowerPoint)
- [ ] Take backup screenshots of every key UI state
- [ ] Polish UI — spacing, fonts, remove any obvious placeholder text

### Say to Claude Code:
```
"Do phase 3 — pitch deck and demo polish for CryptoGuard.

1. Polish the UI: 
   - Remove any 'TODO' or placeholder text
   - Add a subtle animated background pulse on HOLD transactions (red glow animation)
   - Add a transaction counter in the header: 'Transactions Analyzed: [live count]' 
   - Add 'Risk Engine: Active' status badge in the header
   - Make the score number animate when it changes (scale up briefly)

2. Create /demo/DEMO_SCRIPT.md with this structure:
   Step 1: [what you click / what appears on screen / what you say]
   Step 2: ...etc for all 7 demo steps
   
   Use this demo sequence aligned with M1's seed script:
   - T+0s: Normal transaction arrives (score 12, PASS) — say: 'Watch a clean transaction flow straight through'
   - T+5s: Peel chain transaction arrives (score 91, HOLD) — say: 'Now this one — same wallet, completely different behavior'
   - T+8s: Score updates to 91 in red — say: 'Under 100 milliseconds. Score 91. HOLD.'
   - T+10s: Click on the explanation panel — say: 'Not just a number. Here is the evidence.'
   - T+15s: Click HOLD button — say: 'Broker action taken. Three seconds from arrival to hold decision.'
   - T+20s: Point to alert sidebar — say: 'Full audit trail. Every decision. Regulators included.'
   - T+25s: Show the green transaction again — say: 'And clean transactions never get blocked. Zero false positive on this one.'

3. Create /pitch/SLIDE_OUTLINE.md with content for these 7 slides:
   Slide 1: Title — CryptoGuard + one-line value prop
   Slide 2: Problem — $14B stolen, post-transaction tools can't stop it
   Slide 3: The Gap — The mempool window (simple diagram: mempool → block, arrow showing where we act)
   Slide 4: Solution — 5 layers of our system (numbered list)
   Slide 5: Demo — 'Let us show you' (live demo here)
   Slide 6: Market — $3.9B AML market, MiCA regulatory driver, our differentiation vs Chainalysis
   Slide 7: Close — Team + 'We're the layer that exists before Chainalysis has anything to investigate'
"
```

### Your Backup Screenshot Checklist:
- [ ] Dashboard idle state (feed running, no alert selected)
- [ ] Normal transaction selected (green score 12, PASS)
- [ ] High-risk transaction selected (red score 91, HOLD badge, full explanation visible)
- [ ] After clicking HOLD button (confirmation state)
- [ ] Alert sidebar with 3 items
- [ ] Mobile/narrow viewport if judges might view on a tablet

### Deliverable
✅ Demo script written at `/demo/DEMO_SCRIPT.md`  
✅ Slide outline at `/pitch/SLIDE_OUTLINE.md`  
✅ All backup screenshots saved in `/demo/screenshots/`  
✅ UI polish complete — no placeholder text, animations working

---

# PHASE 4 — Hours 16 to 20 | FULL TEAM REHEARSAL

**Goal:** Pitch runs smoothly end-to-end. Every team member knows their role.

### Tasks
- [ ] Run the full pitch with all 3 members, timed
- [ ] Identify 3 weak moments — transitions that stumble, explanations that aren't clear
- [ ] Fix those 3 things. Not everything — just the top 3.
- [ ] Confirm M1 and M2 know which Q&A questions are theirs
- [ ] Practice the demo narration specifically — what you say must match what appears on screen
- [ ] Practice the "demo breaks" recovery out loud

### Your Q&A Ownership:
**You answer:** Opening pitch questions, business model, market size, go-to-market, "why now"  
**M2 answers:** Algorithm depth, false positive rate, technical feasibility  
**M1 answers:** Architecture, pipeline, data sources, scalability

### The Demo Breaks Recovery Script (say this if it breaks):
> *"Looks like we've got some demo gremlins — let me walk you through exactly what you'd see. [Point at blank screen] Here's the live transaction feed — real mempool data streaming in. Here's where the risk card would update in under 100 milliseconds. And here's the explanation panel — this is the part that changes everything for compliance teams. Not a score. Evidence."*

### Say to Claude Code:
```
"Do phase 4 — add final resilience features to CryptoGuard frontend.

1. Add a 'Demo Mode' toggle button in the header that when activated:
   - Disconnects from real WebSocket
   - Starts replaying the hardcoded demo sequence automatically (every 5 seconds, 
     cycle through: clean transaction → peel chain transaction → normal transaction)
   - Shows 'DEMO MODE' badge in the header
   
2. Preload all mock data so the demo mode fires instantly without any loading states.

3. Add keyboard shortcut: pressing 'D' activates demo mode, pressing 'R' resets 
   the feed to empty (useful between demo runs during mentor visits).

4. Make sure the app works offline — all mock data should be bundled, no CDN calls required."
```

### Deliverable
✅ Full pitch rehearsed at least twice, timed  
✅ Demo mode toggle works (offline backup)  
✅ 'D' key activates demo instantly  
✅ Every team member knows their Q&A territory  
✅ Demo break recovery rehearsed out loud

---

# PHASE 5 — Hours 20 to 24 | FINAL FREEZE

**Goal:** Nothing new. You own the room tomorrow.

### Tasks
- [ ] **FULL FREEZE** — no code, no slide changes, no new features
- [ ] Load the app on the **presentation device** — leave it running, don't close it
- [ ] Have `/demo/screenshots/` open in a separate window — ready to switch instantly
- [ ] Open the pitch deck to slide 1 and leave it there
- [ ] Run the demo one final time to confirm everything works on the presentation device
- [ ] Read the Red Flag Responses doc — own answers #1, #4, #8, #9, #10
- [ ] Rest. Seriously. You're the face. You need energy.

### Your Opening Lines (say these out loud until they're natural):
> *"Last year, $14 billion in cryptocurrency was stolen, scammed, or laundered. Not $14 million. $14 billion. And here's the worst part — almost all of it was detectable. The patterns were there. The signals were there. But every existing tool was designed to investigate after the fact, when the money is already gone."*

> *"We asked a different question: what if we could intercept the transaction before it confirms? That's CryptoGuard."*

### Your Close (memorize this):
> *"We're not trying to replace Chainalysis. We're the layer that exists before Chainalysis has anything to investigate. Three engineers. 24 hours. A working prototype. Imagine what we do in 24 months."*

---

## YOUR DEMO SCRIPT — FINAL VERSION
*Fill this in after Phase 3 — print it and have it in your hand during the demo.*

```
STEP 1 — [Dashboard loads, feed running]
SAY: "This is our live dashboard. Every transaction entering the mempool — real time."

STEP 2 — [Trigger normal transaction via 'D' key or seed script]
SAY: "Here's a clean one — wallet with 340 days of history, small amount, one destination. 
      Score: 12. Green. Goes straight through. No friction for legitimate users."

STEP 3 — [Peel chain transaction arrives automatically 5 seconds later]
SAY: "Now watch this. Same pipeline, different wallet. Just received a large deposit and 
      is immediately splitting to 12 addresses simultaneously."

STEP 4 — [RiskCard updates to red 91]
SAY: "Under 100 milliseconds. Score: 91. Action: HOLD."

STEP 5 — [Click on explanation panel / it's already visible]
SAY: "And here's what makes this different from every other tool. Not just a number. 
      Read this explanation. Peel chain detected. Mixer connection. Velocity anomaly. 
      This is what goes into the compliance analyst's case file."

STEP 6 — [Click HOLD button]
SAY: "Broker action taken. Transaction held. Three seconds from transaction arriving 
      to a hold decision. Before the next block confirms. Before the money is gone."

STEP 7 — [Point to alert sidebar]
SAY: "And every decision is logged with full reasoning. When regulators come knocking, 
      you have everything ready."
```

---

## YOUR QUICK-REFERENCE ANSWERS FOR THE PITCH

**"What does the frontend show?"**
> "A real-time compliance dashboard for broker analysts. Live transaction feed, risk scoring in under 100ms, AI-generated case summaries, and broker action controls — all in one view."

**"What's your business model?"**
> "B2B SaaS. Monthly subscription based on transaction volume. $5K–50K per month per broker depending on scale. Brokers already spend significantly on compliance — we replace manual review time with automated, explainable intelligence."

**"Why would a broker switch from what they have?"**
> "Current tools generate 15-20% false positives — compliance teams spend most of their day reviewing legitimate transactions. We reduce that to under 5% through behavioral profiling. And we give them real-time holds, not post-confirmation reports. Faster, cheaper, defensible."

**"Who are your competitors and how are you different?"**
> "Chainalysis and Elliptic are incredible investigation tools. They help you understand what happened after the fact. We stop it from happening. Crime scene versus security guard. Complementary products, different moment in the transaction lifecycle."

**"What's next after the hackathon?"**
> "Customer discovery interviews with 5-10 mid-sized crypto brokers. Validate our assumptions with real compliance teams. Run a pilot on non-critical transaction flow. Turn the prototype into a fundable product."

---

## MENTOR VISIT PLAYBOOK

**When a mentor walks up:**  
Say: *"We built a real-time scam interception platform for crypto brokers — we catch fraudulent transactions in the mempool, before they confirm. Want to see a live demo?"*  
Then immediately: *"Are you familiar with how crypto AML works currently?"*

**If they know crypto:** Skip basics → go straight to mempool interception angle → show demo  
**If they don't:** Use the analogy: "The blockchain updates every 10 minutes. Before the update there's a waiting room. Everyone else reviews the ledger. We monitor the waiting room."  
**If they work at Chainalysis/Elliptic:** Say: *"Glad you stopped by — I'd love your take on the mempool interception angle. Is that a gap you've seen addressed anywhere?"*

**Always ask before they leave:**  
*"What's the one thing about our pitch that's least clear right now?"*

---

*Branch: m3-frontend | Sync points: Hours 0, 4, 8, 12, 16, 20, 22*
