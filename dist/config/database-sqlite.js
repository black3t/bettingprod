"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
exports.getActiveDbPath = getActiveDbPath;
exports.healthDbCheck = healthDbCheck;
exports.initSQLite = initSQLite;
exports.querySQLite = querySQLite;
exports.transactionSQLite = transactionSQLite;
const sqlite3_1 = __importDefault(require("sqlite3"));
const sqlite_1 = require("sqlite");
const logger_1 = require("../utils/logger");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
let db = null;
exports.db = db;
let dbInitialized = false;
let ACTIVE_DB_PATH_ABS = '';
function getActiveDbPath() { return ACTIVE_DB_PATH_ABS; }
function resolveDbPath() {
    const raw = process.env.DB_PATH || 'casino.db';
    const abs = path_1.default.isAbsolute(raw) ? raw : path_1.default.resolve(process.cwd(), raw);
    return abs;
}
async function healthDbCheck() {
    try {
        if (process.env.USE_SQLITE === 'true') {
            await querySQLite('SELECT 1 as health_check');
        }
        else {
            const { query } = require('./database');
            await query('SELECT 1');
        }
        return true;
    }
    catch (error) {
        return false;
    }
}
async function initSQLite() {
    if (dbInitialized && db) {
        logger_1.logger.debug('SQLite already initialized, reusing connection');
        return db;
    }
    // Use absolute path for SQLite database
    const dbPath = resolveDbPath();
    ACTIVE_DB_PATH_ABS = dbPath;
    logger_1.logger.info(`[DB] sqlite path=${dbPath}`);
    try {
        // Open database with serialized mode
        exports.db = db = await (0, sqlite_1.open)({
            filename: dbPath,
            driver: sqlite3_1.default.Database,
            mode: sqlite3_1.default.OPEN_READWRITE | sqlite3_1.default.OPEN_CREATE | sqlite3_1.default.OPEN_FULLMUTEX
        });
        // Bible linea 219: "SQLite in pre-prod"
        // Configure PRAGMA for WAL mode and busy timeout
        await db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 5000;
      PRAGMA synchronous = NORMAL;
      PRAGMA foreign_keys = ON;
    `);
        // Load and execute init script
        const initScriptPath = path_1.default.join(__dirname, '../../database/init-sqlite.sql');
        if (fs_1.default.existsSync(initScriptPath)) {
            const initScript = fs_1.default.readFileSync(initScriptPath, 'utf8');
            await db.exec(initScript);
        }
        else {
            logger_1.logger.warn('init-sqlite.sql not found, using embedded schema');
            await createEmbeddedSchema();
        }
        logger_1.logger.info('SQLite database initialized');
        dbInitialized = true;
    }
    catch (error) {
        logger_1.logger.error('Error initializing SQLite database', error);
        throw error;
    }
    return db;
}
async function createEmbeddedSchema() {
    if (!db)
        throw new Error('Database not initialized');
    // Essential tables for tests
    await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      first_name TEXT,
      last_name TEXT,
      date_of_birth DATE,
      status TEXT DEFAULT 'active',
      email_verified INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME,
      metadata TEXT DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS user_wallets (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      balance REAL DEFAULT 10000,
      bonus_balance REAL DEFAULT 0,
      currency TEXT DEFAULT 'EUR',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS wallet_transactions (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      user_id TEXT NOT NULL,
      wallet_id TEXT NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      balance_before REAL NOT NULL,
      balance_after REAL NOT NULL,
      reference_id TEXT,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      metadata TEXT DEFAULT '{}',
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (wallet_id) REFERENCES user_wallets(id)
    );

    CREATE TABLE IF NOT EXISTS idempotency_keys (
      key TEXT PRIMARY KEY,
      response TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL
    );

    CREATE TABLE IF NOT EXISTS jurisdiction_limits (
      jurisdiction TEXT PRIMARY KEY,
      min_bet REAL NOT NULL,
      max_bet REAL NOT NULL,
      max_win REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS player_limits (
      user_id TEXT PRIMARY KEY,
      daily_limit REAL,
      weekly_limit REAL,
      monthly_limit REAL,
      daily_spent REAL DEFAULT 0,
      weekly_spent REAL DEFAULT 0,
      monthly_spent REAL DEFAULT 0,
      last_reset_daily DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_reset_weekly DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_reset_monthly DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS self_exclusions (
      user_id TEXT PRIMARY KEY,
      reason TEXT,
      excluded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      permanent INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS user_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      expires_at DATETIME NOT NULL,
      last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS login_attempts (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      email TEXT NOT NULL,
      ip_address TEXT,
      success INTEGER NOT NULL,
      error_message TEXT,
      attempted_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      provider TEXT NOT NULL,
      thumbnail_url TEXT,
      is_active INTEGER DEFAULT 1,
      min_bet REAL DEFAULT 0.1,
      max_bet REAL DEFAULT 1000,
      rtp REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      metadata TEXT DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS game_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      game_id TEXT NOT NULL,
      rgs_session_id TEXT,
      rgs_session_token TEXT,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME,
      is_active INTEGER DEFAULT 1,
      total_bet REAL DEFAULT 0,
      total_win REAL DEFAULT 0,
      metadata TEXT DEFAULT '{}',
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      action TEXT NOT NULL,
      user_id TEXT,
      correlation_id TEXT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS responsible_gaming (
      player_id TEXT PRIMARY KEY,
      self_excluded INTEGER DEFAULT 0,
      self_excluded_until DATETIME,
      cooling_off INTEGER DEFAULT 0,
      cooling_off_until DATETIME,
      last_reality_check DATETIME,
      reality_check_ack INTEGER DEFAULT 1,
      FOREIGN KEY (player_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS reality_checks (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      user_id TEXT REFERENCES users(id),
      triggered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      acknowledged_at DATETIME,
      interval_minutes INTEGER DEFAULT 5,
      message_shown TEXT
    );

    CREATE TABLE IF NOT EXISTS webhook_outbox (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      type TEXT NOT NULL,                -- 'balanceChanged' | 'playerExcluded'
      payload TEXT NOT NULL,             -- JSON
      status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING|SENT|FAILED
      attempts INTEGER NOT NULL DEFAULT 0,
      next_attempt_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_error TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_outbox_status ON webhook_outbox(status, next_attempt_at);
  `);
    // Insert default jurisdiction limits
    await db.run(`
    INSERT OR IGNORE INTO jurisdiction_limits (jurisdiction, min_bet, max_bet, max_win) VALUES
    ('MGA', 0.20, 200.00, 3000.00),
    ('UKGC', 0.10, 1000.00, 5000.00),
    ('DEFAULT', 0.10, 100.00, 3000.00)
  `);
    // Insert sample games
    const games = [
        { id: 'game-1', code: 'rawwar', name: 'RawWar', category: 'multiplayer', provider: 'InHouse', rtp: 95.5 },
        { id: 'game-2', code: 'demo-slots', name: 'Demo Slots', category: 'slots', provider: 'Demo', rtp: 96.0 },
        { id: 'game-3', code: 'demo-roulette', name: 'Demo Roulette', category: 'table', provider: 'Demo', rtp: 97.3 },
        { id: 'game-4', code: 'demo-blackjack', name: 'Demo Blackjack', category: 'table', provider: 'Demo', rtp: 99.5 }
    ];
    for (const game of games) {
        await db.run(`INSERT OR IGNORE INTO games (id, code, name, category, provider, rtp) VALUES (?, ?, ?, ?, ?, ?)`, [game.id, game.code, game.name, game.category, game.provider, game.rtp]);
    }
}
// Convert PostgreSQL placeholders ($1, $2) to SQLite (?, ?)
function convertQuery(text) {
    return text
        .replace(/\$\d+/g, '?')
        .replace(/NOW\(\)/gi, "datetime('now')")
        .replace(/gen_random_uuid\(\)/gi, "lower(hex(randomblob(16)))")
        .replace(/RETURNING \*/gi, '');
}
async function querySQLite(text, params) {
    if (!db || !dbInitialized) {
        await initSQLite();
    }
    const sqliteText = convertQuery(text);
    const isSelect = sqliteText.trim().toUpperCase().startsWith('SELECT');
    try {
        if (isSelect) {
            const rows = await db.all(sqliteText, params);
            return { rows, rowCount: rows.length };
        }
        else {
            const result = await db.run(sqliteText, params);
            // Handle INSERT with RETURNING
            if (text.includes('RETURNING') && result.lastID) {
                const tableName = sqliteText.match(/INSERT INTO (\w+)/i)?.[1];
                if (tableName) {
                    const rows = await db.all(`SELECT * FROM ${tableName} WHERE rowid = ?`, [result.lastID]);
                    return { rows, rowCount: 1 };
                }
            }
            return { rows: [], rowCount: result.changes || 0 };
        }
    }
    catch (error) {
        logger_1.logger.error('SQLite query error', { text: sqliteText, error });
        throw error;
    }
}
async function transactionSQLite(callback) {
    if (!db || !dbInitialized) {
        await initSQLite();
    }
    try {
        await db.run('BEGIN IMMEDIATE');
        // Mock client that uses the same db connection
        const mockClient = {
            query: async (text, params) => {
                // Use the existing db connection within transaction
                const convertedQuery = convertQuery(text);
                try {
                    if (text.toLowerCase().startsWith('select')) {
                        const result = await db.all(convertedQuery, params);
                        return { rows: result, rowCount: result.length };
                    }
                    else {
                        const result = await db.run(convertedQuery, params);
                        return { rows: [], rowCount: result.changes || 0 };
                    }
                }
                catch (error) {
                    logger_1.logger.error('SQLite query error in transaction', { query: convertedQuery, error: error.message });
                    throw error;
                }
            }
        };
        const result = await callback(mockClient);
        await db.run('COMMIT');
        return result;
    }
    catch (error) {
        await db.run('ROLLBACK');
        throw error;
    }
}
//# sourceMappingURL=database-sqlite.js.map