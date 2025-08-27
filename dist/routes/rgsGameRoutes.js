"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanup = void 0;
const express_1 = require("express");
const uuid_1 = require("uuid");
const rgsAuth_1 = require("../middleware/rgsAuth");
const idempotency_1 = require("../middleware/idempotency");
const rgsSingleFlight_1 = require("../middleware/rgsSingleFlight");
const logger_1 = require("../utils/logger");
const rw_1 = require("../registry/rw");
const CasinoClient_1 = __importDefault(require("../services/CasinoClient"));
const router = (0, express_1.Router)();
// Middleware to require correlation ID
const requireCorrelationId = (req, res, next) => {
    const correlationId = req.headers['x-correlation-id'];
    if (!correlationId) {
        const { status, body } = (0, rw_1.buildError)('RW-CAS-006', {
            message: 'X-Correlation-Id header is required'
        });
        return res.status(status).json(body);
    }
    // Validate UUID v4 format
    const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    if (!UUID_V4_REGEX.test(correlationId)) {
        const { status, body } = (0, rw_1.buildError)('RW-CAS-006', {
            message: 'X-Correlation-Id must be valid UUID v4 format',
            correlationId
        });
        return res.status(status).json(body);
    }
    next();
};
// Storage for idempotency (48h TTL)
const idempotencyCache = new Map();
const IDEMPOTENCY_TTL = 48 * 60 * 60 * 1000; // 48 hours
// Clean expired entries periodically
let cleanupInterval = null;
if (process.env.NODE_ENV !== 'test') {
    cleanupInterval = setInterval(() => {
        const now = Date.now();
        for (const [key, value] of idempotencyCache.entries()) {
            if (now - value.timestamp > IDEMPOTENCY_TTL) {
                idempotencyCache.delete(key);
            }
        }
    }, 60 * 60 * 1000); // Every hour
}
// Export cleanup function for tests
const cleanup = () => {
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
    }
};
exports.cleanup = cleanup;
/**
 * Helper to check and return cached response for idempotency
 */
function checkIdempotency(key) {
    const cached = idempotencyCache.get(key);
    if (cached && Date.now() - cached.timestamp <= IDEMPOTENCY_TTL) {
        return cached.response;
    }
    return null;
}
/**
 * Helper to store response for idempotency
 */
function storeIdempotency(key, response) {
    idempotencyCache.set(key, {
        response,
        timestamp: Date.now()
    });
}
/**
 * POST /session/validate
 * Validates player session
 */
router.post('/session/validate', rgsAuth_1.validateRGSAuth, requireCorrelationId, async (req, res) => {
    try {
        const { playerId, token, sessionId } = req.body;
        const correlationId = req.headers['x-correlation-id'];
        // Mock validation - in production would check with actual session store
        if (!playerId) {
            const { status, body } = (0, rw_1.buildError)('RW-RGS-001', { message: 'Invalid player ID', correlationId });
            return res.status(status).json(body);
        }
        // Mock response with limits from Casino
        const response = {
            valid: true,
            limits: {
                minBet: '0.10',
                maxBet: '100.00',
                maxWin: '3000.00'
            },
            balance: '1000.00' // Mock balance
        };
        logger_1.logger.info('Session validated', {
            playerId,
            correlationId,
            action: 'session_validate',
            result: 'valid'
        });
        res.status(200).json(response);
    }
    catch (error) {
        logger_1.logger.error('Session validation failed', error);
        const correlationId = req.headers['x-correlation-id'];
        const { status, body } = (0, rw_1.buildError)('RW-SYS-000', { message: 'Internal error', correlationId });
        res.status(status).json(body);
    }
});
/**
 * POST /round/start
 * Starts a new game round
 */
router.post('/round/start', rgsAuth_1.validateRGSAuth, requireCorrelationId, idempotency_1.requireIdempotencyKey, async (req, res) => {
    try {
        const { playerId, gameId, roundId } = req.body;
        const correlationId = req.headers['x-correlation-id'];
        const idempotencyKey = req.headers['idempotency-key'];
        // Check idempotency
        const cached = checkIdempotency(idempotencyKey);
        if (cached) {
            return res.status(200).json(cached);
        }
        if (!playerId || !gameId || !roundId) {
            const { status, body } = (0, rw_1.buildError)('RW-RGS-004', { message: 'Missing required fields', correlationId });
            return res.status(status).json(body);
        }
        // Mock round start
        const sessionId = (0, uuid_1.v4)();
        const response = {
            sessionId,
            status: 'STARTED',
            roundId
        };
        storeIdempotency(idempotencyKey, response);
        logger_1.logger.info('Round started', {
            playerId,
            roundId,
            sessionId,
            correlationId,
            action: 'round_start',
            result: 'started'
        });
        res.status(200).json(response);
    }
    catch (error) {
        logger_1.logger.error('Round start failed', error);
        const correlationId = req.headers['x-correlation-id'];
        const { status, body } = (0, rw_1.buildError)('RW-RGS-005', { message: 'Failed to start round', correlationId });
        res.status(status).json(body);
    }
});
/**
 * POST /transaction/debit
 * Debits player wallet via Casino
 */
router.post('/transaction/debit', rgsAuth_1.validateRGSAuth, requireCorrelationId, idempotency_1.requireIdempotencyKey, rgsSingleFlight_1.rgsSingleFlight, async (req, res) => {
    try {
        // Extract ONLY required fields, reject extra
        const { playerId, amount, roundId, transactionId } = req.body;
        const correlationId = req.headers['x-correlation-id'];
        const idempotencyKey = req.headers['idempotency-key'];
        // Reject extra fields
        const allowedFields = ['playerId', 'amount', 'roundId', 'transactionId'];
        const extraFields = Object.keys(req.body).filter(f => !allowedFields.includes(f));
        if (extraFields.length > 0) {
            const { status, body } = (0, rw_1.buildError)('RW-CAS-006', { message: `Extra fields not allowed: ${extraFields.join(', ')}`, correlationId });
            return res.status(status).json(body);
        }
        // Check idempotency
        const cached = checkIdempotency(idempotencyKey);
        if (cached) {
            return res.status(200).json(cached);
        }
        // Validate required fields
        if (!playerId || !amount || !roundId) {
            const { status, body } = (0, rw_1.buildError)('RW-RGS-004', { message: 'Missing required fields', correlationId });
            return res.status(status).json(body);
        }
        // Validate amount format (must be "xx.yy")
        if (!/^\d+\.\d{2}$/.test(amount)) {
            const { status, body } = (0, rw_1.buildError)('RW-RGS-006', { message: 'Invalid amount format', correlationId });
            return res.status(status).json(body);
        }
        // Call Casino wallet debit with retry
        let casinoResponse;
        let lastError;
        // Retry logic with exponential backoff
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                casinoResponse = await CasinoClient_1.default.debit({
                    playerId,
                    amount,
                    currency: 'EUR',
                    transactionRef: transactionId || (0, uuid_1.v4)()
                }, {
                    'Authorization': `Bearer ${process.env.RGS_API_KEY || 'test_rgs_key'}`,
                    'X-Correlation-Id': correlationId,
                    'Idempotency-Key': idempotencyKey // Same key for retries
                });
                break; // Success, exit retry loop
            }
            catch (error) {
                lastError = error;
                if (error.response?.status >= 400 && error.response?.status < 500) {
                    throw error; // Don't retry client errors
                }
                if (attempt < 2) {
                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
                }
            }
        }
        if (!casinoResponse) {
            throw lastError || new Error('Failed to contact Casino');
        }
        const response = {
            status: casinoResponse.data.status || 'APPROVED',
            newBalance: casinoResponse.data.newBalance || amount,
            transactionId: transactionId || (0, uuid_1.v4)()
        };
        storeIdempotency(idempotencyKey, response);
        logger_1.logger.info('Transaction debit processed', {
            playerId,
            amount,
            correlationId,
            action: 'transaction_debit',
            result: response.status
        });
        res.status(200).json(response);
    }
    catch (error) {
        logger_1.logger.error('Transaction debit failed', {
            error: error.message,
            status: error.response?.status,
            data: error.response?.data
        });
        const correlationId = req.headers['x-correlation-id'];
        // Map Casino errors to RGS errors
        if (error.response?.data?.error?.code === 'RW-CAS-002') {
            const { status, body } = (0, rw_1.buildError)('RW-RGS-002', { message: 'Insufficient funds', correlationId });
            return res.status(status).json(body);
        }
        if (error.response?.data?.error?.code === 'RW-CAS-003') {
            const { status, body } = (0, rw_1.buildError)('RW-RGS-002', { message: 'Limit exceeded', correlationId });
            return res.status(status).json(body);
        }
        const { status, body } = (0, rw_1.buildError)('RW-SYS-000', { message: 'Transaction failed', correlationId });
        res.status(status).json(body);
    }
});
/**
 * POST /transaction/credit
 * Credits player wallet via Casino
 */
router.post('/transaction/credit', rgsAuth_1.validateRGSAuth, requireCorrelationId, idempotency_1.requireIdempotencyKey, rgsSingleFlight_1.rgsSingleFlight, async (req, res) => {
    try {
        const { playerId, amount, roundId, transactionId } = req.body;
        const correlationId = req.headers['x-correlation-id'];
        const idempotencyKey = req.headers['idempotency-key'];
        // Check idempotency
        const cached = checkIdempotency(idempotencyKey);
        if (cached) {
            return res.status(200).json(cached);
        }
        // Validate amount format
        if (!amount || !/^\d+\.\d{2}$/.test(amount)) {
            const { status, body } = (0, rw_1.buildError)('RW-RGS-007', { message: 'Invalid amount format', correlationId });
            return res.status(status).json(body);
        }
        // Call Casino wallet credit
        const casinoResponse = await CasinoClient_1.default.credit({
            playerId,
            amount,
            currency: 'EUR',
            transactionRef: transactionId || (0, uuid_1.v4)()
        }, {
            'Authorization': `Bearer ${process.env.RGS_API_KEY || 'test_rgs_key'}`,
            'X-Correlation-Id': correlationId,
            'Idempotency-Key': idempotencyKey
        });
        const response = {
            status: casinoResponse.data.status || 'APPROVED',
            newBalance: casinoResponse.data.newBalance || amount,
            transactionId: transactionId || (0, uuid_1.v4)()
        };
        storeIdempotency(idempotencyKey, response);
        logger_1.logger.info('Transaction credit processed', {
            playerId,
            amount,
            correlationId,
            action: 'transaction_credit',
            result: response.status
        });
        res.status(200).json(response);
    }
    catch (error) {
        logger_1.logger.error('Transaction credit failed', error);
        const correlationId = req.headers['x-correlation-id'];
        const { status, body } = (0, rw_1.buildError)('RW-SYS-000', { message: 'Transaction failed', correlationId });
        res.status(status).json(body);
    }
});
/**
 * POST /round/end
 * Ends a game round
 */
router.post('/round/end', rgsAuth_1.validateRGSAuth, requireCorrelationId, idempotency_1.requireIdempotencyKey, async (req, res) => {
    try {
        const { roundId, playerId, summary } = req.body;
        const correlationId = req.headers['x-correlation-id'];
        const idempotencyKey = req.headers['idempotency-key'];
        // Check idempotency
        const cached = checkIdempotency(idempotencyKey);
        if (cached) {
            return res.status(200).json(cached);
        }
        if (!roundId || !playerId) {
            const { status, body } = (0, rw_1.buildError)('RW-RGS-004', { message: 'Missing required fields', correlationId });
            return res.status(status).json(body);
        }
        const response = {
            status: 'CLOSED',
            roundId,
            timestamp: new Date().toISOString()
        };
        storeIdempotency(idempotencyKey, response);
        logger_1.logger.info('Round ended', {
            playerId,
            roundId,
            correlationId,
            action: 'round_end',
            result: 'closed'
        });
        res.status(200).json(response);
    }
    catch (error) {
        logger_1.logger.error('Round end failed', error);
        const correlationId = req.headers['x-correlation-id'];
        const { status, body } = (0, rw_1.buildError)('RW-RGS-005', { message: 'Failed to end round', correlationId });
        res.status(status).json(body);
    }
});
// Additional RGS endpoints for extended functionality
/**
 * POST /auth/token
 * Generate session token for player
 */
router.post('/auth/token', rgsAuth_1.validateRGSAuth, requireCorrelationId, async (req, res) => {
    try {
        const { playerId } = req.body;
        const correlationId = req.headers['x-correlation-id'];
        if (!playerId) {
            const { status, body } = (0, rw_1.buildError)('RW-RGS-003', { message: 'Player ID required', correlationId });
            return res.status(status).json(body);
        }
        // Token generation with configurable TTL
        const SESSION_TTL = parseInt(process.env.SESSION_TTL || '3600'); // seconds
        const tokenPayload = {
            playerId,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + SESSION_TTL,
            jti: (0, uuid_1.v4)(), // JWT ID for revocation
            type: 'session'
        };
        // Opaque token format (base64 encoded JSON)
        const token = Buffer.from(JSON.stringify(tokenPayload)).toString('base64');
        const response = {
            token,
            expiresIn: SESSION_TTL,
            tokenType: 'Bearer'
        };
        logger_1.logger.info('Token generated', {
            playerId,
            correlationId,
            action: 'auth_token'
        });
        res.status(200).json(response);
    }
    catch (error) {
        logger_1.logger.error('Token generation failed', error);
        const correlationId = req.headers['x-correlation-id'];
        const { status, body } = (0, rw_1.buildError)('RW-RGS-003', { message: 'Authentication failed', correlationId });
        res.status(status).json(body);
    }
});
/**
 * POST /session/start
 * Start game session
 */
router.post('/session/start', rgsAuth_1.validateRGSAuth, requireCorrelationId, async (req, res) => {
    try {
        const { playerId, gameId, device, ip } = req.body;
        const correlationId = req.headers['x-correlation-id'];
        if (!playerId || !gameId) {
            const { status, body } = (0, rw_1.buildError)('RW-RGS-004', { message: 'Missing required fields', correlationId });
            return res.status(status).json(body);
        }
        const sessionId = (0, uuid_1.v4)();
        const response = {
            sessionId,
            launchUrl: `${process.env.GAME_BASE_URL || 'http://localhost:3000'}/game?session=${sessionId}`,
            iframeToken: Buffer.from(sessionId).toString('base64')
        };
        logger_1.logger.info('Session started', {
            playerId,
            sessionId,
            correlationId,
            action: 'session_start'
        });
        res.status(200).json(response);
    }
    catch (error) {
        logger_1.logger.error('Session start failed', error);
        const correlationId = req.headers['x-correlation-id'];
        const { status, body } = (0, rw_1.buildError)('RW-RGS-003', { message: 'Failed to start session', correlationId });
        res.status(status).json(body);
    }
});
/**
 * POST /session/keepalive
 * Keep session alive (canonical)
 */
router.post('/session/keepalive', rgsAuth_1.validateRGSAuth, requireCorrelationId, async (req, res) => {
    try {
        const { sessionId } = req.body;
        const correlationId = req.headers['x-correlation-id'];
        if (!sessionId) {
            const { status, body } = (0, rw_1.buildError)('RW-RGS-003', { message: 'Session ID required', correlationId });
            return res.status(status).json(body);
        }
        res.status(200).json({
            status: 'alive',
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        logger_1.logger.error('Keepalive failed', error);
        const correlationId = req.headers['x-correlation-id'];
        const { status, body } = (0, rw_1.buildError)('RW-SYS-000', { message: 'Internal error', correlationId });
        res.status(status).json(body);
    }
});
/**
 * POST /session/close
 * Close game session
 */
router.post('/session/close', rgsAuth_1.validateRGSAuth, requireCorrelationId, async (req, res) => {
    try {
        const { sessionId, reason } = req.body;
        const correlationId = req.headers['x-correlation-id'];
        if (!sessionId) {
            const { status, body } = (0, rw_1.buildError)('RW-RGS-003', { message: 'Session ID required', correlationId });
            return res.status(status).json(body);
        }
        logger_1.logger.info('Session closed', {
            sessionId,
            reason,
            correlationId,
            action: 'session_close'
        });
        res.status(200).json({
            status: 'closed',
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        logger_1.logger.error('Session close failed', error);
        const correlationId = req.headers['x-correlation-id'];
        const { status, body } = (0, rw_1.buildError)('RW-SYS-000', { message: 'Internal error', correlationId });
        res.status(status).json(body);
    }
});
/**
 * POST /bet
 * Place bet through Casino
 */
router.post('/bet', rgsAuth_1.validateRGSAuth, requireCorrelationId, idempotency_1.requireIdempotencyKey, rgsSingleFlight_1.rgsSingleFlight, async (req, res) => {
    try {
        const { playerId, amount, betDetails } = req.body;
        const correlationId = req.headers['x-correlation-id'];
        const idempotencyKey = req.headers['idempotency-key'];
        // Check idempotency
        const cached = checkIdempotency(idempotencyKey);
        if (cached) {
            return res.status(200).json(cached);
        }
        // Call Casino wallet debit for bet
        const casinoResponse = await CasinoClient_1.default.debit({
            playerId,
            amount,
            currency: 'EUR'
        }, {
            'Authorization': `Bearer ${process.env.RGS_API_KEY || 'test_rgs_key'}`,
            'X-Correlation-Id': correlationId,
            'Idempotency-Key': idempotencyKey
        });
        const response = {
            status: 'ACCEPTED',
            betId: (0, uuid_1.v4)(),
            newBalance: casinoResponse.data.newBalance
        };
        storeIdempotency(idempotencyKey, response);
        logger_1.logger.info('Bet placed', {
            playerId,
            amount,
            correlationId,
            action: 'bet_place',
            result: 'accepted'
        });
        res.status(200).json(response);
    }
    catch (error) {
        logger_1.logger.error('Bet placement failed', error);
        const correlationId = req.headers['x-correlation-id'];
        if (error.response?.status === 422) {
            const { status, body } = (0, rw_1.buildError)('RW-RGS-002', { message: 'Insufficient funds', correlationId });
            return res.status(status).json(body);
        }
        const { status, body } = (0, rw_1.buildError)('RW-SYS-000', { message: 'Bet failed', correlationId });
        res.status(status).json(body);
    }
});
/**
 * POST /session/heartbeat
 * Deprecated alias for keepalive - use POST /session/keepalive
 */
router.post('/session/heartbeat', rgsAuth_1.validateRGSAuth, requireCorrelationId, async (req, res) => {
    // Add deprecation headers
    const sunsetDate = new Date();
    sunsetDate.setDate(sunsetDate.getDate() + 90);
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', sunsetDate.toISOString());
    res.setHeader('Link', '</session/keepalive>; rel="successor-version"');
    try {
        const { sessionId } = req.body;
        const correlationId = req.headers['x-correlation-id'];
        if (!sessionId) {
            const { status, body } = (0, rw_1.buildError)('RW-RGS-003', { message: 'Session ID required', correlationId });
            return res.status(status).json(body);
        }
        // Mock keepalive - in production would update session timestamp
        const response = {
            sessionId,
            status: 'ACTIVE',
            expiresIn: 1800, // 30 minutes
            timestamp: new Date().toISOString()
        };
        logger_1.logger.info('Session heartbeat', {
            sessionId,
            action: 'session.heartbeat'
        });
        res.status(200).json(response);
    }
    catch (error) {
        logger_1.logger.error('Session heartbeat failed', error);
        const correlationId = req.headers['x-correlation-id'];
        const { status, body } = (0, rw_1.buildError)('RW-SYS-000', { message: 'Internal error', correlationId });
        res.status(status).json(body);
    }
});
/**
 * POST /win
 * Process win through Casino
 */
router.post('/win', rgsAuth_1.validateRGSAuth, requireCorrelationId, idempotency_1.requireIdempotencyKey, rgsSingleFlight_1.rgsSingleFlight, async (req, res) => {
    try {
        const { playerId, amount, winDetails } = req.body;
        const correlationId = req.headers['x-correlation-id'];
        const idempotencyKey = req.headers['idempotency-key'];
        // Check idempotency
        const cached = checkIdempotency(idempotencyKey);
        if (cached) {
            return res.status(200).json(cached);
        }
        // Call Casino wallet credit for win
        const casinoResponse = await CasinoClient_1.default.credit({
            playerId,
            amount,
            currency: 'EUR'
        }, {
            'Authorization': `Bearer ${process.env.RGS_API_KEY || 'test_rgs_key'}`,
            'X-Correlation-Id': correlationId,
            'Idempotency-Key': idempotencyKey
        });
        const response = {
            status: 'CREDITED',
            winId: (0, uuid_1.v4)(),
            newBalance: casinoResponse.data.newBalance
        };
        storeIdempotency(idempotencyKey, response);
        logger_1.logger.info('Win processed', {
            playerId,
            amount,
            correlationId,
            action: 'win_credit',
            result: 'credited'
        });
        res.status(200).json(response);
    }
    catch (error) {
        logger_1.logger.error('Win processing failed', error);
        const correlationId = req.headers['x-correlation-id'];
        const { status, body } = (0, rw_1.buildError)('RW-SYS-000', { message: 'Win processing failed', correlationId });
        res.status(status).json(body);
    }
});
/**
 * POST /round/cancel
 * Cancel a round
 */
router.post('/round/cancel', rgsAuth_1.validateRGSAuth, requireCorrelationId, idempotency_1.requireIdempotencyKey, async (req, res) => {
    try {
        const { roundId, playerId, reason } = req.body;
        const idempotencyKey = req.headers['idempotency-key'];
        // Check idempotency
        const cached = checkIdempotency(idempotencyKey);
        if (cached) {
            return res.status(200).json(cached);
        }
        // Mock round cancellation
        const response = {
            status: 'CANCELLED',
            roundId,
            playerId,
            reason: reason || 'RGS requested',
            timestamp: new Date().toISOString()
        };
        storeIdempotency(idempotencyKey, response);
        logger_1.logger.info('Round cancelled', {
            playerId,
            roundId,
            reason,
            action: 'round.cancel'
        });
        res.status(200).json(response);
    }
    catch (error) {
        logger_1.logger.error('Round cancel failed', error);
        const correlationId = req.headers['x-correlation-id'];
        const { status, body } = (0, rw_1.buildError)('RW-SYS-000', { message: 'Round cancel failed', correlationId });
        res.status(status).json(body);
    }
});
/**
 * POST /round/rollback
 * Rollback round transaction (canonical)
 */
router.post('/round/rollback', rgsAuth_1.validateRGSAuth, requireCorrelationId, idempotency_1.requireIdempotencyKey, async (req, res) => {
    try {
        const { transactionId, playerId, amount } = req.body;
        const idempotencyKey = req.headers['idempotency-key'];
        // Check idempotency - rollback is always idempotent
        const cached = checkIdempotency(idempotencyKey);
        if (cached) {
            return res.status(200).json(cached);
        }
        // Mock rollback - in production would reverse the transaction
        const response = {
            status: 'ROLLED_BACK',
            transactionId,
            timestamp: new Date().toISOString()
        };
        storeIdempotency(idempotencyKey, response);
        logger_1.logger.info('Transaction rolled back', {
            playerId,
            transactionId,
            action: 'rollback'
        });
        res.status(200).json(response);
    }
    catch (error) {
        logger_1.logger.error('Rollback failed', error);
        const correlationId = req.headers['x-correlation-id'];
        const { status, body } = (0, rw_1.buildError)('RW-SYS-000', { message: 'Rollback failed', correlationId });
        res.status(status).json(body);
    }
});
/**
 * POST /rollback
 * Deprecated compatibility alias - use POST /round/rollback
 */
router.post('/rollback', rgsAuth_1.validateRGSAuth, requireCorrelationId, idempotency_1.requireIdempotencyKey, async (req, res) => {
    // Add deprecation headers
    const sunsetDate = new Date();
    sunsetDate.setDate(sunsetDate.getDate() + 90);
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', sunsetDate.toISOString());
    res.setHeader('Link', '</round/rollback>; rel="successor-version"');
    try {
        const { transactionId, playerId, amount } = req.body;
        const idempotencyKey = req.headers['idempotency-key'];
        // Check idempotency - rollback is always idempotent
        const cached = checkIdempotency(idempotencyKey);
        if (cached) {
            return res.status(200).json(cached);
        }
        // Mock rollback - in production would reverse the transaction
        const response = {
            status: 'ROLLED_BACK',
            transactionId,
            timestamp: new Date().toISOString()
        };
        storeIdempotency(idempotencyKey, response);
        logger_1.logger.info('Transaction rolled back', {
            playerId,
            transactionId,
            action: 'rollback'
        });
        res.status(200).json(response);
    }
    catch (error) {
        logger_1.logger.error('Rollback failed', error);
        const correlationId = req.headers['x-correlation-id'];
        const { status, body } = (0, rw_1.buildError)('RW-SYS-000', { message: 'Rollback failed', correlationId });
        res.status(status).json(body);
    }
});
/**
 * POST /limits/check
 * Check player limits via Casino
 */
router.post('/limits/check', rgsAuth_1.validateRGSAuth, requireCorrelationId, rgsSingleFlight_1.rgsSingleFlight, async (req, res) => {
    try {
        const { playerId, amount } = req.body;
        const correlationId = req.headers['x-correlation-id'];
        // Forward to Casino limits check
        const casinoResponse = await CasinoClient_1.default.checkLimits({
            playerId,
            stake: amount
        }, {
            'Authorization': `Bearer ${process.env.RGS_API_KEY || 'test_rgs_key'}`,
            'X-Correlation-Id': correlationId
        });
        // Ensure response always has {ok, reason?} format
        const response = {
            ok: casinoResponse.data?.ok === true,
            ...(casinoResponse.data?.reason && { reason: casinoResponse.data.reason })
        };
        res.status(200).json(response);
    }
    catch (error) {
        logger_1.logger.error('Limits check failed', error);
        const correlationId = req.headers['x-correlation-id'];
        const { status, body } = (0, rw_1.buildError)('RW-SYS-000', { message: 'Limits check failed', correlationId });
        res.status(status).json(body);
    }
});
/**
 * GET /player/state
 * Get player state (mock, no PII)
 */
router.get('/player/state', rgsAuth_1.validateRGSAuth, requireCorrelationId, async (req, res) => {
    try {
        const { playerId } = req.query;
        const correlationId = req.headers['x-correlation-id'];
        if (!playerId) {
            const { status, body } = (0, rw_1.buildError)('RW-RGS-003', { message: 'Player ID required', correlationId });
            return res.status(status).json(body);
        }
        // Mock player state - no PII
        const response = {
            playerId,
            activeSessions: 1,
            lastActivity: new Date().toISOString(),
            sessionStatus: 'active'
        };
        res.status(200).json(response);
    }
    catch (error) {
        logger_1.logger.error('Player state fetch failed', error);
        const correlationId = req.headers['x-correlation-id'];
        const { status, body } = (0, rw_1.buildError)('RW-SYS-000', { message: 'Internal error', correlationId });
        res.status(status).json(body);
    }
});
exports.default = router;
//# sourceMappingURL=rgsGameRoutes.js.map