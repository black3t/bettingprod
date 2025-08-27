"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const uuid_1 = require("uuid");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const OrchestratorService_1 = require("../orchestrator/OrchestratorService");
const healthRoutes_1 = require("./healthRoutes");
const rw_1 = require("../registry/rw");
const logger_1 = require("../utils/logger");
const IdempotencyStore_1 = require("../services/IdempotencyStore");
const orchMetrics_1 = require("../metrics/orchMetrics");
const router = (0, express_1.Router)();
// Middleware timing (dev-only)
if (process.env.NODE_ENV !== 'production') {
    router.use((req, res, next) => {
        const end = orchMetrics_1.hHttp.startTimer({ route: req.path, method: req.method });
        res.on('finish', () => end({ status: String(res.statusCode) }));
        next();
    });
}
// Health endpoint - reuse existing healthHandler
router.get('/health', healthRoutes_1.healthHandler);
// Method discipline: POST /health → 405 (Allow: GET) per Bibbia
router.post('/health', (req, res) => {
    const t0 = Date.now();
    res.setHeader('Allow', 'GET');
    logger_1.logger.info('orch.health.method_discipline', {
        action: 'orch.health.method_discipline',
        route: req.originalUrl,
        result: 405,
        code: 'RW-SYS-000',
        correlationId: req.correlationId,
        ms: Date.now() - t0
    });
    const { status, body } = (0, rw_1.buildError)('RW-SYS-000', {
        message: 'Method Not Allowed',
        correlationId: req.correlationId,
        httpOverride: 405
    });
    return res.status(status).json(body);
});
// Probe endpoint - only in dev/test
router.post('/probe/round', async (req, res) => {
    // Protection: only allow in non-production
    if (process.env.NODE_ENV === 'production') {
        const { status, body } = (0, rw_1.buildError)('RW-CAS-005', {
            message: 'Probe endpoint not available in production',
            correlationId: req.correlationId
        });
        return res.status(status).json(body);
    }
    const correlationId = req.correlationId || (0, uuid_1.v4)();
    const idempotencyKey = req.headers['idempotency-key'];
    try {
        // Generate test IDs
        const playerId = req.body.playerId || 'test-player-' + Date.now();
        const gameId = req.body.gameId || 'test-game';
        const roundId = 'round-' + (0, uuid_1.v4)();
        const debitTxId = 'tx-debit-' + (0, uuid_1.v4)();
        const creditTxId = 'tx-credit-' + (0, uuid_1.v4)();
        const results = {
            correlationId,
            playerId,
            gameId,
            roundId,
            sequence: []
        };
        // 1. Start Round
        logger_1.logger.info('Probe: Starting round', { roundId, playerId, gameId });
        const startResult = await OrchestratorService_1.orchestratorService.startRound({
            playerId,
            gameId,
            roundId,
            correlationId,
            idempotencyKey: idempotencyKey ? `${idempotencyKey}-start` : undefined
        });
        results.sequence.push({
            step: 'startRound',
            status: startResult.status || 'completed',
            data: startResult
        });
        // 2. Debit
        logger_1.logger.info('Probe: Processing debit', { roundId, playerId });
        const debitResult = await OrchestratorService_1.orchestratorService.debit({
            playerId,
            amount: '10.00',
            roundId,
            transactionId: debitTxId,
            correlationId,
            idempotencyKey: idempotencyKey ? `${idempotencyKey}-debit` : undefined
        });
        results.sequence.push({
            step: 'debit',
            status: debitResult.status || 'completed',
            data: debitResult
        });
        // 3. Credit
        logger_1.logger.info('Probe: Processing credit', { roundId, playerId });
        const creditResult = await OrchestratorService_1.orchestratorService.credit({
            playerId,
            amount: '20.00',
            roundId,
            transactionId: creditTxId,
            correlationId,
            idempotencyKey: idempotencyKey ? `${idempotencyKey}-credit` : undefined
        });
        results.sequence.push({
            step: 'credit',
            status: creditResult.status || 'completed',
            data: creditResult
        });
        // 4. End Round
        logger_1.logger.info('Probe: Ending round', { roundId, playerId });
        const endResult = await OrchestratorService_1.orchestratorService.endRound({
            roundId,
            playerId,
            correlationId,
            idempotencyKey: idempotencyKey ? `${idempotencyKey}-end` : undefined
        });
        results.sequence.push({
            step: 'endRound',
            status: endResult.status || 'completed',
            data: endResult
        });
        // Return success
        res.status(200).json({
            success: true,
            message: 'Probe sequence completed',
            results
        });
    }
    catch (error) {
        logger_1.logger.error('Probe failed', { error, correlationId });
        // If error is already formatted from buildError
        if (error.status && error.body) {
            return res.status(error.status).json(error.body);
        }
        // Otherwise, map to generic error
        const { status, body } = (0, rw_1.buildError)('RW-SYS-000', {
            message: 'Probe sequence failed',
            correlationId,
            extra: {
                step: error.step || 'unknown',
                detail: error.message
            }
        });
        res.status(status).json(body);
    }
});
// GET probe info - shows available in dev/test only
router.get('/probe', (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        const { status, body } = (0, rw_1.buildError)('RW-CAS-005', {
            message: 'Probe endpoint not available in production',
            correlationId: req.correlationId
        });
        return res.status(status).json(body);
    }
    res.status(200).json({
        success: true,
        message: 'Orchestrator probe endpoint',
        endpoints: {
            'POST /probe/round': 'Execute full round sequence (start → debit → credit → end)'
        },
        note: 'Only available in development/test environments'
    });
});
// === Rooms (DEV-ONLY) ===
router.post('/rooms/allocate', (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        const { status, body } = (0, rw_1.buildError)('RW-CAS-005', { message: 'Not allowed in production', correlationId: req.correlationId, httpOverride: 404 });
        return res.status(status).json(body);
    }
    const { gameId, playerId } = req.body || {};
    if (!gameId || !playerId) {
        const { status, body } = (0, rw_1.buildError)('RW-CAS-006', { message: 'Invalid request', correlationId: req.correlationId, httpOverride: 422 });
        return res.status(status).json(body);
    }
    const t0 = Date.now();
    const room = OrchestratorService_1.orchestratorService.rooms.allocate(String(gameId), String(playerId));
    orchMetrics_1.gRoomsActive.set(OrchestratorService_1.orchestratorService.rooms.state().length);
    logger_1.logger.info('orch.rooms.allocate', { action: 'orch.rooms.allocate', route: req.originalUrl, result: 200, correlationId: req.correlationId, ms: Date.now() - t0 });
    return res.status(200).json({ ok: true, roomId: room.id, gameId: room.gameId, players: room.players.size });
});
router.get('/rooms/state', (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        const { status, body } = (0, rw_1.buildError)('RW-CAS-005', { message: 'Not allowed in production', correlationId: req.correlationId, httpOverride: 404 });
        return res.status(status).json(body);
    }
    const t0 = Date.now();
    const state = OrchestratorService_1.orchestratorService.rooms.state();
    logger_1.logger.info('orch.rooms.state', { action: 'orch.rooms.state', route: req.originalUrl, result: 200, correlationId: req.correlationId, ms: Date.now() - t0 });
    return res.status(200).json({ ok: true, rooms: state });
});
// === Rooms control (DEV-ONLY) ===
function blockProd(req, res) {
    const { status, body } = (0, rw_1.buildError)('RW-CAS-005', { message: 'Not allowed in production', correlationId: req.correlationId, httpOverride: 404 });
    return res.status(status).json(body);
}
// Method discipline (GET → 405) for mutating routes
router.get('/rooms/join', (req, res) => {
    res.setHeader('Allow', 'POST');
    const { status, body } = (0, rw_1.buildError)('RW-SYS-000', { message: 'Method Not Allowed', correlationId: req.correlationId, httpOverride: 405 });
    return res.status(status).json(body);
});
router.get('/rooms/leave', (req, res) => {
    res.setHeader('Allow', 'POST');
    const { status, body } = (0, rw_1.buildError)('RW-SYS-000', { message: 'Method Not Allowed', correlationId: req.correlationId, httpOverride: 405 });
    return res.status(status).json(body);
});
router.get('/rooms/close', (req, res) => {
    res.setHeader('Allow', 'POST');
    const { status, body } = (0, rw_1.buildError)('RW-SYS-000', { message: 'Method Not Allowed', correlationId: req.correlationId, httpOverride: 405 });
    return res.status(status).json(body);
});
router.post('/rooms/join', (req, res) => {
    if (process.env.NODE_ENV === 'production')
        return blockProd(req, res);
    const { roomId, playerId } = req.body || {};
    if (!roomId || !playerId || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(playerId)) {
        const { status, body } = (0, rw_1.buildError)('RW-CAS-006', { message: 'Invalid request', correlationId: req.correlationId, httpOverride: 422 });
        return res.status(status).json(body);
    }
    const t0 = Date.now();
    const room = OrchestratorService_1.orchestratorService.rooms.join(String(roomId), String(playerId));
    if (!room) {
        const { status, body } = (0, rw_1.buildError)('RW-CAS-006', { message: 'Invalid request', correlationId: req.correlationId, httpOverride: 422 });
        return res.status(status).json(body);
    }
    logger_1.logger.info('orch.rooms.join', { action: 'orch.rooms.join', route: req.originalUrl, result: 200, correlationId: req.correlationId, ms: Date.now() - t0 });
    return res.status(200).json({ ok: true, roomId: room.id, gameId: room.gameId, players: room.players.size });
});
router.post('/rooms/leave', (req, res) => {
    if (process.env.NODE_ENV === 'production')
        return blockProd(req, res);
    const { roomId, playerId } = req.body || {};
    if (!roomId || !playerId || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(playerId)) {
        const { status, body } = (0, rw_1.buildError)('RW-CAS-006', { message: 'Invalid request', correlationId: req.correlationId, httpOverride: 422 });
        return res.status(status).json(body);
    }
    const t0 = Date.now();
    const { room, removed } = OrchestratorService_1.orchestratorService.rooms.leave(String(roomId), String(playerId));
    logger_1.logger.info('orch.rooms.leave', { action: 'orch.rooms.leave', route: req.originalUrl, result: 200, correlationId: req.correlationId, ms: Date.now() - t0 });
    return res.status(200).json({ ok: true, roomId, removed, players: room ? room.players.size : 0 });
});
router.post('/rooms/close', (req, res) => {
    if (process.env.NODE_ENV === 'production')
        return blockProd(req, res);
    const { roomId } = req.body || {};
    if (!roomId) {
        const { status, body } = (0, rw_1.buildError)('RW-CAS-006', { message: 'Invalid request', correlationId: req.correlationId, httpOverride: 422 });
        return res.status(status).json(body);
    }
    const t0 = Date.now();
    const closed = OrchestratorService_1.orchestratorService.rooms.close(String(roomId));
    orchMetrics_1.gRoomsActive.set(OrchestratorService_1.orchestratorService.rooms.state().length);
    logger_1.logger.info('orch.rooms.close', { action: 'orch.rooms.close', route: req.originalUrl, result: 200, correlationId: req.correlationId, ms: Date.now() - t0 });
    return res.status(200).json({ ok: closed, roomId });
});
// === Match shim (DEV-ONLY) ===
function isUuidV4(v) { return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v); }
// GET → 405 (disciplina)
router.get('/match/create', (req, res) => {
    res.setHeader('Allow', 'POST');
    const { status, body } = (0, rw_1.buildError)('RW-SYS-000', { message: 'Method Not Allowed', correlationId: req.correlationId, httpOverride: 405 });
    return res.status(status).json(body);
});
router.get('/match/join', (req, res) => {
    res.setHeader('Allow', 'POST');
    const { status, body } = (0, rw_1.buildError)('RW-SYS-000', { message: 'Method Not Allowed', correlationId: req.correlationId, httpOverride: 405 });
    return res.status(status).json(body);
});
router.get('/match/start', (req, res) => {
    res.setHeader('Allow', 'POST');
    const { status, body } = (0, rw_1.buildError)('RW-SYS-000', { message: 'Method Not Allowed', correlationId: req.correlationId, httpOverride: 405 });
    return res.status(status).json(body);
});
// POST /match/create
router.post('/match/create', async (req, res) => {
    const ik = req.header('Idempotency-Key');
    const endpoint = `${req.method} ${req.originalUrl}`;
    if (ik) {
        const hit = await (0, IdempotencyStore_1.get)(ik, endpoint);
        if (hit) {
            Object.entries(hit.headers || {}).forEach(([k, v]) => res.setHeader(k, String(v)));
            logger_1.logger.info('orch.idem.hit', { action: 'orch.idem.hit', route: req.originalUrl });
            orchMetrics_1.mIdemHit.inc({ endpoint: req.originalUrl });
            return res.status(hit.status).json(hit.body);
        }
        else {
            orchMetrics_1.mIdemMiss.inc({ endpoint: req.originalUrl });
        }
    }
    if (process.env.NODE_ENV === 'production')
        return blockProd(req, res);
    if (!ik) {
        const { status, body } = (0, rw_1.buildError)('RW-CAS-006', { message: 'Invalid request', correlationId: req.correlationId, httpOverride: 422 });
        if (ik) {
            await (0, IdempotencyStore_1.put)(ik, endpoint, status, body, { 'Content-Type': 'application/json' });
        }
        return res.status(status).json(body);
    }
    const { matchId, gameId, playerId, ts } = req.body || {};
    if (!isUuidV4(matchId) || !isUuidV4(playerId) || !gameId || !ts) {
        const { status, body } = (0, rw_1.buildError)('RW-CAS-006', { message: 'Invalid request', correlationId: req.correlationId, httpOverride: 422 });
        if (ik) {
            await (0, IdempotencyStore_1.put)(ik, endpoint, status, body, { 'Content-Type': 'application/json' });
        }
        return res.status(status).json(body);
    }
    OrchestratorService_1.orchestratorService.emit('events.orch.match.created', { matchId, gameId, playerId, ts, modelVersion: '1' });
    const body = { accepted: true, matchId, gameId };
    logger_1.logger.info('orch.match.create.accepted', { action: 'orch.match.create.accepted', route: req.originalUrl, result: 202, correlationId: req.correlationId, ms: 0 });
    if (ik) {
        await (0, IdempotencyStore_1.put)(ik, endpoint, 202, body, { 'Content-Type': 'application/json' });
        logger_1.logger.info('orch.idem.store', { action: 'orch.idem.store', route: req.originalUrl, status: 202 });
    }
    return res.status(202).json(body);
});
// POST /match/join
router.post('/match/join', async (req, res) => {
    const ik = req.header('Idempotency-Key');
    const endpoint = `${req.method} ${req.originalUrl}`;
    if (ik) {
        const hit = await (0, IdempotencyStore_1.get)(ik, endpoint);
        if (hit) {
            Object.entries(hit.headers || {}).forEach(([k, v]) => res.setHeader(k, String(v)));
            logger_1.logger.info('orch.idem.hit', { action: 'orch.idem.hit', route: req.originalUrl });
            orchMetrics_1.mIdemHit.inc({ endpoint: req.originalUrl });
            return res.status(hit.status).json(hit.body);
        }
        else {
            orchMetrics_1.mIdemMiss.inc({ endpoint: req.originalUrl });
        }
    }
    if (process.env.NODE_ENV === 'production')
        return blockProd(req, res);
    if (!ik) {
        const { status, body } = (0, rw_1.buildError)('RW-CAS-006', { message: 'Invalid request', correlationId: req.correlationId, httpOverride: 422 });
        if (ik) {
            await (0, IdempotencyStore_1.put)(ik, endpoint, status, body, { 'Content-Type': 'application/json' });
        }
        return res.status(status).json(body);
    }
    const { matchId, playerId, ts } = req.body || {};
    if (!isUuidV4(matchId) || !isUuidV4(playerId) || !ts) {
        const { status, body } = (0, rw_1.buildError)('RW-CAS-006', { message: 'Invalid request', correlationId: req.correlationId, httpOverride: 422 });
        if (ik) {
            await (0, IdempotencyStore_1.put)(ik, endpoint, status, body, { 'Content-Type': 'application/json' });
        }
        return res.status(status).json(body);
    }
    OrchestratorService_1.orchestratorService.emit('events.orch.match.joined', { matchId, playerId, ts, modelVersion: '1' });
    const body = { accepted: true, matchId, joined: true };
    logger_1.logger.info('orch.match.join.accepted', { action: 'orch.match.join.accepted', route: req.originalUrl, result: 202, correlationId: req.correlationId, ms: 0 });
    if (ik) {
        await (0, IdempotencyStore_1.put)(ik, endpoint, 202, body, { 'Content-Type': 'application/json' });
        logger_1.logger.info('orch.idem.store', { action: 'orch.idem.store', route: req.originalUrl, status: 202 });
    }
    return res.status(202).json(body);
});
// POST /match/start
router.post('/match/start', async (req, res) => {
    const ik = req.header('Idempotency-Key');
    const endpoint = `${req.method} ${req.originalUrl}`;
    if (ik) {
        const hit = await (0, IdempotencyStore_1.get)(ik, endpoint);
        if (hit) {
            Object.entries(hit.headers || {}).forEach(([k, v]) => res.setHeader(k, String(v)));
            logger_1.logger.info('orch.idem.hit', { action: 'orch.idem.hit', route: req.originalUrl });
            orchMetrics_1.mIdemHit.inc({ endpoint: req.originalUrl });
            return res.status(hit.status).json(hit.body);
        }
        else {
            orchMetrics_1.mIdemMiss.inc({ endpoint: req.originalUrl });
        }
    }
    if (process.env.NODE_ENV === 'production')
        return blockProd(req, res);
    if (!ik) {
        const { status, body } = (0, rw_1.buildError)('RW-CAS-006', { message: 'Invalid request', correlationId: req.correlationId, httpOverride: 422 });
        if (ik) {
            await (0, IdempotencyStore_1.put)(ik, endpoint, status, body, { 'Content-Type': 'application/json' });
        }
        return res.status(status).json(body);
    }
    const { matchId, ts } = req.body || {};
    if (!isUuidV4(matchId) || !ts) {
        const { status, body } = (0, rw_1.buildError)('RW-CAS-006', { message: 'Invalid request', correlationId: req.correlationId, httpOverride: 422 });
        if (ik) {
            await (0, IdempotencyStore_1.put)(ik, endpoint, status, body, { 'Content-Type': 'application/json' });
        }
        return res.status(status).json(body);
    }
    OrchestratorService_1.orchestratorService.emit('events.orch.match.started', { matchId, ts, modelVersion: '1' });
    const body = { accepted: true, matchId, started: true };
    logger_1.logger.info('orch.match.start.accepted', { action: 'orch.match.start.accepted', route: req.originalUrl, result: 202, correlationId: req.correlationId, ms: 0 });
    if (ik) {
        await (0, IdempotencyStore_1.put)(ik, endpoint, 202, body, { 'Content-Type': 'application/json' });
        logger_1.logger.info('orch.idem.store', { action: 'orch.idem.store', route: req.originalUrl, status: 202 });
    }
    return res.status(202).json(body);
});
// === Metrics endpoint (DEV-ONLY) ===
router.get('/metrics', async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        const { status, body } = (0, rw_1.buildError)('RW-CAS-005', {
            message: 'Not Found',
            correlationId: req.correlationId,
            httpOverride: 404
        });
        return res.status(status).json(body);
    }
    res.setHeader('Content-Type', 'text/plain; version=0.0.4');
    const metrics = await (0, orchMetrics_1.renderMetrics)();
    res.send(metrics);
});
router.post('/metrics', (req, res) => {
    res.setHeader('Allow', 'GET');
    const { status, body } = (0, rw_1.buildError)('RW-SYS-000', {
        message: 'Method Not Allowed',
        correlationId: req.correlationId,
        httpOverride: 405
    });
    return res.status(status).json(body);
});
// Dev-only limits info
router.get('/limits', (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        const { status, body } = (0, rw_1.buildError)('RW-CAS-005', {
            message: 'Not allowed in production',
            correlationId: req.correlationId,
            httpOverride: 404
        });
        return res.status(status).json(body);
    }
    const limit = Number(process.env.ORCH_RATE_LIMIT ?? 5);
    const windowMs = Number(process.env.ORCH_RATE_WINDOW_MS ?? 10000);
    return res.status(200).json({ ok: true, limit, windowMs, env: 'dev' });
});
// Method discipline
router.post('/limits', (req, res) => {
    res.setHeader('Allow', 'GET');
    const { status, body } = (0, rw_1.buildError)('RW-SYS-000', {
        message: 'Method Not Allowed',
        correlationId: req.correlationId,
        httpOverride: 405
    });
    return res.status(status).json(body);
});
// --- Orchestrator OpenAPI (DEV ONLY) ---
router.get('/openapi.json', (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        const { status, body } = (0, rw_1.buildError)('RW-CAS-005', { message: 'Not allowed in production', correlationId: req.correlationId, httpOverride: 404 });
        return res.status(status).json(body);
    }
    const p = path_1.default.join(__dirname, '..', 'orchestrator', 'openapi.orch.dev.json');
    try {
        const json = JSON.parse(fs_1.default.readFileSync(p, 'utf-8'));
        logger_1.logger.info('orch.openapi.served', { action: 'orch.openapi.served', route: req.originalUrl, result: 200, correlationId: req.correlationId });
        return res.status(200).json(json);
    }
    catch (e) {
        const { status, body } = (0, rw_1.buildError)('RW-SYS-000', { message: 'OpenAPI not available', correlationId: req.correlationId, httpOverride: 500 });
        return res.status(status).json(body);
    }
});
router.post('/openapi.json', (req, res) => {
    res.setHeader('Allow', 'GET');
    const { status, body } = (0, rw_1.buildError)('RW-SYS-000', { message: 'Method Not Allowed', correlationId: req.correlationId, httpOverride: 405 });
    return res.status(status).json(body);
});
exports.default = router;
//# sourceMappingURL=orchestratorRoutes.js.map