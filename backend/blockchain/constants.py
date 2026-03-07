import httpx
import asyncio
from datetime import datetime, timezone

# =============================================================================
# KNOWN SANCTIONED / MIXER ADDRESSES (OFAC-listed Tornado Cash contracts)
# =============================================================================
TORNADO_CASH_ADDRESSES: frozenset[str] = frozenset({
    "0xd4b88df4d29f5cedd6857912842cff3b20c8cfa3",
    "0x910cbd523d972eb0a6f4cae4618ad62622b39dbf",
    "0xfd8610d20aa15b7b2e3be39b396a1bc3516c7144",
    "0x07687e702b410fa43f4cb4af7fa097918ffd2730",
})

ofac_last_updated: str = "Never"

async def refresh_ofac_list():
    """Fetch live OFAC list from ultrasoundmoney/ofac-ethereum-addresses (Fix 4)."""
    global TORNADO_CASH_ADDRESSES, ofac_last_updated
    # Try CSV as primary since JSON is missing in repo
    url = "https://raw.githubusercontent.com/ultrasoundmoney/ofac-ethereum-addresses/main/data.csv"
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=10.0)
            if response.status_code == 200:
                content = response.text
                new_addresses = []
                
                # Simple CSV parsing (address is first column)
                for line in content.splitlines():
                    if line.strip():
                        parts = line.split(",")
                        addr = parts[0].strip().strip('"').lower()
                        if addr.startswith("0x") and len(addr) == 42:
                            new_addresses.append(addr)
                
                if new_addresses:
                    # Merge with seed addresses to be safe (Fix 4)
                    seed_addresses = {
                        "0xd4b88df4d29f5cedd6857912842cff3b20c8cfa3",
                        "0x910cbd523d972eb0a6f4cae4618ad62622b39dbf",
                        "0xfd8610d20aa15b7b2e3be39b396a1bc3516c7144",
                        "0x07687e702b410fa43f4cb4af7fa097918ffd2730",
                    }
                    all_ofac = seed_addresses | set(new_addresses)
                    TORNADO_CASH_ADDRESSES = frozenset(addr.lower() for addr in all_ofac)
                    ofac_last_updated = datetime.now(timezone.utc).isoformat()
                    print(f"✅ OFAC list refreshed: {len(TORNADO_CASH_ADDRESSES)} addresses loaded (merged with seed).")
                else:
                    print("⚠️ OFAC refresh returned no addresses, keeping existing list.")
            else:
                print(f"⚠️ OFAC refresh failed with status {response.status_code}")
    except Exception as e:
        print(f"⚠️ OFAC refresh error: {e}")

async def periodic_ofac_refresh(interval: int):
    """Periodically refresh the OFAC list in the background (Fix 4)."""
    while True:
        await asyncio.sleep(interval)
        await refresh_ofac_list()

# =============================================================================
# DEX ROUTER ADDRESSES (legitimate but worth noting for flow analysis)
# =============================================================================
DEX_ROUTER_ADDRESSES: frozenset[str] = frozenset({
    "0x7a250d5630b4cf539739df2c5dacb4c659f2488d",  # Uniswap V2
    "0xe592427a0aece92de3edee1f18e0157c05861564",  # Uniswap V3
    "0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f",  # SushiSwap
    "0x1111111254fb6c44bac0bed2854e76f90643097d",  # 1inch
})

# =============================================================================
# EXTERNAL BLACKLIST SOURCE
# =============================================================================
MEW_DARK_LIST_URL: str = (
    "https://raw.githubusercontent.com/MyEtherWallet/ethereum-lists/"
    "master/src/addresses/addresses-darklist.json"
)

# =============================================================================
# RISK RULE THRESHOLDS — DO NOT CHANGE
# =============================================================================

# Minimum ETH value to even consider a transaction interesting
MIN_ETH_VALUE_FILTER: float = 0.1

# HIGH_VELOCITY rule: >5 txs within this window → triggered
VELOCITY_WINDOW_SECONDS: int = 60
VELOCITY_THRESHOLD: int = 5

# PEEL_CHAIN rule: received + re-sent >80% within 10 minutes
PEEL_CHAIN_THRESHOLD_PERCENT: float = 0.80
PEEL_CHAIN_WINDOW_SECONDS: int = 600  # 10 minutes

# LARGE_VALUE rule: transaction >10 ETH
LARGE_VALUE_ETH: float = 10.0

# NEW_WALLET rule: wallet age <7 days with high value
NEW_WALLET_AGE_DAYS: int = 7

# =============================================================================
# SCORING WEIGHTS — LOCKED. DO NOT MODIFY.
# =============================================================================
RULE_WEIGHTS: dict[str, int] = {
    "BLACKLIST_HIT":      40,
    "TORNADO_PROXIMITY":  35,
    "PEEL_CHAIN":         30,
    "HIGH_VELOCITY":      25,
    "LARGE_VALUE":        20,
    "NEW_WALLET":         10,
}

# =============================================================================
# RISK TIERS
# =============================================================================
TIER_LOW_MAX: int = 39       # 0–39  → LOW  (monitor only)
TIER_MEDIUM_MAX: int = 69    # 40–69 → MEDIUM (flag for analyst)
# 70–100 → CRITICAL (auto-hold, escalate immediately)
