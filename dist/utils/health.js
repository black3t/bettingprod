"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthDbCheck = healthDbCheck;
exports.healthRedisCheck = healthRedisCheck;
const database_1 = require("../config/database");
const redis_1 = require("../config/redis");
const logger_1 = require("./logger");
/**
 * Check database health in a mockable way
 */
async function healthDbCheck() {
    try {
        if (process.env.USE_SQLITE === 'true') {
            const { querySQLite } = require('../config/database-sqlite');
            await querySQLite('SELECT 1 as health_check');
            return true;
        }
        else {
            if (database_1.pool) {
                const result = await database_1.pool.query('SELECT 1 as health_check');
                return result.rows[0]?.health_check === 1;
            }
            return false;
        }
    }
    catch (error) {
        logger_1.logger.error('Health DB check failed', error);
        return false;
    }
}
/**
 * Check Redis health in a mockable way
 */
async function healthRedisCheck() {
    try {
        // Check current env at runtime (test can change it)
        const useSqlite = process.env.USE_SQLITE === 'true';
        if (useSqlite) {
            // In SQLite mode, Redis is optional
            return true;
        }
        // Non-SQLite mode: Redis is required
        if (!redis_1.redis) {
            // Redis not configured in non-SQLite mode
            return false;
        }
        await redis_1.redis.ping();
        return true;
    }
    catch (error) {
        logger_1.logger.error('Health Redis check failed', error);
        return false;
    }
}
//# sourceMappingURL=health.js.map