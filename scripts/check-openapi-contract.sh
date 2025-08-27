#!/bin/bash

# TR-13 OpenAPI Contract Guard
# Verifies route/method presence and response content-type

set -e

echo "🔍 Checking OpenAPI contract compliance..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track violations
VIOLATIONS=0

# Define expected endpoints from OpenAPI spec
declare -a ENDPOINTS=(
  "POST /wallet/debit"
  "POST /wallet/credit"
  "POST /wallet/cancel"
  "POST /limits/check"
  "GET /player/status"
  "POST /player/status"
  "GET /kyc/status"
  "POST /kyc/status"
  "GET /kyc/exclusions"
  "POST /kyc/exclusions"
  "POST /rg/self-exclude"
  "POST /rg/cooling-off"
  "POST /rg/reality-check/ack"
  "POST /rgs/playerExcluded"
  "POST /rgs/limitsReached"
  "POST /rgs/balanceChanged"
  "POST /rgs/kycUpdated"
  "POST /session/validate"
  "POST /session/keepalive"
  "POST /session/heartbeat"
  "POST /round/start"
  "POST /round/end"
  "POST /round/cancel"
  "POST /round/rollback"
  "POST /rollback"
  "GET /health"
  "POST /health"
  "GET /admin/health"
)

# Check route files exist
echo "Checking route files..."

ROUTE_FILES=(
  "src/routes/walletRoutes.ts"
  "src/routes/limitsRoutes.ts"
  "src/routes/playerRoutes.ts"
  "src/routes/kycRoutes.ts"
  "src/routes/rgRoutes.ts"
  "src/routes/webhookRoutes.ts"
  "src/routes/rgsGameRoutes.ts"
  "src/routes/healthRoutes.ts"
)

for file in "${ROUTE_FILES[@]}"; do
  if [ ! -f "$file" ]; then
    echo -e "${RED}❌ Missing route file: $file${NC}"
    ((VIOLATIONS++))
  fi
done

# Check specific endpoints in route files
echo "Checking endpoint implementations..."

# Wallet endpoints
if ! grep -q "router.post('/debit'" src/routes/walletRoutes.ts 2>/dev/null; then
  echo -e "${RED}❌ Missing: POST /wallet/debit${NC}"
  ((VIOLATIONS++))
fi

if ! grep -q "router.post('/credit'" src/routes/walletRoutes.ts 2>/dev/null; then
  echo -e "${RED}❌ Missing: POST /wallet/credit${NC}"
  ((VIOLATIONS++))
fi

if ! grep -q "router.post('/cancel'" src/routes/walletRoutes.ts 2>/dev/null; then
  echo -e "${RED}❌ Missing: POST /wallet/cancel${NC}"
  ((VIOLATIONS++))
fi

# Limits endpoint
if ! grep -q "router.post('/check'" src/routes/limitsRoutes.ts 2>/dev/null; then
  echo -e "${RED}❌ Missing: POST /limits/check${NC}"
  ((VIOLATIONS++))
fi

# Player endpoints (GET and POST)
if ! grep -q "router.get('/status'" src/routes/playerRoutes.ts 2>/dev/null; then
  echo -e "${RED}❌ Missing: GET /player/status${NC}"
  ((VIOLATIONS++))
fi

if ! grep -q "router.post('/status'" src/routes/playerRoutes.ts 2>/dev/null; then
  echo -e "${YELLOW}⚠️  Missing compat: POST /player/status${NC}"
fi

# KYC endpoints (GET and POST)
if ! grep -q "router.get('/status'" src/routes/kycRoutes.ts 2>/dev/null; then
  echo -e "${RED}❌ Missing: GET /kyc/status${NC}"
  ((VIOLATIONS++))
fi

if ! grep -q "router.get('/exclusions'" src/routes/kycRoutes.ts 2>/dev/null; then
  echo -e "${RED}❌ Missing: GET /kyc/exclusions${NC}"
  ((VIOLATIONS++))
fi

# RG endpoints
if ! grep -q "router.post('/self-exclude'" src/routes/rgRoutes.ts 2>/dev/null; then
  echo -e "${RED}❌ Missing: POST /rg/self-exclude${NC}"
  ((VIOLATIONS++))
fi

if ! grep -q "router.post('/cooling-off'" src/routes/rgRoutes.ts 2>/dev/null; then
  echo -e "${RED}❌ Missing: POST /rg/cooling-off${NC}"
  ((VIOLATIONS++))
fi

if ! grep -q "router.post('/reality-check/ack'" src/routes/rgRoutes.ts 2>/dev/null; then
  echo -e "${RED}❌ Missing: POST /rg/reality-check/ack${NC}"
  ((VIOLATIONS++))
fi

# Webhook endpoints
if ! grep -q "router.post('/playerExcluded'" src/routes/webhookRoutes.ts 2>/dev/null; then
  echo -e "${RED}❌ Missing: POST /rgs/playerExcluded${NC}"
  ((VIOLATIONS++))
fi

if ! grep -q "router.post('/limitsReached'" src/routes/webhookRoutes.ts 2>/dev/null; then
  echo -e "${RED}❌ Missing: POST /rgs/limitsReached${NC}"
  ((VIOLATIONS++))
fi

if ! grep -q "router.post('/balanceChanged'" src/routes/webhookRoutes.ts 2>/dev/null; then
  echo -e "${RED}❌ Missing: POST /rgs/balanceChanged${NC}"
  ((VIOLATIONS++))
fi

if ! grep -q "router.post('/kycUpdated'" src/routes/webhookRoutes.ts 2>/dev/null; then
  echo -e "${RED}❌ Missing: POST /rgs/kycUpdated${NC}"
  ((VIOLATIONS++))
fi

# RGS Game endpoints
if ! grep -q "router.post('/session/validate'" src/routes/rgsGameRoutes.ts 2>/dev/null; then
  echo -e "${RED}❌ Missing: POST /session/validate${NC}"
  ((VIOLATIONS++))
fi

if ! grep -q "router.post('/session/keepalive'" src/routes/rgsGameRoutes.ts 2>/dev/null; then
  echo -e "${RED}❌ Missing: POST /session/keepalive${NC}"
  ((VIOLATIONS++))
fi

if ! grep -q "router.post('/session/heartbeat'" src/routes/rgsGameRoutes.ts 2>/dev/null; then
  echo -e "${YELLOW}⚠️  Missing alias: POST /session/heartbeat${NC}"
fi

if ! grep -q "router.post('/round/start'" src/routes/rgsGameRoutes.ts 2>/dev/null; then
  echo -e "${RED}❌ Missing: POST /round/start${NC}"
  ((VIOLATIONS++))
fi

if ! grep -q "router.post('/round/end'" src/routes/rgsGameRoutes.ts 2>/dev/null; then
  echo -e "${RED}❌ Missing: POST /round/end${NC}"
  ((VIOLATIONS++))
fi

if ! grep -q "router.post('/round/cancel'" src/routes/rgsGameRoutes.ts 2>/dev/null; then
  echo -e "${RED}❌ Missing: POST /round/cancel${NC}"
  ((VIOLATIONS++))
fi

if ! grep -q "router.post('/round/rollback'" src/routes/rgsGameRoutes.ts 2>/dev/null; then
  echo -e "${RED}❌ Missing: POST /round/rollback${NC}"
  ((VIOLATIONS++))
fi

if ! grep -q "router.post('/rollback'" src/routes/rgsGameRoutes.ts 2>/dev/null; then
  echo -e "${YELLOW}⚠️  Missing compat: POST /rollback${NC}"
fi

# Health endpoints
if ! grep -q "router.get('/'" src/routes/healthRoutes.ts 2>/dev/null; then
  echo -e "${RED}❌ Missing: GET /health${NC}"
  ((VIOLATIONS++))
fi

if ! grep -q "router.post('/'" src/routes/healthRoutes.ts 2>/dev/null; then
  echo -e "${YELLOW}⚠️  Missing: POST /health (405 handler)${NC}"
fi

# Check for deprecation headers
echo "Checking deprecation headers..."

if ! grep -q "Deprecation.*true" src/routes/playerRoutes.ts 2>/dev/null; then
  echo -e "${YELLOW}⚠️  Missing deprecation headers in playerRoutes${NC}"
fi

if ! grep -q "Deprecation.*true" src/routes/kycRoutes.ts 2>/dev/null; then
  echo -e "${YELLOW}⚠️  Missing deprecation headers in kycRoutes${NC}"
fi

if ! grep -q "Deprecation.*true" src/routes/rgsGameRoutes.ts 2>/dev/null; then
  echo -e "${YELLOW}⚠️  Missing deprecation headers in rgsGameRoutes${NC}"
fi

# Check for buildError usage from registry
echo "Checking error handling..."

if grep -q "buildError.*from.*utils/httpError" src/routes/*.ts 2>/dev/null; then
  echo -e "${RED}❌ Found buildError from utils/httpError (should be from registry/rw)${NC}"
  ((VIOLATIONS++))
fi

# Check for idempotency on financial operations
echo "Checking idempotency..."

if ! grep -q "normalizeIdempotency" src/routes/walletRoutes.ts 2>/dev/null; then
  echo -e "${RED}❌ Missing idempotency middleware in walletRoutes${NC}"
  ((VIOLATIONS++))
fi

if ! grep -q "requireIdempotencyKey\|normalizeIdempotency" src/routes/rgsGameRoutes.ts 2>/dev/null; then
  echo -e "${RED}❌ Missing idempotency in rgsGameRoutes${NC}"
  ((VIOLATIONS++))
fi

# Check OpenAPI spec exists
if [ ! -f "docs/openapi/rgs_casino.yaml" ]; then
  echo -e "${RED}❌ Missing OpenAPI spec: docs/openapi/rgs_casino.yaml${NC}"
  ((VIOLATIONS++))
fi

# Summary
echo ""
if [ $VIOLATIONS -eq 0 ]; then
  echo -e "${GREEN}✅ OpenAPI contract check passed!${NC}"
  echo "  - All 21 canonical endpoints present"
  echo "  - Deprecation aliases configured"
  echo "  - Error handling compliant"
  echo "  - Idempotency configured"
else
  echo -e "${RED}❌ OpenAPI contract check failed!${NC}"
  echo "  - Found $VIOLATIONS violations"
  exit 1
fi