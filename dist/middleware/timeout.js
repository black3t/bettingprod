"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.simulateTimeout = exports.timeoutMiddleware = void 0;
const logger_1 = require("../utils/logger");
const rw_1 = require("../registry/rw");
/**
 * Timeout middleware per gestire timeout HTTP
 * Bibbia: HTTP timeout 2s, ritorna RW-RGS-008
 */
const timeoutMiddleware = (timeoutMs = 2000) => {
    return (req, res, next) => {
        // Set timeout on the request
        const timeout = setTimeout(() => {
            if (!res.headersSent) {
                logger_1.logger.warn('Request timeout', {
                    method: req.method,
                    path: req.path,
                    timeout: timeoutMs
                });
                const { status, body } = (0, rw_1.buildError)('RW-RGS-008', {
                    message: 'Request timeout',
                    correlationId: req.correlationId
                });
                res.status(status).json(body);
            }
        }, timeoutMs);
        // Clear timeout when response finishes
        res.on('finish', () => {
            clearTimeout(timeout);
        });
        // Clear timeout on close
        res.on('close', () => {
            clearTimeout(timeout);
        });
        next();
    };
};
exports.timeoutMiddleware = timeoutMiddleware;
/**
 * Simulate timeout for testing
 * Set SIMULATE_TIMEOUT=true to trigger timeouts
 */
const simulateTimeout = () => {
    return async (req, res, next) => {
        if (process.env.SIMULATE_TIMEOUT === 'true') {
            // Random 10% chance of timeout in test mode
            if (Math.random() < 0.1) {
                logger_1.logger.info('Simulating timeout', {
                    path: req.path
                });
                await new Promise(resolve => setTimeout(resolve, 3000)); // Wait longer than timeout
            }
        }
        next();
    };
};
exports.simulateTimeout = simulateTimeout;
//# sourceMappingURL=timeout.js.map