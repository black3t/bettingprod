/**
 * T3, T4, T6 - Wallet Operations Tests
 * T3: Fondi insufficienti
 * T4: Currency binding
 * T6: Debit-Credit round-trip
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
    const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    
    if (!UUID_V4_REGEX.test(correlationId)) {
      return res.status(400).json({
        error: {
          code: 'RW-CAS-008',
          message: 'X-Correlation-Id must be valid UUID v4 format'
        }
      });
    }
    
    (req as any).correlationId = correlationId;
    res.setHeader('X-Correlation-Id', correlationId);
    next();
  });
  
  const walletRoutes = require('../routes/walletRoutes').default;
  app.use('/wallet', walletRoutes);
  
  return app;
}

describe('T3, T4, T6 - Wallet Operations', () => {
  let app: express.Application;
  const testPlayerId = uniqueId('wallet');
  const testWalletId = uuidv4();

  beforeAll(async () => {
    app = createApp();
    
    // Create test user first
    await query(`
      INSERT OR IGNORE INTO users (id, username, email, password_hash, status)
      VALUES ($1, $2, $3, $4, $5)
    `, [testPlayerId, 'wallet_test_user', uniqueEmail('wallet'), 'hash', 'active']);
    
    await query(`
      INSERT INTO user_wallets (id, user_id, balance, currency)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id) DO UPDATE SET balance = $3, currency = $4
    `, [testWalletId, testPlayerId, 100.00, 'EUR']);
  });

  afterAll(async () => {
    await query('DELETE FROM wallet_transactions WHERE user_id = $1', [testPlayerId]);
    await query('DELETE FROM idempotency_keys WHERE key LIKE $1', ['%test-wallet%']);
    await query('DELETE FROM user_wallets WHERE user_id = $1', [testPlayerId]);
    await query('DELETE FROM users WHERE id = $1', [testPlayerId]);
  });

  describe('T3 - Fondi insufficienti', () => {
    it('should reject debit when amount exceeds balance', async () => {
      // Ottieni balance corrente
      const walletResult = await query(
        'SELECT balance FROM user_wallets WHERE user_id = $1',
        [testPlayerId]
      );
      const currentBalance = parseFloat(walletResult.rows[0].balance);
      
      // Tenta di addebitare più del saldo
      const excessAmount = (currentBalance + 50).toFixed(2);
      
      const response = await request(app)
        .post('/wallet/debit')
        .set('X-Correlation-Id', uuidv4())
        .set('Authorization', 'Bearer test_rgs_key')
        .set('Idempotency-Key', uuidv4())
        .send({
          playerId: testPlayerId,
          amount: excessAmount,
          currency: 'EUR',
        });

      // Deve essere rifiutato - la bibbia dice status 200 con REJECTED
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('REJECTED');
      expect(response.body.reason).toBe('RW-CAS-002'); // Insufficient funds
      expect(response.body.reason).toMatch(/^RW-(CAS|RGS)-\d{3}$/)
      
      // Verifica che il saldo non sia cambiato
      const newWalletResult = await query(
        'SELECT balance FROM user_wallets WHERE user_id = $1',
        [testPlayerId]
      );
      const newBalance = parseFloat(newWalletResult.rows[0].balance);
      expect(newBalance).toBe(currentBalance);
      
      // Verifica che non ci sia transazione nel ledger
      const txResult = await query(`
        SELECT COUNT(*) as count 
        FROM wallet_transactions 
        WHERE user_id = $1 
        AND amount = $2
        AND created_at > datetime('now', '-1 minute')
      `, [testPlayerId, parseFloat(excessAmount)]);
      
      expect(parseInt(txResult.rows[0].count)).toBe(0);
    });

    it('should reject debit that would make balance negative', async () => {
      // Reset balance to known value
      await query(
        'UPDATE user_wallets SET balance = $1 WHERE user_id = $2',
        [10.00, testPlayerId]
      );
      
      const response = await request(app)
        .post('/wallet/debit')
        .set('X-Correlation-Id', uuidv4())
        .set('Authorization', 'Bearer test_rgs_key')
        .set('Idempotency-Key', uuidv4())
        .send({
          playerId: testPlayerId,
          amount: '15.00',
          currency: 'EUR',
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('REJECTED');
      expect(response.body.reason).toBe('RW-CAS-002'); // Insufficient funds
      expect(response.body.reason).toMatch(/^RW-(CAS|RGS)-\d{3}$/);
      
      // Balance deve rimanere 10.00
      const walletResult = await query(
        'SELECT balance FROM user_wallets WHERE user_id = $1',
        [testPlayerId]
      );
      expect(parseFloat(walletResult.rows[0].balance)).toBe(10.00);
    });

    it('should allow debit equal to balance', async () => {
      // Set balance esatto
      await query(
        'UPDATE user_wallets SET balance = $1 WHERE user_id = $2',
        [50.00, testPlayerId]
      );
      
      const response = await request(app)
        .post('/wallet/debit')
        .set('X-Correlation-Id', uuidv4())
        .set('Authorization', 'Bearer test_rgs_key')
        .set('Idempotency-Key', uuidv4())
        .send({
          playerId: testPlayerId,
          amount: '50.00',
          currency: 'EUR',
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('APPROVED');
      expect(response.body.newBalance).toBe('0.00');
      expect(response.body.newBalance).toMatch(/^\d+\.\d{2}$/);
    });
  });

  describe('T4 - Currency binding', () => {
    it('should reject debit with mismatched currency', async () => {
      // Il wallet è in EUR, prova con USD
      const response = await request(app)
        .post('/wallet/debit')
        .set('X-Correlation-Id', uuidv4())
        .set('Authorization', 'Bearer test_rgs_key')
        .set('Idempotency-Key', uuidv4())
        .send({
          playerId: testPlayerId,
          amount: '10.00',
          currency: 'USD',
        });

      // Currency mismatch deve essere REJECTED con RW-CAS-008
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('REJECTED');
      expect(response.body.reason).toBe('RW-CAS-008'); // Invalid currency
      expect(response.body.reason).toMatch(/^RW-(CAS|RGS)-\d{3}$/)
      
      // Verifica che non ci sia stata modifica al saldo
      const walletResult = await query(
        'SELECT balance, currency FROM user_wallets WHERE user_id = $1',
        [testPlayerId]
      );
      expect(walletResult.rows[0].currency).toBe('EUR');
    });

    it('should reject credit with mismatched currency', async () => {
      const response = await request(app)
        .post('/wallet/credit')
        .set('X-Correlation-Id', uuidv4())
        .set('Authorization', 'Bearer test_rgs_key')
        .set('Idempotency-Key', uuidv4())
        .send({
          playerId: testPlayerId,
          amount: '25.00',
          currency: 'GBP',
        });

      // Currency mismatch deve essere REJECTED con RW-CAS-008
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('REJECTED');
      expect(response.body.reason).toBe('RW-CAS-008'); // Invalid currency
      expect(response.body.reason).toMatch(/^RW-(CAS|RGS)-\d{3}$/)
    });

    it('should accept matching currency', async () => {
      // Reset balance
      await query(
        'UPDATE user_wallets SET balance = $1 WHERE user_id = $2',
        [100.00, testPlayerId]
      );
      
      const response = await request(app)
        .post('/wallet/debit')
        .set('X-Correlation-Id', uuidv4())
        .set('Authorization', 'Bearer test_rgs_key')
        .set('Idempotency-Key', uuidv4())
        .send({
          playerId: testPlayerId,
          amount: '10.00',
          currency: 'EUR',
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('APPROVED');
    });
  });

  describe('T6 - Debit-Credit round-trip', () => {
    it('should maintain balance integrity in round-trip', async () => {
      // Set initial balance
      const initialBalance = 200.00;
      await query(
        'UPDATE user_wallets SET balance = $1 WHERE user_id = $2',
        [initialBalance, testPlayerId]
      );
      
      const amount = '75.50';
      
      // Step 1: Debit
      const debitResponse = await request(app)
        .post('/wallet/debit')
        .set('X-Correlation-Id', uuidv4())
        .set('Authorization', 'Bearer test_rgs_key')
        .set('Idempotency-Key', uuidv4())
        .send({
          playerId: testPlayerId,
          amount,
          currency: 'EUR',
        });

      expect(debitResponse.status).toBe(200);
      expect(debitResponse.body.status).toBe('APPROVED');
      expect(debitResponse.body.newBalance).toMatch(/^\d+\.\d{2}$/);
      const balanceAfterDebit = parseFloat(debitResponse.body.newBalance);
      expect(balanceAfterDebit).toBeCloseTo(initialBalance - parseFloat(amount), 2);
      
      // Step 2: Credit stesso importo
      const creditResponse = await request(app)
        .post('/wallet/credit')
        .set('X-Correlation-Id', uuidv4())
        .set('Authorization', 'Bearer test_rgs_key')
        .set('Idempotency-Key', uuidv4())
        .send({
          playerId: testPlayerId,
          amount,
          currency: 'EUR',
        });

      expect(creditResponse.status).toBe(200);
      expect(creditResponse.body.status).toBe('APPROVED');
      expect(creditResponse.body.newBalance).toMatch(/^\d+\.\d{2}$/);
      const finalBalance = parseFloat(creditResponse.body.newBalance);
      
      // Il saldo finale deve essere uguale a quello iniziale
      expect(finalBalance).toBeCloseTo(initialBalance, 2);
      
      // Verifica nel ledger: devono esserci 2 movimenti
      const txResult = await query(`
        SELECT type, amount, balance_before, balance_after 
        FROM wallet_transactions 
        WHERE user_id = $1 
        AND amount = $2
        ORDER BY created_at DESC
        LIMIT 2
      `, [testPlayerId, parseFloat(amount)]);
      
      expect(txResult.rows.length).toBe(2);
      
      // Verifica coerenza movimenti
      const creditTx = txResult.rows.find(r => r.type === 'credit');
      const debitTx = txResult.rows.find(r => r.type === 'debit');
      
      expect(creditTx).toBeDefined();
      expect(debitTx).toBeDefined();
      expect(parseFloat(creditTx.amount)).toBe(parseFloat(debitTx.amount));
    });

    it('should handle multiple round-trips correctly', async () => {
      const initialBalance = 500.00;
      await query(
        'UPDATE user_wallets SET balance = $1 WHERE user_id = $2',
        [initialBalance, testPlayerId]
      );
      
      const operations = [
        { type: 'debit', amount: '50.00' },
        { type: 'credit', amount: '25.00' },
        { type: 'debit', amount: '30.00' },
        { type: 'credit', amount: '55.00' }
      ];
      
      let expectedBalance = initialBalance;
      
      for (const op of operations) {
        const response = await request(app)
          .post(`/wallet/${op.type}`)
          .set('X-Correlation-Id', uuidv4())
          .set('Authorization', 'Bearer test_rgs_key')
          .set('Idempotency-Key', uuidv4())
          .send({
            playerId: testPlayerId,
            amount: op.amount,
            currency: 'EUR'
          });
        
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('APPROVED');
        expect(response.body.newBalance).toMatch(/^\d+\.\d{2}$/);
        
        if (op.type === 'debit') {
          expectedBalance -= parseFloat(op.amount);
        } else {
          expectedBalance += parseFloat(op.amount);
        }
        
        expect(parseFloat(response.body.newBalance)).toBeCloseTo(expectedBalance, 2);
      }
      
      // Verifica saldo finale nel database
      const finalResult = await query(
        'SELECT balance FROM user_wallets WHERE user_id = $1',
        [testPlayerId]
      );
      
      expect(parseFloat(finalResult.rows[0].balance)).toBeCloseTo(expectedBalance, 2);
    });
  });
});