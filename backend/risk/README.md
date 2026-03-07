# CryptoGuard Risk Engine

The Risk Engine is the core decision layer of CryptoGuard. It accepts normalized transactions from the mempool pipeline, applies 6 independent behavioral and structural rules, and returns a combined risk score (0-100) alongside a natural language AI explanation of the verdict.

## The Signal Detectors

1. **BLACKLIST_HIT (40 pts):** Cross-references the `from` and `to` addresses against OFAC sanctions lists and the MyEtherWallet darklist.
2. **TORNADO_PROXIMITY (35 pts):** Uses a 3-layer check to see if the funds came directly from Tornado Cash, passed through it in recent hops, or if the wallet has historical mixer interaction.
3. **PEEL_CHAIN (30 pts):** Identifies laundering peel chains. Trips fast on multi-hop graph structures (3+ hops), or trips via behavioral analysis if a wallet receives a large sum and forwards >80% to a new destination within 10 minutes.
4. **HIGH_VELOCITY (25 pts):** Detects automated scripting by flagging wallets that submit more than 5 transactions in a 60-second window.
5. **LARGE_VALUE (20 pts):** Flags any transaction moving 10 ETH or more.
6. **NEW_WALLET (10 pts):** Flags wallets created <7 days ago or with very low nonces (0-2) moving significant value.

## Scoring Weights Table

| Signal | Maximum Points |
|--------|----------------|
| Blacklist Hit | 40 |
| Tornado Proximity | 35 |
| Peel Chain | 30 |
| Velocity Anomaly | 25 |
| Large Value | 20 |
| New Wallet | 10 |

**Risk Tiers:**
- `0–39:` **LOW** (Monitor only)
- `40–69:` **MEDIUM** (Flag for analyst)
- `70–100:` **CRITICAL** (Auto-hold, escalate immediately)

*Note: Total score is capped at 100 max.*

## Input Format

The `score_transaction()` function expects a basic dictionary that unifies the data M1 gathers.

```python
{
    "id": "abc123def456...",
    "from_address": "0x1A2B3C4D...",
    "to_address": "0x1X2Y3Z...",
    "eth_value": 45.5,
    "timestamp": "2025-03-01T12:00:00Z",
    "nonce": 12,
    "from_wallet_age_days": 142,
    "hop_chain": ["0xMixer...", "0xHop1...", "0x1A2B3C4D..."] # Optional
}
```

## Output Format

The engine maps directly to the shape expected by Member 3's frontend:

```json
{
  "id": "abc123def456...",
  "hash": "0x...",
  "from_address": "0x1A2B3C4D...",
  "to_address": "0x1X2Y3Z...",
  "eth_value": 45.5,
  "risk_score": 85,
  "risk_tier": "critical",
  "triggered_rules": [
    "TORNADO_PROXIMITY",
    "PEEL_CHAIN",
    "LARGE_VALUE"
  ],
  "hop_chain": [
    "0xMixer...",
    "0x1A2B3C4D..."
  ],
  "ai_explanation": "Transaction is linked to a known crypto mixer (Tornado Cash). Peel chain pattern detected across 2 wallet hops. Large value transfer of 45.500 ETH. Immediate hold recommended.",
  "timestamp": "2025-03-01T12:00:00Z",
  "scored_at_ms": 1709800043000
}
```

## Running Tests

The test suite explicitly runs against the patterns defined in the simulation data.
Requires `pytest` and `pytest-asyncio`.

```bash
# Run unit tests
python -m pytest backend/risk/test_rules.py -v

# Run manual integration tests
python scripts/test_phase3.py

# Run interactive CLI demo
python scripts/demo_m2.py
```
