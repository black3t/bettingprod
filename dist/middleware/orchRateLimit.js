"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.orchRateLimit = orchRateLimit;
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = require("../utils/logger");
const rw_1 = require("../registry/rw");
const buckets = new Map();
function keyFrom(req) {
    // Prefer playerId from body; else route+ip. Do not log raw value.
    const pid = (req.body && (req.body.playerId || req.body.playerID));
    const basis = pid || `${req.ip}|${req.originalUrl}`;
    return crypto_1.default.createHash('sha256').update(basis).digest('hex');
}
function orchRateLimit(opts) {
    const limit = Number(process.env.ORCH_RATE_LIMIT ?? opts?.limit ?? 5);
    const windowMs = Number(process.env.ORCH_RATE_WINDOW_MS ?? opts?.windowMs ?? 10000);
    const allowlist = opts?.allowlist ?? [/^\/orch\/api\/v1\/health$/, /^\/orch\/api\/v1\/metrics$/];
    return (req, res, next) => {
        if (process.env.NODE_ENV === 'production')
            return next(); // OFF in prod
        if (allowlist.some(r => r.test(req.originalUrl)))
            return next();
        const now = Date.now();
        const k = keyFrom(req);
        const b = buckets.get(k) ?? { hits: [] };
        // prune outside window
        b.hits = b.hits.filter(ts => ts > (now - windowMs));
        if (b.hits.length >= limit) {
            const resetMs = (b.hits[0] + windowMs) - now;
            const resetSec = Math.max(1, Math.ceil(resetMs / 1000));
            res.setHeader('Retry-After', String(resetSec));
            res.setHeader('X-RateLimit-Limit', String(limit));
            res.setHeader('X-RateLimit-Remaining', '0');
            res.setHeader('X-RateLimit-Reset', String(Math.ceil((now + resetMs) / 1000)));
            logger_1.logger.info('orch.rate.limit.hit', { action: 'orch.rate.limit.hit', hashedKey: k, route: req.originalUrl, method: req.method, limit, windowMs });
            const { status, body } = (0, rw_1.buildError)('RW-SYS-000', {
                message: 'Too Many Requests',
                correlationId: req.correlationId,
                httpOverride: 429
            });
            return res.status(status).json(body);
        }
        // allow & record
        b.hits.push(now);
        buckets.set(k, b);
        res.setHeader('X-RateLimit-Limit', String(limit));
        res.setHeader('X-RateLimit-Remaining', String(Math.max(0, limit - b.hits.length)));
        res.setHeader('X-RateLimit-Reset', String(Math.ceil((now + windowMs) / 1000)));
        next();
    };
}
//# sourceMappingURL=orchRateLimit.js.map