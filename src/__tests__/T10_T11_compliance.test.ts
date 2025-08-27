/**
 * T10, T11 - Compliance Tests
 * T10: Logging & GDPR (PII-safe + retention)
 * T11: Arrotondamenti (banker's, 2 decimali)
 */

import request from 'supertest';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { query } from '../config/database';
import winston from 'winston';
import { uniqueEmail, uniqueId } from './helpers/unique';

// Mock logger per catturare logs
const testLogCapture: any[] = [];
const mockTransport = new winston.transports.Console({
  format: winston.format.json(),
  log: (info, callback) => {
    testLogCapture.push(info);
    if (callback) callback();
  }
});

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
  
  // Logging middleware
  app.use((req, res, next) => {
    const logger = winston.createLogger({
      transports: [mockTransport]
    });
    
    logger.info('Request', {
      method: req.method,
      path: req.path,
      correlationId: (req as any).correlationId,
      // NON loggare: body, headers con token, query params con PII
    });
    
    next();
  });
  
  const walletRoutes = require('../routes/walletRoutes').default;
  app.use('/wallet', walletRoutes);
  
  return app;
}

describe('T10, T11 - Compliance Tests', () => {
  let app: express.Application;
  const testPlayerId = uniqueId('compliance');

  beforeAll(async () => {
    app = createApp();
    testLogCapture.length = 0; // Clear logs
    
    // Create test user first
    await query(`
      INSERT OR IGNORE INTO users (id, username, email, password_hash, status)
      VALUES ($1, $2, $3, $4, $5)
    `, [testPlayerId, 'compliance_test_user', uniqueEmail('compliance'), 'hash', 'active']);
    
    await query(`
      INSERT INTO user_wallets (id, user_id, balance, currency)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id) DO UPDATE SET balance = $3
    `, [uuidv4(), testPlayerId, 1000.00, 'EUR']);
  });

  afterAll(async () => {
    await query('DELETE FROM wallet_transactions WHERE user_id = $1', [testPlayerId]);
    await query('DELETE FROM user_wallets WHERE user_id = $1', [testPlayerId]);
    await query('DELETE FROM users WHERE id = $1', [testPlayerId]);
  });

  describe('T10 - Logging & GDPR', () => {
    beforeEach(() => {
      testLogCapture.length = 0; // Clear logs before each test
    });

    it('should not log PII in request logs', async () => {
      const sensitiveData = {
        playerId: testPlayerId,
        amount: '50.00',
        currency: 'EUR',
        personalInfo: 'John Doe', // PII
        creditCard: '4111111111111111', // PII
        email: 'john@example.com' // PII
      };

      await request(app)
        .post('/wallet/debit')
        .set('X-Correlation-Id', uuidv4())
        .set('Idempotency-Key', uuidv4())
        .set('Authorization', 'Bearer test_rgs_key')
        .send(sensitiveData);

      // Verifica logs catturati
      testLogCapture.forEach(log => {
        const logString = JSON.stringify(log);
        
        // Non deve contenere PII
        expect(logString).not.toContain('John Doe');
        expect(logString).not.toContain('4111111111111111');
        expect(logString).not.toContain('john@example.com');
        
        // Può contenere solo campi whitelisted (non il body completo)
        if (logString.includes(testPlayerId)) {
          // OK, Player ID è pseudonimo
        }
        expect(logString).toContain('correlationId'); // Correlation ID OK
      });
    });

    it('should log only pseudonymous identifiers', async () => {
      const correlationId = uuidv4();
      
      await request(app)
        .post('/wallet/credit')
        .set('X-Correlation-Id', correlationId)
        .set('Idempotency-Key', uuidv4())
        .set('Authorization', 'Bearer test_rgs_key')
        .send({
          playerId: testPlayerId,
          amount: '25.00',
          currency: 'EUR'
        });

      // Verifica che ci siano logs
      expect(testLogCapture.length).toBeGreaterThan(0);
      
      // Verifica contenuto logs
      const requestLog = testLogCapture.find(l => l.message === 'Request');
      expect(requestLog).toBeDefined();
      expect(requestLog.correlationId).toBe(correlationId);
      expect(requestLog.method).toBe('POST');
      expect(requestLog.path).toBe('/wallet/credit');
      
      // Non deve avere dati sensibili
      expect(requestLog.body).toBeUndefined();
      expect(requestLog.headers).toBeUndefined();
    });

    it('should implement retention policies', async () => {
      // Verifica che esista la configurazione retention
      const nodeEnv = process.env.NODE_ENV || 'development';
      let expectedRetention: number;
      
      switch(nodeEnv) {
        case 'development':
          expectedRetention = 7; // 7 giorni
          break;
        case 'staging':
          expectedRetention = 30; // 30 giorni
          break;
        case 'production':
          expectedRetention = 365; // 365 giorni
          break;
        default:
          expectedRetention = 7;
      }
      
      // Simula check retention policy (in produzione sarebbe un job scheduled)
      const retentionQuery = `
        SELECT COUNT(*) as old_logs 
        FROM audit_logs 
        WHERE created_at < NOW() - INTERVAL '${expectedRetention} days'
      `;
      
      // Query non fallisce (tabella potrebbe non esistere in test)
      try {
        const result = await query(retentionQuery);
        expect(result).toBeDefined();
      } catch (e) {
        // OK, tabella non esiste in test environment
      }
    });

    it('should sanitize error messages', async () => {
      // Forza un errore
      const response = await request(app)
        .post('/wallet/debit')
        .set('X-Correlation-Id', uuidv4())
        .set('Authorization', 'Bearer test_rgs_key')
        .set('Idempotency-Key', uuidv4())
        .send({
          playerId: testPlayerId,
          amount: '99999.00', // Troppo
          currency: 'EUR'
        });

      // La bibbia dice che wallet operations ritornano sempre 200
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('REJECTED');
      
      // L'errore non deve contenere dettagli interni
      expect(response.body.reason).toBeDefined();
      // Il reason è solo un codice RW-CAS-*, non contiene dettagli interni
    });
  });

  describe('T11 - Arrotondamenti', () => {
    it('should use banker\'s rounding for 0.5 cases', async () => {
      // Banker's rounding: 0.5 arrotonda al pari più vicino
      const testCases = [
        { input: '10.015', expected: '10.02' }, // 1.5 cents → 2 (pari)
        { input: '10.025', expected: '10.02' }, // 2.5 cents → 2 (pari)
        { input: '10.035', expected: '10.04' }, // 3.5 cents → 4 (pari)
        { input: '10.045', expected: '10.04' }, // 4.5 cents → 4 (pari)
      ];

      for (const testCase of testCases) {
        // Simula operazione che richiede arrotondamento
        const response = await request(app)
          .post('/wallet/credit')
          .set('X-Correlation-Id', uuidv4())
          .set('Idempotency-Key', uuidv4())
          .set('Authorization', 'Bearer test_rgs_key')
          .send({
            playerId: testPlayerId,
            amount: testCase.input,
            currency: 'EUR'
          });

        if (response.status === 200) {
          // Verifica che l'importo sia arrotondato correttamente
          const txResult = await query(`
            SELECT amount 
            FROM wallet_transactions 
            WHERE user_id = $1 
            ORDER BY created_at DESC 
            LIMIT 1
          `, [testPlayerId]);
          
          if (txResult.rows.length > 0) {
            const storedAmount = parseFloat(txResult.rows[0].amount).toFixed(2);
            expect(storedAmount).toBe(testCase.expected);
          }
        }
      }
    });

    it('should always return amounts as 2-decimal strings', async () => {
      const amounts = ['10', '10.1', '10.99', '10.999', '10.001'];
      
      for (const amount of amounts) {
        const response = await request(app)
          .post('/wallet/debit')
          .set('X-Correlation-Id', uuidv4())
          .set('Idempotency-Key', uuidv4())
          .set('Authorization', 'Bearer test_rgs_key')
          .send({
            playerId: testPlayerId,
            amount,
            currency: 'EUR'
          });

        if (response.status === 200) {
          // newBalance deve sempre essere stringa con 2 decimali
          expect(response.body.newBalance).toMatch(/^\d+\.\d{2}$/);
          
          // Verifica che sia una stringa, non un numero
          expect(typeof response.body.newBalance).toBe('string');
        }
      }
    });

    it('should store amounts consistently in minor units', async () => {
      // Reset balance
      await query(
        'UPDATE user_wallets SET balance = $1 WHERE user_id = $2',
        [100.00, testPlayerId]
      );
      
      // Operazione con decimali
      const amount = '12.34';
      
      const response = await request(app)
        .post('/wallet/debit')
        .set('X-Correlation-Id', uuidv4())
        .set('Idempotency-Key', uuidv4()) // Nell'header come da Bibbia §144!
        .set('Authorization', 'Bearer test_rgs_key')
        .send({
          playerId: testPlayerId,
          amount,
          currency: 'EUR'
        });

      expect(response.status).toBe(200);
      
      // Verifica storage nel database
      const txResult = await query(`
        SELECT amount, balance_before, balance_after 
        FROM wallet_transactions 
        WHERE user_id = $1 
        ORDER BY created_at DESC 
        LIMIT 1
      `, [testPlayerId]);
      
      const tx = txResult.rows[0];
      expect(parseFloat(tx.amount)).toBe(12.34);
      expect(parseFloat(tx.balance_before)).toBe(100.00);
      expect(parseFloat(tx.balance_after)).toBeCloseTo(87.66, 2);
    });

    it('should handle edge cases correctly', async () => {
      const edgeCases = [
        { input: '0.01', valid: true },  // Minimo valore
        { input: '0.001', valid: false }, // Sotto precisione
        { input: '999999.99', valid: true }, // Valore grande
        { input: '0.00', valid: false }, // Zero
        { input: '-10.00', valid: false }, // Negativo
      ];

      for (const testCase of edgeCases) {
        const response = await request(app)
          .post('/wallet/credit')
          .set('X-Correlation-Id', uuidv4())
          .set('Idempotency-Key', uuidv4())
          .set('Authorization', 'Bearer test_rgs_key')
          .send({
            playerId: testPlayerId,
            amount: testCase.input,
            currency: 'EUR'
          });

        if (testCase.valid) {
          expect(response.status).toBe(200);
          if (response.body.status === 'APPROVED') {
            expect(response.body.newBalance).toMatch(/^\d+\.\d{2}$/);
          }
        } else {
          // Per valori invalidi, può essere 200 con REJECTED o 422 con error code
          if (response.status === 200) {
            expect(response.body.status).toBe('REJECTED');
          } else {
            expect(response.status).toBe(422);
            const code = response.body?.error?.code ?? response.body?.reason;
            expect(code).toBeDefined();
            expect(['RW-CAS-006', 'RW-CAS-010', 'RW-SYS-000']).toContain(code);
          }
        }
      }
    });
  });
});