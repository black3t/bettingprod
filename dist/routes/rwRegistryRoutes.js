"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const rw_1 = require("../registry/rw");
const router = (0, express_1.Router)();
/**
 * GET /admin/rw/registry
 * Endpoint read-only per verifiche del registry RW
 */
router.get('/registry', (req, res) => {
    const summary = Object.values(rw_1.REGISTRY).map(entry => ({
        code: entry.code,
        envelope: entry.envelope,
        httpDefault: entry.httpDefault,
        ux: entry.ux,
        retry: entry.retry,
        description: entry.description
    }));
    res.json({
        totalCodes: summary.length,
        uxBuckets: [
            'UX_CONN_ISSUE',
            'UX_SESSION_INVALID',
            'UX_LIMITS',
            'UX_INSUFFICIENT_FUNDS',
            'UX_SERVICE_BUSY',
            'UX_CONTENT_UNAVAILABLE'
        ],
        registry: summary
    });
});
/**
 * GET /admin/rw/registry/:code
 * Get specific code details
 */
router.get('/registry/:code', (req, res) => {
    const code = req.params.code.toUpperCase();
    const entry = rw_1.REGISTRY[code];
    if (!entry) {
        const { status, body } = (0, rw_1.buildError)('RW-SYS-000', {
            httpOverride: 404,
            message: `Code ${code} not found`,
            correlationId: req.correlationId
        });
        res.status(status).json(body);
        return;
    }
    res.json(entry);
});
exports.default = router;
//# sourceMappingURL=rwRegistryRoutes.js.map