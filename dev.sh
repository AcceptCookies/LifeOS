#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

# Cleanup on exit
cleanup() {
  echo ""
  echo "Stopping..."
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null
  docker compose -f "$ROOT/docker-compose.yml" stop
}
trap cleanup EXIT INT TERM

# 1. Postgres
echo "Starting postgres..."
docker compose -f "$ROOT/docker-compose.yml" up -d

# Wait for postgres to be ready
echo "Waiting for postgres..."
until docker compose -f "$ROOT/docker-compose.yml" exec -T postgres pg_isready -U lifeos -q; do
  sleep 1
done

# 2. Backend
echo "Starting backend..."
cd "$ROOT/backend"
go run . &
BACKEND_PID=$!

# 3. Frontend
echo "Starting frontend..."
cd "$ROOT/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "  backend  → http://localhost:8083"
echo "  frontend → http://localhost:5174"
echo ""
echo "Press Ctrl+C to stop."

wait
