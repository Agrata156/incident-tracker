#!/usr/bin/env bash
# Sends a message to the team's Discord channel. Does nothing if no webhook is configured.
# Usage: DISCORD_WEBHOOK_URL=... notify.sh "message"
set -uo pipefail
case "${DISCORD_WEBHOOK_URL:-}" in
  https://*) ;;
  *) echo "Discord webhook not configured - skipping notification"; exit 0 ;;
esac
jq -n --arg content "$1" '{content: $content}' \
  | curl -fsS -H "Content-Type: application/json" -d @- "$DISCORD_WEBHOOK_URL" \
  || echo "Warning: Discord notification failed"
