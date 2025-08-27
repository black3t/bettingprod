# Test Coverage Matrix - 49 Tests

| ID Test | Feature | Presente? | File attuali | Gap tecnico | Fix pianificato |
|---------|---------|-----------|--------------|-------------|-----------------|
| T1.1 | Schema debit valido | Y | walletRoutes.ts, WalletService.ts | - | OK |
| T1.2 | Reject missing idempotency | Y | validation.ts | - | OK |
| T1.3 | Reject invalid correlation | Y | middleware | - | OK |
| T1.4 | Schema credit valido | Y | walletRoutes.ts | - | OK |
| T1.5 | Schema limits check | Y | limitsRoutes.ts | - | OK |
| T1.6 | Use allowed error codes | Y | errorCodes.ts | - | OK |
| T1.7 | Never return outside codes | Y | errorHandler | - | OK |
| T2.1 | No duplicate debit | Y | WalletService.ts | - | OK |
| T2.2 | No duplicate credit | N | WalletService.ts | Bug idempotenza | Fix storeIdempotency |
| T2.3 | Multiple credit replays | Y | WalletService.ts | - | OK |
| T2.4 | Store consistent response | Y | idempotency store | - | OK |
| T2.5 | Different keys separate | Y | WalletService.ts | - | OK |
| T3.1 | Reject exceeding balance | Y | WalletService.ts | - | OK |
| T3.2 | Reject negative balance | Y | WalletService.ts | - | OK |
| T3.3 | Allow equal to balance | Y | WalletService.ts | - | OK |
| T4.1 | Reject mismatched currency debit | Y | WalletService.ts | - | OK |
| T4.2 | Reject mismatched currency credit | Y | WalletService.ts | - | OK |
| T4.3 | Accept matching currency | Y | WalletService.ts | - | OK |
| T6.1 | Balance integrity round-trip | Y | WalletService.ts | - | OK |
| T6.2 | Multiple round-trips | N | WalletService.ts | Bug test | Fix test |
| T5.1 | Reject below minBet | Y | LimitsService.ts | - | OK |
| T5.2 | Reject above maxBet | Y | LimitsService.ts | - | OK |
| T5.3 | Accept within range | Y | LimitsService.ts | - | OK |
| T5.4 | Accept equal minBet | Y | LimitsService.ts | - | OK |
| T5.5 | Accept equal maxBet | Y | LimitsService.ts | - | OK |
| T5.6 | Reject exceeding balance | Y | LimitsService.ts | - | OK |
| T5.7 | Accept within balance | Y | LimitsService.ts | - | OK |
| T5.8 | Handle missing player | Y | LimitsService.ts | - | OK |
| T5.9 | Use allowed error codes | Y | LimitsService.ts | - | OK |
| T8.1 | Return RW-RGS-008 on timeout | N | - | Timeout middleware mancante | NEW timeout.ts |
| T8.2 | Return RW-SYS-000 on error | N | - | Error handler incompleto | Update errorHandler |
| T8.3 | Handle concurrent requests | N | - | Concurrency control mancante | NEW concurrent.ts |
| T9.1 | Send playerExcluded webhook | N | - | Webhook service mancante | NEW WebhookService |
| T9.2 | Send balanceChanged webhook | N | - | Webhook service mancante | NEW WebhookService |
| T9.3 | Retry webhook with backoff | N | - | Retry logic mancante | NEW retry logic |
| T9.4 | Correct webhook error codes | N | - | Webhook error handling | NEW webhook errors |
| T12.1 | Report healthy | N | - | Health endpoint mancante | NEW healthRoutes.ts |
| T12.2 | Report unhealthy DB down | Y | - | Partial | Update health |
| T12.3 | Include timestamp | Y | - | Partial | Update health |
| T12.4 | Report mode correctly | Y | - | Partial | Update health |
| T12.5 | Handle Redis down gracefully | N | - | Redis fallback mancante | NEW redis wrapper |
| T10.1 | No PII in logs | N | logger.ts | Missing redaction | Update logger |
| T10.2 | Log pseudonymous IDs | Y | logger.ts | - | OK |
| T10.3 | Retention policies | Y | - | - | OK |
| T10.4 | Sanitize errors | Y | errorHandler | - | OK |
| T11.1 | Banker's rounding | Y | WalletService.ts | - | OK |
| T11.2 | Return 2-decimal strings | Y | WalletService.ts | - | OK |
| T11.3 | Store amounts consistently | Y | WalletService.ts | - | OK |
| T11.4 | Handle edge cases | N | WalletService.ts | Missing validation | Fix validation |

## Summary:
- **Passing**: 36/49 (73.5%)
- **Failing**: 13/49 (26.5%)
- **Main gaps**: Webhooks (4), Health (2), Timeout (2), Concurrency (1), Logging (1), Edge cases (1), Idempotency (2)