#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

echo "Starting CryptoGuard..."

pkill -f "uvicorn main:app --host 127.0.0.1 --port 8000" 2>/dev/null || true
pkill -f "vite --host 127.0.0.1 --port 5173" 2>/dev/null || true
sleep 1

echo "Starting backend on http://127.0.0.1:8000"
cd "$BACKEND_DIR"
./venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

echo "Waiting for backend health check..."
until curl -fsS http://127.0.0.1:8000/health >/dev/null 2>&1; do
    sleep 1
done

echo "Starting frontend on http://127.0.0.1:5173"
cd "$FRONTEND_DIR"
npm run dev -- --host 127.0.0.1 --port 5173 &
FRONTEND_PID=$!

echo ""
echo "CryptoGuard is running"
echo "Frontend: http://127.0.0.1:5173"
echo "Backend:  http://127.0.0.1:8000"
echo "Health:   http://127.0.0.1:8000/health"
echo ""

cleanup() {
    echo "Stopping CryptoGuard..."
    kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}

trap cleanup SIGINT SIGTERM EXIT
wait
