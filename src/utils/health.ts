import { pool } from '../config/database';
import { redis } from '../config/redis';
import { logger } from './logger';

/**
 * Check database health in a mockable way
 */
export async function healthDbCheck(): Promise<boolean> {
  try {
    if (process.env.USE_SQLITE === 'true') {
      const { querySQLite } = require('../config/database-sqlite');
      await querySQLite('SELECT 1 as health_check');
      return true;
    } else {
      if (pool) {
        const result = await pool.query('SELECT 1 as health_check');
        return result.rows[0]?.health_check === 1;
      }
      return false;
    }
  } catch (error) {
    logger.error('Health DB check failed', error);
    return false;
  }
}

/**
 * Check Redis health in a mockable way
 */
export async function healthRedisCheck(): Promise<boolean> {
  try {
    // Check current env at runtime (test can change it)
    const useSqlite = process.env.USE_SQLITE === 'true';
    
    if (useSqlite) {
      // In SQLite mode, Redis is optional
      return true;
    }
    
    // Non-SQLite mode: Redis is required
    if (!redis) {
      // Redis not configured in non-SQLite mode
      return false;
    }
    
    await redis.ping();
    return true;
  } catch (error) {
    logger.error('Health Redis check failed', error);
    return false;
  }
}