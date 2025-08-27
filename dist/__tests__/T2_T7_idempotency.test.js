"use strict";
/**
 * T2 & T7 - Idempotency Tests
 * T2: Idempotency generale (ledger)
 * T7: Idempotency su credit (replay)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const express_1 = __importDefault(require("express"));
const uuid_1 = require("uuid");
const database_1 = require("../config/database");
const unique_1 = require("./helpers/unique");
// Mock express app con routes
function createApp() {
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    // Correlation ID middleware
    app.use((req, res, next) => {
        const correlationId = req.headers['x-correlation-id'] || (0, uuid_1.v4)();
        req.correlationId = correlationId;
        res.setHeader('X-Correlation-Id', correlationId);
        next();
    });
    // Import routes (assumendo che esistano)
    const walletRoutes = require('../routes/walletRoutes').default;
    app.use('/wallet', walletRoutes);
    return app;
}
describe('T2 & T7 - Idempotency Tests', () => {
    let app;
    const testPlayerId = (0, unique_1.uniqueId)('idemp-player');
    const testIdempotencyKey = (0, uuid_1.v4)();
    beforeAll(async () => {
        // Ensure database is initialized ONCE before creating app
        if (process.env.USE_SQLITE === 'true') {
            const { initSQLite } = require('../config/database-sqlite');
            await initSQLite();
        }
        app = createApp();
        // Create test user first
        await (0, database_1.query)(`
      INSERT OR IGNORE INTO users (id, username, email, password_hash, status)
      VALUES ($1, $2, $3, $4, $5)
    `, [testPlayerId, 'idemp_test_user', (0, unique_1.uniqueEmail)('idemp'), 'hash', 'active']);
        await (0, database_1.query)(`
      INSERT INTO user_wallets (id, user_id, balance, currency)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id) DO UPDATE SET balance = $3
    `, [(0, uuid_1.v4)(), testPlayerId, 1000.00, 'EUR']);
    });
    afterAll(async () => {
        // Cleanup
        await (0, database_1.query)('DELETE FROM wallet_transactions WHERE user_id = $1', [testPlayerId]);
        await (0, database_1.query)('DELETE FROM idempotency_keys WHERE key LIKE $1', ['%' + testPlayerId + '%']);
        await (0, database_1.query)('DELETE FROM user_wallets WHERE user_id = $1', [testPlayerId]);
        await (0, database_1.query)('DELETE FROM users WHERE id = $1', [testPlayerId]);
    });
    describe('T2 - Idempotency generale', () => {
        it('should not duplicate debit with same idempotencyKey', async () => {
            const idempotencyKey = (0, uuid_1.v4)();
            const debitAmount = '25.00';
            // Prima richiesta
            const response1 = await (0, supertest_1.default)(app)
                .post('/wallet/debit')
                .set('X-Correlation-Id', (0, uuid_1.v4)())
                .set('Authorization', 'Bearer test_rgs_key')
                .set('Idempotency-Key', idempotencyKey)
                .send({
                playerId: testPlayerId,
                amount: debitAmount,
                currency: 'EUR'
            });
            expect(response1.status).toBe(200);
            const balance1 = response1.body.newBalance;
            // Seconda richiesta con stessa idempotencyKey
            const response2 = await (0, supertest_1.default)(app)
                .post('/wallet/debit')
                .set('X-Correlation-Id', (0, uuid_1.v4)())
                .set('Authorization', 'Bearer test_rgs_key')
                .set('Idempotency-Key', idempotencyKey)
                .send({
                playerId: testPlayerId,
                amount: debitAmount,
                currency: 'EUR'
            });
            expect(response2.status).toBe(200);
            expect(response2.body.newBalance).toBe(balance1);
            // Verifica che ci sia una sola entry nel ledger
            const result = await (0, database_1.query)(`
        SELECT COUNT(*) as count 
        FROM wallet_transactions 
        WHERE user_id = $1 
        AND amount = $2
        AND type = 'debit'
      `, [testPlayerId, parseFloat(debitAmount)]);
            expect(parseInt(result.rows[0].count)).toBe(1);
        });
        it('should not duplicate credit with same idempotencyKey', async () => {
            const idempotencyKey = (0, uuid_1.v4)();
            const creditAmount = '30.00';
            // Prima richiesta
            const response1 = await (0, supertest_1.default)(app)
                .post('/wallet/credit')
                .set('X-Correlation-Id', (0, uuid_1.v4)())
                .set('Authorization', 'Bearer test_rgs_key')
                .set('Idempotency-Key', idempotencyKey)
                .send({
                playerId: testPlayerId,
                amount: creditAmount,
                currency: 'EUR',
            });
            expect(response1.status).toBe(200);
            const balance1 = response1.body.newBalance;
            // Seconda richiesta con stessa idempotencyKey
            const response2 = await (0, supertest_1.default)(app)
                .post('/wallet/credit')
                .set('X-Correlation-Id', (0, uuid_1.v4)())
                .set('Authorization', 'Bearer test_rgs_key')
                .set('Idempotency-Key', idempotencyKey)
                .send({
                playerId: testPlayerId,
                amount: creditAmount,
                currency: 'EUR',
            });
            expect(response2.status).toBe(200);
            expect(response2.body.newBalance).toBe(balance1);
            // Verifica ledger
            const result = await (0, database_1.query)(`
        SELECT COUNT(*) as count 
        FROM wallet_transactions 
        WHERE user_id = $1 
        AND amount = $2
        AND type = 'credit'
      `, [testPlayerId, parseFloat(creditAmount)]);
            expect(parseInt(result.rows[0].count)).toBe(1);
        });
    });
    describe('T7 - Idempotency su credit (replay)', () => {
        it('should handle multiple credit replays correctly', async () => {
            const idempotencyKey = (0, uuid_1.v4)();
            const creditAmount = '45.50';
            // Ottieni balance iniziale
            const walletResult = await (0, database_1.query)('SELECT balance FROM user_wallets WHERE user_id = $1', [testPlayerId]);
            const initialBalance = parseFloat(walletResult.rows[0].balance);
            // Invia la stessa richiesta 3 volte SEQUENZIALMENTE
            const responses = [];
            for (let i = 0; i < 3; i++) {
                const response = await (0, supertest_1.default)(app)
                    .post('/wallet/credit')
                    .set('X-Correlation-Id', (0, uuid_1.v4)())
                    .set('Authorization', 'Bearer test_rgs_key')
                    .set('Idempotency-Key', idempotencyKey)
                    .send({
                    playerId: testPlayerId,
                    amount: creditAmount,
                    currency: 'EUR'
                });
                responses.push(response);
                // Small delay to ensure transaction completes
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            // Tutte le risposte devono essere identiche
            expect(responses[0].status).toBe(200);
            expect(responses[1].status).toBe(200);
            expect(responses[2].status).toBe(200);
            expect(responses[0].body.newBalance).toBe(responses[1].body.newBalance);
            expect(responses[1].body.newBalance).toBe(responses[2].body.newBalance);
            // Verifica che il balance sia aumentato solo una volta
            const finalWalletResult = await (0, database_1.query)('SELECT balance FROM user_wallets WHERE user_id = $1', [testPlayerId]);
            const finalBalance = parseFloat(finalWalletResult.rows[0].balance);
            expect(finalBalance).toBeCloseTo(initialBalance + parseFloat(creditAmount), 2);
            // Verifica una sola transazione nel ledger
            const USE_SQLITE = process.env.USE_SQLITE === 'true';
            const recentQuery = USE_SQLITE
                ? `SELECT COUNT(*) as count 
           FROM wallet_transactions 
           WHERE user_id = $1 
           AND amount = $2
           AND type = 'credit'
           AND created_at > datetime('now', '-1 minute')`
                : `SELECT COUNT(*) as count 
           FROM wallet_transactions 
           WHERE user_id = $1 
           AND amount = $2
           AND type = 'credit'
           AND created_at > NOW() - INTERVAL '1 minute'`;
            const txResult = await (0, database_1.query)(recentQuery, [testPlayerId, parseFloat(creditAmount)]);
            expect(parseInt(txResult.rows[0].count)).toBe(1);
        });
        it('should store and return consistent idempotent response', async () => {
            const idempotencyKey = (0, uuid_1.v4)();
            const creditAmount = '77.77';
            // Prima richiesta
            const response1 = await (0, supertest_1.default)(app)
                .post('/wallet/credit')
                .set('X-Correlation-Id', (0, uuid_1.v4)())
                .set('Authorization', 'Bearer test_rgs_key')
                .set('Idempotency-Key', idempotencyKey)
                .send({
                playerId: testPlayerId,
                amount: creditAmount,
                currency: 'EUR',
            });
            // Attendi un po' per simulare delay
            await new Promise(resolve => setTimeout(resolve, 100));
            // Seconda richiesta dopo delay
            const response2 = await (0, supertest_1.default)(app)
                .post('/wallet/credit')
                .set('X-Correlation-Id', (0, uuid_1.v4)())
                .set('Authorization', 'Bearer test_rgs_key')
                .set('Idempotency-Key', idempotencyKey)
                .send({
                playerId: testPlayerId,
                amount: creditAmount,
                currency: 'EUR',
            });
            // Le risposte devono essere identiche
            expect(JSON.stringify(response1.body)).toBe(JSON.stringify(response2.body));
            // Verifica che la idempotency key sia stata salvata
            const idempResult = await (0, database_1.query)('SELECT response FROM idempotency_keys WHERE key = $1', [idempotencyKey]);
            expect(idempResult.rows.length).toBe(1);
            expect(JSON.parse(idempResult.rows[0].response)).toEqual(response1.body);
        });
    });
    describe('Edge cases', () => {
        it('should handle different idempotency keys as separate transactions', async () => {
            const key1 = (0, uuid_1.v4)();
            const key2 = (0, uuid_1.v4)();
            const amount = '15.00';
            // Due richieste con chiavi diverse
            const response1 = await (0, supertest_1.default)(app)
                .post('/wallet/debit')
                .set('X-Correlation-Id', (0, uuid_1.v4)())
                .set('Authorization', 'Bearer test_rgs_key')
                .set('Idempotency-Key', key1)
                .send({
                playerId: testPlayerId,
                amount,
                currency: 'EUR'
            });
            const response2 = await (0, supertest_1.default)(app)
                .post('/wallet/debit')
                .set('X-Correlation-Id', (0, uuid_1.v4)())
                .set('Authorization', 'Bearer test_rgs_key')
                .set('Idempotency-Key', key2)
                .send({
                playerId: testPlayerId,
                amount,
                currency: 'EUR'
            });
            // Entrambe devono avere successo
            expect(response1.status).toBe(200);
            expect(response2.status).toBe(200);
            // I balance devono essere diversi (secondo debit)
            const balance1 = parseFloat(response1.body.newBalance);
            const balance2 = parseFloat(response2.body.newBalance);
            expect(balance2).toBeCloseTo(balance1 - parseFloat(amount), 2);
        });
    });
});
//# sourceMappingURL=T2_T7_idempotency.test.js.map