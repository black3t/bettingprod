import axios from 'axios';
import { withServer } from '../test-utils/devServer';

describe('A1: Health 405 Method Discipline', () => {
  const endpoints = [
    '/rgs/api/v1/health',
    '/casino/api/v1/health', 
    '/orch/api/v1/health'
  ];

  test.each(endpoints)('POST %s returns 405 with Allow: GET', async (endpoint) => {
    await withServer(
      { 
        env: { 
          NODE_ENV: 'development',
          ORCH_ENABLED: 'true'
        }
      },
      async (url) => {
        try {
          await axios.post(`${url}${endpoint}`, {}, {
            headers: {
              'X-Correlation-Id': '11111111-2222-4333-8444-555555555555'
            }
          });
          fail('Should have thrown 405');
        } catch (error: any) {
          expect(error.response.status).toBe(405);
          expect(error.response.headers['allow']).toBe('GET');
          expect(error.response.data).toEqual({
            error: {
              code: 'RW-SYS-000',
              message: 'Method Not Allowed'
            },
            correlationId: '11111111-2222-4333-8444-555555555555'
          });
        }
      }
    );
  });

  test('GET health endpoints return 200', async () => {
    await withServer(
      { 
        env: { 
          NODE_ENV: 'development',
          ORCH_ENABLED: 'true'
        }
      },
      async (url) => {
        for (const endpoint of endpoints) {
          const response = await axios.get(`${url}${endpoint}`, {
            headers: {
              'X-Correlation-Id': '22222222-3333-4444-8555-666666666666'
            }
          });
          expect(response.status).toBe(200);
        }
      }
    );
  });
});