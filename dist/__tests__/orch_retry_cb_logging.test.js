"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const fs_1 = __importDefault(require("fs"));
const devServer_1 = require("../test-utils/devServer");
describe('Orchestrator Retry/Circuit Breaker Logging', () => {
    test('retry with backoff and circuit breaker logs', async () => {
        const logFile = 'logs/combined.log';
        if (fs_1.default.existsSync(logFile)) {
            fs_1.default.truncateSync(logFile);
        }
        await (0, devServer_1.withServer)({
            env: {
                NODE_ENV: 'development',
                ORCH_ENABLED: 'true',
                ORCH_MAX_RETRIES: '2',
                ORCH_BACKOFF_MS: '50,100',
                RGS_BASE_URL: 'http://localhost:3999' // Down to trigger retries
            }
        }, async (url) => {
            // Make multiple requests to trigger circuit breaker
            for (let i = 0; i < 4; i++) {
                try {
                    await axios_1.default.post(`${url}/orch/api/v1/probe/round`, {
                        gameId: 'test-game',
                        playerId: '123e4567-e89b-42d3-a456-426614174000'
                    }, {
                        headers: {
                            'X-Correlation-Id': `retry-test-${i}-${Date.now()}`
                        },
                        timeout: 10000
                    });
                }
                catch (e) {
                    // Expected to fail
                }
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            // Wait for logs to be written
            await new Promise(resolve => setTimeout(resolve, 1000));
            const logs = fs_1.default.readFileSync(logFile, 'utf-8');
            const logLines = logs.split('\n').filter(line => line.trim());
            // Check for retry logs
            const retryLogs = logLines.filter(line => line.includes('orch.retry'));
            expect(retryLogs.length).toBeGreaterThan(0);
            // Check backoff sequence
            const backoffValues = [];
            retryLogs.forEach(log => {
                const match = log.match(/"backoffMs":(\d+)/);
                if (match) {
                    backoffValues.push(parseInt(match[1]));
                }
            });
            // Should see 50ms and 100ms backoffs
            expect(backoffValues).toContain(50);
            expect(backoffValues).toContain(100);
            // Check for circuit breaker open log
            const cbOpenLogs = logLines.filter(line => line.includes('orch.cb.open'));
            expect(cbOpenLogs.length).toBeGreaterThan(0);
            // Verify it has failures count and openMs
            const cbOpenLog = cbOpenLogs[0];
            expect(cbOpenLog).toMatch(/"failures":3/);
            expect(cbOpenLog).toMatch(/"openMs":30000/);
            // Make one more request to trigger circuit breaker block
            try {
                await axios_1.default.post(`${url}/orch/api/v1/probe/round`, {
                    gameId: 'test-game',
                    playerId: '123e4567-e89b-42d3-a456-426614174000'
                }, {
                    headers: {
                        'X-Correlation-Id': 'cb-block-test-' + Date.now()
                    },
                    timeout: 1000
                });
            }
            catch (e) {
                // Expected
            }
            await new Promise(resolve => setTimeout(resolve, 500));
            const logsAfterBlock = fs_1.default.readFileSync(logFile, 'utf-8');
            const cbBlockLogs = logsAfterBlock.split('\n').filter(line => line.includes('orch.cb.block'));
            expect(cbBlockLogs.length).toBeGreaterThan(0);
            // Verify block log has failures count
            const cbBlockLog = cbBlockLogs[0];
            expect(cbBlockLog).toMatch(/"failures":3/);
        });
    });
});
//# sourceMappingURL=orch_retry_cb_logging.test.js.map