#!/usr/bin/env bash
set -e

# Chat runs on Groq (set GROQ_API_KEY as a Space secret); embeddings run
# locally on CPU. No Ollama / model pull needed, so startup is fast.
# Start Redis as an in-memory cache (no persistence). Non-fatal if it fails.
echo "==> Starting Redis (in-memory cache)..."
redis-server --daemonize yes --save "" --appendonly no --dir /tmp \
    --bind 127.0.0.1 --port 6379 || echo "WARNING: Redis failed to start (caching disabled)"

if [ -z "$GROQ_API_KEY" ]; then
    echo "WARNING: GROQ_API_KEY is not set — chat will fail until you add it"
    echo "         (Space Settings -> Variables and secrets). Get a free key"
    echo "         at https://console.groq.com"
fi

cd backend
exec uvicorn main:app --host 0.0.0.0 --port 7860 2>&1 | tee /tmp/app.log
