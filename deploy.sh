#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
#  Orca — One-Command Fly.io Deploy
#  Usage: OPENAI_API_KEY=sk-... ./deploy.sh
# ═══════════════════════════════════════════════════════════
set -euo pipefail

APP="orca-gateway"
REGION="${FLY_REGION:-sjc}"

# ── Preflight checks ──────────────────────────────────────
command -v fly >/dev/null 2>&1 || {
  echo "fly CLI not found. Install: curl -L https://fly.io/install.sh | sh"
  exit 1
}

if [[ -z "${OPENAI_API_KEY:-}" && -z "${ANTHROPIC_API_KEY:-}" && -z "${GEMINI_API_KEY:-}" ]]; then
  echo "ERROR: Set at least one LLM API key (OPENAI_API_KEY, ANTHROPIC_API_KEY, or GEMINI_API_KEY)"
  exit 1
fi

if [[ -z "${SAMSKARA_API_KEY:-}" ]]; then
  echo "ERROR: SAMSKARA_API_KEY is required. Get it from samskara-mind.replit.app"
  exit 1
fi

# ── Auto-generate gateway token if not set ────────────────
if [[ -z "${ORCA_GATEWAY_TOKEN:-}" ]]; then
  ORCA_GATEWAY_TOKEN=$(openssl rand -hex 32)
  echo "Generated gateway token: $ORCA_GATEWAY_TOKEN"
  echo "Save this! You'll need it to connect clients."
fi

# ── Create Fly app if not exists ──────────────────────────
if ! fly apps list | grep -q "^$APP"; then
  echo "Creating Fly app: $APP"
  fly apps create "$APP" --machines
fi

# ── Create persistent volume ──────────────────────────────
if ! fly volumes list -a "$APP" | grep -q "orca_data"; then
  echo "Creating persistent volume"
  fly volumes create orca_data --size 10 --region "$REGION" -a "$APP"
fi

# ── Set secrets ───────────────────────────────────────────
echo "Setting secrets..."
fly secrets set \
  ORCA_GATEWAY_TOKEN="$ORCA_GATEWAY_TOKEN" \
  SAMSKARA_API_KEY="$SAMSKARA_API_KEY" \
  SAMSKARA_AGENT_ID="${SAMSKARA_AGENT_ID:-orca-v1}" \
  ${OPENAI_API_KEY:+OPENAI_API_KEY="$OPENAI_API_KEY"} \
  ${ANTHROPIC_API_KEY:+ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY"} \
  ${GEMINI_API_KEY:+GEMINI_API_KEY="$GEMINI_API_KEY"} \
  ${TELEGRAM_BOT_TOKEN:+TELEGRAM_BOT_TOKEN="$TELEGRAM_BOT_TOKEN"} \
  ${DISCORD_BOT_TOKEN:+DISCORD_BOT_TOKEN="$DISCORD_BOT_TOKEN"} \
  ${SLACK_BOT_TOKEN:+SLACK_BOT_TOKEN="$SLACK_BOT_TOKEN"} \
  -a "$APP"

# ── Deploy ────────────────────────────────────────────────
echo "Deploying Orca..."
cd orca && fly deploy --app "$APP" --region "$REGION"

# ── Health check ──────────────────────────────────────────
echo "Waiting for health check..."
sleep 10
fly status -a "$APP"

echo ""
echo "═══════════════════════════════════════════════"
echo "  Orca deployed!"
echo "  URL: https://$APP.fly.dev"
echo "  Token: $ORCA_GATEWAY_TOKEN"
echo "  Brain: https://samskara-mind.replit.app"
echo "═══════════════════════════════════════════════"
