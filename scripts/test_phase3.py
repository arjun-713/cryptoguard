"""
CryptoGuard Risk Engine — Phase 3 Integration Tests
Runs the exact 4 test payloads defined in the Phase 3 instructions.
"""

import asyncio
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))
from backend.risk.scorer import score_transaction

async def run_phase_3_tests():
    print("=== PHASE 3 INTEGRATION TUNING ===\n")

    # TEST 1 — Normal transaction
    tx1 = {
        "id": "test1", "from_address": "cleanWallet", "to_address": "dest1", "eth_value": 0.1, 
        "from_wallet_age_days": 340, "from_wallet_tx_count": 88
    }
    r1 = await score_transaction(tx1)
    print(f"TEST 1 — Normal tx")
    print(f"Score: {r1['risk_score']} | Tier: {r1['risk_tier']} | Action: {'PASS' if r1['risk_score'] < 30 else 'OTHER'}")
    assert r1['risk_score'] < 30, "Test 1 failed"

    # TEST 2 — Peel chain
    tx2 = {
        "id": "test2", "from_address": "peelWallet", "to_address": "newDest", "eth_value": 95.0,
        "from_wallet_age_days": 1,
        "hop_chain": ["0xMixer1", "0xHop1", "peelWallet", "newDest"]  # Mocking a peel chain length >=3
    }
    r2 = await score_transaction(tx2)
    print(f"\nTEST 2 — Peel chain")
    print(f"Score: {r2['risk_score']} | Tier: {r2['risk_tier']} | Rules: {r2['triggered_rules']}")
    assert r2['risk_score'] >= 40, "Test 2 failed"

    # TEST 3 — Mixer adjacent (from_wallet in bad actors list)
    tx3 = {
        "id": "test3", "from_address": "1BadActor1111", "to_address": "dest99", "eth_value": 2.0,
        "from_wallet_age_days": 45
    }
    r3 = await score_transaction(tx3, blacklist={"1BadActor1111"})
    print(f"\nTEST 3 — Mixer adjacent")
    print(f"Score: {r3['risk_score']} | Tier: {r3['risk_tier']} | Rules: {r3['triggered_rules']}")
    assert r3['risk_score'] >= 40, "Test 3 failed"

    # TEST 4 — Velocity anomaly
    history4 = {
        "peelwallet": [
            {"from": "peelWallet", "timestamp": f"2025-03-01T00:00:{i*5:02d}Z"} for i in range(12)
        ]
    }
    tx4 = dict(tx2) # Same as test 2
    tx4['timestamp'] = "2025-03-01T00:00:55Z"
    
    r4 = await score_transaction(tx4, wallet_history=history4)
    print(f"\nTEST 4 — Velocity anomaly")
    print(f"Score: {r4['risk_score']} | Tier: {r4['risk_tier']} | Rules: {r4['triggered_rules']}")
    assert "HIGH_VELOCITY" in r4['triggered_rules'], "Test 4 failed"

    print("\n✅ All Phase 3 Integration Tests passed.")

if __name__ == "__main__":
    asyncio.run(run_phase_3_tests())
