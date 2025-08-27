import request from 'supertest';
import express from 'express';

// Simple smoke test for health endpoints
describe('Health Endpoints Smoke Test', () => {
  let app: express.Application;
  
  beforeAll(() => {
    // Use the actual app instance
    jest.resetModules();
    process.env.USE_SQLITE = 'true';
    process.env.API_BASE_PATH = '/casino/api/v1';
    process.env.RGS_BASE_PATH = '/rgs/api/v1';
    process.env.NODE_ENV = 'test';
    app = require('../../index');
  });

  test('Casino health returns 200 with success=true and ts', async () => {
    const res = await request(app).get('/casino/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('RGS health returns 200 with success=true and ts', async () => {
    const res = await request(app).get('/rgs/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});