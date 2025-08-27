#!/bin/bash

# TR-11 CURL DI VERIFICA

echo "=== CURL TESTS TR-11 ==="
echo ""

# Start server in background for testing
NODE_ENV=test USE_SQLITE=true DEV_SEED=true RGS_API_KEY=test_rgs_key npm start > /dev/null 2>&1 &
SERVER_PID=$!
sleep 3

# 1. Health endpoints (4 varianti)
echo "1. HEALTH ENDPOINTS:"
echo "  a) Prefixed Casino:"
curl -s -X GET http://localhost:3001/casino/api/v1/health | head -1
echo ""
echo "  b) Compat Casino:"
curl -s -X GET http://localhost:3001/health | head -1
echo ""
echo "  c) Admin health prefixed:"
curl -s -X GET http://localhost:3001/casino/api/v1/admin/health | head -1
echo ""
echo "  d) Admin health compat:"
curl -s -X GET http://localhost:3001/admin/health | head -1
echo ""

# 2. Seed player
echo "2. SEED PLAYER:"
SEED_RESPONSE=$(curl -s -X POST http://localhost:3001/casino/api/v1/admin/seed/player \
  -H "Authorization: Bearer test_rgs_key" \
  -H "X-Correlation-Id: 550e8400-e29b-41d4-a716-446655440001" \
  -H "Content-Type: application/json" \
  -d '{"username":"curl_test_user","initialBalance":"1000.00"}')
echo "$SEED_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$SEED_RESPONSE"
PLAYER_ID=$(echo "$SEED_RESPONSE" | grep -o '"playerId":"[^"]*' | cut -d'"' -f4)
echo ""

# 3. RGS flow
echo "3. RGS FLOW:"

echo "  a) Get token:"
TOKEN_RESPONSE=$(curl -s -X POST http://localhost:3001/rgs/api/v1/auth/token \
  -H "Authorization: Bearer test_rgs_key" \
  -H "X-Correlation-Id: 550e8400-e29b-41d4-a716-446655440002" \
  -H "Content-Type: application/json" \
  -d "{\"playerId\":\"$PLAYER_ID\"}")
echo "$TOKEN_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$TOKEN_RESPONSE"
echo ""

echo "  b) Start session:"
SESSION_RESPONSE=$(curl -s -X POST http://localhost:3001/rgs/api/v1/session/start \
  -H "Authorization: Bearer test_rgs_key" \
  -H "X-Correlation-Id: 550e8400-e29b-41d4-a716-446655440003" \
  -H "Content-Type: application/json" \
  -d "{\"playerId\":\"$PLAYER_ID\",\"gameId\":\"rawwar-v6\"}")
echo "$SESSION_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$SESSION_RESPONSE"
echo ""

echo "  c) Start round:"
ROUND_RESPONSE=$(curl -s -X POST http://localhost:3001/rgs/api/v1/round/start \
  -H "Authorization: Bearer test_rgs_key" \
  -H "X-Correlation-Id: 550e8400-e29b-41d4-a716-446655440004" \
  -H "Idempotency-Key: 550e8400-e29b-41d4-a716-446655440100" \
  -H "Content-Type: application/json" \
  -d "{\"playerId\":\"$PLAYER_ID\",\"gameId\":\"rawwar-v6\",\"roundId\":\"round-001\"}")
echo "$ROUND_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$ROUND_RESPONSE"
echo ""

echo "  d) Debit:"
DEBIT_RESPONSE=$(curl -s -X POST http://localhost:3001/rgs/api/v1/transaction/debit \
  -H "Authorization: Bearer test_rgs_key" \
  -H "X-Correlation-Id: 550e8400-e29b-41d4-a716-446655440005" \
  -H "Idempotency-Key: 550e8400-e29b-41d4-a716-446655440101" \
  -H "Content-Type: application/json" \
  -d "{\"playerId\":\"$PLAYER_ID\",\"amount\":\"10.00\",\"roundId\":\"round-001\"}")
echo "$DEBIT_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$DEBIT_RESPONSE"
echo ""

echo "  e) Replay debit (stesso idempotency):"
REPLAY_RESPONSE=$(curl -s -X POST http://localhost:3001/rgs/api/v1/transaction/debit \
  -H "Authorization: Bearer test_rgs_key" \
  -H "X-Correlation-Id: 550e8400-e29b-41d4-a716-446655440006" \
  -H "Idempotency-Key: 550e8400-e29b-41d4-a716-446655440101" \
  -H "Content-Type: application/json" \
  -d "{\"playerId\":\"$PLAYER_ID\",\"amount\":\"10.00\",\"roundId\":\"round-001\"}")
echo "$REPLAY_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$REPLAY_RESPONSE"
echo ""

echo "  f) Credit:"
CREDIT_RESPONSE=$(curl -s -X POST http://localhost:3001/rgs/api/v1/transaction/credit \
  -H "Authorization: Bearer test_rgs_key" \
  -H "X-Correlation-Id: 550e8400-e29b-41d4-a716-446655440007" \
  -H "Idempotency-Key: 550e8400-e29b-41d4-a716-446655440102" \
  -H "Content-Type: application/json" \
  -d "{\"playerId\":\"$PLAYER_ID\",\"amount\":\"10.00\",\"roundId\":\"round-001\"}")
echo "$CREDIT_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$CREDIT_RESPONSE"
echo ""

# 4. Limits check oltre soglia
echo "4. LIMITS CHECK (oltre soglia):"
LIMITS_RESPONSE=$(curl -s -X POST http://localhost:3001/rgs/api/v1/limits/check \
  -H "Authorization: Bearer test_rgs_key" \
  -H "X-Correlation-Id: 550e8400-e29b-41d4-a716-446655440008" \
  -H "Content-Type: application/json" \
  -d "{\"playerId\":\"$PLAYER_ID\",\"amount\":\"999999.99\"}")
echo "$LIMITS_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$LIMITS_RESPONSE"
echo ""

# Cleanup
kill $SERVER_PID 2>/dev/null
wait $SERVER_PID 2>/dev/null

echo "=== CURL TESTS COMPLETED ==="
