#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-8080}"
SERVICE_URL="http://localhost:${PORT}"

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared not found. Install with: brew install cloudflared" >&2
  exit 1
fi

echo "Starting Cloudflare Quick Tunnel to ${SERVICE_URL}..."
# Note: this runs in the foreground; use a process manager or run in background if needed
exec cloudflared tunnel --url "${SERVICE_URL}"
