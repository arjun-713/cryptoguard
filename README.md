# CryptoGuard

> Real-time cryptocurrency scam interception platform for brokers and exchanges.

## Architecture Overview
Our pipeline ingests transactions directly from the mempool — the waiting room before blockchain confirmation. Every transaction is enriched with the sending wallet's behavioral history and immediately handed to the Risk Engine for algorithmic scoring. The entire flow from transaction arrival to scored output, including WebSocket broadcast for frontend visualization, takes under 100 milliseconds.

---

## Quick Start (One-Command Startup)

Once dependencies are installed via `pip install -r requirements.txt`, you can start the entire backend and simulation engine with a single command:

```bash
npm start
```
*(Runs the FastAPI server locally on port 8000).*

### Demo Sequence Trigger
To fire the pre-scripted 4-transaction pitch sequence (Normal → Peel Chain → Mixer → Velocity Anomaly) precisely 5 seconds apart, run:
```bash
npm run demo
```
*(Or send a POST request to `http://localhost:8000/api/demo/start`)*

### Health Check script
Verify all services are running and check simulation mode:
```bash
npm run health
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | System status check |
| `WS` | `/ws` | Live transaction stream |
| `GET` | `/api/transactions` | Last 50 transactions |
| `GET` | `/api/transactions/recent`| Last 20 transactions |
| `GET` | `/api/transactions/{tx_id}` | Single transaction detail |
| `POST`| `/api/transactions/score` | Score a single transaction manually |
| `GET` | `/api/wallet/{address}/history`| Get last 10 transactions for a wallet |
| `POST`| `/api/actions/hold` | Log a HOLD action by a broker |
| `POST`| `/api/actions/monitor` | Log a MONITOR action by a broker |
| `POST`| `/api/actions/escalate` | Log an ESCALATE action by a broker |
| `GET` | `/api/actions` | All pending case actions |
| `POST`| `/api/demo/start` | Fire the 4-step pitch demo sequence |

---

## Project Structure

```
cryptoguard/
├── backend/
│   ├── api/             # FastAPI route handlers
│   │   ├── transactions.py
│   │   ├── demo.py      # Pitch sequencer
│   │   └── actions.py
│   ├── blockchain/      # Mempool stream & simulation (simulator.py)
│   ├── db/              # Database & Pydantic models (models.py)
│   ├── ingestion/       # Health checks and raw ingestion scripts
│   ├── risk/            # Risk scoring engine (M2)
│   ├── config.py        # Central config from .env
│   └── main.py          # FastAPI entry point
├── docs/                # Project docs & simulation data
├── package.json         # NPM scripts for one-command execution
├── .env.example         # Environment template
├── requirements.txt     # Python dependencies
└── README.md
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | API Port (default 8000) |
| `ALCHEMY_WSS_URL` | Alchemy WebSocket URL for Ethereum mempool |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key |
| `DATABASE_URL` | SQLite connection string |
| `CORS_ORIGINS` | Allowed frontend origins (comma-separated, `*`) |
| `SIMULATION_MODE` | `true` for demo, `false` for live mempool |
| `SIMULATION_DATA_PATH` | Path to simulation data JSON |

---

## Team

| Role | Branch | Owns |
|------|--------|------|
| M1 — Pipeline Engineer | `m1-pipeline` | Backend, API, data schemas, ingestion |
| M2 — Risk Engine | `m2-engine` | Scoring algorithms, graph analytics, explainability |
| M3 — Frontend & Pitch | `m3-frontend` | Dashboard, demo, pitch deck |
