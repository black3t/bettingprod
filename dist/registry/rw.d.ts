/**
 * TR-12 - Registry Unico Codici RW-* e UX Mapping
 * Bible reference: bibleBet.txt righe 394-399 (6 UX buckets)
 * Bible reference: bibleBet.txt righe 416-423 (mapping RW->UX)
 */
export type UXBucket = 'UX_CONN_ISSUE' | 'UX_SESSION_INVALID' | 'UX_LIMITS' | 'UX_INSUFFICIENT_FUNDS' | 'UX_SERVICE_BUSY' | 'UX_CONTENT_UNAVAILABLE';
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
export declare const REGISTRY: Record<RWCode, RWEntry>;
/**
 * Get registry entry with fallback to RW-SYS-000
 */
export declare function getRW(code: RWCode): RWEntry;
/**
 * Check if code is business error (200 + REJECTED)
 */
export declare function isBusiness(code: RWCode): boolean;
/**
 * Build protocol error response (4xx/5xx)
 * Returns format: { error: { code, message }, correlationId }
 */
export declare function buildError(code: RWCode, opts?: {
    httpOverride?: number;
    message?: string;
    extra?: any;
    correlationId?: string;
}): {
    status: number;
    body: any;
};
/**
 * Build business rejection response (always 200)
 * Returns format: { status: "REJECTED", reason: code }
 */
export declare function businessReject(code: RWCode, extra?: object): {
    status: number;
    body: any;
};
/**
 * Helper to send error response (Express)
 */
export declare function sendError(res: any, code: RWCode, opts?: any): any;
/**
 * Helper to send business rejection (Express)
 */
export declare function sendReject(res: any, code: RWCode, extra?: object): any;
//# sourceMappingURL=rw.d.ts.map