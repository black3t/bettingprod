"use strict";
/**
 * TR-12 - Smoke test for 404 handler with buildError
 */
Object.defineProperty(exports, "__esModule", { value: true });
const rw_1 = require("../rw");
describe('404 Handler with buildError', () => {
    it('should handle 404 with httpOverride correctly', () => {
        const correlationId = '550e8400-e29b-41d4-a716-446655440001';
        const { status, body } = (0, rw_1.buildError)('RW-SYS-000', {
            httpOverride: 404,
            message: 'Not found',
            correlationId
        });
        // Should return 404 status despite RW-SYS-000 default being 500
        expect(status).toBe(404);
        // Should have proper error structure
        expect(body).toEqual({
            error: {
                code: 'RW-SYS-000',
                message: 'Not found'
            },
            correlationId
        });
    });
    it('should handle 404 without correlationId', () => {
        const { status, body } = (0, rw_1.buildError)('RW-SYS-000', {
            httpOverride: 404,
            message: 'Resource not found'
        });
        expect(status).toBe(404);
        expect(body.error.code).toBe('RW-SYS-000');
        expect(body.error.message).toBe('Resource not found');
        expect(body.correlationId).toBeUndefined();
    });
    it('should use correct UX bucket for 404', () => {
        const { status, body } = (0, rw_1.buildError)('RW-SYS-000', {
            httpOverride: 404,
            message: 'Not found'
        });
        // Verify it's using RW-SYS-000 which maps to UX_SERVICE_BUSY
        expect(status).toBe(404);
        expect(body.error.code).toBe('RW-SYS-000');
    });
});
//# sourceMappingURL=rw-404.test.js.map