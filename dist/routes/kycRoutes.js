"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const KYCService_1 = require("../services/KYCService");
const rgsAuth_1 = require("../middleware/rgsAuth");
const logger_1 = require("../utils/logger");
const rw_1 = require("../registry/rw");
const router = (0, express_1.Router)();
/**
 * GET /kyc/status
 * Bible riga 691: kyc status endpoint (canonical)
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
        const kycStatus = await KYCService_1.kycService.getKYCStatus(playerId);
        res.json(kycStatus);
    }
    catch (error) {
        logger_1.logger.error('KYC status error', error);
        const { status, body } = (0, rw_1.buildError)('RW-SYS-000', {
            message: error.message,
            correlationId: req.correlationId
        });
        res.status(status).json(body);
    }
});
/**
 * POST /kyc/status
 * Deprecated compatibility alias - use GET /kyc/status
 */
router.post('/status', rgsAuth_1.validateRGSAuth, async (req, res) => {
    const sunsetDate = new Date();
    sunsetDate.setDate(sunsetDate.getDate() + 90);
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', sunsetDate.toISOString());
    res.setHeader('Link', '</kyc/status>; rel="successor-version"');
    try {
        const playerId = req.body.playerId;
        if (!playerId) {
            const { status, body } = (0, rw_1.buildError)('RW-CAS-006', {
                message: 'playerId required',
                correlationId: req.correlationId
            });
            return res.status(status).json(body);
        }
        const kycStatus = await KYCService_1.kycService.getKYCStatus(playerId);
        res.json(kycStatus);
    }
    catch (error) {
        logger_1.logger.error('KYC status error', error);
        const { status, body } = (0, rw_1.buildError)('RW-SYS-000', {
            message: error.message,
            correlationId: req.correlationId
        });
        res.status(status).json(body);
    }
});
/**
 * POST /kyc/update
 * Update KYC status
 */
router.post('/update', rgsAuth_1.validateRGSAuth, async (req, res) => {
    try {
        const { playerId, status } = req.body;
        if (!playerId || !status) {
            const { status: httpStatus, body } = (0, rw_1.buildError)('RW-CAS-006', {
                message: 'playerId and status required',
                correlationId: req.correlationId
            });
            return res.status(httpStatus).json(body);
        }
        if (!Object.values(KYCService_1.KYCStatus).includes(status)) {
            const { status: httpStatus, body } = (0, rw_1.buildError)('RW-CAS-006', {
                message: 'Invalid KYC status',
                correlationId: req.correlationId
            });
            return res.status(httpStatus).json(body);
        }
        await KYCService_1.kycService.updateKYCStatus(playerId, status);
        res.json({
            status: 'OK',
            message: 'KYC status updated'
        });
    }
    catch (error) {
        logger_1.logger.error('KYC update error', error);
        const { status, body } = (0, rw_1.buildError)('RW-SYS-000', {
            message: error.message,
            correlationId: req.correlationId
        });
        res.status(status).json(body);
    }
});
/**
 * GET /kyc/exclusions
 * Bible riga 691: exclusions endpoint (canonical)
 */
router.get('/exclusions', rgsAuth_1.validateRGSAuth, async (req, res) => {
    try {
        const playerId = req.query.playerId;
        if (!playerId) {
            const { status, body } = (0, rw_1.buildError)('RW-CAS-006', {
                message: 'playerId required',
                correlationId: req.correlationId
            });
            return res.status(status).json(body);
        }
        const exclusions = await KYCService_1.kycService.getExclusions(playerId);
        res.json(exclusions);
    }
    catch (error) {
        logger_1.logger.error('Exclusions error', error);
        const { status, body } = (0, rw_1.buildError)('RW-SYS-000', {
            message: error.message,
            correlationId: req.correlationId
        });
        res.status(status).json(body);
    }
});
/**
 * POST /kyc/exclusions
 * Deprecated compatibility alias - use GET /kyc/exclusions
 */
router.post('/exclusions', rgsAuth_1.validateRGSAuth, async (req, res) => {
    const sunsetDate = new Date();
    sunsetDate.setDate(sunsetDate.getDate() + 90);
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', sunsetDate.toISOString());
    res.setHeader('Link', '</kyc/exclusions>; rel="successor-version"');
    try {
        const playerId = req.body.playerId;
        if (!playerId) {
            const { status, body } = (0, rw_1.buildError)('RW-CAS-006', {
                message: 'playerId required',
                correlationId: req.correlationId
            });
            return res.status(status).json(body);
        }
        const exclusions = await KYCService_1.kycService.getExclusions(playerId);
        res.json(exclusions);
    }
    catch (error) {
        logger_1.logger.error('Exclusions error', error);
        const { status, body } = (0, rw_1.buildError)('RW-SYS-000', {
            message: error.message,
            correlationId: req.correlationId
        });
        res.status(status).json(body);
    }
});
exports.default = router;
//# sourceMappingURL=kycRoutes.js.map