"use strict";
/**
 * TR-12 - Contract tests for RW codes
 * Verifica HTTP status, envelope, e UX bucket per ogni codice
 */
Object.defineProperty(exports, "__esModule", { value: true });
const rw_1 = require("../rw");
describe('RW Contract Tests', () => {
    describe('Business errors (200 + REJECTED)', () => {
        const businessCodes = [
            'RW-CAS-001', 'RW-CAS-002', 'RW-CAS-003', 'RW-CAS-004', 'RW-CAS-005',
            'RW-CAS-008', 'RW-CAS-009',
            'RW-RGS-001', 'RW-RGS-002',
            'RW-RG-001', 'RW-RG-002'
        ];
        businessCodes.forEach(code => {
            it(`${code} should return 200 with REJECTED status`, () => {
                const entry = rw_1.REGISTRY[code];
                expect(entry).toBeDefined();
                expect(entry.envelope).toBe('business');
                expect(entry.httpDefault).toBe(200);
                // Test businessReject
                const { status, body } = (0, rw_1.businessReject)(code);
                expect(status).toBe(200);
                expect(body.status).toBe('REJECTED');
                expect(body.reason).toBe(code);
            });
        });
    });
    describe('Protocol errors (4xx/5xx)', () => {
        const protocolTests = [
            { code: 'RW-CAS-006', expectedHttp: 422, ux: 'UX_SERVICE_BUSY' },
            { code: 'RW-CAS-007', expectedHttp: 502, ux: 'UX_SERVICE_BUSY' },
            { code: 'RW-CAS-010', expectedHttp: 422, ux: 'UX_SERVICE_BUSY' },
            { code: 'RW-RGS-003', expectedHttp: 401, ux: 'UX_SESSION_INVALID' },
            { code: 'RW-RGS-004', expectedHttp: 409, ux: 'UX_SERVICE_BUSY' },
            { code: 'RW-RGS-005', expectedHttp: 409, ux: 'UX_SERVICE_BUSY' },
            { code: 'RW-RGS-006', expectedHttp: 422, ux: 'UX_CONTENT_UNAVAILABLE' },
            { code: 'RW-RGS-007', expectedHttp: 422, ux: 'UX_SERVICE_BUSY' },
            { code: 'RW-RGS-008', expectedHttp: 504, ux: 'UX_SERVICE_BUSY' },
            { code: 'RW-DB-003', expectedHttp: 503, ux: 'UX_CONN_ISSUE' },
            { code: 'RW-NET-009', expectedHttp: 503, ux: 'UX_SERVICE_BUSY' },
            { code: 'RW-SYS-000', expectedHttp: 500, ux: 'UX_SERVICE_BUSY' }
        ];
        protocolTests.forEach(({ code, expectedHttp, ux }) => {
            it(`${code} should return ${expectedHttp} with error envelope and ${ux}`, () => {
                const entry = rw_1.REGISTRY[code];
                expect(entry).toBeDefined();
                expect(entry.envelope).toBe('protocol');
                expect(entry.httpDefault).toBe(expectedHttp);
                expect(entry.ux).toBe(ux);
                // Test buildError
                const { status, body } = (0, rw_1.buildError)(code);
                expect(status).toBe(expectedHttp);
                expect(body.error).toBeDefined();
                expect(body.error.code).toBe(code);
            });
        });
    });
    describe('UX Bucket mappings', () => {
        const uxMappings = [
            { codes: ['RW-CAS-002', 'RW-RGS-001'], ux: 'UX_INSUFFICIENT_FUNDS' },
            { codes: ['RW-CAS-003', 'RW-RGS-002', 'RW-RG-001', 'RW-RG-002'], ux: 'UX_LIMITS' },
            { codes: ['RW-RGS-003'], ux: 'UX_SESSION_INVALID' },
            { codes: ['RW-DB-003'], ux: 'UX_CONN_ISSUE' }
        ];
        uxMappings.forEach(({ codes, ux }) => {
            codes.forEach(code => {
                it(`${code} should map to ${ux}`, () => {
                    const entry = rw_1.REGISTRY[code];
                    expect(entry).toBeDefined();
                    expect(entry.ux).toBe(ux);
                });
            });
        });
    });
    describe('Error response format', () => {
        it('buildError should include correlation ID when provided', () => {
            const { body } = (0, rw_1.buildError)('RW-CAS-006', {
                message: 'Test error',
                correlationId: 'test-123'
            });
            expect(body.error.code).toBe('RW-CAS-006');
            expect(body.error.message).toBe('Test error');
            expect(body.correlationId).toBe('test-123');
        });
        it('businessReject should include extra fields', () => {
            const { body } = (0, rw_1.businessReject)('RW-CAS-002', {
                newBalance: '100.00'
            });
            expect(body.status).toBe('REJECTED');
            expect(body.reason).toBe('RW-CAS-002');
            expect(body.newBalance).toBe('100.00');
        });
    });
    describe('Reserved codes', () => {
        it('RW-CAS-004 and RW-CAS-005 should be marked as RESERVED', () => {
            expect(rw_1.REGISTRY['RW-CAS-004'].description).toContain('RESERVED');
            expect(rw_1.REGISTRY['RW-CAS-005'].description).toContain('RESERVED');
        });
    });
    describe('Retry policy', () => {
        const retryableCodes = ['RW-RGS-008', 'RW-DB-003', 'RW-NET-009', 'RW-SYS-000', 'RW-CAS-007'];
        const nonRetryableCodes = ['RW-CAS-002', 'RW-CAS-003', 'RW-RG-001', 'RW-RG-002'];
        retryableCodes.forEach(code => {
            it(`${code} should be marked as retryable`, () => {
                expect(rw_1.REGISTRY[code].retry).toBe('server');
            });
        });
        nonRetryableCodes.forEach(code => {
            it(`${code} should not be retryable`, () => {
                expect(rw_1.REGISTRY[code].retry).toBe('none');
            });
        });
    });
});
//# sourceMappingURL=rw-contract.test.js.map