import axios from 'axios';
import { DevServer } from '../test-utils/devServer';

describe('A3: Match Idempotency Persistence', () => {
  const idempotencyKey = '990e8400-e29b-41d4-a716-446655440000';
  
  test('match/create idempotency same-process', async () => {
    const server = new DevServer({
      env: {
        NODE_ENV: 'development',
        ORCH_ENABLED: 'true'
      }
    });

    try {
      await server.start();
      const url = server.getUrl();

      const payload = {
        matchId: '123e4567-e89b-42d3-a456-426614174100',
        gameId: 'rawwar-demo',
        playerId: '123e4567-e89b-42d3-a456-426614174101',
        ts: '2025-08-26T10:00:00Z'
      };

      // First request
      const response1 = await axios.post(`${url}/orch/api/v1/match/create`, payload, {
        headers: {
          'X-Correlation-Id': '11111111-2222-4333-8444-555555555555',
          'Idempotency-Key': idempotencyKey
        },
        validateStatus: () => true
      });

      // Second request with same idempotency key
      const response2 = await axios.post(`${url}/orch/api/v1/match/create`, payload, {
        headers: {
          'X-Correlation-Id': '22222222-3333-4444-8555-666666666666',
          'Idempotency-Key': idempotencyKey
        },
        validateStatus: () => true
      });

      // Body should be byte-identical
      expect(JSON.stringify(response1.data)).toEqual(JSON.stringify(response2.data));
      expect(response1.status).toEqual(response2.status);
    } finally {
      await server.stop();
    }
  });

  test('match/create idempotency cross-restart', async () => {
    const payload = {
      matchId: '223e4567-e89b-42d3-a456-426614174200',
      gameId: 'rawwar-demo',
      playerId: '223e4567-e89b-42d3-a456-426614174201',
      ts: '2025-08-26T11:00:00Z'
    };
    
    const restartKey = 'aa0e8400-e29b-41d4-a716-446655440000';
    let response1Data: any;
    let response1Status: number;

    // First server run
    const server1 = new DevServer({
      env: {
        NODE_ENV: 'development',
        ORCH_ENABLED: 'true'
      }
    });

    try {
      await server1.start();
      const url = server1.getUrl();

      const response1 = await axios.post(`${url}/orch/api/v1/match/create`, payload, {
        headers: {
          'X-Correlation-Id': '33333333-4444-4555-8666-777777777777',
          'Idempotency-Key': restartKey
        },
        validateStatus: () => true
      });
      
      response1Data = response1.data;
      response1Status = response1.status;
    } finally {
      await server1.stop();
    }

    // Restart server
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Second server run
    const server2 = new DevServer({
      env: {
        NODE_ENV: 'development',
        ORCH_ENABLED: 'true'
      }
    });

    try {
      await server2.start();
      const url = server2.getUrl();

      const response2 = await axios.post(`${url}/orch/api/v1/match/create`, payload, {
        headers: {
          'X-Correlation-Id': '44444444-5555-4666-8777-888888888888',
          'Idempotency-Key': restartKey
        },
        validateStatus: () => true
      });

      // Body should be byte-identical after restart
      expect(JSON.stringify(response2.data)).toEqual(JSON.stringify(response1Data));
      expect(response2.status).toEqual(response1Status);
    } finally {
      await server2.stop();
    }
  });

  test('match/create mismatch body returns cached', async () => {
    const server = new DevServer({
      env: {
        NODE_ENV: 'development',
        ORCH_ENABLED: 'true'
      }
    });

    try {
      await server.start();
      const url = server.getUrl();
      
      const mismatchKey = 'bb0e8400-e29b-41d4-a716-446655440000';

      // First request
      const payload1 = {
        matchId: '323e4567-e89b-42d3-a456-426614174300',
        gameId: 'original-game',
        playerId: '323e4567-e89b-42d3-a456-426614174301',
        ts: '2025-08-26T12:00:00Z'
      };

      const response1 = await axios.post(`${url}/orch/api/v1/match/create`, payload1, {
        headers: {
          'X-Correlation-Id': '55555555-6666-4777-8888-999999999999',
          'Idempotency-Key': mismatchKey
        },
        validateStatus: () => true
      });

      // Different payload with same idempotency key
      const payload2 = {
        matchId: '999e9999-9999-9999-9999-999999999999',
        gameId: 'different-game',
        playerId: '888e8888-8888-8888-8888-888888888888',
        ts: '2025-08-26T13:00:00Z'
      };

      const response2 = await axios.post(`${url}/orch/api/v1/match/create`, payload2, {
        headers: {
          'X-Correlation-Id': '66666666-7777-4888-8999-000000000000',
          'Idempotency-Key': mismatchKey
        },
        validateStatus: () => true
      });

      // Should return cached response despite different payload
      expect(JSON.stringify(response2.data)).toEqual(JSON.stringify(response1.data));
    } finally {
      await server.stop();
    }
  });
});