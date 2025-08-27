import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Clean DB tables in FK-safe order
import { querySQLite, initSQLite } from '../config/database-sqlite';

beforeAll(async () => {
  await initSQLite();
  
  await querySQLite('PRAGMA foreign_keys=OFF;');
  await querySQLite('DELETE FROM wallet_transactions;');
  await querySQLite('DELETE FROM idempotency_keys;');
  await querySQLite('DELETE FROM webhook_outbox;');
  await querySQLite('DELETE FROM reality_checks;');
  await querySQLite('DELETE FROM responsible_gaming;');
  await querySQLite('DELETE FROM player_limits;');
  await querySQLite('DELETE FROM self_exclusions;');
  await querySQLite('DELETE FROM user_sessions;');
  await querySQLite('DELETE FROM login_attempts;');
  await querySQLite('DELETE FROM game_sessions;');
  await querySQLite('DELETE FROM audit_logs;');
  await querySQLite('DELETE FROM user_wallets;');
  await querySQLite('DELETE FROM users;');
  await querySQLite('PRAGMA foreign_keys=ON;');
});

// Set test environment
process.env.NODE_ENV = 'test';
process.env.USE_SQLITE = 'true';
process.env.JWT_SECRET = 'test_jwt_secret';
process.env.RGS_API_KEY = 'test_rgs_key';

// Clean up any existing test DB before tests start - do this BEFORE initSQLite
const testDbPath = path.join(process.cwd(), 'casino.db');
if (fs.existsSync(testDbPath)) {
  try {
    fs.unlinkSync(testDbPath);
  } catch (e) {
    // Database might be locked from previous run, ignore
  }
}
const testDbWalPath = testDbPath + '-wal';
if (fs.existsSync(testDbWalPath)) {
  try {
    fs.unlinkSync(testDbWalPath);
  } catch (e) {
    // Ignore
  }
}
const testDbShmPath = testDbPath + '-shm';
if (fs.existsSync(testDbShmPath)) {
  try {
    fs.unlinkSync(testDbShmPath);
  } catch (e) {
    // Ignore
  }
}

// Suppress logs during tests unless explicitly needed
if (process.env.SHOW_LOGS !== 'true') {
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
}

// Global test timeout
jest.setTimeout(30000);

// Clean up after all tests
afterAll(async () => {
  // Close SQLite connection first
  try {
    const { db } = require('../config/database-sqlite');
    if (db) {
      await db.close();
    }
  } catch (e) {
    // Ignore
  }
  
  // Close database connections if needed
  try {
    const { pool } = require('../config/database');
    if (pool) {
      await pool.end();
    }
  } catch (e) {
    // Ignore
  }
  
  // Close Redis connections if needed
  try {
    const { redis } = require('../config/redis');
    if (redis) {
      await redis.quit();
    }
  } catch (e) {
    // Ignore
  }
  
  // Small delay before cleanup
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Clean up test DB files
  const testDbPath = path.join(process.cwd(), 'casino.db');
  if (fs.existsSync(testDbPath)) {
    try {
      fs.unlinkSync(testDbPath);
    } catch (e) {
      // Ignore
    }
  }
  const testDbWalPath = testDbPath + '-wal';
  if (fs.existsSync(testDbWalPath)) {
    try {
      fs.unlinkSync(testDbWalPath);
    } catch (e) {
      // Ignore
    }
  }
  const testDbShmPath = testDbPath + '-shm';
  if (fs.existsSync(testDbShmPath)) {
    try {
      fs.unlinkSync(testDbShmPath);
    } catch (e) {
      // Ignore
    }
  }
});