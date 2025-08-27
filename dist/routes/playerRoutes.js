"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const PlayerService_1 = require("../services/PlayerService");
const rgsAuth_1 = require("../middleware/rgsAuth");
const logger_1 = require("../utils/logger");
const rw_1 = require("../registry/rw");
const router = (0, express_1.Router)();
const playerService = new PlayerService_1.PlayerService();
/**
 * GET /player/status
 * RGS → Casino: Get player status (canonical)
 * Bible: returns playerId, status, kyc, rgFlags, activeSessions
 */
router.get('/status', rgsAuth_1.validateRGSAuth, async (req, res) => {
    try {
        const playerId = req.query.playerId;
        if (!playerId) {
            const { status, body } = (0, rw_1.buildError)('RW-CAS-006', {
                message: 'playerId required',
                correlationId: req.correlationId
            });
            return res.status(status).json(body);
        }
        const playerStatus = await playerService.getPlayerStatus(playerId);
        res.json(playerStatus);
    }
    catch (error) {
        logger_1.logger.error('Player status error', error);
        const errorCode = error.code && error.code.startsWith('RW-') ? error.code : 'RW-SYS-000';
        const { status, body } = (0, rw_1.buildError)(errorCode, {
            message: error.message,
            correlationId: req.correlationId
        });
        res.status(status).json(body);
    }
});
/**
 * POST /player/status
 * Deprecated compatibility alias - use GET /player/status
 */
router.post('/status', rgsAuth_1.validateRGSAuth, async (req, res) => {
    // Add deprecation headers
    const sunsetDate = new Date();
    sunsetDate.setDate(sunsetDate.getDate() + 90);
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', sunsetDate.toISOString());
    res.setHeader('Link', '</player/status>; rel="successor-version"');
    try {
        const playerId = req.body.playerId;
        if (!playerId) {
            const { status, body } = (0, rw_1.buildError)('RW-CAS-006', {
                message: 'playerId required',
                correlationId: req.correlationId
            });
            return res.status(status).json(body);
        }
        const playerStatus = await playerService.getPlayerStatus(playerId);
        res.json(playerStatus);
    }
    catch (error) {
        logger_1.logger.error('Player status error', error);
        const errorCode = error.code && error.code.startsWith('RW-') ? error.code : 'RW-SYS-000';
        const { status, body } = (0, rw_1.buildError)(errorCode, {
            message: error.message,
            correlationId: req.correlationId
        });
        res.status(status).json(body);
    }
});
exports.default = router;
//# sourceMappingURL=playerRoutes.js.map