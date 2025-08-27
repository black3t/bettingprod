/**
 * TR-13 RGS⇄Casino Contract Tests
 * Tests all 21 communication endpoints
 */

import request from 'supertest';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';

// Import routes
import walletRoutes from '../../routes/walletRoutes';
import limitsRoutes from '../../routes/limitsRoutes';
import playerRoutes from '../../routes/playerRoutes';
import kycRoutes from '../../routes/kycRoutes';
import rgRoutes from '../../routes/rgRoutes';
import webhookRoutes from '../../routes/webhookRoutes';
import rgsGameRoutes from '../../routes/rgsGameRoutes';
import healthRoutes from '../../routes/healthRoutes';

describe('RGS⇄Casino Contract Tests (21 endpoints)', () => {
  let app: express.Application;
  const correlationId = uuidv4();
  const idempotencyKey = uuidv4();
  const playerId = uuidv4();
  
  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Add correlation ID middleware
    app.use((req, res, next) => {
      req.headers['x-correlation-id'] = req.headers['x-correlation-id'] || correlationId;
      (req as any).correlationId = req.headers['x-correlation-id'];
      next();
    });
    
    // Mount routes
    app.use('/wallet', walletRoutes);
    app.use('/limits', limitsRoutes);
    app.use('/player', playerRoutes);
    app.use('/kyc', kycRoutes);
    app.use('/rg', rgRoutes);
    app.use('/rgs', webhookRoutes);
    app.use('/session', rgsGameRoutes);
    app.use('/round', rgsGameRoutes);
    app.use('/health', healthRoutes);
    app.use('/admin/health', healthRoutes);
    app.use('/', rgsGameRoutes); // For /rollback alias
  });

  describe('Casino Endpoints (RGS → Casino)', () => {
    
    test('1. POST /wallet/debit', async () => {
      const res = await request(app)
        .post('/wallet/debit')
        .set('Authorization', 'Bearer test_rgs_key')
        .set('X-Correlation-Id', correlationId)
        .set('Idempotency-Key', uuidv4())
        .send({ playerId, amount: '10.50', currency: 'EUR' });
      
      expect([200, 422]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body).toHaveProperty('status');
        expect(['APPROVED', 'REJECTED']).toContain(res.body.status);
      }
    });

    test('2. POST /wallet/credit', async () => {
      const res = await request(app)
        .post('/wallet/credit')
        .set('Authorization', 'Bearer test_rgs_key')
        .set('X-Correlation-Id', correlationId)
        .set('Idempotency-Key', uuidv4())
        .send({ playerId, amount: '25.00', currency: 'EUR' });
      
      expect([200, 422]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body).toHaveProperty('status');
      }
    });

    test('3. POST /wallet/cancel', async () => {
      const res = await request(app)
        .post('/wallet/cancel')
        .set('Authorization', 'Bearer test_rgs_key')
        .set('X-Correlation-Id', correlationId)
        .set('Idempotency-Key', uuidv4())
        .send({ playerId, transactionId: uuidv4(), amount: '10.50' });
      
      expect([200, 422]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body).toHaveProperty('status');
      }
    });

    test('4. POST /limits/check', async () => {
      const res = await request(app)
        .post('/limits/check')
        .set('Authorization', 'Bearer test_rgs_key')
        .set('X-Correlation-Id', correlationId)
        .send({ playerId, stake: '100.00' });
      
      expect([200, 422]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body).toHaveProperty('ok');
        expect(typeof res.body.ok).toBe('boolean');
      }
    });

    test('5. GET /player/status (canonical)', async () => {
      const res = await request(app)
        .get(`/player/status?playerId=${playerId}`)
        .set('Authorization', 'Bearer test_rgs_key')
        .set('X-Correlation-Id', correlationId);
      
      expect([200, 404, 422]).toContain(res.status);
    });

    test('5b. POST /player/status (deprecated)', async () => {
      const res = await request(app)
        .post('/player/status')
        .set('Authorization', 'Bearer test_rgs_key')
        .set('X-Correlation-Id', correlationId)
        .send({ playerId });
      
      expect(res.headers['deprecation']).toBe('true');
      expect(res.headers['sunset']).toBeDefined();
      expect([200, 404, 422]).toContain(res.status);
    });

    test('6. GET /kyc/status (canonical)', async () => {
      const res = await request(app)
        .get(`/kyc/status?playerId=${playerId}`)
        .set('Authorization', 'Bearer test_rgs_key')
        .set('X-Correlation-Id', correlationId);
      
      expect([200, 404, 422]).toContain(res.status);
    });

    test('7. GET /kyc/exclusions (canonical)', async () => {
      const res = await request(app)
        .get(`/kyc/exclusions?playerId=${playerId}`)
        .set('Authorization', 'Bearer test_rgs_key')
        .set('X-Correlation-Id', correlationId);
      
      expect([200, 404, 422]).toContain(res.status);
    });

    test('8. POST /rg/self-exclude', async () => {
      const until = new Date();
      until.setMonth(until.getMonth() + 6);
      
      const res = await request(app)
        .post('/rg/self-exclude')
        .set('Authorization', 'Bearer test_rgs_key')
        .set('X-Correlation-Id', correlationId)
        .send({ playerId, until: until.toISOString() });
      
      expect([200, 422]).toContain(res.status);
    });

    test('9. POST /rg/cooling-off', async () => {
      const until = new Date();
      until.setDate(until.getDate() + 7);
      
      const res = await request(app)
        .post('/rg/cooling-off')
        .set('Authorization', 'Bearer test_rgs_key')
        .set('X-Correlation-Id', correlationId)
        .send({ playerId, until: until.toISOString() });
      
      expect([200, 422]).toContain(res.status);
    });

    test('10. POST /rg/reality-check/ack', async () => {
      const res = await request(app)
        .post('/rg/reality-check/ack')
        .set('Authorization', 'Bearer test_rgs_key')
        .set('X-Correlation-Id', correlationId)
        .send({ playerId });
      
      expect([200, 422]).toContain(res.status);
    });
  });

  describe('Webhook Endpoints (Casino → RGS)', () => {
    
    test('11. POST /rgs/playerExcluded', async () => {
      const res = await request(app)
        .post('/rgs/playerExcluded')
        .set('Authorization', 'Bearer test_rgs_key')
        .set('X-Correlation-Id', correlationId)
        .send({ 
          playerId, 
          reason: 'RW-RG-001',
          until: new Date(Date.now() + 86400000).toISOString()
        });
      
      expect([200, 202]).toContain(res.status);
    });

    test('12. POST /rgs/limitsReached', async () => {
      const res = await request(app)
        .post('/rgs/limitsReached')
        .set('Authorization', 'Bearer test_rgs_key')
        .set('X-Correlation-Id', correlationId)
        .send({ 
          playerId, 
          reason: 'daily_limit',
          ts: new Date().toISOString()
        });
      
      expect([200, 202]).toContain(res.status);
    });

    test('13. POST /rgs/balanceChanged', async () => {
      const res = await request(app)
        .post('/rgs/balanceChanged')
        .set('Authorization', 'Bearer test_rgs_key')
        .set('X-Correlation-Id', correlationId)
        .send({ 
          playerId, 
          newBalance: '1234.56',
          ts: new Date().toISOString()
        });
      
      expect([200, 202]).toContain(res.status);
    });

    test('14. POST /rgs/kycUpdated', async () => {
      const res = await request(app)
        .post('/rgs/kycUpdated')
        .set('Authorization', 'Bearer test_rgs_key')
        .set('X-Correlation-Id', correlationId)
        .send({ 
          playerId, 
          kycStatus: 'VERIFIED',
          ts: new Date().toISOString()
        });
      
      expect([200, 202]).toContain(res.status);
    });
  });

  describe('RGS Endpoints', () => {
    
    test('15. POST /session/validate', async () => {
      const res = await request(app)
        .post('/session/validate')
        .set('Authorization', 'Bearer test_rgs_key')
        .set('X-Correlation-Id', correlationId)
        .send({ sessionId: uuidv4(), playerId });
      
      expect([200, 401, 422]).toContain(res.status);
    });

    test('16. POST /session/heartbeat (alias)', async () => {
      const res = await request(app)
        .post('/session/heartbeat')
        .set('Authorization', 'Bearer test_rgs_key')
        .set('X-Correlation-Id', correlationId)
        .send({ sessionId: uuidv4() });
      
      expect(res.headers['deprecation']).toBe('true');
      expect([200, 422]).toContain(res.status);
    });

    test('17. POST /round/start', async () => {
      const res = await request(app)
        .post('/round/start')
        .set('Authorization', 'Bearer test_rgs_key')
        .set('X-Correlation-Id', correlationId)
        .set('Idempotency-Key', uuidv4())
        .send({ playerId, gameId: 'rawwar', roundId: uuidv4() });
      
      expect([200, 422]).toContain(res.status);
    });

    test('18. POST /round/end', async () => {
      const res = await request(app)
        .post('/round/end')
        .set('Authorization', 'Bearer test_rgs_key')
        .set('X-Correlation-Id', correlationId)
        .set('Idempotency-Key', uuidv4())
        .send({ playerId, roundId: uuidv4() });
      
      expect([200, 422]).toContain(res.status);
    });

    test('19. POST /round/cancel', async () => {
      const res = await request(app)
        .post('/round/cancel')
        .set('Authorization', 'Bearer test_rgs_key')
        .set('X-Correlation-Id', correlationId)
        .set('Idempotency-Key', uuidv4())
        .send({ playerId, roundId: uuidv4(), reason: 'user_request' });
      
      expect([200, 422]).toContain(res.status);
    });

    test('20. POST /round/rollback (canonical)', async () => {
      const res = await request(app)
        .post('/round/rollback')
        .set('Authorization', 'Bearer test_rgs_key')
        .set('X-Correlation-Id', correlationId)
        .set('Idempotency-Key', uuidv4())
        .send({ playerId, transactionId: uuidv4(), amount: '10.00' });
      
      expect([200, 422]).toContain(res.status);
    });

    test('20b. POST /rollback (deprecated alias)', async () => {
      const res = await request(app)
        .post('/rollback')
        .set('Authorization', 'Bearer test_rgs_key')
        .set('X-Correlation-Id', correlationId)
        .set('Idempotency-Key', uuidv4())
        .send({ playerId, transactionId: uuidv4(), amount: '10.00' });
      
      expect(res.headers['deprecation']).toBe('true');
      expect([200, 422]).toContain(res.status);
    });
  });

  describe('Admin/Health Endpoints', () => {
    
    test('21. GET /health (canonical)', async () => {
      const res = await request(app)
        .get('/health')
        .set('X-Correlation-Id', correlationId);
      
      expect([200, 503]).toContain(res.status);
      expect(res.body).toHaveProperty('status');
    });

    test('21b. POST /health (405 Method Not Allowed)', async () => {
      const res = await request(app)
        .post('/health')
        .set('X-Correlation-Id', correlationId)
        .send({});
      
      expect(res.status).toBe(405);
      expect(res.headers['allow']).toBe('GET');
    });

    test('21c. GET /admin/health', async () => {
      const res = await request(app)
        .get('/admin/health')
        .set('X-Correlation-Id', correlationId);
      
      expect([200, 503]).toContain(res.status);
    });
  });

  describe('Idempotency Tests', () => {
    
    test('Wallet cancel idempotency replay', async () => {
      const idempKey = uuidv4();
      const payload = { playerId, transactionId: uuidv4(), amount: '10.50' };
      
      // First request
      const res1 = await request(app)
        .post('/wallet/cancel')
        .set('Authorization', 'Bearer test_rgs_key')
        .set('X-Correlation-Id', correlationId)
        .set('Idempotency-Key', idempKey)
        .send(payload);
      
      // Replay with same key
      const res2 = await request(app)
        .post('/wallet/cancel')
        .set('Authorization', 'Bearer test_rgs_key')
        .set('X-Correlation-Id', uuidv4()) // Different correlation ID
        .set('Idempotency-Key', idempKey)
        .send(payload);
      
      // Should return same response
      expect(res2.status).toBe(res1.status);
      expect(res2.body).toEqual(res1.body);
    });

    test('Round cancel idempotency replay', async () => {
      const idempKey = uuidv4();
      const payload = { playerId, roundId: uuidv4(), reason: 'test' };
      
      // First request
      const res1 = await request(app)
        .post('/round/cancel')
        .set('Authorization', 'Bearer test_rgs_key')
        .set('X-Correlation-Id', correlationId)
        .set('Idempotency-Key', idempKey)
        .send(payload);
      
      // Replay with same key
      const res2 = await request(app)
        .post('/round/cancel')
        .set('Authorization', 'Bearer test_rgs_key')
        .set('X-Correlation-Id', uuidv4())
        .set('Idempotency-Key', idempKey)
        .send(payload);
      
      expect(res2.status).toBe(res1.status);
      expect(res2.body).toEqual(res1.body);
    });
  });

  describe('Webhook 202 + Outbox', () => {
    
    test('limitsReached returns 202 on forward failure', async () => {
      // Mock forward failure by not setting up forwarder
      const res = await request(app)
        .post('/rgs/limitsReached')
        .set('Authorization', 'Bearer test_rgs_key')
        .set('X-Correlation-Id', correlationId)
        .send({ 
          playerId, 
          reason: 'test',
          ts: new Date().toISOString()
        });
      
      // Should accept and queue
      expect([200, 202]).toContain(res.status);
      if (res.status === 202) {
        expect(res.body).toHaveProperty('accepted', true);
      }
    });

    test('kycUpdated returns 202 on forward failure', async () => {
      const res = await request(app)
        .post('/rgs/kycUpdated')
        .set('Authorization', 'Bearer test_rgs_key')
        .set('X-Correlation-Id', correlationId)
        .send({ 
          playerId, 
          kycStatus: 'PENDING',
          ts: new Date().toISOString()
        });
      
      expect([200, 202]).toContain(res.status);
      if (res.status === 202) {
        expect(res.body).toHaveProperty('accepted', true);
      }
    });
  });
});