#!/usr/bin/env bash
# Post-deployment smoke tests against a running environment.
# Usage: smoke-test.sh <base-url> [full|readonly]
#   full     - also registers a user and creates/updates an incident (staging)
#   readonly - only checks health, metrics and auth protection (production)
set -euo pipefail

BASE="$1"
MODE="${2:-full}"
PASS_COUNT=0

pass() { echo "  ✅ $1"; PASS_COUNT=$((PASS_COUNT + 1)); }
fail() { echo "  ❌ $1"; exit 1; }

expect_status() { # name expected actual
  if [ "$3" = "$2" ]; then pass "$1 (HTTP $3)"; else fail "$1 expected HTTP $2 but got $3"; fi
}

echo "Smoke testing ${BASE} (${MODE})"

curl -fsS "$BASE/health" | jq -e '.status == "ok"' >/dev/null && pass "GET /health is ok" || fail "GET /health"
curl -fsS "$BASE/metrics" | grep -q '^incidents_open' && pass "GET /metrics exposes incidents_open" || fail "GET /metrics"
expect_status "GET /api/incidents without token is rejected" 401 \
  "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/incidents")"

if [ "$MODE" = "full" ]; then
  USERNAME="smoke_${RANDOM}${RANDOM}"
  PASSWORD="SmokeTest123!"
  JSON='Content-Type: application/json'

  expect_status "POST /api/auth/register" 201 \
    "$(curl -s -o /dev/null -w '%{http_code}' -H "$JSON" -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}" "$BASE/api/auth/register")"

  TOKEN=$(curl -fsS -H "$JSON" -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}" "$BASE/api/auth/login" | jq -r '.token')
  [ -n "$TOKEN" ] && [ "$TOKEN" != "null" ] && pass "POST /api/auth/login returns a JWT" || fail "login"
  AUTH="Authorization: Bearer $TOKEN"

  ID=$(curl -fsS -H "$JSON" -H "$AUTH" -d '{"title":"Smoke test incident","severity":"Low"}' "$BASE/api/incidents" | jq -r '.id')
  [ "$ID" != "null" ] && pass "POST /api/incidents created #$ID" || fail "create incident"

  curl -fsS -H "$AUTH" "$BASE/api/incidents?severity=Low" | jq -e --argjson id "$ID" 'map(.id) | index($id) != null' >/dev/null \
    && pass "GET /api/incidents?severity=Low lists it" || fail "list incidents"

  STATUS=$(curl -fsS -X PATCH -H "$JSON" -H "$AUTH" -d '{"status":"Resolved"}' "$BASE/api/incidents/$ID" | jq -r '.status')
  [ "$STATUS" = "Resolved" ] && pass "PATCH /api/incidents/$ID resolved it" || fail "update incident"
fi

echo "All ${PASS_COUNT} smoke tests passed"
