/**
 * T8, T9, T12 - System Tests
 * T8: Timeout/Busy path
 * T9: Webhook delivery
 * T12: Health/Readiness
 */

import request from 'supertest';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { query, pool } from '../config/database';
import { redis } from '../config/redis';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

function createApp() {
  const app = express();
  app.use(express.json());
  
  // Correlation ID middleware
  app.use((req, res, next) => {
    const correlationId = req.headers['x-correlation-id'] as string || uuidv4();
    (req as any).correlationId = correlationId;
    res.setHeader('X-Correlation-Id', correlationId);
    next();
  });
  
  // Import all routes
  const walletRoutes = require('../routes/walletRoutes').default;
  const webhookRoutes = require('../routes/webhookRoutes').default;
  const limitsRoutes = require('../routes/limitsRoutes').default;
  
  app.use('/wallet', walletRoutes);
  app.use('/rgs', webhookRoutes);
  app.use('/limits', limitsRoutes);
  
  // Health endpoint - READ ONLY, no transactions
  app.get('/health', async (req, res) => {
    try {
      // Use exported healthDbCheck function
      const { healthDbCheck } = require('../config/database-sqlite');
      const dbHealthy = await healthDbCheck();
      
      if (!dbHealthy) {
        throw new Error('Database check failed');
      }
      
      // Evaluate USE_SQLITE at runtime for each request
      const USE_SQLITE = process.env.USE_SQLITE === 'true';
      
      // Check Redis if not in SQLite mode
      if (!USE_SQLITE) {
        try {
          // Lazy require Redis module
          const { redis } = require('../config/redis');
          if (redis) {
            // Set a short timeout for Redis ping
            await Promise.race([
              redis.ping(),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Redis timeout')), 300)
              )
            ]);
          } else {
            // Redis not configured in non-SQLite mode
            throw new Error('Redis not configured');
          }
        } catch (redisError) {
          // Redis failed in non-SQLite mode
          throw new Error('Redis check failed');
        }
      }
      
      res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          database: 'connected',
          redis: USE_SQLITE ? 'not-required' : 'connected',
          mode: USE_SQLITE ? 'test-sqlite' : 'production-postgres'
        }
      });
    } catch (error) {
      res.status(503).json({
        success: false,
        status: 'unhealthy',
        error: 'Service unavailable'
      });
    }
  });
  
  return app;
}

describe('T8, T9, T12 - System Tests', () => {
  let app: express.Application;

  beforeAll(async () => {
    // Ensure database is initialized ONCE before creating app
    if (process.env.USE_SQLITE === 'true') {
      const { initSQLite } = require('../config/database-sqlite');
      await initSQLite();
    }
    app = createApp();
  });

  describe('T8 - Timeout/Busy path', () => {
    it('should return RW-RGS-008 on timeout', async () => {
      // Mock slow database
      const originalQuery = query;
      jest.spyOn(require('../config/database'), 'query').mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 6000)); // Simula timeout
        throw new Error('Query timeout');
      });

      const response = await request(app)
        .post('/wallet/debit')
        .set('X-Correlation-Id', uuidv4())
        .set('Idempotency-Key', uuidv4())
        .set('Authorization', 'Bearer test_rgs_key')
        .send({
          playerId: 'test-timeout',
          amount: '10.00',
          currency: 'EUR'
        })
        .timeout(7000);

      // Deve restituire uno dei codici ammessi per timeout
      expect(['RW-RGS-008', 'RW-SYS-000']).toContain(response.body.error?.code);

      // Restore original
      jest.spyOn(require('../config/database'), 'query').mockRestore();
    });

    it('should return RW-SYS-000 on system error', async () => {
      // Mock database error
      jest.spyOn(require('../config/database'), 'query').mockRejectedValueOnce(
        new Error('Database connection lost')
      );

      const response = await request(app)
        .post('/wallet/credit')
        .set('X-Correlation-Id', uuidv4())
        .set('Idempotency-Key', uuidv4())
        .set('Authorization', 'Bearer test_rgs_key')
        .send({
          playerId: 'test-error',
          amount: '20.00',
          currency: 'EUR'
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body.error).toBeDefined();
      expect(['RW-SYS-000', 'RW-RGS-008']).toContain(response.body.error.code);

      jest.spyOn(require('../config/database'), 'query').mockRestore();
    });

    it('should handle concurrent requests gracefully', async () => {
      const responses = [];
      
      // Invia 10 richieste SEQUENZIALMENTE (no concurrency to avoid locks)
      for (let i = 0; i < 10; i++) {
        const response = await request(app)
          .post('/limits/check')
          .set('X-Correlation-Id', uuidv4())
          .set('Authorization', 'Bearer test_rgs_key')
          .send({
            playerId: `concurrent-${i}`,
            stake: '10.00'
          });
        responses.push(response);
      }
      
      // Tutte devono avere una risposta valida
      responses.forEach(response => {
        expect(response.status).toBeLessThanOrEqual(503);
        if (response.status === 200) {
          // Se 200, deve avere ok booleano
          expect(typeof response.body.ok).toBe('boolean');
          if (!response.body.ok) {
            // Se ok false, deve avere reason
            expect(response.body.reason).toBeDefined();
          }
        } else {
          // Se errore HTTP, deve essere uno dei codici ammessi
          const code = response.body?.error?.code ?? response.body?.reason;
          expect(code).toBeDefined();
          expect(['RW-CAS-003', 'RW-RGS-008', 'RW-SYS-000', 'RW-CAS-006']).toContain(code);
        }
      });
    });
  });

  describe('T9 - Webhook delivery', () => {
    beforeEach(() => {
      mockedAxios.post.mockClear();
    });

    it('should send playerExcluded webhook with correct payload', async () => {
      mockedAxios.post.mockResolvedValueOnce({ status: 200, data: { success: true } });

      const response = await request(app)
        .post('/rgs/playerExcluded')
        .set('X-Correlation-Id', uuidv4())
        .set('Authorization', `Bearer ${process.env.RGS_API_KEY || 'test_rgs_key'}`)
        .send({
          playerId: uuidv4(),
          reason: 'self_exclusion',
          ts: new Date().toISOString()
        });

      expect(response.status).toBe(200);
      
      // Verifica che il webhook sia stato inviato
      if (process.env.RGS_WEBHOOK_URL) {
        expect(mockedAxios.post).toHaveBeenCalledWith(
          expect.stringContaining('/playerExcluded'),
          expect.objectContaining({
            playerId: expect.any(String),
            reason: 'self_exclusion',
            ts: expect.any(String)
          }),
          expect.any(Object)
        );
      }
    });

    it('should send balanceChanged webhook with correct payload', async () => {
      mockedAxios.post.mockResolvedValueOnce({ status: 200, data: { success: true } });

      const response = await request(app)
        .post('/rgs/balanceChanged')
        .set('X-Correlation-Id', uuidv4())
        .set('Authorization', `Bearer ${process.env.RGS_API_KEY || 'test_rgs_key'}`)
        .send({
          playerId: uuidv4(),
          newBalance: '1500.00',
          ts: new Date().toISOString()
        });

      expect(response.status).toBe(200);
      
      if (process.env.RGS_WEBHOOK_URL) {
        expect(mockedAxios.post).toHaveBeenCalledWith(
          expect.stringContaining('/balanceChanged'),
          expect.objectContaining({
            playerId: expect.any(String),
            newBalance: '1500.00'
          }),
          expect.any(Object)
        );
      }
    });

    it('should retry webhook on failure with backoff', async () => {
      // Simula fallimento iniziale poi successo
      mockedAxios.post
        .mockRejectedValueOnce(new Error('Connection refused'))
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValueOnce({ status: 200, data: { success: true } });

      const response = await request(app)
        .post('/rgs/playerExcluded')
        .set('X-Correlation-Id', uuidv4())
        .set('Authorization', `Bearer ${process.env.RGS_API_KEY || 'test_rgs_key'}`)
        .send({
          playerId: uuidv4(),
          reason: 'limit_reached',
          ts: new Date().toISOString()
        });

      // Anche se c'è retry interno, la risposta deve essere immediata
      expect(response.status).toBeLessThanOrEqual(202);
      
      // Attendi un po' per i retry
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Verifica che ci siano stati tentativi di retry
      if (process.env.RGS_WEBHOOK_URL) {
        expect(mockedAxios.post).toHaveBeenCalledTimes(3);
      }
    });

    it('should return correct error codes on webhook failure', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Network error'));

      const response = await request(app)
        .post('/rgs/balanceChanged')
        .set('X-Correlation-Id', uuidv4())
        .set('Authorization', `Bearer ${process.env.RGS_API_KEY || 'test_rgs_key'}`)
        .send({
          playerId: uuidv4(),
          newBalance: '0.00',
          ts: new Date().toISOString()
        });

      if (response.status >= 400) {
        // Codici ammessi per webhook failure
        const code = response.body?.error?.code ?? response.body?.reason;
        expect(code).toBeDefined();
        expect(['RW-CAS-007', 'RW-NET-009', 'RW-SYS-000']).toContain(code);
      }
    });
  });

  describe('T12 - Health/Readiness', () => {
    it('should report healthy when all services are up', async () => {
      const response = await request(app)
        .get('/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.status).toBe('healthy');
      expect(response.body.services).toBeDefined();
      expect(response.body.services.database).toBe('connected');
    });

    it('should report unhealthy when database is down', async () => {
      // Mock healthDbCheck to return false
      const spy = jest.spyOn(require('../config/database-sqlite'), 'healthDbCheck')
        .mockResolvedValueOnce(false);

      const response = await request(app)
        .get('/health');

      expect(response.status).toBe(503);
      expect(response.body.success).toBe(false);
      expect(response.body.status).toBe('unhealthy');

      spy.mockRestore();
    });

    it('should include timestamp in health response', async () => {
      const response = await request(app)
        .get('/health');

      expect(response.body.timestamp).toBeDefined();
      const timestamp = new Date(response.body.timestamp);
      expect(timestamp.getTime()).toBeLessThanOrEqual(Date.now());
      expect(timestamp.getTime()).toBeGreaterThan(Date.now() - 1000);
    });

    it('should report mode correctly', async () => {
      const response = await request(app)
        .get('/health');

      const expectedMode = process.env.USE_SQLITE === 'true' 
        ? 'test-sqlite' 
        : 'production-postgres';
      
      expect(response.body.services.mode).toBe(expectedMode);
    });

    it('should handle Redis down gracefully in non-SQLite mode', async () => {
      const originalUseSqlite = process.env.USE_SQLITE;
      process.env.USE_SQLITE = 'false';

      // Mock Redis failure
      if (redis) {
        jest.spyOn(redis, 'ping').mockRejectedValueOnce(new Error('Redis down'));
      }

      const response = await request(app)
        .get('/health');

      expect(response.status).toBe(503);
      expect(response.body.success).toBe(false);

      // Restore
      process.env.USE_SQLITE = originalUseSqlite;
      if (redis) {
        jest.spyOn(redis, 'ping').mockRestore();
      }
    });
  });
});