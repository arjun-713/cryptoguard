import sys
from pathlib import Path

# Add backend to sys.path so imports like 'config', 'blockchain', etc. work
backend_path = str(Path(__file__).resolve().parent / "backend")
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)
