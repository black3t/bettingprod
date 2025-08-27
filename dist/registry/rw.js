"use strict";
/**
 * TR-12 - Registry Unico Codici RW-* e UX Mapping
 * Bible reference: bibleBet.txt righe 394-399 (6 UX buckets)
 * Bible reference: bibleBet.txt righe 416-423 (mapping RW->UX)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.REGISTRY = void 0;
exports.getRW = getRW;
exports.isBusiness = isBusiness;
exports.buildError = buildError;
exports.businessReject = businessReject;
exports.sendError = sendError;
exports.sendReject = sendReject;
/**
 * Registry completo dei codici RW-* dalla Bible
 * Mapping basato su Bible righe 416-423
 */
exports.REGISTRY = {
    // ========== RW-CAS-* (Casino errors) ==========
    'RW-CAS-001': {
        code: 'RW-CAS-001',
        envelope: 'business',
        httpDefault: 200,
        ux: 'UX_SERVICE_BUSY',
        retry: 'none',
        logLevel: 'warn',
        metrics: 'casino.player_not_found',
        description: 'Player not found'
    },
    'RW-CAS-002': {
        code: 'RW-CAS-002',
        envelope: 'business',
        httpDefault: 200,
        ux: 'UX_INSUFFICIENT_FUNDS',
        retry: 'none',
        logLevel: 'warn',
        metrics: 'casino.insufficient_funds',
        description: 'Insufficient funds'
    },
    'RW-CAS-003': {
        code: 'RW-CAS-003',
        envelope: 'business',
        httpDefault: 200,
        ux: 'UX_LIMITS',
        retry: 'none',
        logLevel: 'warn',
        metrics: 'casino.limit_exceeded',
        description: 'Limit exceeded'
    },
    'RW-CAS-004': {
        code: 'RW-CAS-004',
        envelope: 'business',
        httpDefault: 200,
        ux: 'UX_SERVICE_BUSY',
        retry: 'none',
        logLevel: 'warn',
        metrics: 'casino.reserved',
        description: 'RESERVED - TODO: define in Bible'
    },
    'RW-CAS-005': {
        code: 'RW-CAS-005',
        envelope: 'business',
        httpDefault: 200,
        ux: 'UX_SERVICE_BUSY',
        retry: 'none',
        logLevel: 'warn',
        metrics: 'casino.reserved',
        description: 'RESERVED - TODO: define in Bible'
    },
    'RW-CAS-006': {
        code: 'RW-CAS-006',
        envelope: 'protocol',
        httpDefault: 422,
        ux: 'UX_SERVICE_BUSY',
        retry: 'none',
        logLevel: 'warn',
        metrics: 'casino.invalid_request',
        description: 'Invalid request/validation error'
    },
    'RW-CAS-007': {
        code: 'RW-CAS-007',
        envelope: 'protocol',
        httpDefault: 502,
        ux: 'UX_SERVICE_BUSY',
        retry: 'server',
        logLevel: 'error',
        metrics: 'casino.webhook_failed',
        description: 'Webhook delivery failed'
    },
    'RW-CAS-008': {
        code: 'RW-CAS-008',
        envelope: 'business',
        httpDefault: 200,
        ux: 'UX_SERVICE_BUSY',
        retry: 'none',
        logLevel: 'warn',
        metrics: 'casino.invalid_currency',
        description: 'Invalid currency'
    },
    'RW-CAS-009': {
        code: 'RW-CAS-009',
        envelope: 'business',
        httpDefault: 200,
        ux: 'UX_SERVICE_BUSY',
        retry: 'none',
        logLevel: 'warn',
        metrics: 'casino.aml_review',
        description: 'AML review required'
    },
    'RW-CAS-010': {
        code: 'RW-CAS-010',
        envelope: 'protocol',
        httpDefault: 422,
        ux: 'UX_SERVICE_BUSY',
        retry: 'none',
        logLevel: 'warn',
        metrics: 'casino.missing_idempotency',
        description: 'Missing idempotency key'
    },
    // ========== RW-RGS-* (RGS errors) ==========
    'RW-RGS-001': {
        code: 'RW-RGS-001',
        envelope: 'business',
        httpDefault: 200,
        ux: 'UX_INSUFFICIENT_FUNDS',
        retry: 'none',
        logLevel: 'warn',
        metrics: 'rgs.insufficient_funds',
        description: 'RGS insufficient funds'
    },
    'RW-RGS-002': {
        code: 'RW-RGS-002',
        envelope: 'business',
        httpDefault: 200,
        ux: 'UX_LIMITS',
        retry: 'none',
        logLevel: 'warn',
        metrics: 'rgs.limit_exceeded',
        description: 'RGS limit exceeded'
    },
    'RW-RGS-003': {
        code: 'RW-RGS-003',
        envelope: 'protocol',
        httpDefault: 401,
        ux: 'UX_SESSION_INVALID',
        retry: 'none',
        logLevel: 'warn',
        metrics: 'rgs.session_invalid',
        description: 'RGS session invalid'
    },
    'RW-RGS-004': {
        code: 'RW-RGS-004',
        envelope: 'protocol',
        httpDefault: 409,
        ux: 'UX_SERVICE_BUSY',
        retry: 'none',
        logLevel: 'warn',
        metrics: 'rgs.round_not_open',
        description: 'Round not open'
    },
    'RW-RGS-005': {
        code: 'RW-RGS-005',
        envelope: 'protocol',
        httpDefault: 409,
        ux: 'UX_SERVICE_BUSY',
        retry: 'none',
        logLevel: 'warn',
        metrics: 'rgs.round_already_closed',
        description: 'Round already closed'
    },
    'RW-RGS-006': {
        code: 'RW-RGS-006',
        envelope: 'protocol',
        httpDefault: 422,
        ux: 'UX_CONTENT_UNAVAILABLE',
        retry: 'none',
        logLevel: 'warn',
        metrics: 'rgs.invalid_game_id',
        description: 'Invalid game ID'
    },
    'RW-RGS-007': {
        code: 'RW-RGS-007',
        envelope: 'protocol',
        httpDefault: 422,
        ux: 'UX_SERVICE_BUSY',
        retry: 'none',
        logLevel: 'warn',
        metrics: 'rgs.invalid_amount',
        description: 'Invalid amount'
    },
    'RW-RGS-008': {
        code: 'RW-RGS-008',
        envelope: 'protocol',
        httpDefault: 504,
        ux: 'UX_SERVICE_BUSY',
        retry: 'server',
        logLevel: 'error',
        metrics: 'rgs.timeout',
        description: 'RGS timeout'
    },
    // ========== RW-RG-* (Responsible Gaming) ==========
    'RW-RG-001': {
        code: 'RW-RG-001',
        envelope: 'business',
        httpDefault: 200,
        ux: 'UX_LIMITS',
        retry: 'none',
        logLevel: 'warn',
        metrics: 'rg.self_exclusion',
        description: 'Self-exclusion active'
    },
    'RW-RG-002': {
        code: 'RW-RG-002',
        envelope: 'business',
        httpDefault: 200,
        ux: 'UX_LIMITS',
        retry: 'none',
        logLevel: 'warn',
        metrics: 'rg.cooling_off',
        description: 'Cooling-off active'
    },
    // ========== RW-DB-* (Database errors) ==========
    'RW-DB-003': {
        code: 'RW-DB-003',
        envelope: 'protocol',
        httpDefault: 503,
        ux: 'UX_CONN_ISSUE',
        retry: 'server',
        logLevel: 'error',
        metrics: 'db.connection_failed',
        description: 'Database connection failed'
    },
    // ========== RW-NET-* (Network errors) ==========
    'RW-NET-009': {
        code: 'RW-NET-009',
        envelope: 'protocol',
        httpDefault: 503,
        ux: 'UX_SERVICE_BUSY',
        retry: 'server',
        logLevel: 'error',
        metrics: 'net.gateway_busy',
        description: 'Gateway busy/overloaded'
    },
    // ========== RW-SYS-* (System errors) ==========
    'RW-SYS-000': {
        code: 'RW-SYS-000',
        envelope: 'protocol',
        httpDefault: 500,
        ux: 'UX_SERVICE_BUSY',
        retry: 'server',
        logLevel: 'error',
        metrics: 'sys.internal_error',
        description: 'Internal system error (fallback)'
    }
};
/**
 * Get registry entry with fallback to RW-SYS-000
 */
function getRW(code) {
    return exports.REGISTRY[code] || exports.REGISTRY['RW-SYS-000'];
}
/**
 * Check if code is business error (200 + REJECTED)
 */
function isBusiness(code) {
    const entry = getRW(code);
    return entry.envelope === 'business';
}
/**
 * Build protocol error response (4xx/5xx)
 * Returns format: { error: { code, message }, correlationId }
 */
function buildError(code, opts) {
    const entry = getRW(code);
    const status = opts?.httpOverride || entry.httpDefault;
    const body = {
        error: {
            code,
            message: opts?.message || entry.description || 'Error occurred'
        }
    };
    if (opts?.correlationId) {
        body.correlationId = opts.correlationId;
    }
    if (opts?.extra) {
        Object.assign(body, opts.extra);
    }
    return { status, body };
}
/**
 * Build business rejection response (always 200)
 * Returns format: { status: "REJECTED", reason: code }
 */
function businessReject(code, extra) {
    const body = {
        status: 'REJECTED',
        reason: code
    };
    if (extra) {
        Object.assign(body, extra);
    }
    return { status: 200, body };
}
/**
 * Helper to send error response (Express)
 */
function sendError(res, code, opts) {
    const { status, body } = buildError(code, opts);
    return res.status(status).json(body);
}
/**
 * Helper to send business rejection (Express)
 */
function sendReject(res, code, extra) {
    const { status, body } = businessReject(code, extra);
    return res.status(status).json(body);
}
//# sourceMappingURL=rw.js.map