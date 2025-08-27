"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const LimitsService_1 = require("../services/LimitsService");
const rgsAuth_1 = require("../middleware/rgsAuth");
const validation_1 = require("../middleware/validation");
const logger_1 = require("../utils/logger");
const singleFlight_1 = require("../middleware/singleFlight");
const idempotency_1 = require("../middleware/idempotency");
const router = (0, express_1.Router)();
const limitsService = new LimitsService_1.LimitsService();
/**
 * POST /limits/check
 * RGS → Casino: Verifica se il giocatore può piazzare la scommessa
 * Bibbia §4.5: { playerId, stake } → { ok:true|false, reason? }
 */
router.post('/check', [rgsAuth_1.validateRGSAuth, idempotency_1.normalizeIdempotency, (0, validation_1.validate)('limitsCheck'), singleFlight_1.singleFlightByPlayer], async (req, res) => {
    try {
        const correlationId = req.headers['x-correlation-id'];
        // Extract only required fields, ignore extras
        const response = await limitsService.checkLimits({
            playerId: req.body.playerId,
            stake: req.body.stake, // stringa "10.00"
            correlationId
        });
        // Ensure response always has ok boolean and reason when false
        const safeResponse = {
            ok: response?.ok === true,
            ...((!response?.ok || response?.reason) && {
                reason: response?.reason || 'RW-SYS-000'
            })
        };
        // Always return 200 with {ok, reason?} for business logic
        return res.status(200).json(safeResponse);
    }
    catch (error) {
        // Map all errors to deterministic response
        logger_1.logger.error('Limits check error', error);
        // Always return 200 with deterministic response on error
        return res.status(200).json({
            ok: false,
            reason: 'RW-SYS-000'
        });
    }
});
exports.default = router;
//# sourceMappingURL=limitsRoutes.js.map