"""
Test script to measure TTFB and total duration of the Gemini streaming API
using the explainer module.
"""

import sys
import asyncio
import time
from pathlib import Path
from dotenv import load_dotenv

# Ensure backend module can be imported
sys.path.append(str(Path(__file__).parent.parent))
from backend.ai.explainer import generate_explanation

load_dotenv()

async def measure_streaming_latency():
    # Mock Critical Transaction Payload requested by the user
    tx = {
      "tx_id": "test_001",
      "from_address": "0xd4b88df4d29f5cedd6857912842cff3b20c8cfa3",
      "to_address": "0xabc123def456abc123def456abc123def456abc1",
      "eth_value": 14.3,
      "risk_score": 95,
      "risk_tier": "critical",
      "triggered_rules": ["BLACKLIST_HIT", "TORNADO_PROXIMITY", "PEEL_CHAIN"],
      "hop_chain": ["0xwallet1", "0xwallet2", "0xwallet3"]
    }

    print("--- Starting AI Explanation Stream Test ---")
    start_time = time.time()
    print(f"[0.000s] Call start timestamp: {start_time}")

    first_token_time = None
    total_tokens = 0
    full_text = ""

    try:
        # We process the async generator yielded by the explainer
        stream = generate_explanation(tx)
        
        async for chunk in stream:
            # Record time of first received token
            if first_token_time is None:
                first_token_time = time.time()
                ttfb = first_token_time - start_time
                print(f"[{ttfb:.3f}s] First token received timestamp: {first_token_time}")
                print(f"\n[STREAMING OUTPUT]:\n", end="")
            
            # Print the chunk as it streams in
            print(chunk, end="", flush=True)
            full_text += chunk
            total_tokens += 1
            
    except Exception as e:
        print(f"\n\n[ERROR] Streaming failed: {e}")
        return

    end_time = time.time()
    print(f"\n\n[{end_time - start_time:.3f}s] Last token received timestamp: {end_time}")
    
    # Calculate Latencies
    if first_token_time:
        ttfb = first_token_time - start_time
        total_time = end_time - start_time
        stream_time = end_time - first_token_time
        
        print("\n--- LATENCY METRICS ---")
        print(f"Time to First Token (TTFB): {ttfb:.3f} seconds")
        print(f"Total Stream Duration:      {stream_time:.3f} seconds")
        print(f"Total Response Time:        {total_time:.3f} seconds")
        print(f"Total Chunks Yielded:       {total_tokens}")
    else:
        print("\n[!] No tokens were received.")

if __name__ == "__main__":
    asyncio.run(measure_streaming_latency())
