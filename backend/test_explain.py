import asyncio
from ai.explainer import generate_explanation
import os
from dotenv import load_dotenv

async def main():
    load_dotenv("../.env")
    print("API KEY:", os.getenv("GEMINI_API_KEY")[:5] if os.getenv("GEMINI_API_KEY") else "None")
    risk_result = {
        "from_address": "0x123",
        "to_address": "0x456",
        "eth_value": 1.5,
        "risk_score": 85,
        "risk_tier": "critical",
        "triggered_rules": ["BLACKLIST_HIT"]
    }
    generator = generate_explanation(risk_result)
    try:
        async for chunk in generator:
            print(chunk, end="", flush=True)
    except Exception as e:
        print("EXCEPTION:", e)
    print("\nDONE")

if __name__ == "__main__":
    asyncio.run(main())
