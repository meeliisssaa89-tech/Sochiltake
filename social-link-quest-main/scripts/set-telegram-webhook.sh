#!/usr/bin/env bash
# Set/Update the Telegram bot webhook to point at the deployed
# `telegram-webhook` Supabase Edge Function.
#
# Usage:
#   TELEGRAM_BOT_TOKEN=xxxx SUPABASE_PROJECT_REF=abmwmsvbwaqjxugleegn ./scripts/set-telegram-webhook.sh
#
# Or pass them as arguments:
#   ./scripts/set-telegram-webhook.sh <BOT_TOKEN> <SUPABASE_PROJECT_REF>
#
# Optional: pass a custom webhook URL as $WEBHOOK_URL to override the default
# (use this if you proxy Telegram through your own domain).

set -euo pipefail

BOT_TOKEN="${1:-${TELEGRAM_BOT_TOKEN:-}}"
PROJECT_REF="${2:-${SUPABASE_PROJECT_REF:-}}"
WEBHOOK_URL="${WEBHOOK_URL:-}"

if [[ -z "$BOT_TOKEN" ]]; then
  echo "ERROR: TELEGRAM_BOT_TOKEN is not set." >&2
  exit 1
fi

if [[ -z "$WEBHOOK_URL" ]]; then
  if [[ -z "$PROJECT_REF" ]]; then
    echo "ERROR: SUPABASE_PROJECT_REF is not set (and no WEBHOOK_URL given)." >&2
    exit 1
  fi
  WEBHOOK_URL="https://${PROJECT_REF}.supabase.co/functions/v1/telegram-webhook"
fi

echo "Setting Telegram webhook to: $WEBHOOK_URL"
RESPONSE=$(curl -s -X POST \
  "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"${WEBHOOK_URL}\",\"allowed_updates\":[\"message\",\"callback_query\",\"inline_query\"]}")

echo "$RESPONSE"

if echo "$RESPONSE" | grep -q '"ok":true'; then
  echo "✓ Webhook set successfully."
else
  echo "✗ Failed to set webhook." >&2
  exit 1
fi

echo
echo "Current webhook info:"
curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo"
echo
