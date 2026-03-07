"""
scripts/toggle_mode.py

Helper script to quickly switch between simulation and live modes
without manually editing the .env file.
"""

import sys
from pathlib import Path

def toggle_mode(mode: str):
    env_path = Path(".env")
    if not env_path.exists():
        print("❌ .env file not found!")
        sys.exit(1)

    with open(env_path, "r") as f:
        lines = f.readlines()

    target_val = "true" if mode == "sim" else "false"
    changed = False

    for i, line in enumerate(lines):
        if line.startswith("SIMULATION_MODE="):
            lines[i] = f"SIMULATION_MODE={target_val}\n"
            changed = True
            break

    if not changed:
        lines.append(f"SIMULATION_MODE={target_val}\n")

    with open(env_path, "w") as f:
        f.writelines(lines)

    mode_name = "SIMULATION" if mode == "sim" else "LIVE"
    print(f"✅ Switched to {mode_name} mode (SIMULATION_MODE={target_val})")
    print("Restart your uvicorn server for the change to take effect.")

if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] not in ["sim", "live"]:
        print("Usage: python scripts/toggle_mode.py [sim|live]")
        sys.exit(1)
        
    toggle_mode(sys.argv[1])
