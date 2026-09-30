#!/usr/bin/env bash
set -euo pipefail

# ─── Resolve project root (always relative to repo, not cwd) ─────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_ROOT}"

# ─── Configuration ───────────────────────────────────────────────────────────
IMAGE="ghcr.io/appfresheners/archer:latest"

# ─── Load env vars from .env.local (only the ones we need) ───────────────────
if [ -f .env.local ]; then
  _env_val() { grep "^$1=" .env.local | head -1 | cut -d'=' -f2- || true; }
  GHCR_TOKEN="${GHCR_TOKEN:-$(_env_val GHCR_TOKEN)}"
  GHCR_USER="${GHCR_USER:-$(_env_val GHCR_USER)}"
  COOLIFY_TOKEN="${COOLIFY_TOKEN:-$(_env_val COOLIFY_TOKEN)}"
  COOLIFY_WEBHOOK="${COOLIFY_WEBHOOK:-$(_env_val COOLIFY_WEBHOOK)}"
fi

# ─── Validate required env vars ──────────────────────────────────────────────
missing=()
[ -z "${GHCR_USER:-}" ] && missing+=("GHCR_USER")
[ -z "${GHCR_TOKEN:-}" ] && missing+=("GHCR_TOKEN")
[ -z "${COOLIFY_TOKEN:-}" ] && missing+=("COOLIFY_TOKEN")
[ -z "${COOLIFY_WEBHOOK:-}" ] && missing+=("COOLIFY_WEBHOOK")

if [ ${#missing[@]} -gt 0 ]; then
  echo "❌ Missing required env vars: ${missing[*]}"
  echo "   Set them in .env.local or export them before running this script."
  exit 1
fi

# ─── Authenticate to GHCR ────────────────────────────────────────────────────
echo "🔐 Logging into GHCR..."
echo "${GHCR_TOKEN}" | docker login ghcr.io -u "${GHCR_USER}" --password-stdin

# ─── Build ────────────────────────────────────────────────────────────────────
echo "🏗️  Building image: ${IMAGE}"
docker build --network=host -t "${IMAGE}" .

# ─── Push ─────────────────────────────────────────────────────────────────────
echo "📦 Pushing image to GHCR..."
docker push "${IMAGE}"

echo "✅ Done — ${IMAGE} pushed successfully"

# ─── Trigger Coolify deploy webhook ──────────────────────────────────────────
echo "🚀 Triggering Coolify deployment..."
response=$(curl -sk --max-time 30 -w "\n%{http_code}" \
  -X GET "${COOLIFY_WEBHOOK}" \
  -H "Authorization: Bearer ${COOLIFY_TOKEN}" 2>&1) || {
  echo "❌ curl failed to reach Coolify: ${response}"
  exit 1
}

http_status=$(echo "${response}" | tail -1)
response_body=$(echo "${response}" | head -n -1)

echo "   Response: ${response_body}"

if [ "${http_status}" -ge 200 ] && [ "${http_status}" -lt 300 ]; then
  echo "✅ Coolify deployment triggered (HTTP ${http_status})"
else
  echo "❌ Coolify webhook failed (HTTP ${http_status})"
  exit 1
fi
