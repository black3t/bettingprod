"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const WalletService_1 = require("../services/WalletService");
const rgsAuth_1 = require("../middleware/rgsAuth");
const validation_1 = require("../middleware/validation");
const idempotency_1 = require("../middleware/idempotency");
const logger_1 = require("../utils/logger");
const rw_1 = require("../registry/rw");
const router = (0, express_1.Router)();
const walletService = new WalletService_1.WalletService();
/**
 * POST /wallet/debit
 * RGS → Casino: Addebita fondi dal wallet del giocatore
 * Bibbia §4.5: { playerId, amount, currency, idempotencyKey } → { status, reason?, newBalance? }
 */
router.post('/debit', rgsAuth_1.validateRGSAuth, idempotency_1.normalizeIdempotency, idempotency_1.requireIdempotencyKey, (0, validation_1.validate)('walletDebit'), async (req, res) => {
    try {
        const correlationId = req.headers['x-correlation-id'];
        const response = await walletService.debit({
            playerId: req.body.playerId,
            amount: req.body.amount, // DEVE essere stringa "10.00"
            currency: req.body.currency,
            idempotencyKey: req.idempotencyKey, // DA HEADER come da bibbia!
            correlationId
        });
        res.json(response);
    }
    catch (error) {
        logger_1.logger.error('Wallet debit error', error);
        const correlationId = req.headers['x-correlation-id'];
        const { status, body } = (0, rw_1.buildError)(error.code || 'RW-SYS-000', {
            message: error.message || 'Transaction failed',
            correlationId
        });
        res.status(status).json(body);
    }
});
/**
 * POST /wallet/credit
 * RGS → Casino: Accredita fondi al wallet del giocatore
 * Bibbia §4.5: stesso formato di debit
 */
router.post('/credit', rgsAuth_1.validateRGSAuth, idempotency_1.normalizeIdempotency, idempotency_1.requireIdempotencyKey, (0, validation_1.validate)('walletCredit'), async (req, res) => {
    try {
        const correlationId = req.headers['x-correlation-id'];
        const response = await walletService.credit({
            playerId: req.body.playerId,
            amount: req.body.amount, // DEVE essere stringa "10.00"
            currency: req.body.currency,
            idempotencyKey: req.idempotencyKey, // DA HEADER come da bibbia!
            correlationId
        });
        res.json(response);
    }
    catch (error) {
        logger_1.logger.error('Wallet credit error', error);
        const correlationId = req.headers['x-correlation-id'];
        const { status, body } = (0, rw_1.buildError)(error.code || 'RW-SYS-000', {
            message: error.message || 'Transaction failed',
            correlationId
        });
        res.status(status).json(body);
    }
});
/**
 * POST /wallet/cancel
 * RGS → Casino: Cancel a transaction
 * Bible: void/abort unsettled financial operation
 */
router.post('/cancel', rgsAuth_1.validateRGSAuth, idempotency_1.normalizeIdempotency, idempotency_1.requireIdempotencyKey, async (req, res) => {
    try {
        const correlationId = req.headers['x-correlation-id'];
        // Bible: amount must be string "xx.yy"
        const { playerId, transactionId, amount, reason } = req.body;
        // Normalized by middleware from header 'Idempotency-Key'
        const idempotencyKey = req.idempotencyKey;
        const result = await walletService.cancelTransaction(playerId, transactionId, amount, reason || 'RGS requested', correlationId, idempotencyKey);
        res.json(result);
    }
    catch (error) {
        logger_1.logger.error('Cancel transaction error', error);
        const correlationId = req.headers['x-correlation-id'];
        const errorCode = error.code && error.code.startsWith('RW-') ? error.code : 'RW-SYS-000';
        const { status, body } = (0, rw_1.buildError)(errorCode, {
            message: error.message,
            correlationId
        });
        res.status(status).json(body);
    }
});
exports.default = router;
//# sourceMappingURL=walletRoutes.js.map