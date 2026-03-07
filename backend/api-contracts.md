# CryptoGuard API Contracts

> Base URL: `http://localhost:8000`

---

## System

### `GET /health`

**Response:**
```json
{
  "status": "ok",
  "simulation_mode": true,
  "transactions_processed": 42
}
```

---

## Transactions

### `GET /api/transactions`
Returns last 50 transactions (newest first).

**Response:** `200 OK`
```json
[
  {
    "id": "sim_005",
    "hash": "0x7d3e4f...",
    "from_address": "0x5e6f7a...",
    "to_address": "0x4d5e6f...",
    "eth_value": 0.5,
    "risk_score": 4,
    "risk_tier": "low",
    "triggered_rules": [],
    "hop_chain": null,
    "ai_explanation": null,
    "scenario": "normal_activity",
    "gas_price_gwei": 19.8,
    "nonce": 201,
    "timestamp": "2026-03-07T09:15:00+00:00"
  }
]
```

---

### `GET /api/transactions/recent`
Returns last 20 transactions (compact version for dashboards).

**Response:** Same shape as `/api/transactions`.

---

### `GET /api/transactions/{tx_id}`
Returns a single transaction by ID.

**Request:** `GET /api/transactions/sim_006`

**Response (found):** `200 OK`
```json
{
  "id": "sim_006",
  "hash": "0x8e4f5a...",
  "from_address": "0xd4b88d...",
  "to_address": "0xab12cd...",
  "eth_value": 49.8,
  "risk_score": 75,
  "risk_tier": "critical",
  "triggered_rules": ["TORNADO_PROXIMITY", "BLACKLIST_HIT", "LARGE_VALUE"],
  "hop_chain": ["0xd4b88d...", "0xab12cd..."],
  "ai_explanation": "Wallet received 49.8 ETH directly from Tornado Cash...",
  "timestamp": "2026-03-07T09:15:23+00:00"
}
```

**Response (not found):** `200 OK`
```json
{ "detail": "Transaction not found", "tx_id": "unknown_id" }
```

---

### `POST /api/transactions/score`
Score a transaction. Accepts `tx_id`, enriches with wallet history, returns risk score.

**Request:**
```json
{ "tx_id": "sim_006" }
```

**Response:** `200 OK`
```json
{
  "tx_id": "sim_006",
  "risk_score": 90,
  "risk_tier": "critical",
  "triggered_rules": ["TORNADO_PROXIMITY", "BLACKLIST_HIT", "LARGE_VALUE"],
  "from_address": "0xd4b88d...",
  "wallet_history_count": 2,
  "is_known_bad_actor": true,
  "scored_at": "2026-03-07T09:20:00+00:00",
  "scorer": "stub_v1"
}
```

> **Stub scorer logic:** 90 for known bad actors, 75 if wallet < 7 days old, else uses simulation score. Replace with M2's real scorer in Phase 3.

---

## Wallet

### `GET /api/wallet/{address}/history`
Returns last 10 transactions involving this wallet.

**Request:** `GET /api/wallet/0x4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e/history`

**Response:** `200 OK`
```json
[
  { "id": "sim_001", "eth_value": 0.25, "risk_tier": "low", "..." : "..." }
]
```

---

## Broker Actions

### `POST /api/actions/hold`
Place a hold on a flagged transaction.

**Request:**
```json
{
  "tx_id": "sim_014",
  "analyst_notes": "Rug pull deployer — freezing immediately"
}
```

**Response:** `200 OK`
```json
{
  "status": "held",
  "id": 1,
  "tx_id": "sim_014",
  "action": "hold",
  "analyst_notes": "Rug pull deployer — freezing immediately",
  "actioned_at": "2026-03-07T09:25:00+00:00",
  "actioned_by": "analyst_01"
}
```

---

### `POST /api/actions/monitor`
Flag a transaction for ongoing monitoring.

**Request:**
```json
{
  "tx_id": "sim_011",
  "analyst_notes": "High velocity — watching for further activity"
}
```

**Response:** `200 OK`
```json
{
  "status": "monitoring",
  "id": 2,
  "tx_id": "sim_011",
  "action": "monitor",
  "analyst_notes": "High velocity — watching for further activity",
  "actioned_at": "2026-03-07T09:26:00+00:00",
  "actioned_by": "analyst_01"
}
```

---

### `POST /api/actions/escalate`
Escalate a transaction for compliance review.

**Request:**
```json
{
  "tx_id": "sim_020",
  "analyst_notes": "Final peel chain hop — headed to exchange"
}
```

**Response:** `200 OK`
```json
{
  "status": "escalated",
  "id": 3,
  "tx_id": "sim_020",
  "action": "escalate",
  "analyst_notes": "Final peel chain hop — headed to exchange",
  "actioned_at": "2026-03-07T09:27:00+00:00",
  "actioned_by": "analyst_01"
}
```

---

### `GET /api/actions`
Return all case actions (most recent first).

**Response:** `200 OK`
```json
[
  { "id": 3, "tx_id": "sim_020", "action": "escalate", "..." : "..." },
  { "id": 2, "tx_id": "sim_011", "action": "monitor", "..." : "..." },
  { "id": 1, "tx_id": "sim_014", "action": "hold", "..." : "..." }
]
```

---

## WebSocket

### `WS /ws`
Live transaction stream. Connect and receive `new_transaction` events.

**Connect:** `ws://localhost:8000/ws`

**Messages received:**
```json
{
  "type": "new_transaction",
  "data": {
    "id": "sim_006",
    "hash": "0x8e4f5a...",
    "from_address": "0xd4b88d...",
    "to_address": "0xab12cd...",
    "eth_value": 49.8,
    "risk_score": 75,
    "risk_tier": "critical",
    "triggered_rules": ["TORNADO_PROXIMITY", "BLACKLIST_HIT", "LARGE_VALUE"],
    "timestamp": "2026-03-07T09:15:23+00:00"
  }
}
```
