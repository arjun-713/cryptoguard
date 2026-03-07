# CryptoGuard

> Real-time cryptocurrency scam interception platform for brokers and exchanges.

CryptoGuard intercepts suspicious blockchain transactions **in the mempool** — before confirmation — scores them in milliseconds, and generates AI-powered compliance explanations so analysts can act instantly.

---

## Quick Start

### Prerequisites
- Python 3.11+
- Node 20+ (for frontend, setup separately)

### Backend Setup

```bash
# 1. Clone and enter the project
cd cryptoguard

# 2. Create virtual environment
python3 -m venv venv
source venv/bin/activate   # Linux/Mac
# venv\Scripts\activate    # Windows

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment
cp .env.example .env
# Edit .env with your API keys (Alchemy, Anthropic)

# 5. Run the server
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

### Verify

```bash
curl http://localhost:8000/health
# → {"status": "ok", "simulation_mode": true, "transactions_processed": 0}
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | System status check |
| `WS` | `/ws` | Live transaction stream |
| `GET` | `/api/transactions` | Last 50 transactions |
| `GET` | `/api/transactions/{tx_id}` | Single transaction detail |
| `GET` | `/api/explain/{tx_id}` | SSE-streamed AI explanation |
| `POST` | `/api/actions` | Create hold/monitor/escalate action |
| `GET` | `/api/actions` | All case actions |

---

## Project Structure

```
cryptoguard/
├── backend/
│   ├── ai/              # Claude AI explainer
│   ├── api/             # FastAPI route handlers
│   │   ├── transactions.py
│   │   └── actions.py
│   ├── blockchain/      # Mempool stream & simulation
│   ├── db/              # Database & Pydantic models
│   │   └── models.py
│   ├── risk/            # Risk scoring engine (6 rules)
│   ├── config.py        # Central config from .env
│   └── main.py          # FastAPI entry point
├── docs/                # Project docs & simulation data
├── .env.example         # Environment template
├── requirements.txt     # Python dependencies
└── README.md
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ALCHEMY_WSS_URL` | Alchemy WebSocket URL for Ethereum mempool |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key |
| `DATABASE_URL` | SQLite connection string |
| `CORS_ORIGINS` | Allowed frontend origins (comma-separated) |
| `SIMULATION_MODE` | `true` for demo, `false` for live mempool |
| `SIMULATION_DATA_PATH` | Path to simulation data JSON |

---

## Team

| Role | Branch | Owns |
|------|--------|------|
| M1 — Pipeline Engineer | `m1-pipeline` | Backend, API, data schemas, ingestion |
| M2 — Risk Engine | `m2-engine` | Scoring algorithms, graph analytics, explainability |
| M3 — Frontend & Pitch | `m3-frontend` | Dashboard, demo, pitch deck |
