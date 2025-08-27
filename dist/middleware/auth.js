"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionalAuth = exports.authenticate = void 0;
const AuthService_1 = require("../services/AuthService");
const logger_1 = require("../utils/logger");
const rw_1 = require("../registry/rw");
const authService = new AuthService_1.AuthService();
const authenticate = async (req, res, next) => {
    try {
        // Get token from multiple sources
        const token = req.headers.authorization?.replace('Bearer ', '') ||
            req.cookies?.token ||
            req.query.token;
        if (!token) {
            const { status, body } = (0, rw_1.buildError)('RW-RGS-003', {
                message: 'Authentication required',
                correlationId: req.correlationId
            });
            res.status(status).json(body);
            return;
        }
        // Validate session
        const user = await authService.validateSession(token);
        if (!user) {
            const { status, body } = (0, rw_1.buildError)('RW-RGS-003', {
                message: 'Invalid or expired session',
                correlationId: req.correlationId
            });
            res.status(status).json(body);
            return;
        }
        // Attach user to request
        req.user = user;
        req.token = token;
        next();
    }
    catch (error) {
        logger_1.logger.error('Authentication error', error);
        const { status, body } = (0, rw_1.buildError)('RW-SYS-000', {
            message: 'Authentication failed',
            correlationId: req.correlationId
        });
        res.status(status).json(body);
    }
};
exports.authenticate = authenticate;
const optionalAuth = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '') ||
            req.cookies?.token ||
            req.query.token;
        if (token) {
            const user = await authService.validateSession(token);
            if (user) {
                req.user = user;
                req.token = token;
            }
        }
        next();
    }
    catch (error) {
        // Continue without auth
        next();
    }
};
exports.optionalAuth = optionalAuth;
//# sourceMappingURL=auth.js.map