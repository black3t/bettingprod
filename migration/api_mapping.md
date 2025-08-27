# API Mapping - Casino Mock Refactor

## Endpoint Mapping Table

| Vecchio endpoint | Metodo | Nuovo endpoint (Bible) | Cambi UI richiesti | Note (adapter codici RW) |
|-----------------|--------|------------------------|-------------------|-------------------------|
| /wallet/debit | POST | /casino/api/v1/wallet/debit | Aggiornare base path | RW-CAS-001 (insufficient), RW-CAS-002 (blocked) |
| /wallet/credit | POST | /casino/api/v1/wallet/credit | Aggiornare base path | RW-CAS-006 (invalid), RW-CAS-008 (correlation) |
| /limits/check | POST | /casino/api/v1/limits/check | Aggiornare base path | RW-CAS-003 (limit exceeded) |
| /user/profile | GET | /casino/api/v1/player/status | Rinominare endpoint | Nuovo formato risposta |
| /auth/login | POST | /casino/api/v1/auth/login | Mantenere per UI | Cookie httpOnly sid |
| /auth/signup | POST | /casino/api/v1/auth/signup | Mantenere per UI | Non canonico ma necessario |
| /game/launch | POST | Non canonico | Mantenere locale | Solo per UI demo |
| - | POST | /casino/api/v1/rgs/playerExcluded | N/A - Webhook | NEW - RW-CAS-007 delivery |
| - | POST | /casino/api/v1/rgs/balanceChanged | N/A - Webhook | NEW - RW-NET-009 busy |
| - | GET | /casino/api/v1/admin/health | N/A - Admin | NEW - health check |

## Note implementative:
- Tutti gli endpoint canonici useranno prefix `/casino/api/v1/`
- idempotencyKey nel BODY per debit/credit (non headers)
- Money format: stringhe "10.00", internamente minor units
- Timeout 2s HTTP, ritorna RW-RGS-008
- Webhook con retry backoff esponenziale