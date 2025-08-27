"use strict";
/**
 * T1 - Contract REST (schema + error registry)
 * Obiettivo: ogni risposta rispetta OpenAPI + solo codici ammessi per Casino
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const express_1 = __importDefault(require("express"));
const uuid_1 = require("uuid");
const walletRoutes_1 = __importDefault(require("../routes/walletRoutes"));
const limitsRoutes_1 = __importDefault(require("../routes/limitsRoutes"));
// Codici ammessi dalla bibbia §22.6
const ALLOWED_WALLET_CODES = [
    'RW-CAS-001', // Insufficient funds
    'RW-CAS-002', // Player blocked  
    'RW-CAS-006', // Invalid request
    'RW-CAS-008', // Invalid correlation ID
    'RW-CAS-010', // Missing idempotency
    'RW-RGS-008', // Timeout
    'RW-SYS-000' // System error
];
const ALLOWED_LIMITS_CODES = [
    'RW-CAS-003', // Limit exceeded
    'RW-CAS-006', // Invalid request (validation errors)
    'RW-RGS-008', // Timeout
    'RW-SYS-000' // System error
];
describe('T1 - Contract REST', () => {
    let app;
    beforeEach(() => {
        app = (0, express_1.default)();
        app.use(express_1.default.json());
        // Correlation ID middleware
        app.use((req, res, next) => {
            const correlationId = req.headers['x-correlation-id'] || (0, uuid_1.v4)();
            const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
            if (!UUID_V4_REGEX.test(correlationId)) {
                return res.status(400).json({
                    error: {
                        code: 'RW-CAS-008',
                        message: 'X-Correlation-Id must be valid UUID v4 format'
                    }
                });
            }
            req.correlationId = correlationId;
            res.setHeader('X-Correlation-Id', correlationId);
            next();
        });
        app.use('/wallet', walletRoutes_1.default);
        app.use('/limits', limitsRoutes_1.default);
    });
    describe('POST /wallet/debit', () => {
        it('should return valid schema for successful debit', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/wallet/debit')
                .set('X-Correlation-Id', (0, uuid_1.v4)())
                .set('Authorization', 'Bearer test_rgs_key')
                .set('Idempotency-Key', (0, uuid_1.v4)())
                .send({
                playerId: 'test-player-123',
                amount: '10.00',
                currency: 'EUR'
            });
            // Debug: log response sempre
            console.log('Debit Response status:', response.status);
            console.log('Debit Response body:', JSON.stringify(response.body, null, 2));
            // Verifica schema risposta
            if (response.status === 200) {
                expect(response.body).toHaveProperty('status');
                expect(response.body).toHaveProperty('newBalance');
                expect(typeof response.body.newBalance).toBe('string');
                expect(response.body.newBalance).toMatch(/^\d+\.\d{2}$/);
            }
            else {
                // Verifica codice errore ammesso
                expect(response.body).toHaveProperty('error');
                expect(response.body.error).toHaveProperty('code');
                expect(ALLOWED_WALLET_CODES).toContain(response.body.error.code);
            }
        });
        it('should reject missing idempotency key with correct code', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/wallet/debit')
                .set('X-Correlation-Id', (0, uuid_1.v4)())
                .set('Authorization', 'Bearer test_rgs_key')
                .send({
                playerId: 'test-player-123',
                amount: '10.00',
                currency: 'EUR'
                // manca idempotencyKey!
            });
            expect(response.status).toBe(422);
            expect(response.body.error.code).toBe('RW-CAS-010'); // Missing idempotency dalla bibbia
        });
        it('should reject invalid correlation ID format', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/wallet/debit')
                .set('X-Correlation-Id', 'not-a-uuid')
                .set('Authorization', 'Bearer test_rgs_key')
                .send({
                playerId: 'test-player-123',
                amount: '10.00',
                currency: 'EUR',
            });
            expect(response.status).toBe(400);
            expect(response.body.error.code).toBe('RW-CAS-008');
        });
    });
    describe('POST /wallet/credit', () => {
        it('should return valid schema for successful credit', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/wallet/credit')
                .set('X-Correlation-Id', (0, uuid_1.v4)())
                .set('Authorization', 'Bearer test_rgs_key')
                .set('Idempotency-Key', (0, uuid_1.v4)())
                .send({
                playerId: 'test-player-123',
                amount: '50.00',
                currency: 'EUR'
            });
            if (response.status === 200) {
                expect(response.body).toHaveProperty('status');
                expect(response.body).toHaveProperty('newBalance');
                expect(typeof response.body.newBalance).toBe('string');
                expect(response.body.newBalance).toMatch(/^\d+\.\d{2}$/);
            }
            else {
                expect(ALLOWED_WALLET_CODES).toContain(response.body.error.code);
            }
        });
    });
    describe('POST /limits/check', () => {
        it('should return valid schema for limits check', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/limits/check')
                .set('X-Correlation-Id', (0, uuid_1.v4)())
                .set('Authorization', 'Bearer test_rgs_key')
                .send({
                playerId: 'test-player-123',
                stake: '10.00'
            });
            if (response.status === 200) {
                expect(response.body).toHaveProperty('ok');
                expect(typeof response.body.ok).toBe('boolean');
                if (!response.body.ok) {
                    expect(response.body).toHaveProperty('reason');
                }
            }
            else {
                expect(response.body).toHaveProperty('error');
                expect(response.body.error).toHaveProperty('code');
                expect(ALLOWED_LIMITS_CODES).toContain(response.body.error.code);
            }
        });
        it('should use only allowed error codes', async () => {
            // Test con stake fuori range per forzare errore
            const response = await (0, supertest_1.default)(app)
                .post('/limits/check')
                .set('X-Correlation-Id', (0, uuid_1.v4)())
                .set('Authorization', 'Bearer test_rgs_key')
                .send({
                playerId: 'test-player-123',
                stake: '999999.00' // Eccessivo
            });
            if (response.status !== 200) {
                expect(ALLOWED_LIMITS_CODES).toContain(response.body.error?.code);
            }
        });
    });
    describe('Error code compliance', () => {
        it('should never return codes outside allowed list', async () => {
            const testCases = [
                { endpoint: '/wallet/debit', allowedCodes: ALLOWED_WALLET_CODES },
                { endpoint: '/wallet/credit', allowedCodes: ALLOWED_WALLET_CODES },
                { endpoint: '/limits/check', allowedCodes: ALLOWED_LIMITS_CODES }
            ];
            for (const testCase of testCases) {
                // Test con vari input errati
                const invalidRequests = [
                    {}, // Empty body
                    { amount: 'invalid' }, // Invalid amount
                    { playerId: null }, // Null player
                ];
                for (const invalidBody of invalidRequests) {
                    const response = await (0, supertest_1.default)(app)
                        .post(testCase.endpoint)
                        .set('X-Correlation-Id', (0, uuid_1.v4)())
                        .set('Authorization', 'Bearer test_rgs_key')
                        .send(invalidBody);
                    if (response.body.error?.code) {
                        expect(testCase.allowedCodes).toContain(response.body.error.code);
                    }
                }
            }
        });
    });
});
//# sourceMappingURL=T1_contract_rest.test.js.map