"use strict";
/**
 * Codici errore Casino secondo Bibbia RAWWAR
 * Bible riga 1009-1011: RW-CAS-001/002/003/006/007/008/009/010
 * Bible riga 1009,1011: RW-RGS-008 (timeout), RW-NET-009, RW-SYS-000
 * Bible riga 719-720: RW-RG-001/002 per Responsible Gaming
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CasinoErrorCodes = void 0;
exports.CasinoErrorCodes = {
    // Casino errors (RW-CAS-*) dalla Bible
    PLAYER_NOT_FOUND: 'RW-CAS-001',
    INSUFFICIENT_FUNDS: 'RW-CAS-002',
    LIMIT_EXCEEDED: 'RW-CAS-003',
    INVALID_REQUEST: 'RW-CAS-006',
    WEBHOOK_DELIVERY_FAILED: 'RW-CAS-007',
    INVALID_CURRENCY: 'RW-CAS-008',
    AML_REVIEW_REQUIRED: 'RW-CAS-009',
    MISSING_IDEMPOTENCY: 'RW-CAS-010',
    // RGS timeout (Bible riga 1009)
    RGS_TIMEOUT: 'RW-RGS-008',
    // Network errors (Bible riga 1012)
    GATEWAY_BUSY: 'RW-NET-009',
    // System errors (Bible riga 1010)
    SYSTEM_ERROR: 'RW-SYS-000',
    TRANSACTION_FAILED: 'RW-SYS-000',
    // Responsible Gaming (Bible riga 719-720)
    SELF_EXCLUSION_ACTIVE: 'RW-RG-001',
    COOLING_OFF_ACTIVE: 'RW-RG-002'
};
//# sourceMappingURL=errorCodes.js.map