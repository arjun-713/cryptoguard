import sys
import asyncio
from pathlib import Path
from dotenv import load_dotenv
import os
import google.generativeai as genai

sys.path.append(str(Path(__file__).parent.parent))
from backend.ai.explainer import _build_prompt

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

genai.configure(api_key=api_key)
model = genai.GenerativeModel("gemini-2.5-flash")

tx = {
    "from_address": "0xd4b88df4d29f5cedd6857912842cff3b20c8cfa3",
    "to_address": "0xabc123def456abc123def456abc123def456abc1",
    "eth_value": 14.3,
    "risk_score": 95,
    "risk_tier": "critical",
    "triggered_rules": ["BLACKLIST_HIT", "TORNADO_PROXIMITY", "PEEL_CHAIN"],
    "hop_chain": ["0xwallet1", "0xwallet2", "0xwallet3"]
}

prompt = _build_prompt(tx)

response = model.generate_content(
    prompt, 
    stream=True
)

print("STREAMING LIMIT REMOVED:")
try:
    for chunk in response:
        print(f"CHUNK: {chunk.text}")
        if hasattr(chunk, 'candidates'):
            for c in chunk.candidates:
                print(f"  -> Finish Reason: {c.finish_reason}")
except Exception as e:
    print(f"ERROR: {e}")
