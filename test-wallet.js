const axios = require('axios');

async function testWallet() {
  try {
    const response = await axios.post('http://localhost:3001/wallet/debit', {
      playerId: 'test-123',
      amount: '10.00',
      currency: 'EUR',
      idempotencyKey: 'test-key-' + Date.now()
    }, {
      headers: {
        'X-Correlation-Id': '550e8400-e29b-41d4-a716-446655440000',
        'Authorization': 'Bearer test_rgs_key'
      }
    });
    
    console.log('Response:', response.data);
  } catch (error) {
    console.log('Error:', error.response?.data || error.message);
  }
}

testWallet();