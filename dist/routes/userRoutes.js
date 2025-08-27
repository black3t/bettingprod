"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const UserService_1 = require("../services/UserService");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const logger_1 = require("../utils/logger");
const rw_1 = require("../registry/rw");
const router = (0, express_1.Router)();
const userService = new UserService_1.UserService();
// Get current user profile
router.get('/profile', auth_1.authenticate, async (req, res) => {
    try {
        const user = await userService.getUser(req.user.id);
        const wallet = await userService.getWallet(req.user.id);
        res.json({
            success: true,
            user: {
                ...user,
                balance: wallet.balance,
                currency: wallet.currency
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Get profile error', error);
        const correlationId = req.headers['x-correlation-id'];
        const errorCode = error.code && error.code.startsWith('RW-') ? error.code : 'RW-SYS-000';
        const { status, body } = (0, rw_1.buildError)(errorCode, {
            message: error.message,
            correlationId
        });
        res.status(status).json(body);
    }
});
// Update profile
router.put('/profile', auth_1.authenticate, (0, validation_1.validate)('updateProfile'), async (req, res) => {
    try {
        const updatedUser = await userService.updateProfile(req.user.id, req.body);
        res.json({
            success: true,
            user: updatedUser
        });
    }
    catch (error) {
        logger_1.logger.error('Update profile error', error);
        const correlationId = req.headers['x-correlation-id'];
        const errorCode = error.code && error.code.startsWith('RW-') ? error.code : 'RW-SYS-000';
        const { status, body } = (0, rw_1.buildError)(errorCode, {
            message: error.message,
            correlationId
        });
        res.status(status).json(body);
    }
});
// Get wallet balance
router.get('/wallet', auth_1.authenticate, async (req, res) => {
    try {
        const wallet = await userService.getWallet(req.user.id);
        res.json({
            success: true,
            wallet
        });
    }
    catch (error) {
        logger_1.logger.error('Get wallet error', error);
        const correlationId = req.headers['x-correlation-id'];
        const errorCode = error.code && error.code.startsWith('RW-') ? error.code : 'RW-SYS-000';
        const { status, body } = (0, rw_1.buildError)(errorCode, {
            message: error.message,
            correlationId
        });
        res.status(status).json(body);
    }
});
// Get transaction history
router.get('/transactions', auth_1.authenticate, async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const offset = parseInt(req.query.offset) || 0;
        const transactions = await userService.getTransactionHistory(req.user.id, limit, offset);
        res.json({
            success: true,
            transactions,
            pagination: {
                limit,
                offset
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Get transactions error', error);
        const correlationId = req.headers['x-correlation-id'];
        const { status, body } = (0, rw_1.buildError)('RW-SYS-000', {
            message: error.message,
            correlationId
        });
        res.status(status).json(body);
    }
});
// Get user statistics
router.get('/stats', auth_1.authenticate, async (req, res) => {
    try {
        const stats = await userService.getStats(req.user.id);
        res.json({
            success: true,
            stats
        });
    }
    catch (error) {
        logger_1.logger.error('Get stats error', error);
        const correlationId = req.headers['x-correlation-id'];
        const { status, body } = (0, rw_1.buildError)('RW-SYS-000', {
            message: error.message,
            correlationId
        });
        res.status(status).json(body);
    }
});
exports.default = router;
//# sourceMappingURL=userRoutes.js.map