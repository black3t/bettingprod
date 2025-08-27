# TR-13: Close Drift & Missing Endpoints RGS⇄Casino

## Overview
Implementation of all 21 RGS⇄Casino communication endpoints per Bible specification with full compliance to error handling, idempotency, and deprecation policies.

## Changes

### New Endpoints
- **POST /wallet/cancel** - Cancel unsettled financial operations with 48h idempotency
- **POST /rgs/limitsReached** - Webhook for limit notifications (202 + outbox)
- **POST /rgs/kycUpdated** - Webhook for KYC status changes (202 + outbox)
- **POST /round/cancel** - Cancel game rounds with idempotency
- **POST /round/rollback** - Canonical path for transaction rollback
- **POST /session/heartbeat** - Alias for keepalive (deprecated)

### Fixed Endpoints
- **POST /limits/check** - Fixed buildError import from registry/rw, added idempotency
- **GET /player/status** - Changed from POST to GET (canonical), POST deprecated
- **GET /kyc/status** - Changed from POST to GET (canonical), POST deprecated
- **GET /kyc/exclusions** - Changed from POST to GET (canonical), POST deprecated
- **POST /health** - Returns 405 Method Not Allowed with Allow: GET header

### Deprecation Aliases
All deprecated endpoints include:
- `Deprecation: true` header
- `Sunset: <date+90days>` header  
- `Link: <canonical>; rel="successor-version"` header

Deprecated aliases:
- POST /player/status → GET /player/status
- POST /kyc/status → GET /kyc/status
- POST /kyc/exclusions → GET /kyc/exclusions
- POST /session/heartbeat → POST /session/keepalive
- POST /rollback → POST /round/rollback

### Technical Improvements
- All errors use buildError() from registry/rw (no pure 4xx/5xx)
- 48h idempotency window for financial/round operations
- Webhook 202 + outbox pattern for all Casino→RGS webhooks
- Money format "xx.yy" validation everywhere
- X-Correlation-Id UUID v4 propagation
- Business rejections return HTTP 200 with status:"REJECTED"

### Testing
- Added comprehensive contract tests for all 21 endpoints
- Idempotency replay tests for new financial operations
- Webhook 202 + outbox failure path tests
- Deprecation header validation tests

### Documentation
- OpenAPI 3.0 specification at docs/openapi/rgs_casino.yaml
- Contract guard script at scripts/check-openapi-contract.sh
- All endpoints documented with request/response schemas

## Migration Guide

### For RGS Integrators
1. Update to use GET for read-only operations (player/status, kyc/*)
2. POST methods still work but are deprecated (90-day sunset)
3. New /wallet/cancel endpoint available for transaction reversals
4. Use canonical /round/* paths instead of root-level aliases

### For Casino Integrators  
1. Implement new webhook handlers for limitsReached and kycUpdated
2. All webhooks now return 202 on forward failure (automatic retry)
3. Ensure X-Correlation-Id UUID v4 format in all requests

## Compliance Status
- ✅ All 21 endpoints implemented
- ✅ Zero pure 4xx/5xx responses  
- ✅ 48h idempotency for financial operations
- ✅ Outbox pattern for webhooks
- ✅ Dual-mount preserved (API_BASE_PATH + COMPAT_ROUTES)
- ✅ All existing tests remain green
- ✅ CI guards pass with zero violations