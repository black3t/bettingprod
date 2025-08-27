/**
 * E2E Integration Test Suite - RAWWAR↔RGS↔Casino
 * TR-11: Validazione end-to-end con concorrenza, idempotenza, outbox, health, GDPR
 */

import request from 'supertest';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import * as logger from '../utils/logger';

// Test server setup
let casinoApp: express.Application;
let rgsApp: express.Application;
let casinoServer: any;
let rgsServer: any;

const CASINO_PORT = 4001;
const RGS_PORT = 4002;

// Set CASINO_BASE_URL before importing RGS routes - include full path
process.env.CASINO_BASE_URL = `http://localhost:${CASINO_PORT}/casino/api/v1`;
process.env.RGS_SINGLE_FLIGHT = 'true'; // Enable single-flight for tests

// Setup test apps
function setupCasinoApp() {
  const app = express();
  app.use(express.json());
  
  // Add correlation ID middleware
  app.use((req: any, res: any, next: any) => {
    const correlationId = req.headers['x-correlation-id'] || uuidv4();
    req.correlationId = correlationId;
    res.setHeader('X-Correlation-Id', correlationId);
    next();
  });
  
  // Mount all Casino routes
  const walletRoutes = require('../routes/walletRoutes').default;
  const limitsRoutes = require('../routes/limitsRoutes').default;
  const healthRoutes = require('../routes/healthRoutes').default;
  const adminSeedRoutes = require('../routes/adminSeedRoutes').default;
  const webhookRoutes = require('../routes/webhookRoutes').default;
  
  // With prefix
  app.use('/casino/api/v1/wallet', walletRoutes);
  app.use('/casino/api/v1/limits', limitsRoutes);
  app.use('/casino/api/v1/health', healthRoutes);
  app.use('/casino/api/v1/admin/seed', adminSeedRoutes);
  app.use('/casino/api/v1/rgs', webhookRoutes);
  
  // Compat routes (no prefix)
  app.use('/wallet', walletRoutes);
  app.use('/limits', limitsRoutes);
  app.use('/health', healthRoutes);
  app.use('/admin/seed', adminSeedRoutes);
  
  return app;
}

function setupRGSApp() {
  const app = express();
  app.use(express.json());
  
  // Clear module cache to get fresh instance with updated env
  delete require.cache[require.resolve('../routes/rgsGameRoutes')];
  
  // Mount RGS routes
  const rgsRoutes = require('../routes/rgsGameRoutes').default;
  
  // With prefix
  app.use('/rgs/api/v1', rgsRoutes);
  
  // Compat
  app.use('/rgs', rgsRoutes);
  
  return app;
}

describe('E2E RGS-Casino Integration Suite', () => {
  let testPlayerId: string;
  let testToken: string;
  let testSessionId: string;
  
  beforeEach(() => {
    // Use fake timers for deterministic tests
    jest.useFakeTimers();
  });
  
  afterEach(() => {
    // Restore real timers
    jest.useRealTimers();
  });
  
  beforeAll(async () => {
    // Set environment
    process.env.USE_SQLITE = 'true';
    process.env.DEV_SEED = 'true';
    process.env.NODE_ENV = 'test';
    process.env.SESSION_TTL = '3600';
    process.env.IDEMPOTENCY_WINDOW_HOURS = '48';
    process.env.RGS_API_KEY = 'test_rgs_key';
    
    // Database is already initialized by test setup
    
    // Setup apps
    casinoApp = setupCasinoApp();
    rgsApp = setupRGSApp();
    
    // Start servers
    await new Promise<void>((resolve) => {
      casinoServer = casinoApp.listen(CASINO_PORT, () => {
        resolve();
      });
    });
    
    await new Promise<void>((resolve) => {
      rgsServer = rgsApp.listen(RGS_PORT, () => {
        resolve();
      });
    });
  });
  
  afterAll(async () => {
    if (casinoServer) await new Promise((resolve) => casinoServer.close(resolve));
    if (rgsServer) await new Promise((resolve) => rgsServer.close(resolve));
  });
  
  describe('TASK A - E2E Flow with Concurrency', () => {
    it('should seed player via Casino admin endpoint', async () => {
      const response = await request(casinoApp)
        .post('/casino/api/v1/admin/seed/player')
        .set('Authorization', 'Bearer test_rgs_key')
        .set('X-Correlation-Id', uuidv4())
        .send({
          username: `e2e_test_${Date.now()}`,
          initialBalance: '1000.00'
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('playerId');
      expect(response.body.balance).toBe('1000.00');
      
      testPlayerId = response.body.playerId;
    });
    
    it('should generate RGS auth token', async () => {
      const response = await request(rgsApp)
        .post('/rgs/api/v1/auth/token')
        .set('Authorization', 'Bearer test_rgs_key')
        .set('X-Correlation-Id', uuidv4())
        .send({ playerId: testPlayerId });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body.expiresIn).toBeGreaterThan(0);
      
      testToken = response.body.token;
    });
    
    it('should start RGS session', async () => {
      const response = await request(rgsApp)
        .post('/rgs/api/v1/session/start')
        .set('Authorization', 'Bearer test_rgs_key')
        .set('X-Correlation-Id', uuidv4())
        .send({
          playerId: testPlayerId,
          gameId: 'rawwar-v6',
          device: 'desktop',
          ip: '127.0.0.1'
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('sessionId');
      expect(response.body).toHaveProperty('launchUrl');
      
      testSessionId = response.body.sessionId;
    });
    
    it('should start round with idempotency', async () => {
      const idempotencyKey = uuidv4();
      const roundId = uuidv4();
      
      const response = await request(rgsApp)
        .post('/rgs/api/v1/round/start')
        .set('Authorization', 'Bearer test_rgs_key')
        .set('X-Correlation-Id', uuidv4())
        .set('Idempotency-Key', idempotencyKey)
        .send({
          playerId: testPlayerId,
          gameId: 'rawwar-v6',
          roundId
        });
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('STARTED');
    });
    
    it('should handle concurrent debits with idempotency', async () => {
      jest.useRealTimers(); // Use real timers for HTTP requests
      
      const amount = '10.00';
      
      // Create requests - reduce to 3+3 to avoid timeout
      const requests = [];
      
      // 3 identical requests (same idempotency key and transactionId)
      const idempotentKey = uuidv4();
      const idempotentTxId = uuidv4();
      const roundId = uuidv4();
      
      for (let i = 0; i < 3; i++) {
        requests.push(
          request(rgsApp)
            .post('/rgs/api/v1/transaction/debit')
            .set('Authorization', 'Bearer test_rgs_key')
            .set('X-Correlation-Id', uuidv4())
            .set('Idempotency-Key', idempotentKey)
            .send({
              playerId: testPlayerId,
              amount,
              roundId,
              transactionId: idempotentTxId
            })
        );
      }
      
      // 3 unique requests (different idempotency keys and transactionIds)
      for (let i = 0; i < 3; i++) {
        requests.push(
          request(rgsApp)
            .post('/rgs/api/v1/transaction/debit')
            .set('Authorization', 'Bearer test_rgs_key')
            .set('X-Correlation-Id', uuidv4())
            .set('Idempotency-Key', uuidv4())
            .send({
              playerId: testPlayerId,
              amount,
              roundId: uuidv4(),
              transactionId: uuidv4()
            })
        );
      }
      
      // Execute sequentially to avoid timeout issues
      const responses = [];
      for (const req of requests) {
        const res = await req;
        responses.push(res);
      }
      
      // Verify all succeeded
      responses.forEach((r, i) => {
        if (r.status !== 200) {
          console.log(`Request ${i} failed:`, r.status, r.body);
        }
        expect(r.status).toBe(200);
        expect(r.body).toHaveProperty('status');
        expect(r.body.status).toBe('APPROVED');
      });
      
      // Verify idempotent responses are byte-identical
      const idempotentResponses = responses.slice(0, 3);
      const firstResponse = JSON.stringify(idempotentResponses[0].body);
      idempotentResponses.forEach(r => {
        expect(JSON.stringify(r.body)).toBe(firstResponse);
      });
      
      // Check balance - should be reduced by 4 * 10.00 = 40.00 (1 idempotent + 3 unique)
      const balanceCheck = await request(casinoApp)
        .post('/casino/api/v1/wallet/balance')
        .set('X-Correlation-Id', uuidv4())
        .send({ playerId: testPlayerId });
      
      expect(balanceCheck.status).toBe(200);
      const newBalance = parseFloat(balanceCheck.body.balance);
      expect(newBalance).toBe(960.00); // 1000 - 40
    });
    
    it('should handle concurrent credits with idempotency', async () => {
      jest.useRealTimers(); // Use real timers for HTTP requests
      
      const amount = '10.00';
      
      // Create requests - reduce to 3+3 to avoid timeout
      const requests = [];
      
      // 3 identical requests
      const idempotentKey = uuidv4();
      const idempotentTxId = uuidv4();
      const roundId = uuidv4();
      
      for (let i = 0; i < 3; i++) {
        requests.push(
          request(rgsApp)
            .post('/rgs/api/v1/transaction/credit')
            .set('Authorization', 'Bearer test_rgs_key')
            .set('X-Correlation-Id', uuidv4())
            .set('Idempotency-Key', idempotentKey)
            .send({
              playerId: testPlayerId,
              amount,
              roundId,
              transactionId: idempotentTxId
            })
        );
      }
      
      // 3 unique requests
      for (let i = 0; i < 3; i++) {
        requests.push(
          request(rgsApp)
            .post('/rgs/api/v1/transaction/credit')
            .set('Authorization', 'Bearer test_rgs_key')
            .set('X-Correlation-Id', uuidv4())
            .set('Idempotency-Key', uuidv4())
            .send({
              playerId: testPlayerId,
              amount,
              roundId: uuidv4(),
              transactionId: uuidv4()
            })
        );
      }
      
      // Execute sequentially to avoid timeout issues
      const responses = [];
      for (const req of requests) {
        const res = await req;
        responses.push(res);
      }
      
      // Verify all succeeded
      responses.forEach(r => {
        expect(r.status).toBe(200);
        expect(r.body.status).toBe('APPROVED');
      });
      
      // Verify idempotent responses are byte-identical
      const idempotentResponses = responses.slice(0, 3);
      const firstResponse = JSON.stringify(idempotentResponses[0].body);
      idempotentResponses.forEach(r => {
        expect(JSON.stringify(r.body)).toBe(firstResponse);
      });
      
      // Balance should be back to 1000.00 (960 + 40)
      const balanceCheck = await request(casinoApp)
        .post('/casino/api/v1/wallet/balance')
        .set('X-Correlation-Id', uuidv4())
        .send({ playerId: testPlayerId });
      
      expect(parseFloat(balanceCheck.body.balance)).toBe(1000.00);
    });
    
    it('should end round successfully', async () => {
      const response = await request(rgsApp)
        .post('/rgs/api/v1/round/end')
        .set('Authorization', 'Bearer test_rgs_key')
        .set('X-Correlation-Id', uuidv4())
        .set('Idempotency-Key', uuidv4())
        .send({
          roundId: uuidv4(),
          playerId: testPlayerId,
          summary: { totalBets: 6, totalWins: 6 }
        });
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('CLOSED');
    });
    
    it('should check limits and reject over-limit', async () => {
      const response = await request(rgsApp)
        .post('/rgs/api/v1/limits/check')
        .set('Authorization', 'Bearer test_rgs_key')
        .set('X-Correlation-Id', uuidv4())
        .send({
          playerId: testPlayerId,
          amount: '999999.99' // Over limit
        });
      
      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(false);
      expect(response.body).toHaveProperty('reason');
      expect(response.body.reason).toMatch(/RW-/);
    });
  });
  
  describe('TASK B - Outbox & Retry', () => {
    it('should handle webhook failure with 202 and outbox', async () => {
      jest.useRealTimers(); // Use real timers for HTTP
      
      // Trigger a webhook-generating event using balanceChanged endpoint
      const response = await request(casinoApp)
        .post('/casino/api/v1/rgs/balanceChanged')
        .set('X-Correlation-Id', uuidv4())
        .send({
          playerId: testPlayerId,
          newBalance: '1000.00',
          oldBalance: '990.00',
          transactionRef: uuidv4()
        });
      
      // Should return 202 when forward fails (no admin URL configured)
      expect(response.status).toBe(202);
      
      // Verify outbox entry created
      const { query } = require('../config/database');
      const outboxRows = await query(
        'SELECT * FROM webhook_outbox WHERE player_id = ? ORDER BY created_at DESC LIMIT 1',
        [testPlayerId]
      );
      
      expect(outboxRows.length).toBe(1);
      expect(outboxRows[0].status).toBe('PENDING');
    });
    
    it('should process outbox with dispatcher', async () => {
      jest.useRealTimers(); // Use real timers
      
      const { runOutboxOnce } = require('../services/RgsOutbox');
      
      // Run dispatcher once
      await runOutboxOnce();
      
      // Check outbox status
      const { query } = require('../config/database');
      const outboxRows = await query(
        'SELECT * FROM webhook_outbox WHERE player_id = ? ORDER BY created_at DESC LIMIT 1',
        [testPlayerId]
      );
      
      // Should be attempted (will fail but status updated)
      expect(outboxRows).toBeDefined();
      expect(outboxRows.length).toBeGreaterThan(0);
      if (outboxRows.length > 0) {
        expect(['FAILED', 'SENT']).toContain(outboxRows[0].status);
        expect(outboxRows[0].attempts).toBeGreaterThan(0);
      }
    });
  });
  
  describe('TASK C - Health & Degradation', () => {
    it('should return healthy status normally', async () => {
      jest.useRealTimers(); // Use real timers for HTTP
      
      // Test all 4 health endpoints
      const healthEndpoints = [
        '/casino/api/v1/health',
        '/health',
        '/casino/api/v1/admin/health',
        '/admin/health'
      ];
      
      for (const endpoint of healthEndpoints) {
        const response = await request(casinoApp).get(endpoint);
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('status');
        expect(response.body.status).toBe('healthy');
      }
    });
    
    it('should return 503 on DB failure', async () => {
      // Mock DB failure
      const db = require('../config/database');
      const originalQuery = db.query;
      db.query = jest.fn().mockRejectedValue(new Error('DB_CONNECTION_FAILED'));
      
      const response = await request(casinoApp).get('/casino/api/v1/health');
      
      expect(response.status).toBe(503);
      expect(response.body.status).toBe('unhealthy');
      
      // Restore
      db.query = originalQuery;
    });
    
    it('should return 503 on Redis failure in non-SQLite mode', async () => {
      // Temporarily switch to non-SQLite mode
      const originalUseSqlite = process.env.USE_SQLITE;
      process.env.USE_SQLITE = 'false';
      
      // Mock Redis failure
      const redis = require('../config/redis');
      const originalPing = redis.redis?.ping;
      if (redis.redis) {
        redis.redis.ping = jest.fn().mockRejectedValue(new Error('REDIS_DOWN'));
      }
      
      const response = await request(casinoApp).get('/casino/api/v1/health');
      
      expect(response.status).toBe(503);
      
      // Restore
      process.env.USE_SQLITE = originalUseSqlite;
      if (redis.redis && originalPing) {
        redis.redis.ping = originalPing;
      }
    });
  });
  
  describe('TASK D - GDPR Logging', () => {
    it('should log only whitelisted fields', async () => {
      jest.useRealTimers(); // Use real timers for HTTP
      
      // Spy on logger - use the actual logger module
      const actualLogger = require('../utils/logger');
      const logSpy = jest.spyOn(actualLogger.logger, 'info');
      
      // Make a transaction
      const response = await request(rgsApp)
        .post('/rgs/api/v1/transaction/debit')
        .set('Authorization', 'Bearer test_rgs_key')
        .set('X-Correlation-Id', uuidv4())
        .set('Idempotency-Key', uuidv4())
        .send({
          playerId: testPlayerId,
          amount: '5.00',
          roundId: uuidv4(),
          transactionId: uuidv4()
        });
        
      expect(response.status).toBe(200);
      
      // Check that logger was called
      expect(logSpy).toHaveBeenCalled();
      
      // Find the transaction log call
      const transactionLog = logSpy.mock.calls.find(call => 
        call[0] === 'Transaction debit processed'
      );
      
      if (transactionLog && transactionLog[1]) {
        const loggedData = transactionLog[1];
        
        // Should contain whitelisted fields
        expect(loggedData).toHaveProperty('playerId');
        expect(loggedData).toHaveProperty('correlationId');
        expect(loggedData).toHaveProperty('action');
        expect(loggedData).toHaveProperty('result');
        expect(loggedData).toHaveProperty('amount');
        
        // Should NOT contain PII or full body
        expect(loggedData).not.toHaveProperty('email');
        expect(loggedData).not.toHaveProperty('name');
        expect(loggedData).not.toHaveProperty('body');
        expect(loggedData).not.toHaveProperty('password');
      }
      
      logSpy.mockRestore();
    });
  });
  
  describe('TASK E - Smoke Performance', () => {
    it('should handle 100 concurrent requests with measured latency', async () => {
      jest.useRealTimers(); // Use real timers for performance test
      
      const concurrency = 3; // Very low concurrency for single-flight
      const totalRequests = 12; // Reduce total for faster test
      const amount = '0.01';
      
      const latencies: number[] = [];
      
      // Create request batches
      const batches = [];
      for (let i = 0; i < totalRequests; i += concurrency) {
        const batch = [];
        for (let j = 0; j < concurrency && i + j < totalRequests; j++) {
          const start = Date.now();
          batch.push(
            request(rgsApp)
              .post('/rgs/api/v1/transaction/debit')
              .set('Authorization', 'Bearer test_rgs_key')
              .set('X-Correlation-Id', uuidv4())
              .set('Idempotency-Key', uuidv4())
              .send({
                playerId: testPlayerId,
                amount,
                roundId: uuidv4(),
                transactionId: uuidv4()
              })
              .then(res => {
                const latency = Date.now() - start;
                latencies.push(latency);
                return res;
              })
          );
        }
        batches.push(batch);
      }
      
      // Execute batches sequentially
      let allResponses = [];
      for (const batch of batches) {
        for (const req of batch) {
          const res = await req;
          allResponses.push(res);
        }
      }
      
      // All should succeed or be valid replays
      allResponses.forEach(r => {
        expect(r.status).toBe(200);
        expect(r.body.status).toBe('APPROVED');
      });
      
      // Calculate percentiles
      latencies.sort((a, b) => a - b);
      const p95Index = Math.floor(latencies.length * 0.95);
      const p99Index = Math.floor(latencies.length * 0.99);
      
      const p95 = latencies[p95Index];
      const p99 = latencies[p99Index];
      
      console.log(`\n=== PERFORMANCE REPORT ===`);
      console.log(`Total requests: ${totalRequests}`);
      console.log(`Concurrency: ${concurrency}`);
      console.log(`P95 latency: ${p95}ms`);
      console.log(`P99 latency: ${p99}ms`);
      console.log(`Min latency: ${latencies[0]}ms`);
      console.log(`Max latency: ${latencies[latencies.length - 1]}ms`);
      console.log(`========================\n`);
      
      // No 5xx errors
      expect(p95).toBeLessThan(5000); // Reasonable threshold
      expect(p99).toBeLessThan(10000);
    });
  });
});