# CryptoGuard

CryptoGuard is a crypto-risk demo app that scores suspicious Ethereum-style transactions, explains why they were flagged, and lets a user walk through hold, monitor, and authorize decisions from a single dashboard.

## Architecture

- Frontend: React + Vite in `frontend/`
- API: FastAPI exposed through `api/index.py` for Vercel
- Demo state: browser session / `localStorage`
- Scoring + explanations: Python API endpoints

The current deployment target is a single Vercel project. The frontend is built as static assets and the backend is exposed as Python serverless functions behind the same origin.

## Local Development

Prerequisites:

- Node.js
- Python with the backend virtualenv already created at `backend/venv`

Start the whole app:

```bash
npm start
```

Or run each side explicitly:

```bash
npm run dev:backend
npm run dev:frontend
```

Local URLs:

- Frontend: `http://127.0.0.1:5173`
- Backend health: `http://127.0.0.1:8000/health`

## Environment Variables

Copy `.env.example` to `.env` and set what you need.

Required for the polished demo experience:

- `GEMINI_API_KEY`

Optional:

- `ALCHEMY_WSS_URL`
- `ALCHEMY_HTTP_URL`
- `DATABASE_URL`
- `BROKER_WEBHOOK_URL`
- `HOLD_THRESHOLD`
- `MONITOR_THRESHOLD`

Notes:

- On Vercel, if `DATABASE_URL` is not set, the app falls back to `/tmp/cryptoguard.db`.
- The Vercel-safe demo flow does not require Alchemy to be configured.

## Vercel Deployment

This repo is configured for a single-project Vercel deploy via [vercel.json](vercel.json).

Build behavior:

- Vercel runs `cd frontend && npm run build`
- Static frontend output is served from `frontend/dist`
- API and health routes are rewritten to `api/index.py`

Deploy manually:

```bash
vercel --prod
```

## Demo Behavior

- The transaction feed is replayed from bundled simulation data in the browser.
- Case log and suspicious-address tracking are stored per browser session.
- Manual scam injection still calls the Python API so scoring and explanation generation stay real.

## Verification

Frontend build:

```bash
cd frontend && npm run build
```

Python entrypoint import:

```bash
backend/venv/bin/python -c "import api.index; print('ok')"
```
