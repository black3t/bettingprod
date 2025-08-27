/**
 * RGS Integration Tests
 * Tests RGS mock endpoints and integration with Casino
 */

import request from 'supertest';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';

// Create test app
function createApp() {
  const app = express();
  app.use(express.json());
  
  // Mount RGS routes
  const rgsRoutes = require('../routes/rgsGameRoutes').default;
  app.use('/rgs/api/v1', rgsRoutes);
  
  // Mock Casino routes for integration
  app.post('/casino/api/v1/wallet/debit', (req, res) => {
    const { amount } = req.body;
    if (parseFloat(amount) > 1000) {
      return res.status(422).json({
        error: { code: 'RW-CAS-002', message: 'Insufficient funds' }
      });
    }
    res.json({ status: 'APPROVED', newBalance: '950.00' });
  });
  
  app.post('/casino/api/v1/wallet/credit', (req, res) => {
    res.json({ status: 'APPROVED', newBalance: '1050.00' });
  });
  
  app.post('/casino/api/v1/limits/check', (req, res) => {
    const { stake } = req.body;
    res.json({ 
      ok: parseFloat(stake) <= 100,
      reason: parseFloat(stake) > 100 ? 'RW-CAS-003' : undefined
    });
  });
  
  return app;
}

describe('RGS Integration Tests', () => {
  let app: express.Application;
  let server: any;
  
  beforeAll((done) => {
    app = createApp();
    // Start test server
    server = app.listen(3099, () => {
      process.env.CASINO_BASE_URL = 'http://localhost:3099';
      done();
    });
  });
  
  afterAll((done) => {
    if (server) {
      server.close(done);
    } else {
      done();
    }
  });
  
  describe('Authentication & Session', () => {
    it('should generate auth token', async () => {
      const response = await request(app)
        .post('/rgs/api/v1/auth/token')
        .set('Authorization', 'Bearer test_rgs_key')
        .set('X-Correlation-Id', uuidv4())
        .send({ playerId: 'test-player' });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('expiresIn');
    });
    
    it('should validate session', async () => {
      const response = await request(app)
        .post('/rgs/api/v1/session/validate')
        .set('Authorization', 'Bearer test_rgs_key')
        .set('X-Correlation-Id', uuidv4())
        .send({ playerId: 'test-player' });
      
      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(true);
      expect(response.body).toHaveProperty('limits');
      expect(response.body).toHaveProperty('balance');
    });
    
    it('should start session', async () => {
      const response = await request(app)
        .post('/rgs/api/v1/session/start')
        .set('Authorization', 'Bearer test_rgs_key')
        .set('X-Correlation-Id', uuidv4())
        .send({ 
          playerId: 'test-player',
          gameId: 'rawwar-v1'
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('sessionId');
      expect(response.body).toHaveProperty('launchUrl');
    });
    
    it('should keep session alive', async () => {
      const response = await request(app)
        .post('/rgs/api/v1/session/keepalive')
        .set('Authorization', 'Bearer test_rgs_key')
        .set('X-Correlation-Id', uuidv4())
        .send({ sessionId: uuidv4() });
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('alive');
    });
    
    it('should close session', async () => {
      const response = await request(app)
        .post('/rgs/api/v1/session/close')
        .set('Authorization', 'Bearer test_rgs_key')
        .set('X-Correlation-Id', uuidv4())
        .send({ sessionId: uuidv4() });
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('closed');
    });
  });
  
  describe('Round Management', () => {
    it('should start round', async () => {
      const response = await request(app)
        .post('/rgs/api/v1/round/start')
        .set('Authorization', 'Bearer test_rgs_key')
        .set('X-Correlation-Id', uuidv4())
        .set('Idempotency-Key', uuidv4())
        .send({
          playerId: 'test-player',
          gameId: 'rawwar-v1',
          roundId: uuidv4()
        });
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('STARTED');
      expect(response.body).toHaveProperty('sessionId');
    });
    
    it('should end round', async () => {
      const response = await request(app)
        .post('/rgs/api/v1/round/end')
        .set('Authorization', 'Bearer test_rgs_key')
        .set('X-Correlation-Id', uuidv4())
        .set('Idempotency-Key', uuidv4())
        .send({
          playerId: 'test-player',
          roundId: uuidv4(),
          summary: { totalBets: 2, totalWins: 1 }
        });
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('CLOSED');
    });
  });
  
  describe('Transactions', () => {
    it('should process debit transaction', async () => {
      const response = await request(app)
        .post('/rgs/api/v1/transaction/debit')
        .set('Authorization', 'Bearer test_rgs_key')
        .set('X-Correlation-Id', uuidv4())
        .set('Idempotency-Key', uuidv4())
        .send({
          playerId: 'test-player',
          amount: '10.00',
          roundId: uuidv4(),
          transactionId: uuidv4()
        });
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('APPROVED');
      expect(response.body).toHaveProperty('newBalance');
    });
    
    it('should process credit transaction', async () => {
      const response = await request(app)
        .post('/rgs/api/v1/transaction/credit')
        .set('Authorization', 'Bearer test_rgs_key')
        .set('X-Correlation-Id', uuidv4())
        .set('Idempotency-Key', uuidv4())
        .send({
          playerId: 'test-player',
          amount: '50.00',
          roundId: uuidv4(),
          transactionId: uuidv4()
        });
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('APPROVED');
      expect(response.body).toHaveProperty('newBalance');
    });
    
    it('should handle insufficient funds', async () => {
      const response = await request(app)
        .post('/rgs/api/v1/transaction/debit')
        .set('Authorization', 'Bearer test_rgs_key')
        .set('X-Correlation-Id', uuidv4())
        .set('Idempotency-Key', uuidv4())
        .send({
          playerId: 'test-player',
          amount: '10000.00', // Exceeds balance
          roundId: uuidv4()
        });
      
      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('RW-RGS-002');
    });
    
    it('should validate amount format', async () => {
      const response = await request(app)
        .post('/rgs/api/v1/transaction/debit')
        .set('Authorization', 'Bearer test_rgs_key')
        .set('X-Correlation-Id', uuidv4())
        .set('Idempotency-Key', uuidv4())
        .send({
          playerId: 'test-player',
          amount: '10.123', // Invalid format
          roundId: uuidv4()
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('RW-RGS-006');
    });
  });
  
  describe('Betting', () => {
    it('should place bet', async () => {
      const response = await request(app)
        .post('/rgs/api/v1/bet')
        .set('Authorization', 'Bearer test_rgs_key')
        .set('X-Correlation-Id', uuidv4())
        .set('Idempotency-Key', uuidv4())
        .send({
          playerId: 'test-player',
          amount: '10.00',
          betDetails: { type: 'WINNER', selection: [3] }
        });
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ACCEPTED');
      expect(response.body).toHaveProperty('betId');
    });
    
    it('should process win', async () => {
      const response = await request(app)
        .post('/rgs/api/v1/win')
        .set('Authorization', 'Bearer test_rgs_key')
        .set('X-Correlation-Id', uuidv4())
        .set('Idempotency-Key', uuidv4())
        .send({
          playerId: 'test-player',
          amount: '76.40',
          winDetails: { betId: uuidv4() }
        });
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('CREDITED');
      expect(response.body).toHaveProperty('winId');
    });
    
    it('should rollback transaction', async () => {
      const response = await request(app)
        .post('/rgs/api/v1/rollback')
        .set('Authorization', 'Bearer test_rgs_key')
        .set('X-Correlation-Id', uuidv4())
        .set('Idempotency-Key', uuidv4())
        .send({
          playerId: 'test-player',
          transactionId: uuidv4(),
          amount: '10.00'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ROLLED_BACK');
    });
  });
  
  describe('Limits', () => {
    it('should check limits', async () => {
      const response = await request(app)
        .post('/rgs/api/v1/limits/check')
        .set('Authorization', 'Bearer test_rgs_key')
        .set('X-Correlation-Id', uuidv4())
        .send({
          playerId: 'test-player',
          amount: '50.00'
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('ok');
      expect(response.body.ok).toBe(true);
    });
    
    it('should reject over limit', async () => {
      const response = await request(app)
        .post('/rgs/api/v1/limits/check')
        .set('Authorization', 'Bearer test_rgs_key')
        .set('X-Correlation-Id', uuidv4())
        .send({
          playerId: 'test-player',
          amount: '200.00' // Over limit
        });
      
      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(false);
      expect(response.body.reason).toBe('RW-CAS-003');
    });
  });
  
  describe('Player State', () => {
    it('should get player state', async () => {
      const response = await request(app)
        .get('/rgs/api/v1/player/state')
        .set('Authorization', 'Bearer test_rgs_key')
        .set('X-Correlation-Id', uuidv4())
        .query({ playerId: 'test-player' });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('playerId');
      expect(response.body).toHaveProperty('activeSessions');
      expect(response.body).toHaveProperty('sessionStatus');
    });
    
    it('should require player ID', async () => {
      const response = await request(app)
        .get('/rgs/api/v1/player/state')
        .set('Authorization', 'Bearer test_rgs_key')
        .set('X-Correlation-Id', uuidv4());
      
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('RW-RGS-001');
    });
  });
  
  describe('Idempotency', () => {
    it('should handle idempotent requests', async () => {
      const idempotencyKey = uuidv4();
      const payload = {
        playerId: 'test-player',
        amount: '10.00',
        roundId: uuidv4(),
        transactionId: uuidv4()
      };
      
      // First request
      const response1 = await request(app)
        .post('/rgs/api/v1/transaction/debit')
        .set('Authorization', 'Bearer test_rgs_key')
        .set('X-Correlation-Id', uuidv4())
        .set('Idempotency-Key', idempotencyKey)
        .send(payload);
      
      // Second request with same idempotency key
      const response2 = await request(app)
        .post('/rgs/api/v1/transaction/debit')
        .set('Authorization', 'Bearer test_rgs_key')
        .set('X-Correlation-Id', uuidv4())
        .set('Idempotency-Key', idempotencyKey)
        .send(payload);
      
      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(response1.body).toEqual(response2.body); // Byte-identical
    });
    
    it('should require idempotency key for critical operations', async () => {
      const response = await request(app)
        .post('/rgs/api/v1/transaction/debit')
        .set('Authorization', 'Bearer test_rgs_key')
        .set('X-Correlation-Id', uuidv4())
        .send({
          playerId: 'test-player',
          amount: '10.00',
          roundId: uuidv4()
        });
      
      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('RW-CAS-010');
    });
  });
  
  describe('Error Handling', () => {
    it('should require authorization', async () => {
      const response = await request(app)
        .post('/rgs/api/v1/session/validate')
        .set('X-Correlation-Id', uuidv4())
        .send({ playerId: 'test-player' });
      
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('RW-CAS-008');
    });
    
    it('should require correlation ID', async () => {
      const response = await request(app)
        .post('/rgs/api/v1/session/validate')
        .set('Authorization', 'Bearer test_rgs_key')
        .send({ playerId: 'test-player' });
      
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('RW-CAS-008');
    });
    
    it('should validate correlation ID format', async () => {
      const response = await request(app)
        .post('/rgs/api/v1/session/validate')
        .set('Authorization', 'Bearer test_rgs_key')
        .set('X-Correlation-Id', 'invalid-uuid')
        .send({ playerId: 'test-player' });
      
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('RW-CAS-008');
    });
  });
});