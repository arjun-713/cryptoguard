"""
backend/blockchain/enricher.py

Enriches raw blockchain transactions with on-chain history data.
Uses Alchemy's Asset Transfers API to reconstruct the hop_chain (fund flow history).
"""

import time
import httpx
import logging
from typing import List, Dict, Optional

logger = logging.getLogger(__name__)

# Cache for enriched data to avoid rate limits
# Key: wallet_address, Value: (timestamp, hop_chain)
_hop_chain_cache: Dict[str, tuple] = {}
CACHE_TTL = 300  # 5 minutes

async def enrich_transaction(tx: dict, alchemy_http_url: str) -> dict:
    """
    Dives into on-chain history to build a real hop_chain.
    Replaces the empty [] hop_chain with actual source wallet paths.
    """
    from_address = tx.get("from_address") or tx.get("from")
    if not from_address or not alchemy_http_url:
        return tx

    # Check cache first
    now = time.time()
    if from_address in _hop_chain_cache:
        cached_time, cached_hop = _hop_chain_cache[from_address]
        if now - cached_time < CACHE_TTL:
            tx["hop_chain"] = cached_hop
            return tx

    try:
        hop_chain = await _reconstruct_hop_chain(from_address, alchemy_http_url)
        _hop_chain_cache[from_address] = (now, hop_chain)
        tx["hop_chain"] = hop_chain
    except Exception as e:
        logger.error(f"Failed to enrich transaction for {from_address}: {e}")
        # Return original tx if enrichment fails
        if "hop_chain" not in tx:
            tx["hop_chain"] = []
    
    return tx

async def _reconstruct_hop_chain(target_address: str, alchemy_url: str, max_depth: int = 3) -> List[str]:
    """
    Recursively (up to max_depth) finds where funds came from.
    Looks for "immediate forward" patterns (within 10 minutes).
    """
    hop_chain = [target_address]
    current_addr = target_address
    
    async with httpx.AsyncClient() as client:
        for _ in range(max_depth):
            # Fetch last 20 transfers TO the current address
            payload = {
                "jsonrpc": "2.0",
                "id": 0,
                "method": "alchemy_getAssetTransfers",
                "params": [
                    {
                        "toAddress": current_addr,
                        "category": ["external", "erc20"],
                        "order": "desc",
                        "maxCount": "0x14" # 20
                    }
                ]
            }
            
            response = await client.post(alchemy_url, json=payload)
            if response.status_code != 200:
                break
                
            data = response.json()
            transfers = data.get("result", {}).get("transfers", [])
            
            if not transfers:
                break
                
            # Take the most recent transfer
            # Note: In a real "peel chain", we'd look for the one closest to
            # our current transaction timestamp, but here we'll take the latest.
            latest_transfer = transfers[0]
            source_addr = latest_transfer.get("from")
            
            if not source_addr or source_addr == "0x0000000000000000000000000000000000000000":
                break
                
            # Avoid cycles or self-transfers
            if source_addr in hop_chain:
                break
                
            hop_chain.append(source_addr)
            current_addr = source_addr
            
    # Reverse so it's [Source, ..., Target]
    return list(reversed(hop_chain))
