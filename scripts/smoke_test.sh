#!/usr/bin/env bash
# Smoke test – volá každý endpoint a kontroluje HTTP status.
# Použitie: ./scripts/smoke_test.sh [BASE_URL]
# Default: http://localhost:8083

set -euo pipefail

BASE="${1:-http://localhost:8083}"
TEST_EMAIL="smoketest@lifeos.local"
TEST_PASS="smoketest123"
PASS=0
FAIL=0

GREEN='\033[0;32m'
RED='\033[0;31m'
DIM='\033[0;90m'
NC='\033[0m'

check() {
  local label="$1"
  local expected="$2"
  local actual="$3"
  if [ "$actual" -eq "$expected" ]; then
    echo -e "${GREEN}✓${NC} $label ${DIM}($actual)${NC}"
    ((PASS++))
  else
    echo -e "${RED}✗${NC} $label ${DIM}(očakávaný $expected, dostal $actual)${NC}"
    ((FAIL++))
  fi
}

# ── Public endpoints ────────────────────────────────────────────────────────

status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/meta")
check "GET /api/meta" 200 "$status"

# Register (201 = nový, 400 = už existuje – oba sú OK pre smoke test)
status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASS\"}")
if [ "$status" -eq 201 ] || [ "$status" -eq 400 ]; then
  echo -e "${GREEN}✓${NC} POST /api/auth/register ${DIM}($status)${NC}"
  ((PASS++))
else
  echo -e "${RED}✗${NC} POST /api/auth/register ${DIM}(očakávaný 201/400, dostal $status)${NC}"
  ((FAIL++))
fi

# Login – získaj JWT
response=$(curl -s -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASS\"}")
TOKEN=$(echo "$response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo -e "${RED}✗${NC} POST /api/auth/login – nepodarilo sa získať token"
  echo "  Response: $response"
  ((FAIL++))
  echo ""
  echo "─────────────────────────────"
  echo -e "Výsledok: ${RED}FAIL${NC} – bez tokenu nemôžem testovať protected endpoints"
  exit 1
else
  echo -e "${GREEN}✓${NC} POST /api/auth/login ${DIM}(token OK)${NC}"
  ((PASS++))
fi

AUTH="-H \"Authorization: Bearer $TOKEN\""

call() {
  curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $TOKEN" \
    "$BASE$1"
}

call_post() {
  curl -s -o /dev/null -w "%{http_code}" \
    -X POST \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$2" \
    "$BASE$1"
}

# ── Habits ──────────────────────────────────────────────────────────────────

status=$(call "/api/today")
check "GET /api/today" 200 "$status"

status=$(call "/api/history")
check "GET /api/history" 200 "$status"

status=$(call "/api/streaks")
check "GET /api/streaks" 200 "$status"

TODAY=$(date +%Y-%m-%d)
status=$(call "/api/day/$TODAY")
check "GET /api/day/:date" 200 "$status"

# ── Pantry ──────────────────────────────────────────────────────────────────

status=$(call "/api/pantry")
check "GET /api/pantry" 200 "$status"

status=$(call "/api/shopping")
check "GET /api/shopping" 200 "$status"

# ── Recipes ─────────────────────────────────────────────────────────────────

status=$(call "/api/recipes")
check "GET /api/recipes" 200 "$status"

# ── Workout ─────────────────────────────────────────────────────────────────

status=$(call "/api/workout/muscles")
check "GET /api/workout/muscles" 200 "$status"

status=$(call "/api/workout/sessions")
check "GET /api/workout/sessions" 200 "$status"

status=$(call "/api/workout/schedule")
check "GET /api/workout/schedule" 200 "$status"

status=$(call "/api/workout/stats")
check "GET /api/workout/stats" 200 "$status"

# ── Výsledok ────────────────────────────────────────────────────────────────

echo ""
echo "─────────────────────────────"
TOTAL=$((PASS + FAIL))
if [ "$FAIL" -eq 0 ]; then
  echo -e "${GREEN}Všetky testy prešli${NC} ($PASS/$TOTAL)"
else
  echo -e "${RED}$FAIL testov zlyhalo${NC} ($PASS/$TOTAL prešlo)"
  exit 1
fi
