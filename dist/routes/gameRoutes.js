"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const GameService_1 = require("../services/GameService");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const logger_1 = require("../utils/logger");
const rw_1 = require("../registry/rw");
const router = (0, express_1.Router)();
const gameService = new GameService_1.GameService();
// Get all available games
router.get('/list', auth_1.optionalAuth, async (req, res) => {
    try {
        const category = req.query.category;
        const games = await gameService.getGames(category);
        res.json({
            success: true,
            games,
            count: games.length
        });
    }
    catch (error) {
        logger_1.logger.error('Get games error', error);
        const correlationId = req.headers['x-correlation-id'];
        const { status, body } = (0, rw_1.buildError)('RW-SYS-000', {
            message: error.message,
            correlationId
        });
        res.status(status).json(body);
    }
});
// Get specific game
router.get('/:gameCode', async (req, res) => {
    try {
        const game = await gameService.getGame(req.params.gameCode);
        if (!game) {
            const correlationId = req.headers['x-correlation-id'];
            const { status, body } = (0, rw_1.buildError)('RW-RGS-006', {
                message: 'Game not found',
                correlationId
            });
            res.status(status).json(body);
            return;
        }
        res.json({
            success: true,
            game
        });
    }
    catch (error) {
        logger_1.logger.error('Get game error', error);
        const correlationId = req.headers['x-correlation-id'];
        const { status, body } = (0, rw_1.buildError)('RW-SYS-000', {
            message: error.message,
            correlationId
        });
        res.status(status).json(body);
    }
});
// Launch game
router.post('/launch', auth_1.authenticate, (0, validation_1.validate)('launchGame'), async (req, res) => {
    try {
        const response = await gameService.launchGame(req.user.id, req.body);
        res.json(response);
    }
    catch (error) {
        logger_1.logger.error('Launch game error', error);
        const correlationId = req.headers['x-correlation-id'];
        const errorCode = error.code && error.code.startsWith('RW-') ? error.code : 'RW-SYS-000';
        const { status, body } = (0, rw_1.buildError)(errorCode, {
            message: error.message,
            correlationId
        });
        res.status(status).json(body);
    }
});
// End game session
router.post('/end/:sessionId', auth_1.authenticate, async (req, res) => {
    try {
        await gameService.endGameSession(req.user.id, req.params.sessionId);
        res.json({
            success: true,
            message: 'Game session ended'
        });
    }
    catch (error) {
        logger_1.logger.error('End game session error', error);
        const correlationId = req.headers['x-correlation-id'];
        const errorCode = error.code && error.code.startsWith('RW-') ? error.code : 'RW-SYS-000';
        const { status, body } = (0, rw_1.buildError)(errorCode, {
            message: error.message,
            correlationId
        });
        res.status(status).json(body);
    }
});
// Get active game sessions
router.get('/sessions/active', auth_1.authenticate, async (req, res) => {
    try {
        const sessions = await gameService.getActiveGameSessions(req.user.id);
        res.json({
            success: true,
            sessions,
            count: sessions.length
        });
    }
    catch (error) {
        logger_1.logger.error('Get active sessions error', error);
        const correlationId = req.headers['x-correlation-id'];
        const { status, body } = (0, rw_1.buildError)('RW-SYS-000', {
            message: error.message,
            correlationId
        });
        res.status(status).json(body);
    }
});
// Get game history
router.get('/history', auth_1.authenticate, async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const offset = parseInt(req.query.offset) || 0;
        const history = await gameService.getGameHistory(req.user.id, limit, offset);
        res.json({
            success: true,
            history,
            pagination: {
                limit,
                offset
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Get game history error', error);
        const correlationId = req.headers['x-correlation-id'];
        const { status, body } = (0, rw_1.buildError)('RW-SYS-000', {
            message: error.message,
            correlationId
        });
        res.status(status).json(body);
    }
});
exports.default = router;
//# sourceMappingURL=gameRoutes.js.map