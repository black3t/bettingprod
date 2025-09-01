import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { querySQLite, transactionSQLite, initSQLite, getActiveDbPath } from './database-sqlite';

// Check if we're in test mode (use SQLite) or production mode (use PostgreSQL)
const USE_SQLITE = process.env.USE_SQLITE === 'true' || process.env.NODE_ENV === 'test';

let pool: Pool | null = null;

if (!USE_SQLITE) {
  pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5433'),
    database: process.env.DB_NAME || 'casino_mock',
    user: process.env.DB_USER || 'casino_admin',
    password: process.env.DB_PASSWORD || 'casino_pass_2024',
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  pool.on('error', (err) => {
    logger.error('Database pool error', err);
  });
} else {
  // Initialize SQLite in test mode - but not automatically
  // Tests will call initSQLite explicitly to avoid multiple connections
  logger.info('Running in TEST MODE with SQLite database');
  if (process.env.NODE_ENV !== 'test') {
    initSQLite().catch(err => {
      logger.error('Failed to initialize SQLite', err);
    });
  }
}

export { pool };
export { getActiveDbPath };

export async function query(text: string, params?: any[]) {
  const start = Date.now();
  
  if (USE_SQLITE) {
    // Use SQLite in test mode
    return querySQLite(text, params);
  }
  
  // Use PostgreSQL in production mode
  try {
    const res = await pool!.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Query executed', { text: text.substring(0, 50), duration, rows: res.rowCount });
    return res;
  } catch (error) {
    logger.error('Query error', { text: text.substring(0, 50), error });
    throw error;
  }
}

export async function transaction<T>(
  callback: (client: any) => Promise<T>
): Promise<T> {
  if (USE_SQLITE) {
    // Use SQLite transaction in test mode
    return transactionSQLite(callback);
  }
  
  // Use PostgreSQL transaction in production mode
  const client = await pool!.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}