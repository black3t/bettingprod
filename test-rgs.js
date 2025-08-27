const request = require('supertest');
const express = require('express');
const app = express();
app.use(express.json());

// Mount RGS routes
const rgsRoutes = require('./src/routes/rgsGameRoutes').default;
app.use('/rgs/api/v1', rgsRoutes);

// Test
request(app)
  .post('/rgs/api/v1/auth/token')
  .set('Authorization', 'Bearer test_rgs_key')
  .set('X-Correlation-Id', '550e8400-e29b-41d4-a716-446655440000')
  .send({ playerId: 'test-player' })
  .then(response => {
    console.log('Status:', response.status);
    console.log('Body:', response.body);
  })
  .catch(err => {
    console.error('Error:', err);
  });
