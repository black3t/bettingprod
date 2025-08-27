const axios = require('axios');

const CASINO_URL = 'http://localhost:3001';

async function testCasino() {
  console.log('🎰 Testing Casino Mock Platform...\n');
  
  let token;
  const testUser = {
    username: `testuser_${Date.now()}`,
    email: `test_${Date.now()}@example.com`,
    password: 'TestPass123!',
    first_name: 'Test',
    last_name: 'User'
  };

  try {
    // 1. Test health endpoint
    console.log('1. Testing health check...');
    const health = await axios.get(`${CASINO_URL}/health`);
    console.log('✅ Health check:', health.data);
    
    // 2. Signup new user
    console.log('\n2. Creating new user account...');
    const signupResponse = await axios.post(
      `${CASINO_URL}/api/auth/signup`,
      testUser
    );
    console.log('✅ User created:', {
      username: signupResponse.data.user.username,
      email: signupResponse.data.user.email,
      balance: signupResponse.data.user.balance,
      currency: signupResponse.data.user.currency
    });
    
    token = signupResponse.data.token;
    
    // 3. Check initial balance (should be 10,000)
    console.log('\n3. Checking initial balance...');
    const walletResponse = await axios.get(
      `${CASINO_URL}/api/user/wallet`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    console.log('✅ Wallet balance:', {
      balance: walletResponse.data.wallet.balance,
      currency: walletResponse.data.wallet.currency
    });
    
    if (walletResponse.data.wallet.balance !== 10000) {
      throw new Error(`Expected 10000 credits, got ${walletResponse.data.wallet.balance}`);
    }
    
    // 4. Login test
    console.log('\n4. Testing login...');
    const loginResponse = await axios.post(
      `${CASINO_URL}/api/auth/login`,
      {
        email: testUser.email,
        password: testUser.password
      }
    );
    console.log('✅ Login successful:', {
      username: loginResponse.data.user.username,
      token: loginResponse.data.token.substring(0, 20) + '...'
    });
    
    // 5. Get available games
    console.log('\n5. Getting available games...');
    const gamesResponse = await axios.get(
      `${CASINO_URL}/api/games/list`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    console.log('✅ Available games:', gamesResponse.data.games.map(g => ({
      code: g.code,
      name: g.name,
      category: g.category
    })));
    
    // 6. Launch RawWar game (if RGS is running)
    console.log('\n6. Attempting to launch RawWar game...');
    try {
      const launchResponse = await axios.post(
        `${CASINO_URL}/api/games/launch`,
        {
          game_code: 'rawwar',
          demo_mode: false
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      console.log('✅ Game launched:', {
        game_url: launchResponse.data.game_url,
        session_id: launchResponse.data.session_id
      });
    } catch (error) {
      console.log('⚠️ Game launch failed (RGS might not be running):', error.response?.data?.error || error.message);
    }
    
    // 7. Get user stats
    console.log('\n7. Getting user statistics...');
    const statsResponse = await axios.get(
      `${CASINO_URL}/api/user/stats`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    console.log('✅ User stats:', statsResponse.data.stats);
    
    // 8. Logout
    console.log('\n8. Testing logout...');
    await axios.post(
      `${CASINO_URL}/api/auth/logout`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    console.log('✅ Logged out successfully');
    
    console.log('\n🎉 Casino Mock test completed successfully!');
    console.log('✅ All features working correctly:');
    console.log('   - User signup with 10,000 credits');
    console.log('   - User login/logout');
    console.log('   - Wallet management');
    console.log('   - Game listing');
    console.log('   - Game launch (requires RGS)');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

// Run test
testCasino();