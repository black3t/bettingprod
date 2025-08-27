// Test script to simulate health degrade
const axios = require('axios');

async function testHealthDegrade() {
  console.log('Testing health degrade simulation...\n');
  
  // First, check normal health
  console.log('1. Normal health check:');
  try {
    const res1 = await axios.get('http://localhost:3001/rgs/api/v1/health');
    console.log('RGS Health:', res1.status, JSON.stringify(res1.data));
  } catch (e) {
    console.log('RGS Health Error:', e.response?.status, e.response?.data);
  }

  try {
    const res2 = await axios.get('http://localhost:3001/casino/api/v1/health');
    console.log('Casino Health:', res2.status, JSON.stringify(res2.data));
  } catch (e) {
    console.log('Casino Health Error:', e.response?.status, e.response?.data);
  }
  
  console.log('\n2. Simulating DB failure (requires manual intervention in healthDegrade.ts)');
  console.log('Edit src/utils/healthDegrade.ts to set db: true and rebuild');
  
  console.log('\n3. Expected degraded response: 503 with RW-DB-003');
}

testHealthDegrade();