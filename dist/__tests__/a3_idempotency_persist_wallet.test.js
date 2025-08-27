"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const devServer_1 = require("../test-utils/devServer");
describe('A3: Wallet Idempotency Persistence', () => {
    const idempotencyKey = '660e8400-e29b-41d4-a716-446655440000';
    test('wallet debit idempotency same-process', async () => {
        const server = new devServer_1.DevServer({
            env: {
                NODE_ENV: 'development',
                ORCH_ENABLED: 'true'
            }
        });
        try {
            await server.start();
            const url = server.getUrl();
            const payload = {
                playerId: '123e4567-e89b-42d3-a456-426614174000',
                amount: '25.50',
                roundId: 'round-' + Date.now(),
                transactionId: 'tx-' + Date.now()
            };
            // First request
            const response1 = await axios_1.default.post(`${url}/casino/api/v1/wallet/debit`, payload, {
                headers: {
                    'X-Correlation-Id': '55555555-6666-4777-8888-999999999999',
                    'Idempotency-Key': idempotencyKey
                },
                validateStatus: () => true
            });
            // Second request with same idempotency key
            const response2 = await axios_1.default.post(`${url}/casino/api/v1/wallet/debit`, payload, {
                headers: {
                    'X-Correlation-Id': '66666666-7777-4888-8999-000000000000',
                    'Idempotency-Key': idempotencyKey
                },
                validateStatus: () => true
            });
            // Body should be byte-identical
            expect(JSON.stringify(response1.data)).toEqual(JSON.stringify(response2.data));
            expect(response1.status).toEqual(response2.status);
        }
        finally {
            await server.stop();
        }
    });
    test('wallet debit idempotency cross-restart', async () => {
        const payload = {
            playerId: '123e4567-e89b-42d3-a456-426614174002',
            amount: '30.00',
            roundId: 'round-restart-' + Date.now(),
            transactionId: 'tx-restart-' + Date.now()
        };
        const restartKey = '770e8400-e29b-41d4-a716-446655440000';
        let response1Data;
        let response1Status;
        // First server run
        const server1 = new devServer_1.DevServer({
            env: {
                NODE_ENV: 'development',
                ORCH_ENABLED: 'true'
            }
        });
        try {
            await server1.start();
            const url = server1.getUrl();
            const response1 = await axios_1.default.post(`${url}/casino/api/v1/wallet/debit`, payload, {
                headers: {
                    'X-Correlation-Id': '77777777-8888-4999-8000-111111111111',
                    'Idempotency-Key': restartKey
                },
                validateStatus: () => true
            });
            response1Data = response1.data;
            response1Status = response1.status;
        }
        finally {
            await server1.stop();
        }
        // Restart server
        await new Promise(resolve => setTimeout(resolve, 2000));
        // Second server run
        const server2 = new devServer_1.DevServer({
            env: {
                NODE_ENV: 'development',
                ORCH_ENABLED: 'true'
            }
        });
        try {
            await server2.start();
            const url = server2.getUrl();
            const response2 = await axios_1.default.post(`${url}/casino/api/v1/wallet/debit`, payload, {
                headers: {
                    'X-Correlation-Id': '88888888-9999-4000-8111-222222222222',
                    'Idempotency-Key': restartKey
                },
                validateStatus: () => true
            });
            // Body should be byte-identical after restart
            expect(JSON.stringify(response2.data)).toEqual(JSON.stringify(response1Data));
            expect(response2.status).toEqual(response1Status);
        }
        finally {
            await server2.stop();
        }
    });
    test('wallet debit mismatch body returns cached', async () => {
        const server = new devServer_1.DevServer({
            env: {
                NODE_ENV: 'development',
                ORCH_ENABLED: 'true'
            }
        });
        try {
            await server.start();
            const url = server.getUrl();
            const mismatchKey = '880e8400-e29b-41d4-a716-446655440000';
            // First request
            const payload1 = {
                playerId: '123e4567-e89b-42d3-a456-426614174003',
                amount: '100.00',
                roundId: 'round-mismatch-1',
                transactionId: 'tx-mismatch-1'
            };
            const response1 = await axios_1.default.post(`${url}/casino/api/v1/wallet/debit`, payload1, {
                headers: {
                    'X-Correlation-Id': '99999999-0000-4111-8222-333333333333',
                    'Idempotency-Key': mismatchKey
                },
                validateStatus: () => true
            });
            // Different payload with same idempotency key
            const payload2 = {
                playerId: '999e9999-9999-9999-9999-999999999999',
                amount: '999.99',
                roundId: 'round-different',
                transactionId: 'tx-different'
            };
            const response2 = await axios_1.default.post(`${url}/casino/api/v1/wallet/debit`, payload2, {
                headers: {
                    'X-Correlation-Id': '00000000-1111-4222-8333-444444444444',
                    'Idempotency-Key': mismatchKey
                },
                validateStatus: () => true
            });
            // Should return cached response despite different payload
            expect(JSON.stringify(response2.data)).toEqual(JSON.stringify(response1.data));
        }
        finally {
            await server.stop();
        }
    });
});
//# sourceMappingURL=a3_idempotency_persist_wallet.test.js.map