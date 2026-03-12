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

# ── Derive or generate gateway token ─────────────────────
# Preferred: set ORCA_PASSPHRASE to a memorable phrase; the token is
# deterministically derived so you can always recreate it.
# Fallback: set ORCA_GATEWAY_TOKEN directly, or leave both unset to
# get a random token printed once (old behaviour, not recommended).
if [[ -n "${ORCA_PASSPHRASE:-}" ]]; then
  ORCA_GATEWAY_TOKEN=$(printf '%s' "${ORCA_PASSPHRASE}:orca-gateway-token" | openssl dgst -sha256 -hex | awk '{print $2}')
  echo "Gateway token derived from passphrase (reproducible)."
elif [[ -z "${ORCA_GATEWAY_TOKEN:-}" ]]; then
  ORCA_GATEWAY_TOKEN=$(openssl rand -hex 32)
  echo "WARNING: random gateway token generated — save it or set ORCA_PASSPHRASE next time."
  echo "Token: $ORCA_GATEWAY_TOKEN"
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
