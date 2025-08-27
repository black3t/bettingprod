const app = require('./dist/index.js');
console.log('App loaded:', typeof app);

// Try basic request
const http = require('http');
const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/rgs/api/v1/auth/token',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer test_rgs_key',
    'X-Correlation-Id': '550e8400-e29b-41d4-a716-446655440000'
  }
};

const req = http.request(options, (res) => {
  console.log('Status:', res.statusCode);
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => { 
    console.log('Response:', data);
    process.exit(0);
  });
});

req.on('error', (e) => {
  console.error('Error:', e);
  process.exit(1);
});

req.write(JSON.stringify({ playerId: 'test-player' }));
req.end();

// Give it 2 seconds
setTimeout(() => {
  console.log('Timeout');
  process.exit(1);
}, 2000);
