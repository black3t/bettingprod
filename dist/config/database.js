"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
exports.query = query;
exports.transaction = transaction;
const pg_1 = require("pg");
const logger_1 = require("../utils/logger");
const database_sqlite_1 = require("./database-sqlite");
// Check if we're in test mode (use SQLite) or production mode (use PostgreSQL)
const USE_SQLITE = process.env.USE_SQLITE === 'true' || process.env.NODE_ENV === 'test';
let pool = null;
exports.pool = pool;
if (!USE_SQLITE) {
    exports.pool = pool = new pg_1.Pool({
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
        logger_1.logger.error('Database pool error', err);
    });
}
else {
    // Initialize SQLite in test mode - but not automatically
    // Tests will call initSQLite explicitly to avoid multiple connections
    logger_1.logger.info('Running in TEST MODE with SQLite database');
    if (process.env.NODE_ENV !== 'test') {
        (0, database_sqlite_1.initSQLite)().catch(err => {
            logger_1.logger.error('Failed to initialize SQLite', err);
        });
    }
}
async function query(text, params) {
    const start = Date.now();
    if (USE_SQLITE) {
        // Use SQLite in test mode
        return (0, database_sqlite_1.querySQLite)(text, params);
    }
    // Use PostgreSQL in production mode
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        logger_1.logger.debug('Query executed', { text: text.substring(0, 50), duration, rows: res.rowCount });
        return res;
    }
    catch (error) {
        logger_1.logger.error('Query error', { text: text.substring(0, 50), error });
        throw error;
    }
}
async function transaction(callback) {
    if (USE_SQLITE) {
        // Use SQLite transaction in test mode
        return (0, database_sqlite_1.transactionSQLite)(callback);
    }
    // Use PostgreSQL transaction in production mode
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
}
//# sourceMappingURL=database.js.map