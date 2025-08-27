import axios from 'axios';
import fs from 'fs';
import { withServer } from '../test-utils/devServer';

describe('Orchestrator Header Propagation', () => {
  test('outbound headers are logged with sanitary flags', async () => {
    const logFile = 'logs/combined.log';
    if (fs.existsSync(logFile)) {
      fs.truncateSync(logFile);
    }

    await withServer(
      { 
        env: { 
          NODE_ENV: 'development',
          ORCH_ENABLED: 'true',
          ORCH_MAX_RETRIES: '0',
          RGS_BASE_URL: 'http://localhost:3999', // Down but will still log
          RGS_API_KEY: 'test_rgs_key'
        }
      },
      async (url) => {
        try {
          await axios.post(`${url}/orch/api/v1/probe/round`, {
            gameId: 'test-game',
            playerId: '123e4567-e89b-42d3-a456-426614174000'
          }, {
            headers: {
              'X-Correlation-Id': '77777777-8888-4999-8000-111111111111',
              'Idempotency-Key': 'cc0e8400-e29b-41d4-a716-446655440000'
            },
            timeout: 1000
          });
        } catch (e) {
          // Expected to fail, but headers should be logged
        }

        // Wait for logs
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const logs = fs.readFileSync(logFile, 'utf-8');
        const logLines = logs.split('\n').filter(line => line.trim());
        
        // Find outbound headers log
        const headerLogs = logLines.filter(line => line.includes('orch.outbound.headers'));
        expect(headerLogs.length).toBeGreaterThan(0);
        
        const headerLog = headerLogs[0];
        
        // Check for sanitary flags
        expect(headerLog).toMatch(/"hasAuth":true/);
        expect(headerLog).toMatch(/"hasCorrelationId":true/);
        expect(headerLog).toMatch(/"hasIdempotencyKey":true/);
        
        // Ensure no actual secrets in logs
        expect(headerLog).not.toMatch(/Bearer.*test_rgs_key/);
        expect(headerLog).not.toMatch(/test_rgs_key/);
        expect(headerLog).not.toMatch(/77777777-8888-4999-8000-111111111111/);
        expect(headerLog).not.toMatch(/cc0e8400-e29b-41d4-a716-446655440000/);
        
        // Double check entire log file for secrets
        expect(logs).not.toMatch(/Authorization.*Bearer.*test_rgs_key/i);
        expect(logs).not.toMatch(/X-Idempotency-Key.*cc0e8400/i);
      }
    );
  });

  test('no idempotency key results in hasIdempotencyKey:false', async () => {
    const logFile = 'logs/combined.log';
    if (fs.existsSync(logFile)) {
      fs.truncateSync(logFile);
    }

    await withServer(
      { 
        env: { 
          NODE_ENV: 'development',
          ORCH_ENABLED: 'true',
          ORCH_MAX_RETRIES: '0',
          RGS_BASE_URL: 'http://localhost:3999'
        }
      },
      async (url) => {
        try {
          await axios.post(`${url}/orch/api/v1/probe/round`, {
            gameId: 'test-game',
            playerId: '123e4567-e89b-42d3-a456-426614174000'
          }, {
            headers: {
              'X-Correlation-Id': '88888888-9999-4000-8111-222222222222'
              // No Idempotency-Key
            },
            timeout: 1000
          });
        } catch (e) {
          // Expected
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const logs = fs.readFileSync(logFile, 'utf-8');
        const headerLogs = logs.split('\n').filter(line => 
          line.includes('orch.outbound.headers')
        );
        
        expect(headerLogs.length).toBeGreaterThan(0);
        const headerLog = headerLogs[0];
        
        // Should show no idempotency key
        expect(headerLog).toMatch(/"hasIdempotencyKey":false/);
        expect(headerLog).toMatch(/"hasAuth":true/);
        expect(headerLog).toMatch(/"hasCorrelationId":true/);
      }
    );
  });
});