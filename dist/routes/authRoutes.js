"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const AuthService_1 = require("../services/AuthService");
const validation_1 = require("../middleware/validation");
const auth_1 = require("../middleware/auth");
const logger_1 = require("../utils/logger");
const rw_1 = require("../registry/rw");
const router = (0, express_1.Router)();
const authService = new AuthService_1.AuthService();
// Signup
router.post('/signup', (0, validation_1.validate)('signup'), async (req, res) => {
    try {
        const ipAddress = req.ip || req.socket.remoteAddress;
        const response = await authService.signup(req.body, ipAddress);
        // Set cookie
        res.cookie('token', response.token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7200000 // 2 hours
        });
        res.status(201).json(response);
    }
    catch (error) {
        logger_1.logger.error('Signup error', error);
        const correlationId = req.headers['x-correlation-id'];
        const errorCode = error.code && error.code.startsWith('RW-') ? error.code : 'RW-CAS-006';
        const { status, body } = (0, rw_1.buildError)(errorCode, {
            message: error.message,
            correlationId
        });
        res.status(status).json(body);
    }
});
// Login
router.post('/login', (0, validation_1.validate)('login'), async (req, res) => {
    try {
        const ipAddress = req.ip || req.socket.remoteAddress;
        const userAgent = req.headers['user-agent'];
        const response = await authService.login(req.body, ipAddress, userAgent);
        // Set cookie
        res.cookie('token', response.token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7200000 // 2 hours
        });
        res.json(response);
    }
    catch (error) {
        logger_1.logger.error('Login error', error);
        const correlationId = req.headers['x-correlation-id'];
        const errorCode = error.code && error.code.startsWith('RW-') ? error.code : 'RW-CAS-001';
        const { status, body } = (0, rw_1.buildError)(errorCode, {
            message: error.message,
            correlationId
        });
        res.status(status).json(body);
    }
});
// Logout
router.post('/logout', auth_1.authenticate, async (req, res) => {
    try {
        await authService.logout(req.token);
        // Clear cookie
        res.clearCookie('token');
        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    }
    catch (error) {
        logger_1.logger.error('Logout error', error);
        const correlationId = req.headers['x-correlation-id'];
        const { status, body } = (0, rw_1.buildError)('RW-SYS-000', {
            message: 'Logout failed',
            correlationId
        });
        res.status(status).json(body);
    }
});
// Validate session
router.get('/validate', auth_1.authenticate, async (req, res) => {
    res.json({
        success: true,
        user: req.user
    });
});
exports.default = router;
//# sourceMappingURL=authRoutes.js.map