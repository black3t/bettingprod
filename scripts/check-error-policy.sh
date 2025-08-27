#!/bin/bash
# TR-12 CI Guard - Verifica policy "no pure 400s"

echo "🔍 Checking error policy compliance..."

# Check for res.status(4xx/5xx) not using buildError
VIOLATIONS=$(grep -r "res\.status([45]" src --include="*.ts" | grep -v "test.ts" | grep -v "buildError" | grep -v "__tests__")

if [ ! -z "$VIOLATIONS" ]; then
  echo "❌ ERROR: Found responses with status 4xx/5xx not using buildError:"
  echo "$VIOLATIONS"
  echo ""
  echo "All 4xx/5xx responses must use buildError() from registry/rw.ts"
  exit 1
fi

# Whitelisted codes that are expected to not be in registry (e.g., from test files)
WHITELISTED_CODES="RW-TEST-001 RW-TEST-002"

# Check that all RW- codes are in registry
RW_CODES=$(grep -r "RW-[A-Z]+-[0-9]" src --include="*.ts" -o | sort -u | cut -d: -f2)
MISSING=""

for code in $RW_CODES; do
  # Skip whitelisted codes
  if echo "$WHITELISTED_CODES" | grep -q "$code"; then
    continue
  fi
  if ! grep -q "\"$code\":" src/registry/rw.ts; then
    MISSING="$MISSING $code"
  fi
done

if [ ! -z "$MISSING" ]; then
  echo "⚠️  WARNING: Found RW codes not in registry:$MISSING"
  echo "Add these to src/registry/rw.ts"
fi

# Check business errors use 200
BUSINESS_CODES=$(grep "envelope: 'business'" src/registry/rw.ts -B2 | grep "code: '" | cut -d"'" -f4)
for code in $BUSINESS_CODES; do
  HTTP=$(grep -A3 "\"$code\":" src/registry/rw.ts | grep "httpDefault:" | grep -o "[0-9]*")
  if [ "$HTTP" != "200" ]; then
    echo "❌ ERROR: Business code $code has HTTP $HTTP instead of 200"
    exit 1
  fi
done

echo "✅ Error policy check passed!"
echo "  - No pure 4xx/5xx responses found"
echo "  - All business errors use HTTP 200"
echo "  - Registry contains $(grep -c "code: 'RW-" src/registry/rw.ts) RW codes"