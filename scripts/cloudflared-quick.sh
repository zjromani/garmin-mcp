#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-8080}"
SERVICE_URL="http://localhost:${PORT}"
LOGFILE="${TMPDIR:-/tmp}/cloudflared-quick.log"

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared not found. Install with: brew install cloudflared" >&2
  exit 1
fi

: > "$LOGFILE"
echo "Starting Cloudflare Quick Tunnel to ${SERVICE_URL}... (logs: $LOGFILE)"

# Start cloudflared in background and log to file
cloudflared tunnel --no-autoupdate --url "${SERVICE_URL}" --logfile "$LOGFILE" &
CLOUDFLARED_PID=$!

# Wait for the URL to appear
URL=""
for i in {1..30}; do
  if grep -Eo 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOGFILE" >/dev/null 2>&1; then
    URL=$(grep -Eo 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOGFILE" | head -n1)
    break
  fi
  sleep 1
done

if [[ -n "$URL" ]]; then
  echo "Quick Tunnel URL: $URL"
  echo "Try: $URL/healthz"
  echo "Webhook: $URL/garmin/webhook"
else
  echo "Failed to detect tunnel URL. See logs: $LOGFILE" >&2
fi

# Stream live logs and wait for process
trap 'kill $CLOUDFLARED_PID >/dev/null 2>&1 || true' INT TERM
tail -f "$LOGFILE" &
TAIL_PID=$!
wait $CLOUDFLARED_PID || true
kill $TAIL_PID >/dev/null 2>&1 || true
