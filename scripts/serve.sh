#!/bin/bash
# Wrapper script that builds, kills existing process, and restarts server in a loop

cd "$(dirname "$0")/.." || exit 1

# Load environment
source .env 2>/dev/null
PORT=${WEB_PORT:-3000}

# Kill any existing process on the port
lsof -ti:$PORT | xargs kill 2>/dev/null

# Build the project
echo "Building..."
cd web && bun run build || exit 1

# Run server in a loop
while true; do
  echo "Starting server on port $PORT..."
  PORT=$PORT bun build/index.js
  EXIT_CODE=$?

  if [ $EXIT_CODE -eq 0 ]; then
    echo "Server exited cleanly, restarting in 1 second..."
    sleep 1
  else
    echo "Server crashed with exit code $EXIT_CODE, restarting in 2 seconds..."
    sleep 2
  fi
done
