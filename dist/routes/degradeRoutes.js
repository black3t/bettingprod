"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const healthDegrade_1 = require("../utils/healthDegrade");
const rw_1 = require("../registry/rw");
const router = (0, express_1.Router)();
// Only allow in non-production
router.post('/degrade/:component', (req, res) => {
    if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_DEGRADE_TEST) {
        const { status, body } = (0, rw_1.buildError)('RW-CAS-005', {
            message: 'Degrade simulation not allowed in production',
            correlationId: req.correlationId
        });
        return res.status(status).json(body);
    }
    const { component } = req.params;
    const { state } = req.body;
    if (component !== 'db' && component !== 'redis') {
        const { status, body } = (0, rw_1.buildError)('RW-CAS-006', {
            message: 'Invalid component',
            correlationId: req.correlationId
        });
        return res.status(status).json(body);
    }
    (0, healthDegrade_1.setDegradeState)(component, state === true);
    res.json({ success: true, component, degraded: state === true });
});
router.post('/reset', (req, res) => {
    if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_DEGRADE_TEST) {
        const { status, body } = (0, rw_1.buildError)('RW-CAS-005', {
            message: 'Degrade simulation not allowed in production',
            correlationId: req.correlationId
        });
        return res.status(status).json(body);
    }
    (0, healthDegrade_1.resetDegradeState)();
    res.json({ success: true, message: 'Degrade state reset' });
});
exports.default = router;
//# sourceMappingURL=degradeRoutes.js.map