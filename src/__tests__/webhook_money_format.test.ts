import request from 'supertest';
import express from 'express';
import webhookRoutes from '../routes/webhookRoutes';

describe('L5: Webhook Money Format Validation', () => {
  let app: express.Application;
  
  beforeAll(() => {
    app = express();
    app.use(express.json());
    
    // Add correlation ID middleware
    app.use((req: any, res: any, next: any) => {
      req.correlationId = req.headers['x-correlation-id'] || 'test-correlation';
      next();
    });
    
    app.use('/rgs', webhookRoutes);
  });
  
  const correlationId = '123e4567-e89b-42d3-a456-426614174000';
  const authHeader = `Bearer ${process.env.RGS_API_KEY || 'test_rgs_key'}`;
  
  describe('POST /rgs/balanceChanged', () => {
    it('should reject negative money format', async () => {
      const res = await request(app)
        .post('/rgs/balanceChanged')
        .set('Authorization', authHeader)
        .set('X-Correlation-Id', correlationId)
        .send({
          playerId: '123e4567-e89b-42d3-a456-426614174000',
          newBalance: '-100.00', // Negative amount
          ts: '2025-08-25T14:00:00.000Z'
        });
      
      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({
        error: {
          code: 'RW-CAS-006',
          message: 'Invalid newBalance format'
        },
        correlationId
      });
    });
    
    it('should reject money without cents', async () => {
      const res = await request(app)
        .post('/rgs/balanceChanged')
        .set('Authorization', authHeader)
        .set('X-Correlation-Id', correlationId)
        .send({
          playerId: '123e4567-e89b-42d3-a456-426614174000',
          newBalance: '100', // No decimal places
          ts: '2025-08-25T14:00:00.000Z'
        });
      
      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({
        error: {
          code: 'RW-CAS-006',
          message: 'Invalid newBalance format'
        },
        correlationId
      });
    });
    
    it('should reject money with wrong decimal places', async () => {
      const res = await request(app)
        .post('/rgs/balanceChanged')
        .set('Authorization', authHeader)
        .set('X-Correlation-Id', correlationId)
        .send({
          playerId: '123e4567-e89b-42d3-a456-426614174000',
          newBalance: '100.1', // Only 1 decimal place
          ts: '2025-08-25T14:00:00.000Z'
        });
      
      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({
        error: {
          code: 'RW-CAS-006',
          message: 'Invalid newBalance format'
        },
        correlationId
      });
    });
    
    it('should reject money with too many decimal places', async () => {
      const res = await request(app)
        .post('/rgs/balanceChanged')
        .set('Authorization', authHeader)
        .set('X-Correlation-Id', correlationId)
        .send({
          playerId: '123e4567-e89b-42d3-a456-426614174000',
          newBalance: '100.123', // 3 decimal places
          ts: '2025-08-25T14:00:00.000Z'
        });
      
      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({
        error: {
          code: 'RW-CAS-006',
          message: 'Invalid newBalance format'
        },
        correlationId
      });
    });
    
    it('should accept valid positive money format', async () => {
      const res = await request(app)
        .post('/rgs/balanceChanged')
        .set('Authorization', authHeader)
        .set('X-Correlation-Id', correlationId)
        .send({
          playerId: '123e4567-e89b-42d3-a456-426614174000',
          newBalance: '100.00', // Valid format
          ts: '2025-08-25T14:00:00.000Z'
        });
      
      expect(res.status).toBe(202);
      expect(res.body).toEqual({ accepted: true });
    });
    
    it('should accept zero money format', async () => {
      const res = await request(app)
        .post('/rgs/balanceChanged')
        .set('Authorization', authHeader)
        .set('X-Correlation-Id', correlationId)
        .send({
          playerId: '123e4567-e89b-42d3-a456-426614174000',
          newBalance: '0.00', // Zero is valid
          ts: '2025-08-25T14:00:00.000Z'
        });
      
      expect(res.status).toBe(202);
      expect(res.body).toEqual({ accepted: true });
    });
  });
});