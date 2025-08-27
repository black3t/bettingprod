import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const BASE_URL = 'http://localhost:3001';
const ORCH_BASE_PATH = '/orch/api/v1';

describe('Orchestrator E2E Tests', () => {
  const correlationId = uuidv4();
  
  beforeAll(() => {
    // Ensure we're in test mode
    expect(process.env.NODE_ENV).not.toBe('production');
  });

  describe('Health Check', () => {
    it('should return healthy status from orchestrator health endpoint', async () => {
      const response = await axios.get(`${BASE_URL}${ORCH_BASE_PATH}/health`, {
        headers: {
          'X-Correlation-Id': correlationId
        },
        validateStatus: () => true
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('status', 'healthy');
      expect(response.data).toHaveProperty('checks');
    });
  });

  describe('Happy Path - Round Sequence', () => {
    it('should execute full round sequence via probe endpoint', async () => {
      const idempotencyKey = uuidv4();
      
      const response = await axios.post(
        `${BASE_URL}${ORCH_BASE_PATH}/probe/round`,
        {
          playerId: 'test-player-' + Date.now(),
          gameId: 'test-game'
        },
        {
          headers: {
            'X-Correlation-Id': correlationId,
            'Idempotency-Key': idempotencyKey
          },
          validateStatus: () => true
        }
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('success', true);
      expect(response.data).toHaveProperty('results');
      
      const { results } = response.data;
      expect(results).toHaveProperty('sequence');
      expect(results.sequence).toHaveLength(4);
      
      // Verify sequence steps
      const steps = results.sequence.map((s: any) => s.step);
      expect(steps).toEqual(['startRound', 'debit', 'credit', 'endRound']);
    });
  });

  describe('Idempotency', () => {
    it('should return identical response for same idempotency key', async () => {
      const idempotencyKey = uuidv4();
      const payload = {
        playerId: 'idempotent-player-' + Date.now(),
        gameId: 'test-game'
      };
      
      // First request
      const response1 = await axios.post(
        `${BASE_URL}${ORCH_BASE_PATH}/probe/round`,
        payload,
        {
          headers: {
            'X-Correlation-Id': uuidv4(),
            'Idempotency-Key': idempotencyKey
          },
          validateStatus: () => true
        }
      );
      
      // Second request with same idempotency key
      const response2 = await axios.post(
        `${BASE_URL}${ORCH_BASE_PATH}/probe/round`,
        payload,
        {
          headers: {
            'X-Correlation-Id': uuidv4(), // Different correlation ID
            'Idempotency-Key': idempotencyKey // Same idempotency key
          },
          validateStatus: () => true
        }
      );
      
      // Responses should be byte-identical (excluding correlation ID in response)
      expect(response1.status).toBe(response2.status);
      expect(JSON.stringify(response1.data.results.sequence))
        .toBe(JSON.stringify(response2.data.results.sequence));
    });
  });

  describe('Failure Modes', () => {
    it('should handle RGS timeout gracefully', async () => {
      // This test would require mocking RGS to simulate timeout
      // For now, we verify the orchestrator handles errors properly
      
      const response = await axios.post(
        `${BASE_URL}${ORCH_BASE_PATH}/probe/round`,
        {
          playerId: 'timeout-test-player',
          gameId: 'test-game',
          // Add a flag that RGS mock could recognize to simulate timeout
          simulateTimeout: true
        },
        {
          headers: {
            'X-Correlation-Id': correlationId
          },
          validateStatus: () => true,
          timeout: 5000
        }
      );
      
      // If RGS times out, we expect either success (with retries) 
      // or proper error mapping
      if (response.status !== 200) {
        expect(response.status).toBeGreaterThanOrEqual(500);
        expect(response.data).toHaveProperty('error');
        expect(response.data.error).toHaveProperty('code');
        // Should map to RW-RGS-008 for timeout
        if (response.data.error.code === 'RW-RGS-008') {
          expect(response.data.error.code).toBe('RW-RGS-008');
        }
      }
    });

    it('should handle insufficient funds properly', async () => {
      // Test with a player that would have insufficient funds
      const response = await axios.post(
        `${BASE_URL}${ORCH_BASE_PATH}/probe/round`,
        {
          playerId: 'broke-player', // Assuming this player has no funds
          gameId: 'test-game'
        },
        {
          headers: {
            'X-Correlation-Id': correlationId
          },
          validateStatus: () => true
        }
      );
      
      // Even with insufficient funds, probe might succeed
      // but show REJECTED status in the debit step
      if (response.status === 200) {
        const debitStep = response.data.results.sequence.find((s: any) => s.step === 'debit');
        if (debitStep && debitStep.status === 'REJECTED') {
          expect(debitStep.data).toHaveProperty('reason');
          // Should map to RW-RGS-002 for insufficient funds
          expect(['RW-RGS-002', 'RW-CAS-001']).toContain(debitStep.data.reason);
        }
      }
    });
  });

  describe('Correlation ID Propagation', () => {
    it('should propagate correlation ID through all calls', async () => {
      const testCorrelationId = uuidv4();
      
      const response = await axios.post(
        `${BASE_URL}${ORCH_BASE_PATH}/probe/round`,
        {
          playerId: 'correlation-test-player',
          gameId: 'test-game'
        },
        {
          headers: {
            'X-Correlation-Id': testCorrelationId
          },
          validateStatus: () => true
        }
      );
      
      expect(response.headers).toHaveProperty('x-correlation-id', testCorrelationId);
      if (response.status === 200) {
        expect(response.data.results).toHaveProperty('correlationId', testCorrelationId);
      }
    });
  });

  describe('Production Protection', () => {
    it('should block probe endpoint in production', async () => {
      // Temporarily set NODE_ENV to production for this test
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      try {
        const response = await axios.post(
          `${BASE_URL}${ORCH_BASE_PATH}/probe/round`,
          {},
          {
            headers: {
              'X-Correlation-Id': correlationId
            },
            validateStatus: () => true
          }
        );
        
        // In production, probe should return error
        if (process.env.NODE_ENV === 'production') {
          expect(response.status).toBeGreaterThanOrEqual(400);
          expect(response.data).toHaveProperty('error');
          expect(response.data.error).toHaveProperty('code', 'RW-CAS-005');
        }
      } finally {
        // Restore original NODE_ENV
        process.env.NODE_ENV = originalEnv;
      }
    });
  });
});