"""
CryptoGuard Risk Engine — Member 2 Demo (CLI)
This script demonstrates exactly what Member 2 (you) has built so far.
It takes transactions from the simulation data, scores them using the 6 rules,
and generates the AI explanations using Gemini.
"""

import asyncio
import json
import os
from pathlib import Path

# Fix relative imports for standalone execution
import sys
project_root = str(Path(__file__).parent.parent)
sys.path.append(project_root)

from backend.risk.scorer import score_transaction
from backend.ai.explainer import generate_explanation
from dotenv import load_dotenv

load_dotenv()

# ANSI Colors for terminal output
RESET = "\033[0m"
RED = "\033[91m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
CYAN = "\033[96m"
BOLD = "\033[1m"


async def main():
    print(f"\n{BOLD}{CYAN}=== CryptoGuard Risk Engine (Member 2) Interactive Demo ==={RESET}\n")

    # 1. Load Simulation Data
    sim_file = Path(project_root) / "docs" / "simulation-data.json"
    with open(sim_file) as f:
        sim_data = json.load(f)

    transactions = sim_data["transactions"]

    # Select 3 distinct transactions to demonstrate
    # sim_001: Normal clean transaction
    # sim_006: Tornado Cash withdrawal
    # sim_014: Rug pull exit (requires wallet history for velocity/peel chain)
    
    demo_txs = [
        next(t for t in transactions if t["id"] == "sim_001"),
        next(t for t in transactions if t["id"] == "sim_006"),
        next(t for t in transactions if t["id"] == "sim_014"),
    ]

    # Mock wallet history to make sim_014 trigger HIGH_VELOCITY
    rug_addr = "0xef56ab78cd90ef56ab78cd90ef56ab78cd90ef56"
    wallet_history = {
        rug_addr: [
            {
                "from": "0xvictim", "to": rug_addr, "eth_value": 15.0, 
                "timestamp": f"2025-03-01T00:00:{i*10:02d}Z"
            } for i in range(6)
        ]
    }

    print(f"Loaded {len(demo_txs)} test scenarios.\n")

    for i, tx in enumerate(demo_txs, 1):
        print(f"{BOLD}--- Scenario {i}: {tx['scenario'].replace('_', ' ').title()} ---{RESET}")
        print(f"  Transaction: {tx['eth_value']} ETH from {tx['from'][:8]}...")
        
        # 2. Score the transaction using our scorer & rules
        print("  Scoring...", end=" ", flush=True)
        result = await score_transaction(
            tx, 
            wallet_history=wallet_history,
            blacklist={rug_addr} # Mocking the MEW darklist load for sim_014
        )
        print("Done.")

        tier_color = GREEN if result['risk_tier'] == 'low' else YELLOW if result['risk_tier'] == 'medium' else RED
        print(f"  {BOLD}Score:{RESET} {tier_color}{result['risk_score']}/100 ({result['risk_tier'].upper()}){RESET}")
        print(f"  {BOLD}Triggered Rules:{RESET} {', '.join(result['triggered_rules']) or 'None'}")

        # 3. Generate AI Explanation
        print(f"  {BOLD}Explanation:{RESET} ", end="", flush=True)
        
        # Temporarily clear the pre-baked AI explanation so we can see our fallback/Gemini stream
        # in action, otherwise it returns immediately.
        result['ai_explanation'] = None 
        
        try:
            async for chunk in generate_explanation(result):
                print(f"{YELLOW}{chunk}{RESET}", end="", flush=True)
        except Exception as e:
            print(f"{RED}[Error streaming: {e}]{RESET}")
        
        print("\n")
        await asyncio.sleep(1)

    print(f"{BOLD}{CYAN}=== End of Demo ==={RESET}")
    print("If you provide a valid GEMINI_API_KEY in .env, the explanations will be generated live by Gemini.")
    print("Otherwise, you are seeing the rule-based fallback generator we built.")

if __name__ == "__main__":
    asyncio.run(main())
