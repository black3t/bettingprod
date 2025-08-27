import axios from 'axios';
import fs from 'fs';
import { withServer } from '../test-utils/devServer';

describe('Orchestrator Retry/Circuit Breaker Logging', () => {
  test('retry with backoff and circuit breaker logs', async () => {
    const logFile = 'logs/combined.log';
    if (fs.existsSync(logFile)) {
      fs.truncateSync(logFile);
    }

    await withServer(
      { 
        env: { 
          NODE_ENV: 'development',
          ORCH_ENABLED: 'true',
          ORCH_MAX_RETRIES: '2',
          ORCH_BACKOFF_MS: '50,100',
          RGS_BASE_URL: 'http://localhost:3999' // Down to trigger retries
        }
      },
      async (url) => {
        // Make multiple requests to trigger circuit breaker
        for (let i = 0; i < 4; i++) {
          try {
            await axios.post(`${url}/orch/api/v1/probe/round`, {
              gameId: 'test-game',
              playerId: '123e4567-e89b-42d3-a456-426614174000'
            }, {
              headers: {
                'X-Correlation-Id': `retry-test-${i}-${Date.now()}`
              },
              timeout: 10000
            });
          } catch (e) {
            // Expected to fail
          }
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Wait for logs to be written
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const logs = fs.readFileSync(logFile, 'utf-8');
        const logLines = logs.split('\n').filter(line => line.trim());
        
        // Check for retry logs
        const retryLogs = logLines.filter(line => line.includes('orch.retry'));
        expect(retryLogs.length).toBeGreaterThan(0);
        
        // Check backoff sequence
        const backoffValues: number[] = [];
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
          await axios.post(`${url}/orch/api/v1/probe/round`, {
            gameId: 'test-game',
            playerId: '123e4567-e89b-42d3-a456-426614174000'
          }, {
            headers: {
              'X-Correlation-Id': 'cb-block-test-' + Date.now()
            },
            timeout: 1000
          });
        } catch (e) {
          // Expected
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const logsAfterBlock = fs.readFileSync(logFile, 'utf-8');
        const cbBlockLogs = logsAfterBlock.split('\n').filter(line => line.includes('orch.cb.block'));
        expect(cbBlockLogs.length).toBeGreaterThan(0);
        
        // Verify block log has failures count
        const cbBlockLog = cbBlockLogs[0];
        expect(cbBlockLog).toMatch(/"failures":3/);
      }
    );
  });
});