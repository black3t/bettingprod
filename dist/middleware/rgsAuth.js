"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRGSAuth = void 0;
const logger_1 = require("../utils/logger");
const rw_1 = require("../registry/rw");
/**
 * Middleware per autenticare le richieste provenienti da RGS
 * In Pre-Prod: validazione base API key
 * In Prod: mTLS + API key + signature
 */
const validateRGSAuth = (req, res, next) => {
    try {
        // Verifica API key RGS - supporta sia x-api-key che Authorization Bearer
        const apiKeyHeader = req.headers['x-api-key'];
        const authHeader = req.headers['authorization'];
        let apiKey;
        if (apiKeyHeader) {
            apiKey = apiKeyHeader;
        }
        else if (authHeader && authHeader.startsWith('Bearer ')) {
            apiKey = authHeader.substring(7);
        }
        const expectedKey = process.env.RGS_API_KEY || 'test_rgs_key';
        if (!apiKey || apiKey !== expectedKey) {
            logger_1.logger.warn('Invalid RGS API key', {
                provided: apiKey ? 'yes' : 'no',
                ip: req.ip
            });
            const { status, body } = (0, rw_1.buildError)('RW-RGS-003', {
                message: 'Unauthorized',
                correlationId: req.headers['x-correlation-id']
            });
            res.status(status).json(body);
            return;
        }
        // Il controllo del correlation ID è fatto dal middleware requireCorrelationId nel router
        // In Prod aggiungeremmo:
        // - Verifica certificato mTLS
        // - Verifica signature HMAC del body
        // - Rate limiting per API key
        next();
    }
    catch (error) {
        logger_1.logger.error('RGS auth middleware error', error);
        const { status, body } = (0, rw_1.buildError)('RW-SYS-000', {
            message: 'Internal server error',
            correlationId: req.headers['x-correlation-id']
        });
        res.status(status).json(body);
    }
};
exports.validateRGSAuth = validateRGSAuth;
//# sourceMappingURL=rgsAuth.js.map