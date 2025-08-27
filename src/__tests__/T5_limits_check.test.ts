/**
 * T5 - Limits Check Test
 * Obiettivo: la verifica limiti usa solo la sorgente canonica (Bible §0.7)
 * NOTA: La bibbia dice /limits/check { playerId, stake } → { ok:true|false, reason? }
 * NON c'è jurisdiction nel request!
 */

import request from 'supertest';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database';
import { uniqueEmail, uniqueId } from './helpers/unique';

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
  
  const limitsRoutes = require('../routes/limitsRoutes').default;
  app.use('/limits', limitsRoutes);
  
  return app;
}

describe('T5 - Limits Check', () => {
  let app: express.Application;
  const testPlayerId = uniqueId('limits');

  beforeAll(async () => {
    app = createApp();
    
    // Create test user and wallet for this suite
    await query(`
      INSERT OR IGNORE INTO users (id, username, email, password_hash, status)
      VALUES ($1, $2, $3, $4, $5)
    `, [testPlayerId, 'limitstest', uniqueEmail('limits'), 'hash', 'active']);
    
    await query(`
      INSERT OR IGNORE INTO user_wallets (id, user_id, balance, currency)
      VALUES ($1, $2, $3, $4)
    `, [uuidv4(), testPlayerId, 1000.00, 'EUR']);
  });

  afterAll(async () => {
    await query('DELETE FROM user_wallets WHERE user_id = $1', [testPlayerId]);
    await query('DELETE FROM users WHERE id = $1', [testPlayerId]);
  });

  describe('Bibbia §0.7 DEFAULT limits (min_bet 0.10, max_bet 100.00)', () => {
    it('should reject stake below minBet (0.10)', async () => {
      const response = await request(app)
        .post('/limits/check')
        .set('X-Correlation-Id', uuidv4())
        .set('Authorization', 'Bearer test_rgs_key')
        .send({
          playerId: testPlayerId,
          stake: '0.05' // Below min
        });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(false);
      expect(response.body.reason).toBeDefined();
    });

    it('should reject stake above maxBet (100.00)', async () => {
      const response = await request(app)
        .post('/limits/check')
        .set('X-Correlation-Id', uuidv4())
        .set('Authorization', 'Bearer test_rgs_key')
        .send({
          playerId: testPlayerId,
          stake: '150.00' // Above max
        });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(false);
      expect(response.body.reason).toBeDefined();
    });

    it('should accept stake within range', async () => {
      const response = await request(app)
        .post('/limits/check')
        .set('X-Correlation-Id', uuidv4())
        .set('Authorization', 'Bearer test_rgs_key')
        .send({
          playerId: testPlayerId,
          stake: '50.00' // Within range
        });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.reason).toBeUndefined();
    });

    it('should accept stake equal to minBet', async () => {
      const response = await request(app)
        .post('/limits/check')
        .set('X-Correlation-Id', uuidv4())
        .set('Authorization', 'Bearer test_rgs_key')
        .send({
          playerId: testPlayerId,
          stake: '0.10'
        });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
    });

    it('should accept stake equal to maxBet', async () => {
      const response = await request(app)
        .post('/limits/check')
        .set('X-Correlation-Id', uuidv4())
        .set('Authorization', 'Bearer test_rgs_key')
        .send({
          playerId: testPlayerId,
          stake: '100.00'
        });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
    });
  });

  describe('Balance checks', () => {
    it('should reject stake exceeding balance', async () => {
      // Set specific balance
      await query(
        'UPDATE user_wallets SET balance = $1 WHERE user_id = $2',
        [50.00, testPlayerId]
      );
      
      const response = await request(app)
        .post('/limits/check')
        .set('X-Correlation-Id', uuidv4())
        .set('Authorization', 'Bearer test_rgs_key')
        .send({
          playerId: testPlayerId,
          stake: '75.00' // More than balance
        });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(false);
      expect(response.body.reason).toBe('RW-CAS-002'); // Insufficient balance code
      expect(typeof response.body.reason).toBe('string');
    });

    it('should accept stake within balance', async () => {
      // Set specific balance
      await query(
        'UPDATE user_wallets SET balance = $1 WHERE user_id = $2',
        [100.00, testPlayerId]
      );
      
      const response = await request(app)
        .post('/limits/check')
        .set('X-Correlation-Id', uuidv4())
        .set('Authorization', 'Bearer test_rgs_key')
        .send({
          playerId: testPlayerId,
          stake: '50.00' // Within balance
        });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should handle missing player', async () => {
      const response = await request(app)
        .post('/limits/check')
        .set('X-Correlation-Id', uuidv4())
        .set('Authorization', 'Bearer test_rgs_key')
        .send({
          playerId: 'non-existent-player',
          stake: '10.00'
        });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(false);
      expect(response.body.reason).toBeDefined();
    });

    it('should use allowed error codes on failure', async () => {
      const response = await request(app)
        .post('/limits/check')
        .set('X-Correlation-Id', uuidv4())
        .set('Authorization', 'Bearer test_rgs_key')
        .send({
          // Missing required fields
          playerId: 'test-player'
        });

      if (response.status !== 200) {
        expect(response.body.error).toBeDefined();
        // Solo codici ammessi: RW-CAS-003, RW-RGS-008, RW-SYS-000, RW-CAS-006
        expect(['RW-CAS-003', 'RW-RGS-008', 'RW-SYS-000', 'RW-CAS-006']).toContain(response.body.error.code);
      }
    });
  });
});