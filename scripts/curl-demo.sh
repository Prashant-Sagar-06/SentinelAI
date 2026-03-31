#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${BASE_URL:-}" ]]; then
  echo "Missing BASE_URL. Example: BASE_URL=https://your-backend-url" >&2
  exit 1
fi
EMAIL="${EMAIL:-demo@soc.local}"

echo "Base URL: ${BASE_URL}"
echo "Email: ${EMAIL}"

read -r -s -p "Password for ${EMAIL}: " PASSWORD
echo

step() { echo; echo "=== $1 ==="; }

step "Health (no auth)"
curl -sS "${BASE_URL}/health"; echo

step "Register (may 409 if already exists)"
curl -sS -X POST "${BASE_URL}/api/auth/register" \
  -H 'content-type: application/json' \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\",\"role\":\"analyst\"}" \
  || true

echo

step "Login"
LOGIN_JSON="$(curl -sS -X POST "${BASE_URL}/api/auth/login" \
  -H 'content-type: application/json' \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}")"

TOKEN="$(python - <<'PY'
import json,sys
print(json.loads(sys.stdin.read()).get('token',''))
PY
<<<"$LOGIN_JSON")"

if [[ -z "$TOKEN" ]]; then
  echo "Login failed; response was:" >&2
  echo "$LOGIN_JSON" >&2
  exit 1
fi

echo "Token acquired (length=${#TOKEN})"

step "Create a log event (requires auth)"
NOW="$(python - <<'PY'
from datetime import datetime, timezone
print(datetime.now(timezone.utc).isoformat())
PY
)"

curl -sS -X POST "${BASE_URL}/api/logs" \
  -H 'content-type: application/json' \
  -H "authorization: Bearer ${TOKEN}" \
  -d "{\"timestamp\":\"${NOW}\",\"source\":\"curl-demo\",\"event_type\":\"login_attempt\",\"status\":\"failed\",\"actor\":{\"user\":\"demo\"},\"network\":{\"ip\":\"185.23.12.58\",\"user_agent\":\"curl-demo\"},\"attributes\":{\"attempts\":42},\"tags\":[\"demo\",\"curl\"]}"; echo

step "System health (requires auth)"
curl -sS "${BASE_URL}/api/system-health" -H "authorization: Bearer ${TOKEN}"; echo

step "Query logs (requires auth)"
curl -sS "${BASE_URL}/api/logs?limit=5" -H "authorization: Bearer ${TOKEN}"; echo
