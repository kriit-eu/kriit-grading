#!/bin/bash
# Wrapper script that restarts the server when it exits

cd "$(dirname "$0")/../web" || exit 1

while true; do
  echo "Starting server..."
  node build
  EXIT_CODE=$?

  if [ $EXIT_CODE -eq 0 ]; then
    echo "Server exited cleanly, restarting in 1 second..."
    sleep 1
  else
    echo "Server crashed with exit code $EXIT_CODE, restarting in 2 seconds..."
    sleep 2
  fi
done
