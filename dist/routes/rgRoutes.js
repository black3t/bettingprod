"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ResponsibleGamingService_1 = require("../services/ResponsibleGamingService");
const rgsAuth_1 = require("../middleware/rgsAuth");
const logger_1 = require("../utils/logger");
const rw_1 = require("../registry/rw");
const router = (0, express_1.Router)();
/**
 * POST /rg/self-exclude
 * Bible riga 717: "Self-exclusion immediate upon reception"
 */
router.post('/self-exclude', rgsAuth_1.validateRGSAuth, async (req, res) => {
    try {
        const { playerId, until } = req.body;
        if (!playerId || !until) {
            const { status, body } = (0, rw_1.buildError)('RW-CAS-006', {
                message: 'playerId and until required',
                correlationId: req.correlationId
            });
            return res.status(status).json(body);
        }
        const untilDate = new Date(until);
        if (isNaN(untilDate.getTime()) || untilDate <= new Date()) {
            const { status, body } = (0, rw_1.buildError)('RW-CAS-006', {
                message: 'Invalid until date',
                correlationId: req.correlationId
            });
            return res.status(status).json(body);
        }
        await ResponsibleGamingService_1.responsibleGamingService.selfExclude(playerId, untilDate);
        res.json({
            status: 'OK',
            message: 'Self-exclusion activated',
            until: untilDate.toISOString()
        });
    }
    catch (error) {
        logger_1.logger.error('Self-exclude error', error);
        const { status, body } = (0, rw_1.buildError)('RW-SYS-000', {
            message: error.message,
            correlationId: req.correlationId
        });
        res.status(status).json(body);
    }
});
/**
 * POST /rg/cooling-off
 * Bible riga 717: "cooling-off aumento limiti"
 */
router.post('/cooling-off', rgsAuth_1.validateRGSAuth, async (req, res) => {
    try {
        const { playerId, until } = req.body;
        if (!playerId || !until) {
            const { status, body } = (0, rw_1.buildError)('RW-CAS-006', {
                message: 'playerId and until required',
                correlationId: req.correlationId
            });
            return res.status(status).json(body);
        }
        const untilDate = new Date(until);
        if (isNaN(untilDate.getTime()) || untilDate <= new Date()) {
            const { status, body } = (0, rw_1.buildError)('RW-CAS-006', {
                message: 'Invalid until date',
                correlationId: req.correlationId
            });
            return res.status(status).json(body);
        }
        await ResponsibleGamingService_1.responsibleGamingService.setCoolingOff(playerId, untilDate);
        res.json({
            status: 'OK',
            message: 'Cooling-off period activated',
            until: untilDate.toISOString()
        });
    }
    catch (error) {
        logger_1.logger.error('Cooling-off error', error);
        const { status, body } = (0, rw_1.buildError)('RW-SYS-000', {
            message: error.message,
            correlationId: req.correlationId
        });
        res.status(status).json(body);
    }
});
/**
 * POST /rg/reality-check/ack
 * Bible riga 715: "ACK obbligatorio"
 */
router.post('/reality-check/ack', rgsAuth_1.validateRGSAuth, async (req, res) => {
    try {
        const { playerId } = req.body;
        if (!playerId) {
            const { status, body } = (0, rw_1.buildError)('RW-CAS-006', {
                message: 'playerId required',
                correlationId: req.correlationId
            });
            return res.status(status).json(body);
        }
        await ResponsibleGamingService_1.responsibleGamingService.acknowledgeRealityCheck(playerId);
        res.json({
            status: 'OK',
            message: 'Reality check acknowledged'
        });
    }
    catch (error) {
        logger_1.logger.error('Reality check ack error', error);
        const { status, body } = (0, rw_1.buildError)('RW-SYS-000', {
            message: error.message,
            correlationId: req.correlationId
        });
        res.status(status).json(body);
    }
});
/**
 * GET /rg/status
 * Get RG status for player
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
        const rgStatus = await ResponsibleGamingService_1.responsibleGamingService.getStatus(playerId);
        res.json(rgStatus);
    }
    catch (error) {
        logger_1.logger.error('RG status error', error);
        const { status, body } = (0, rw_1.buildError)('RW-SYS-000', {
            message: error.message,
            correlationId: req.correlationId
        });
        res.status(status).json(body);
    }
});
exports.default = router;
//# sourceMappingURL=rgRoutes.js.map