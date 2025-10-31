#!/usr/bin/env bash
set -euo pipefail

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required" >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required (brew install jq | apt install jq)" >&2
  exit 1
fi

BASE_URL="${BASE_URL:-http://localhost:4000}"
RESTAURANT_ID="${RESTAURANT_ID:-resto-1}"
SECTOR_ID="${SECTOR_ID:-sector-main}"
BOOKING_DATE="${BOOKING_DATE:-2025-06-01}"
SMALL_PARTY_SIZE="${SMALL_PARTY_SIZE:-4}"
LARGE_PARTY_SIZE="${LARGE_PARTY_SIZE:-8}"

echo "👉 Using API at ${BASE_URL}"
echo

api_get() {
  local path="$1"
  shift || true
  curl -sS "${BASE_URL}${path}" "$@"
}

api_post() {
  local path="$1"
  local payload="$2"
  shift 2 || true
  curl -sS -X POST "${BASE_URL}${path}" \
    -H "Content-Type: application/json" \
    -d "${payload}" "$@"
}

api_put() {
  local path="$1"
  local payload="$2"
  shift 2 || true
  curl -sS -X PUT "${BASE_URL}${path}" \
    -H "Content-Type: application/json" \
    -d "${payload}" "$@"
}

api_delete() {
  local path="$1"
  curl -sS -X DELETE "${BASE_URL}${path}"
}

echo "🔍 Step 1 — Discover availability for party size ${SMALL_PARTY_SIZE}"
DISCOVER_SMALL=$(api_get "/woki/discover" \
  --get \
  --data-urlencode "restaurantId=${RESTAURANT_ID}" \
  --data-urlencode "sectorId=${SECTOR_ID}" \
  --data-urlencode "partySize=${SMALL_PARTY_SIZE}" \
  --data-urlencode "date=${BOOKING_DATE}")
echo "${DISCOVER_SMALL}" | jq

CANDIDATE_START=$(echo "${DISCOVER_SMALL}" | jq -r '.candidate.start')

echo
echo "📝 Step 2 — Create the booking using discovered slot ${CANDIDATE_START}"
BOOKING_PAYLOAD=$(jq -n \
  --arg restaurantId "${RESTAURANT_ID}" \
  --arg sectorId "${SECTOR_ID}" \
  --arg start "${CANDIDATE_START}" \
  --arg customerName "Walk-in Guest" \
  --arg notes "Demo reservation created by script" \
  --argjson partySize "${SMALL_PARTY_SIZE}" \
  '{restaurantId:$restaurantId, sectorId:$sectorId, partySize:$partySize, start:$start, customerName:$customerName, notes:$notes}')

BOOKING_RESPONSE=$(api_post "/woki/bookings" "${BOOKING_PAYLOAD}")
echo "${BOOKING_RESPONSE}" | jq
SMALL_BOOKING_ID=$(echo "${BOOKING_RESPONSE}" | jq -r '.id')

echo
echo "📋 Step 3 — List bookings for ${BOOKING_DATE}"
api_get "/woki/bookings/day" \
  --get \
  --data-urlencode "restaurantId=${RESTAURANT_ID}" \
  --data-urlencode "sectorId=${SECTOR_ID}" \
  --data-urlencode "date=${BOOKING_DATE}" | jq

echo
echo "🔍 Step 4 — Discover availability for large party (${LARGE_PARTY_SIZE})"
DISCOVER_LARGE=$(api_get "/woki/discover" \
  --get \
  --data-urlencode "restaurantId=${RESTAURANT_ID}" \
  --data-urlencode "sectorId=${SECTOR_ID}" \
  --data-urlencode "partySize=${LARGE_PARTY_SIZE}" \
  --data-urlencode "date=${BOOKING_DATE}")
echo "${DISCOVER_LARGE}" | jq

LARGE_START=$(echo "${DISCOVER_LARGE}" | jq -r '.candidate.start')

echo
echo "📝 Step 5 — Create large-party booking (will be pending approval)"
LARGE_PAYLOAD=$(jq -n \
  --arg restaurantId "${RESTAURANT_ID}" \
  --arg sectorId "${SECTOR_ID}" \
  --arg start "${LARGE_START}" \
  --arg customerName "Corporate Group" \
  --arg notes "Needs projector" \
  --argjson partySize "${LARGE_PARTY_SIZE}" \
  '{restaurantId:$restaurantId, sectorId:$sectorId, partySize:$partySize, start:$start, customerName:$customerName, notes:$notes}')
LARGE_BOOKING_RESPONSE=$(api_post "/woki/bookings" "${LARGE_PAYLOAD}")
echo "${LARGE_BOOKING_RESPONSE}" | jq
LARGE_BOOKING_ID=$(echo "${LARGE_BOOKING_RESPONSE}" | jq -r '.id')

echo
echo "✅ Step 6 — Approve the large-party booking"
APPROVAL_PAYLOAD='{"approver":"Floor manager"}'
api_put "/woki/bookings/${LARGE_BOOKING_ID}/approve" "${APPROVAL_PAYLOAD}" | jq

echo
echo "📥 Step 7 — Add a guest to the waitlist"
WAITLIST_PAYLOAD=$(jq -n \
  --arg restaurantId "${RESTAURANT_ID}" \
  --arg sectorId "${SECTOR_ID}" \
  --arg desired "${CANDIDATE_START}" \
  '{restaurantId:$restaurantId, sectorId:$sectorId, partySize:2, customerName:"Waitlist Guest", desiredTime:$desired}')
WAITLIST_ENTRY=$(api_post "/woki/waitlist" "${WAITLIST_PAYLOAD}")
echo "${WAITLIST_ENTRY}" | jq

WAITLIST_ID=$(echo "${WAITLIST_ENTRY}" | jq -r '.id')

echo
echo "🗑️ Step 8 — Cancel original booking to free space"
api_delete "/woki/bookings/${SMALL_BOOKING_ID}"
echo "Booking ${SMALL_BOOKING_ID} cancelled."

echo
echo "⏱ Step 9 — Wait a moment for waitlist promotion..."
sleep 1

echo "📋 Waitlist state after cancellation"
api_get "/woki/waitlist" \
  --get \
  --data-urlencode "restaurantId=${RESTAURANT_ID}" \
  --data-urlencode "sectorId=${SECTOR_ID}" | jq

echo
echo "♻️ Step 10 — Request repack optimization for the day"
REPACK_PAYLOAD=$(jq -n \
  --arg restaurantId "${RESTAURANT_ID}" \
  --arg sectorId "${SECTOR_ID}" \
  --arg date "${BOOKING_DATE}" \
  '{restaurantId:$restaurantId, sectorId:$sectorId, date:$date}')
api_post "/woki/bookings/repack" "${REPACK_PAYLOAD}" | jq

echo
echo "📈 Step 11 — Fetch metrics snapshot"
curl -sS "${BASE_URL}/metrics" || true

echo
echo "✨ Flow completed"
