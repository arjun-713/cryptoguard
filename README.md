# 🛡️ CryptoGuard

> Real-time cryptocurrency scam interception —
> we score Ethereum transactions in the mempool
> before they confirm on the blockchain.

---

## What is this?

CryptoGuard sits between a crypto broker and the Ethereum network. When a customer initiates a transaction, CryptoGuard scores it in 40 microseconds across 6 behavioral rules and automatically holds suspicious ones before the broker releases funds.

Chainalysis investigates crimes after. We prevent them during the 12-second mempool window.

---

## Where it sits

```
Customer initiates transaction
        ↓
Broker calls CryptoGuard
        ↓
Risk scored in 40 microseconds
        ↓
HOLD / MONITOR / AUTHORIZE
        ↓
Broker acts before funds leave
        ↓
Transaction hits blockchain (or doesn't)
```

---

## Tech Stack

- **Backend** — Python, FastAPI, aiosqlite
- **Frontend** — React, TypeScript, Tailwind, shadcn/ui
- **AI** — Google Gemini 2.5 Flash (compliance explanations)
- **Blockchain** — Alchemy WebSocket (Ethereum mempool)

---

## Quick Start

```bash
git clone https://github.com/arjun-713/cryptoguard
cd Cryptoguard
chmod +x start.sh
./start.sh
```

Open **http://localhost:5173**

---

## Environment Variables

Copy `.env.example` to `.env` and fill in:

```
ALCHEMY_WSS_URL=wss://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
GEMINI_API_KEY=your_key_here
SIMULATION_MODE=false
HOLD_THRESHOLD=70
MONITOR_THRESHOLD=40
```

---

## Demo Mode

Click **START DEMO** in the dashboard to switch from live Ethereum data to scripted simulation. Click **STOP DEMO** to switch back.

Or via API:

```bash
curl -X POST http://localhost:8000/api/demo/start
curl -X POST http://localhost:8000/api/demo/stop
```

---

## Running Tests

```bash
cd backend
source venv/bin/activate
pytest tests/ -v
```

---

## Performance

| Metric | Value |
|--------|-------|
| Scoring latency | 40.3 μs average |
| Interception advantage | 297,647x faster than confirmation |
| Risk rules | 6 simultaneous |
| OFAC addresses | 85+ live-refreshed |

---

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| /health | GET | System status |
| /api/transactions/recent | GET | Latest scored transactions |
| /api/broker/withdraw | POST | Score a withdrawal request |
| /api/actions/hold | POST | Hold a transaction |
| /api/actions/monitor | POST | Monitor a transaction |
| /api/actions/authorize | POST | Authorize a transaction |
| /api/demo/start | POST | Enable simulation mode |
| /api/demo/stop | POST | Enable live mode |
| /api/suspicious-addresses | GET | Reputation database |
