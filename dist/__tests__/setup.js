"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// Load test environment variables
dotenv_1.default.config({ path: '.env.test' });
// Clean DB tables in FK-safe order
const database_sqlite_1 = require("../config/database-sqlite");
beforeAll(async () => {
    await (0, database_sqlite_1.initSQLite)();
    await (0, database_sqlite_1.querySQLite)('PRAGMA foreign_keys=OFF;');
    await (0, database_sqlite_1.querySQLite)('DELETE FROM wallet_transactions;');
    await (0, database_sqlite_1.querySQLite)('DELETE FROM idempotency_keys;');
    await (0, database_sqlite_1.querySQLite)('DELETE FROM webhook_outbox;');
    await (0, database_sqlite_1.querySQLite)('DELETE FROM reality_checks;');
    await (0, database_sqlite_1.querySQLite)('DELETE FROM responsible_gaming;');
    await (0, database_sqlite_1.querySQLite)('DELETE FROM player_limits;');
    await (0, database_sqlite_1.querySQLite)('DELETE FROM self_exclusions;');
    await (0, database_sqlite_1.querySQLite)('DELETE FROM user_sessions;');
    await (0, database_sqlite_1.querySQLite)('DELETE FROM login_attempts;');
    await (0, database_sqlite_1.querySQLite)('DELETE FROM game_sessions;');
    await (0, database_sqlite_1.querySQLite)('DELETE FROM audit_logs;');
    await (0, database_sqlite_1.querySQLite)('DELETE FROM user_wallets;');
    await (0, database_sqlite_1.querySQLite)('DELETE FROM users;');
    await (0, database_sqlite_1.querySQLite)('PRAGMA foreign_keys=ON;');
});
// Set test environment
process.env.NODE_ENV = 'test';
process.env.USE_SQLITE = 'true';
process.env.JWT_SECRET = 'test_jwt_secret';
process.env.RGS_API_KEY = 'test_rgs_key';
// Clean up any existing test DB before tests start - do this BEFORE initSQLite
const testDbPath = path_1.default.join(process.cwd(), 'casino.db');
if (fs_1.default.existsSync(testDbPath)) {
    try {
        fs_1.default.unlinkSync(testDbPath);
    }
    catch (e) {
        // Database might be locked from previous run, ignore
    }
}
const testDbWalPath = testDbPath + '-wal';
if (fs_1.default.existsSync(testDbWalPath)) {
    try {
        fs_1.default.unlinkSync(testDbWalPath);
    }
    catch (e) {
        // Ignore
    }
}
const testDbShmPath = testDbPath + '-shm';
if (fs_1.default.existsSync(testDbShmPath)) {
    try {
        fs_1.default.unlinkSync(testDbShmPath);
    }
    catch (e) {
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
    }
    catch (e) {
        // Ignore
    }
    // Close database connections if needed
    try {
        const { pool } = require('../config/database');
        if (pool) {
            await pool.end();
        }
    }
    catch (e) {
        // Ignore
    }
    // Close Redis connections if needed
    try {
        const { redis } = require('../config/redis');
        if (redis) {
            await redis.quit();
        }
    }
    catch (e) {
        // Ignore
    }
    // Small delay before cleanup
    await new Promise(resolve => setTimeout(resolve, 100));
    // Clean up test DB files
    const testDbPath = path_1.default.join(process.cwd(), 'casino.db');
    if (fs_1.default.existsSync(testDbPath)) {
        try {
            fs_1.default.unlinkSync(testDbPath);
        }
        catch (e) {
            // Ignore
        }
    }
    const testDbWalPath = testDbPath + '-wal';
    if (fs_1.default.existsSync(testDbWalPath)) {
        try {
            fs_1.default.unlinkSync(testDbWalPath);
        }
        catch (e) {
            // Ignore
        }
    }
    const testDbShmPath = testDbPath + '-shm';
    if (fs_1.default.existsSync(testDbShmPath)) {
        try {
            fs_1.default.unlinkSync(testDbShmPath);
        }
        catch (e) {
            // Ignore
        }
    }
});
//# sourceMappingURL=setup.js.map