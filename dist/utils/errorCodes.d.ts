/**
 * Codici errore Casino secondo Bibbia RAWWAR
 * Bible riga 1009-1011: RW-CAS-001/002/003/006/007/008/009/010
 * Bible riga 1009,1011: RW-RGS-008 (timeout), RW-NET-009, RW-SYS-000
 * Bible riga 719-720: RW-RG-001/002 per Responsible Gaming
 */
export declare const CasinoErrorCodes: {
    readonly PLAYER_NOT_FOUND: "RW-CAS-001";
    readonly INSUFFICIENT_FUNDS: "RW-CAS-002";
    readonly LIMIT_EXCEEDED: "RW-CAS-003";
    readonly INVALID_REQUEST: "RW-CAS-006";
    readonly WEBHOOK_DELIVERY_FAILED: "RW-CAS-007";
    readonly INVALID_CURRENCY: "RW-CAS-008";
    readonly AML_REVIEW_REQUIRED: "RW-CAS-009";
    readonly MISSING_IDEMPOTENCY: "RW-CAS-010";
    readonly RGS_TIMEOUT: "RW-RGS-008";
    readonly GATEWAY_BUSY: "RW-NET-009";
    readonly SYSTEM_ERROR: "RW-SYS-000";
    readonly TRANSACTION_FAILED: "RW-SYS-000";
    readonly SELF_EXCLUSION_ACTIVE: "RW-RG-001";
    readonly COOLING_OFF_ACTIVE: "RW-RG-002";
};
export type CasinoErrorCode = typeof CasinoErrorCodes[keyof typeof CasinoErrorCodes];
//# sourceMappingURL=errorCodes.d.ts.map