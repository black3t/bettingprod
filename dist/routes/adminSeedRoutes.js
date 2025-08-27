"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const uuid_1 = require("uuid");
const database_1 = require("../config/database");
const rgsAuth_1 = require("../middleware/rgsAuth");
const logger_1 = require("../utils/logger");
const rw_1 = require("../registry/rw");
const router = (0, express_1.Router)();
/**
 * POST /player
 * Dev-only endpoint to seed a test player with wallet
 * Only available in development/test with DEV_SEED=true
 */
router.post('/player', rgsAuth_1.validateRGSAuth, async (req, res) => {
    try {
        // Validate X-Correlation-Id (required UUID v4)
        const correlationId = req.headers['x-correlation-id'];
        if (!correlationId) {
            const { status, body } = (0, rw_1.buildError)('RW-CAS-008', {
                message: 'X-Correlation-Id header is required',
                correlationId: correlationId || (0, uuid_1.v4)()
            });
            return res.status(status).json(body);
        }
        // Validate UUID v4 format
        const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
        if (!UUID_V4_REGEX.test(correlationId)) {
            const { status, body } = (0, rw_1.buildError)('RW-CAS-008', {
                message: 'X-Correlation-Id must be valid UUID v4 format',
                correlationId
            });
            return res.status(status).json(body);
        }
        // Extract initial balance (default 1000.00)
        const initialBalance = req.body?.initialBalance || '1000.00';
        // Validate balance format
        if (!/^\d+\.\d{2}$/.test(initialBalance)) {
            const { status, body } = (0, rw_1.buildError)('RW-CAS-006', {
                message: 'Invalid balance format, must be xx.yy',
                correlationId
            });
            return res.status(status).json(body);
        }
        // Generate IDs
        const playerId = (0, uuid_1.v4)();
        const walletId = (0, uuid_1.v4)();
        // Create user (with required fields for schema)
        const useSqlite = process.env.USE_SQLITE === 'true';
        const testUsername = `player_${playerId.substring(0, 8)}`;
        const testEmail = `${playerId}@test.local`;
        const testPasswordHash = '$2b$10$test.hash.for.dev.only'; // Fake hash for dev
        if (useSqlite) {
            await (0, database_1.query)('INSERT INTO users (id, username, email, password_hash, created_at) VALUES (?, ?, ?, ?, datetime("now"))', [playerId, testUsername, testEmail, testPasswordHash]);
            // Create wallet with id and initial balance
            await (0, database_1.query)('INSERT INTO user_wallets (id, user_id, balance, currency, created_at) VALUES (?, ?, ?, ?, datetime("now"))', [walletId, playerId, initialBalance, 'EUR']);
        }
        else {
            await (0, database_1.query)('INSERT INTO users (id, username, email, password_hash, created_at) VALUES ($1, $2, $3, $4, NOW())', [playerId, testUsername, testEmail, testPasswordHash]);
            // Create wallet with id and initial balance
            await (0, database_1.query)('INSERT INTO user_wallets (id, user_id, balance, currency, created_at) VALUES ($1, $2, $3, $4, NOW())', [walletId, playerId, initialBalance, 'EUR']);
        }
        // Create RG/limits defaults for the player
        if (useSqlite) {
            // Create responsible_gaming record with all safe defaults
            await (0, database_1.query)(`INSERT INTO responsible_gaming (
          player_id, self_excluded, cooling_off, reality_check_ack
        ) VALUES (?, 0, 0, 1)`, [playerId]);
            // Create player_limits with high limits (essentially unlimited for testing)
            await (0, database_1.query)(`INSERT INTO player_limits (
          user_id, daily_limit, weekly_limit, monthly_limit,
          daily_spent, weekly_spent, monthly_spent,
          last_reset_daily, last_reset_weekly, last_reset_monthly
        ) VALUES (?, ?, ?, ?, 0, 0, 0, datetime('now'), datetime('now'), datetime('now'))`, [playerId, '999999.99', '999999.99', '999999.99']);
            // No active self-exclusions or reality checks needed
        }
        else {
            // PostgreSQL version
            await (0, database_1.query)(`INSERT INTO responsible_gaming (
          player_id, self_excluded, cooling_off, reality_check_ack
        ) VALUES ($1, false, false, true)`, [playerId]);
            await (0, database_1.query)(`INSERT INTO player_limits (
          user_id, daily_limit, weekly_limit, monthly_limit,
          daily_spent, weekly_spent, monthly_spent,
          last_reset_daily, last_reset_weekly, last_reset_monthly
        ) VALUES ($1, $2, $3, $4, 0, 0, 0, NOW(), NOW(), NOW())`, [playerId, '999999.99', '999999.99', '999999.99']);
        }
        // Log only whitelisted fields
        logger_1.logger.info('Test player seeded', {
            playerId,
            correlationId,
            action: 'seed_player'
        });
        // Return player info
        res.status(200).json({
            playerId,
            balance: initialBalance,
            currency: 'EUR'
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to seed player', {
            error: error.message,
            correlationId: req.headers['x-correlation-id']
        });
        const { status, body } = (0, rw_1.buildError)('RW-SYS-000', {
            message: 'Failed to seed player',
            correlationId: req.headers['x-correlation-id']
        });
        res.status(status).json(body);
    }
});
/**
 * GET /player/:id
 * Dev-only endpoint to get player snapshot for debugging
 * Only available in development/test with DEV_SEED=true
 */
router.get('/player/:id', rgsAuth_1.validateRGSAuth, async (req, res) => {
    try {
        const playerId = req.params.id;
        // Validate UUID format
        const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
        if (!UUID_V4_REGEX.test(playerId)) {
            const { status, body } = (0, rw_1.buildError)('RW-CAS-006', {
                message: 'Invalid player ID format',
                correlationId: req.correlationId
            });
            return res.status(status).json(body);
        }
        // Get player data
        const userResult = await (0, database_1.query)('SELECT * FROM users WHERE id = ?', [playerId]);
        if (userResult.rows.length === 0) {
            const { status, body } = (0, rw_1.buildError)('RW-CAS-001', {
                message: 'Player not found',
                correlationId: req.correlationId
            });
            return res.status(status).json(body);
        }
        // Get wallet
        const walletResult = await (0, database_1.query)('SELECT * FROM user_wallets WHERE user_id = ?', [playerId]);
        // Get RG settings
        const rgResult = await (0, database_1.query)('SELECT * FROM responsible_gaming WHERE player_id = ?', [playerId]);
        // Get limits
        const limitsResult = await (0, database_1.query)('SELECT * FROM player_limits WHERE user_id = ?', [playerId]);
        // Build snapshot
        const snapshot = {
            playerId,
            wallet: walletResult.rows[0] ? {
                currency: walletResult.rows[0].currency,
                balance: walletResult.rows[0].balance
            } : null,
            rg: rgResult.rows[0] || {},
            limits: limitsResult.rows[0] || {}
        };
        res.status(200).json(snapshot);
    }
    catch (error) {
        logger_1.logger.error('Failed to get player snapshot', {
            error: error.message,
            playerId: req.params.id
        });
        const { status, body } = (0, rw_1.buildError)('RW-SYS-000', {
            message: 'Failed to get player snapshot',
            correlationId: req.correlationId
        });
        res.status(status).json(body);
    }
});
exports.default = router;
//# sourceMappingURL=adminSeedRoutes.js.map