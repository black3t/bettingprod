"use strict";
/**
 * TR-12 - Unit tests for RW Registry
 */
Object.defineProperty(exports, "__esModule", { value: true });
const rw_1 = require("../rw");
describe('RW Registry', () => {
    describe('Registry completeness', () => {
        it('should have all RW-CAS codes (001-010)', () => {
            for (let i = 1; i <= 10; i++) {
                const code = `RW-CAS-${String(i).padStart(3, '0')}`;
                expect(rw_1.REGISTRY[code]).toBeDefined();
                expect(rw_1.REGISTRY[code].code).toBe(code);
            }
        });
        it('should have all RW-RGS codes (001-008)', () => {
            for (let i = 1; i <= 8; i++) {
                const code = `RW-RGS-${String(i).padStart(3, '0')}`;
                expect(rw_1.REGISTRY[code]).toBeDefined();
                expect(rw_1.REGISTRY[code].code).toBe(code);
            }
        });
        it('should have RW-RG codes', () => {
            expect(rw_1.REGISTRY['RW-RG-001']).toBeDefined();
            expect(rw_1.REGISTRY['RW-RG-002']).toBeDefined();
        });
        it('should have infrastructure codes', () => {
            expect(rw_1.REGISTRY['RW-DB-003']).toBeDefined();
            expect(rw_1.REGISTRY['RW-NET-009']).toBeDefined();
            expect(rw_1.REGISTRY['RW-SYS-000']).toBeDefined();
        });
    });
    describe('UX Bucket mapping', () => {
        const uxBuckets = [
            'UX_CONN_ISSUE',
            'UX_SESSION_INVALID',
            'UX_LIMITS',
            'UX_INSUFFICIENT_FUNDS',
            'UX_SERVICE_BUSY',
            'UX_CONTENT_UNAVAILABLE'
        ];
        it('should use only valid UX buckets', () => {
            Object.values(rw_1.REGISTRY).forEach(entry => {
                expect(uxBuckets).toContain(entry.ux);
            });
        });
        it('should map insufficient funds correctly', () => {
            expect(rw_1.REGISTRY['RW-CAS-002'].ux).toBe('UX_INSUFFICIENT_FUNDS');
            expect(rw_1.REGISTRY['RW-RGS-001'].ux).toBe('UX_INSUFFICIENT_FUNDS');
        });
        it('should map limits correctly', () => {
            expect(rw_1.REGISTRY['RW-CAS-003'].ux).toBe('UX_LIMITS');
            expect(rw_1.REGISTRY['RW-RGS-002'].ux).toBe('UX_LIMITS');
            expect(rw_1.REGISTRY['RW-RG-001'].ux).toBe('UX_LIMITS');
            expect(rw_1.REGISTRY['RW-RG-002'].ux).toBe('UX_LIMITS');
        });
        it('should map session errors correctly', () => {
            expect(rw_1.REGISTRY['RW-RGS-003'].ux).toBe('UX_SESSION_INVALID');
        });
        it('should map connection issues correctly', () => {
            expect(rw_1.REGISTRY['RW-DB-003'].ux).toBe('UX_CONN_ISSUE');
        });
    });
    describe('Envelope policy', () => {
        it('should mark business errors correctly', () => {
            // Business errors (200 + REJECTED)
            expect(rw_1.REGISTRY['RW-CAS-002'].envelope).toBe('business');
            expect(rw_1.REGISTRY['RW-CAS-003'].envelope).toBe('business');
            expect(rw_1.REGISTRY['RW-CAS-008'].envelope).toBe('business');
            expect(rw_1.REGISTRY['RW-RGS-001'].envelope).toBe('business');
            expect(rw_1.REGISTRY['RW-RGS-002'].envelope).toBe('business');
            expect(rw_1.REGISTRY['RW-RG-001'].envelope).toBe('business');
            expect(rw_1.REGISTRY['RW-RG-002'].envelope).toBe('business');
        });
        it('should mark protocol errors correctly', () => {
            // Protocol/infra errors (4xx/5xx)
            // Note: RW-CAS-001 is now business per GPT directive
            expect(rw_1.REGISTRY['RW-CAS-006'].envelope).toBe('protocol');
            expect(rw_1.REGISTRY['RW-CAS-007'].envelope).toBe('protocol');
            expect(rw_1.REGISTRY['RW-CAS-010'].envelope).toBe('protocol');
            expect(rw_1.REGISTRY['RW-RGS-003'].envelope).toBe('protocol');
            expect(rw_1.REGISTRY['RW-RGS-008'].envelope).toBe('protocol');
            expect(rw_1.REGISTRY['RW-DB-003'].envelope).toBe('protocol');
            expect(rw_1.REGISTRY['RW-NET-009'].envelope).toBe('protocol');
            expect(rw_1.REGISTRY['RW-SYS-000'].envelope).toBe('protocol');
        });
    });
    describe('HTTP status codes', () => {
        it('should use 200 for all business errors', () => {
            Object.values(rw_1.REGISTRY).forEach(entry => {
                if (entry.envelope === 'business') {
                    expect(entry.httpDefault).toBe(200);
                }
            });
        });
        it('should never use pure 400', () => {
            Object.values(rw_1.REGISTRY).forEach(entry => {
                // 400 is allowed only with specific codes like RW-CAS-010
                if (entry.httpDefault === 400) {
                    expect(entry.code).toMatch(/^RW-/);
                }
            });
        });
        it('should use appropriate 4xx/5xx for protocol errors', () => {
            // RW-CAS-001 is now business (200)
            expect(rw_1.REGISTRY['RW-CAS-006'].httpDefault).toBe(422); // Validation
            expect(rw_1.REGISTRY['RW-CAS-010'].httpDefault).toBe(422); // Missing idempotency
            expect(rw_1.REGISTRY['RW-RGS-003'].httpDefault).toBe(401); // Auth
            expect(rw_1.REGISTRY['RW-RGS-008'].httpDefault).toBe(504); // Timeout
            expect(rw_1.REGISTRY['RW-DB-003'].httpDefault).toBe(503); // Service unavailable
            expect(rw_1.REGISTRY['RW-SYS-000'].httpDefault).toBe(500); // Internal error
        });
    });
    describe('getRW function', () => {
        it('should return entry for known codes', () => {
            const entry = (0, rw_1.getRW)('RW-CAS-002');
            expect(entry.code).toBe('RW-CAS-002');
            expect(entry.ux).toBe('UX_INSUFFICIENT_FUNDS');
        });
        it('should fallback to RW-SYS-000 for unknown codes', () => {
            const entry = (0, rw_1.getRW)('RW-UNKNOWN-999');
            expect(entry.code).toBe('RW-SYS-000');
            expect(entry.ux).toBe('UX_SERVICE_BUSY');
        });
    });
    describe('isBusiness function', () => {
        it('should identify business errors', () => {
            expect((0, rw_1.isBusiness)('RW-CAS-002')).toBe(true);
            expect((0, rw_1.isBusiness)('RW-CAS-003')).toBe(true);
            expect((0, rw_1.isBusiness)('RW-RGS-001')).toBe(true);
            expect((0, rw_1.isBusiness)('RW-RG-001')).toBe(true);
        });
        it('should identify protocol errors', () => {
            // RW-CAS-001 is now business
            expect((0, rw_1.isBusiness)('RW-CAS-006')).toBe(false);
            expect((0, rw_1.isBusiness)('RW-RGS-008')).toBe(false);
            expect((0, rw_1.isBusiness)('RW-SYS-000')).toBe(false);
        });
    });
    describe('buildError function', () => {
        it('should build protocol error with default status', () => {
            const result = (0, rw_1.buildError)('RW-CAS-006');
            expect(result.status).toBe(422);
            expect(result.body.error.code).toBe('RW-CAS-006');
        });
        it('should allow HTTP override', () => {
            const result = (0, rw_1.buildError)('RW-CAS-006', { httpOverride: 400 });
            expect(result.status).toBe(400);
        });
        it('should include correlation ID when provided', () => {
            const result = (0, rw_1.buildError)('RW-CAS-006', { correlationId: 'test-123' });
            expect(result.body.correlationId).toBe('test-123');
        });
        it('should include extra fields', () => {
            const result = (0, rw_1.buildError)('RW-CAS-006', { extra: { field: 'value' } });
            expect(result.body.field).toBe('value');
        });
        it('should fallback to RW-SYS-000 for unknown codes', () => {
            const result = (0, rw_1.buildError)('RW-UNKNOWN-999');
            expect(result.status).toBe(500);
            expect(result.body.error.code).toBe('RW-UNKNOWN-999');
        });
    });
    describe('businessReject function', () => {
        it('should always return 200 status', () => {
            const result = (0, rw_1.businessReject)('RW-CAS-002');
            expect(result.status).toBe(200);
        });
        it('should format as REJECTED with reason', () => {
            const result = (0, rw_1.businessReject)('RW-CAS-002');
            expect(result.body.status).toBe('REJECTED');
            expect(result.body.reason).toBe('RW-CAS-002');
        });
        it('should include extra fields', () => {
            const result = (0, rw_1.businessReject)('RW-CAS-002', { newBalance: '100.00' });
            expect(result.body.newBalance).toBe('100.00');
        });
        it('should work with any code (even unknown)', () => {
            const result = (0, rw_1.businessReject)('RW-UNKNOWN-999');
            expect(result.status).toBe(200);
            expect(result.body.status).toBe('REJECTED');
            expect(result.body.reason).toBe('RW-UNKNOWN-999');
        });
    });
    describe('Retry policy', () => {
        it('should mark server errors as retryable', () => {
            expect(rw_1.REGISTRY['RW-RGS-008'].retry).toBe('server'); // Timeout
            expect(rw_1.REGISTRY['RW-DB-003'].retry).toBe('server'); // DB down
            expect(rw_1.REGISTRY['RW-NET-009'].retry).toBe('server'); // Gateway busy
            expect(rw_1.REGISTRY['RW-SYS-000'].retry).toBe('server'); // System error
        });
        it('should mark business errors as non-retryable', () => {
            expect(rw_1.REGISTRY['RW-CAS-002'].retry).toBe('none'); // Insufficient funds
            expect(rw_1.REGISTRY['RW-CAS-003'].retry).toBe('none'); // Limit exceeded
            expect(rw_1.REGISTRY['RW-RG-001'].retry).toBe('none'); // Self-exclusion
        });
    });
    describe('Metrics tags', () => {
        it('should have unique metrics tags', () => {
            const tags = new Set();
            Object.values(rw_1.REGISTRY).forEach(entry => {
                // Reserved codes can share metrics
                if (!entry.description?.includes('RESERVED')) {
                    expect(tags.has(entry.metrics)).toBe(false);
                    tags.add(entry.metrics);
                }
            });
        });
    });
});
//# sourceMappingURL=rw.test.js.map