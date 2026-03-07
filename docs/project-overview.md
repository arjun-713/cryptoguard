# CryptoGuard — Project Overview

## What This Is

CryptoGuard is a **real-time cryptocurrency scam interception platform** built for crypto brokers and exchanges. It sits as a live decision layer between incoming blockchain transactions and exchange approval workflows — catching laundering, scam flows, and suspicious activity **before** funds exit the ecosystem.

Unlike Chainalysis or Elliptic (which do post-transaction forensics), CryptoGuard intercepts transactions **in-flight**, scores them in milliseconds, triggers automated broker actions, and generates plain-English AI explanations so non-expert compliance officers can act instantly.

---

## The Problem

- **$24.2 billion** was lost to crypto scams and laundering in 2023
- Current AML tools (Chainalysis, Elliptic) are **forensic** — they analyze after the money is gone
- Exchanges face heavy regulatory fines if they lack real-time AML controls
- Compliance analysts are buried in false positives and manual reviews
- No tool today gives brokers **automated in-flight transaction control** with explainable AI reasoning

---

## The Solution — Three Layers

### Layer 1: Real-Time Blockchain Intelligence
- Connects to Ethereum mempool via Alchemy WebSocket
- Ingests live pending transactions before block confirmation
- Filters for high-value, DEX-routed, and suspicious-pattern transactions
- Cross-references every wallet against OFAC sanctions + MEW dark list (30,000+ flagged addresses)

### Layer 2: Risk Scoring Engine
Every transaction is scored 0–100 in under 10ms using six rules:

| Rule | Weight | What It Detects |
|------|--------|-----------------|
| BLACKLIST_HIT | +40 | Wallet in OFAC/dark-list |
| TORNADO_PROXIMITY | +35 | Funds routed through mixer |
| PEEL_CHAIN | +30 | Received + re-sent >80% within 10min |
| HIGH_VELOCITY | +25 | >5 transactions in 60 seconds |
| LARGE_VALUE | +20 | Transaction >10 ETH |
| NEW_WALLET | +10 | Wallet age <7 days, high value |

Risk tiers:
- **0–39 → LOW** (green): monitor only
- **40–69 → MEDIUM** (amber): flag for analyst
- **70–100 → CRITICAL** (red): auto-hold, escalate immediately

### Layer 3: Explainable AI (Claude API)
- On every flagged transaction, calls Claude claude-sonnet-4-20250514
- Generates 2–3 sentence compliance-ready explanation in plain English
- Streams token-by-token to the dashboard (no spinner, live typing effect)
- Output example: *"Wallet 0xA1B2 received 14.3 ETH from a Tornado Cash-adjacent address at 03:14 UTC and re-routed 92% of funds to 3 new wallets within 8 minutes — a textbook peel-chain laundering pattern. Recommend immediate hold and SAR filing."*

---

## Tech Stack

### Backend
- **Python 3.11** + **FastAPI** — API + WebSocket server
- **uvicorn** — ASGI server
- **websockets** — Alchemy stream connection
- **httpx** — async HTTP for blacklist fetching + Claude API
- **SQLite** (via `aiosqlite`) — case log persistence
- **pydantic** — data validation

### Frontend
- **React 18** + **TypeScript** + **Vite**
- **Tailwind CSS** — utility styling
- **shadcn/ui** — base components
- **react-force-graph-2d** — wallet hop graph visualization
- **recharts** — time-series risk chart
- **Vercel AI SDK** — streaming Claude responses

### External APIs
- **Alchemy WebSocket API** — live Ethereum mempool feed (free tier)
- **Anthropic Claude API** — AI explanation generation
- **MyEtherWallet Dark List** — public blacklist JSON (no key needed)

### Deployment
- **Docker Compose** — single command startup
- **Railway.app** — free-tier cloud deployment

---

## Architecture Flow

```
Ethereum Mempool
      ↓
Alchemy WebSocket (wss://eth-mainnet.g.alchemy.com/v2/KEY)
      ↓
backend/blockchain/stream.py  ← normalize + filter transactions
      ↓
backend/risk/scorer.py        ← score 0-100 in <10ms
      ↓
FastAPI WebSocket /ws          ← broadcast RiskResult to frontend
      ↓
React Dashboard               ← live feed, gauge, graph
      ↓  (on MEDIUM/CRITICAL)
backend/ai/explainer.py       ← Claude API streaming call
      ↓
AIExplanation component       ← streams word-by-word to analyst
      ↓  (analyst clicks action)
backend/api/actions.py        ← store Hold/Monitor/Escalate in SQLite
```

---

## Dashboard Pages

### 1. Live Monitor (main page)
- Top bar: system status, tx scanned counter, active alerts count
- Left: live transaction feed — new rows animate in, colored by risk tier
- Right: risk score gauge (circular, animated), triggered rule breakdown
- Bottom drawer: AI explanation that streams in when row selected

### 2. Case Detail
- Full wallet behavior history (last 20 transactions)
- Wallet hop graph — interactive D3 force graph showing fund flow
- Risk score timeline chart
- AI explanation (full)
- Action buttons: Hold / Monitor / Escalate with notes field

### 3. Case Log
- All actioned transactions
- Filter by action type, date, risk tier
- Export to PDF (compliance report)
- Stats: total held, total escalated, false positive rate

---

## Visual Design Language

**Theme:** Bloomberg Terminal × Cybersecurity Ops Center
- Background: `#0a0e1a` (near-black navy)
- Surface: `#111827`
- Critical red: `#ff3366` with glow
- Medium amber: `#ffaa00`
- Safe green: `#00ff88`
- All wallet addresses in JetBrains Mono font
- Rows slide in from top with 300ms ease-out
- Risk badges pulse when CRITICAL
- Wallet graph: physics-simulated node graph, red nodes = flagged

---

## What Makes This Win

1. **Real Ethereum mempool data** — real transaction hashes judges can verify on Etherscan
2. **Wallet hop graph** — visually stunning, no other team will have this
3. **Streaming AI explanations** — feels alive, not like a spinner
4. **The intercepted vs. investigated framing** — we're not Chainalysis, we're the alarm system
5. **Compliance-ready output** — it's not just detection, it's analyst workflow automation

---

## Environment Variables Needed

```env
ALCHEMY_WSS_URL=wss://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
ANTHROPIC_API_KEY=sk-ant-...
DATABASE_URL=sqlite:///./cryptoguard.db
CORS_ORIGINS=http://localhost:5173
```

Get Alchemy key free at: https://alchemy.com (create app → Ethereum Mainnet → copy WebSocket URL)
Get Anthropic key at: https://console.anthropic.com
