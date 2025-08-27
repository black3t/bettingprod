"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireIdempotencyKey = exports.normalizeIdempotency = void 0;
const crypto_1 = require("crypto");
const rw_1 = require("../registry/rw");
/**
 * Middleware di normalizzazione idempotency
 * Se manca header Idempotency-Key ma c'è body.idempotencyKey,
 * normalizza spostando il valore nell'header e rimuovendolo dal body
 * per mantenere gli schemi stretti (Bibbia §144: header obbligatorio)
 */
const normalizeIdempotency = (req, res, next) => {
    // Header standard
    const headerKey = (req.headers['idempotency-key'] || '').trim();
    // Se manca header ma c'è nel body, normalizza (compatibilità)
    if (!headerKey && req.body && req.body.idempotencyKey) {
        req.headers['idempotency-key'] = req.body.idempotencyKey;
        delete req.body.idempotencyKey;
    }
    const finalHeaderKey = (req.headers['idempotency-key'] || '').trim();
    req.idempotencyHeader = finalHeaderKey; // mai loggare questo valore
    // Body hash deterministico (idempotency vale su body identico)
    const bodyStr = JSON.stringify(req.body ?? {});
    const bodyHash = (0, crypto_1.createHash)('sha256').update(bodyStr).digest('hex');
    // Path/method stabili
    const method = (req.method || 'GET').toUpperCase();
    const path = `${req.baseUrl || ''}${req.route?.path || req.path || ''}`;
    // PlayerId (se presente)
    const playerId = (req.body && req.body.playerId) ||
        (req.query && req.query.playerId) ||
        'na';
    // Fingerprint composita anti-collisione tra endpoint
    const composite = `H:${method}|P:${path}|PID:${playerId}|BH:${bodyHash}|K:${finalHeaderKey}`;
    req.idempotencyKey = composite;
    next();
};
exports.normalizeIdempotency = normalizeIdempotency;
/**
 * Middleware che richiede header Idempotency-Key obbligatorio
 * Bibbia §144: Idempotency obbligatoria via header
 */
const requireIdempotencyKey = (req, res, next) => {
    const idempotencyKey = req.headers['idempotency-key'];
    if (!idempotencyKey || idempotencyKey === '') {
        const correlationId = req.headers['x-correlation-id'];
        const { status, body } = (0, rw_1.buildError)('RW-CAS-010', {
            message: 'Idempotency-Key header required',
            correlationId
        });
        res.status(status).json(body);
        return;
    }
    req.idempotencyHeader = idempotencyKey; // keep composite from normalizeIdempotency
    next();
};
exports.requireIdempotencyKey = requireIdempotencyKey;
//# sourceMappingURL=idempotency.js.map