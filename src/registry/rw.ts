/**
 * TR-12 - Registry Unico Codici RW-* e UX Mapping
 * Bible reference: bibleBet.txt righe 394-399 (6 UX buckets)
 * Bible reference: bibleBet.txt righe 416-423 (mapping RW->UX)
 */

// 6 UX Buckets esatti da Bible (righe 394-399)
export type UXBucket = 
  | 'UX_CONN_ISSUE'           // "Connessione instabile. Riprova."
  | 'UX_SESSION_INVALID'      // "Sessione non valida. Accedi di nuovo."
  | 'UX_LIMITS'               // "Hai raggiunto i limiti di gioco."
  | 'UX_INSUFFICIENT_FUNDS'   // "Saldo insufficiente."
  | 'UX_SERVICE_BUSY'         // "Servizio temporaneamente occupato."
  | 'UX_CONTENT_UNAVAILABLE'; // "Contenuto non disponibile."

export type RWCode = string;
export type Envelope = 'business' | 'protocol';
export type RetryPolicy = 'none' | 'client' | 'server';
export type LogLevel = 'warn' | 'error';

export interface RWEntry {
  code: RWCode;
  envelope: Envelope;
  httpDefault: number;
  ux: UXBucket;
  retry: RetryPolicy;
  logLevel: LogLevel;
  metrics: string;
  description?: string;
}

/**
 * Registry completo dei codici RW-* dalla Bible
 * Mapping basato su Bible righe 416-423
 */
export const REGISTRY: Record<RWCode, RWEntry> = {
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
export function getRW(code: RWCode): RWEntry {
  return REGISTRY[code] || REGISTRY['RW-SYS-000'];
}

/**
 * Check if code is business error (200 + REJECTED)
 */
export function isBusiness(code: RWCode): boolean {
  const entry = getRW(code);
  return entry.envelope === 'business';
}

/**
 * Build protocol error response (4xx/5xx)
 * Returns format: { error: { code, message }, correlationId }
 */
export function buildError(
  code: RWCode,
  opts?: {
    httpOverride?: number;
    message?: string;
    extra?: any;
    correlationId?: string;
  }
): { status: number; body: any } {
  const entry = getRW(code);
  const status = opts?.httpOverride || entry.httpDefault;
  
  const body: any = {
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
export function businessReject(
  code: RWCode,
  extra?: object
): { status: number; body: any } {
  const body: any = {
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
export function sendError(res: any, code: RWCode, opts?: any) {
  const { status, body } = buildError(code, opts);
  return res.status(status).json(body);
}

/**
 * Helper to send business rejection (Express)
 */
export function sendReject(res: any, code: RWCode, extra?: object) {
  const { status, body } = businessReject(code, extra);
  return res.status(status).json(body);
}