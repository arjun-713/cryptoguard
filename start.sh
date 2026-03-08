#!/bin/bash

echo "🛡️  Starting CryptoGuard..."

# Kill any existing servers
pkill -f uvicorn 2>/dev/null
pkill -f "npm run dev" 2>/dev/null
sleep 1

# Start backend
echo "🔧 Starting backend..."
cd ~/Cryptoguard/backend
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
echo "✅ Backend started (PID: $BACKEND_PID)"

# Wait for backend to be ready
echo "⏳ Waiting for backend..."
until curl -s http://localhost:8000/health > /dev/null 2>&1; do
    sleep 1
done
echo "✅ Backend ready"

# Start frontend
echo "🎨 Starting frontend..."
cd ~/Cryptoguard/frontend
npm run dev &
FRONTEND_PID=$!
echo "✅ Frontend started (PID: $FRONTEND_PID)"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🛡️  CryptoGuard is running!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Frontend: http://localhost:5173"
echo "Backend:  http://localhost:8000"
echo "Health:   http://localhost:8000/health"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Press Ctrl+C to stop all servers"
echo ""

# Keep script running and kill both on Ctrl+C
trap "echo 'Stopping...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" SIGINT SIGTERM
wait
