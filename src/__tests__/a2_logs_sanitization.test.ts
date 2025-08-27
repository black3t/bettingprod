import axios from 'axios';
import fs from 'fs';
import { withServer } from '../test-utils/devServer';

describe('A2: Log Sanitization', () => {
  test('logs do not contain sensitive headers', async () => {
    // Clear logs first
    const logFile = 'logs/combined.log';
    if (fs.existsSync(logFile)) {
      fs.truncateSync(logFile);
    }

    await withServer(
      { 
        env: { 
          NODE_ENV: 'development',
          ORCH_ENABLED: 'true'
        }
      },
      async (url) => {
        // Make requests with sensitive headers
        try {
          await axios.post(`${url}/casino/api/v1/wallet/debit`, {
            playerId: '123e4567-e89b-42d3-a456-426614174000',
            amount: '10.00',
            roundId: 'round-' + Date.now()
          }, {
            headers: {
              'Authorization': 'Bearer secret-token-12345',
              'X-Idempotency-Key': '550e8400-e29b-41d4-a716-446655440000',
              'Cookie': 'session=secret-session-cookie',
              'X-Correlation-Id': '33333333-4444-4555-8666-777777777777'
            }
          });
        } catch (e) {
          // Expected to fail, we're testing logs
        }

        // Wait for logs to be written
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Check logs
        const logs = fs.readFileSync(logFile, 'utf-8');
        
        // Assert no sensitive data
        expect(logs).not.toMatch(/Bearer secret-token-12345/i);
        expect(logs).not.toMatch(/Authorization.*secret/i);
        expect(logs).not.toMatch(/550e8400-e29b-41d4-a716-446655440000/);
        expect(logs).not.toMatch(/X-Idempotency-Key.*550e8400/i);
        expect(logs).not.toMatch(/Cookie.*session/i);
        expect(logs).not.toMatch(/secret-session-cookie/);
        
        // But correlation ID should be present
        expect(logs).toMatch(/33333333-4444-4555-8666-777777777777/);
      }
    );
  });

  test('orchestrator outbound headers are sanitized', async () => {
    const logFile = 'logs/combined.log';
    if (fs.existsSync(logFile)) {
      fs.truncateSync(logFile);
    }

    await withServer(
      { 
        env: { 
          NODE_ENV: 'development',
          ORCH_ENABLED: 'true',
          RGS_BASE_URL: 'http://localhost:3999' // Down, will fail but log
        }
      },
      async (url) => {
        try {
          await axios.post(`${url}/orch/api/v1/probe/round`, {
            gameId: 'test-game',
            playerId: '123e4567-e89b-42d3-a456-426614174001'
          }, {
            headers: {
              'X-Correlation-Id': '44444444-5555-4666-8777-888888888888'
            },
            timeout: 500
          });
        } catch (e) {
          // Expected to fail
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
        const logs = fs.readFileSync(logFile, 'utf-8');
        
        // Should have outbound headers log with flags only
        expect(logs).toMatch(/orch\.outbound\.headers/);
        expect(logs).toMatch(/hasAuth.*true/);
        expect(logs).toMatch(/hasCorrelationId.*true/);
        
        // But no actual secrets
        expect(logs).not.toMatch(/Bearer.*test_rgs_key/);
        expect(logs).not.toMatch(/Authorization.*test/i);
      }
    );
  });
});