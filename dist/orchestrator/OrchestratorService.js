"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.orchestratorService = exports.OrchestratorService = exports.RoomManager = void 0;
const axios_1 = __importDefault(require("axios"));
const uuid_1 = require("uuid");
const logger_1 = require("../utils/logger");
const rw_1 = require("../registry/rw");
const InMemoryBus_1 = require("./bus/InMemoryBus");
const events_1 = require("./schemas/events");
const orchMetrics_1 = require("../metrics/orchMetrics");
class RoomManager {
    maxPlayersPerRoom;
    rooms = new Map();
    constructor(maxPlayersPerRoom = 50) {
        this.maxPlayersPerRoom = maxPlayersPerRoom;
    }
    allocate(gameId, playerId) {
        // simple reuse policy: first room with space, else new
        for (const r of this.rooms.values()) {
            if (r.gameId === gameId && r.players.size < this.maxPlayersPerRoom) {
                r.players.add(playerId);
                return r;
            }
        }
        const id = 'room_' + Math.random().toString(36).slice(2, 10);
        const room = { id, gameId, players: new Set([playerId]), createdAt: new Date().toISOString() };
        this.rooms.set(id, room);
        return room;
    }
    get(roomId) { return this.rooms.get(roomId) || null; }
    state() { return [...this.rooms.values()].map(r => ({ id: r.id, gameId: r.gameId, players: [...r.players], createdAt: r.createdAt })); }
    join(roomId, playerId) {
        const r = this.rooms.get(roomId);
        if (!r)
            return null;
        r.players.add(playerId);
        return r;
    }
    leave(roomId, playerId) {
        const r = this.rooms.get(roomId);
        if (!r)
            return { room: null, removed: false };
        const removed = r.players.delete(playerId);
        if (r.players.size === 0)
            this.rooms.delete(roomId);
        return { room: r, removed };
    }
    close(roomId) {
        return this.rooms.delete(roomId);
    }
}
exports.RoomManager = RoomManager;
class OrchestratorService {
    idempotencyCache = {};
    circuitBreaker = {
        failures: 0,
        isOpen: false
    };
    bus;
    emit(topic, payload) {
        const event = {
            eventId: (0, uuid_1.v4)(),
            type: topic.replace('events.orch.', ''),
            correlationId: payload.correlationId || (0, uuid_1.v4)(),
            timestamp: new Date().toISOString(),
            occurredAt: new Date().toISOString(),
            payload,
            modelVersion: payload.modelVersion || '1'
        };
        this.bus.publish(event);
    }
    rgsBaseUrl;
    maxRetries;
    rooms = new RoomManager(50);
    backoffMs;
    idempotencyTtlMs;
    circuitBreakerOpenDurationMs = 30000; // 30s
    circuitBreakerThreshold = 3;
    constructor() {
        this.bus = new InMemoryBus_1.InMemoryBus();
        this.rgsBaseUrl = process.env.RGS_BASE_URL || 'http://localhost:3001/rgs/api/v1';
        this.maxRetries = parseInt(process.env.ORCH_MAX_RETRIES || '3');
        this.backoffMs = (process.env.ORCH_BACKOFF_MS || '1000,2000,4000').split(',').map(ms => parseInt(ms));
        this.idempotencyTtlMs = parseInt(process.env.ORCH_IDEMPOTENCY_TTL_H || '48') * 60 * 60 * 1000;
        // Cleanup expired cache entries every hour
        setInterval(() => this.cleanupCache(), 60 * 60 * 1000);
    }
    cleanupCache() {
        const now = Date.now();
        Object.keys(this.idempotencyCache).forEach(key => {
            if (now - this.idempotencyCache[key].timestamp > this.idempotencyTtlMs) {
                delete this.idempotencyCache[key];
            }
        });
    }
    getCacheKey(method, idempotencyKey) {
        if (!idempotencyKey)
            return null;
        return `${method}:${idempotencyKey}`;
    }
    checkIdempotency(method, idempotencyKey) {
        if (!idempotencyKey)
            return null;
        const key = this.getCacheKey(method, idempotencyKey);
        if (!key)
            return null;
        const cached = this.idempotencyCache[key];
        if (cached && Date.now() - cached.timestamp <= this.idempotencyTtlMs) {
            logger_1.logger.info(`Idempotency hit for ${method}`, { idempotencyKey });
            return cached.response;
        }
        return null;
    }
    storeIdempotentResponse(method, idempotencyKey, response) {
        if (!idempotencyKey)
            return;
        const key = this.getCacheKey(method, idempotencyKey);
        if (!key)
            return;
        this.idempotencyCache[key] = {
            response,
            timestamp: Date.now()
        };
    }
    checkCircuitBreaker() {
        if (this.circuitBreaker.isOpen) {
            const now = Date.now();
            if (this.circuitBreaker.openedAt && now - this.circuitBreaker.openedAt > this.circuitBreakerOpenDurationMs) {
                // Half-open state - allow one request through
                this.circuitBreaker.isOpen = false;
                this.circuitBreaker.failures = 0;
                logger_1.logger.info('Circuit breaker transitioning to half-open');
                return true;
            }
            return false;
        }
        return true;
    }
    recordSuccess() {
        this.circuitBreaker.failures = 0;
        this.circuitBreaker.isOpen = false;
    }
    recordFailure() {
        this.circuitBreaker.failures++;
        this.circuitBreaker.lastFailureAt = Date.now();
        if (this.circuitBreaker.failures >= this.circuitBreakerThreshold) {
            this.circuitBreaker.isOpen = true;
            this.circuitBreaker.openedAt = Date.now();
            logger_1.logger.info('orch.cb.open', {
                action: 'orch.cb.open',
                failures: this.circuitBreaker.failures,
                openMs: this.circuitBreakerOpenDurationMs
            });
            orchMetrics_1.mCbOpen.inc();
        }
    }
    async callRgsWithRetry(method, endpoint, data, correlationId, idempotencyKey) {
        // Check circuit breaker
        if (!this.checkCircuitBreaker()) {
            logger_1.logger.info('orch.cb.block', {
                action: 'orch.cb.block',
                failures: this.circuitBreaker.failures,
                correlationId
            });
            orchMetrics_1.mCbBlock.inc();
            const error = (0, rw_1.buildError)('RW-RGS-008', {
                message: 'Service temporarily unavailable (circuit breaker open)',
                correlationId
            });
            throw error;
        }
        let lastError;
        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
                const auth = `Bearer ${process.env.RGS_API_KEY || 'test_rgs_key'}`;
                const cid = correlationId || '';
                const ik = idempotencyKey || '';
                const headers = {
                    'Authorization': auth,
                    'Content-Type': 'application/json',
                    'X-Correlation-Id': cid,
                    'X-API-Key': process.env.RGS_API_KEY || 'test_rgs_key'
                };
                if (ik) {
                    headers['Idempotency-Key'] = ik;
                }
                // Sanitary log (no secrets/PII values)
                logger_1.logger.info('orch.outbound.headers', {
                    action: 'orch.outbound.headers',
                    to: endpoint,
                    hasAuth: true,
                    hasCorrelationId: Boolean(cid),
                    hasIdempotencyKey: Boolean(ik)
                });
                const response = await axios_1.default.post(`${this.rgsBaseUrl}${endpoint}`, data, {
                    headers,
                    timeout: 2000,
                    validateStatus: () => true // Accept any status code
                });
                // Check for protocol errors (4xx/5xx)
                if (response.status >= 400) {
                    // Map to appropriate RW error
                    if (response.status === 504 || response.status === 408) {
                        lastError = (0, rw_1.buildError)('RW-RGS-008', {
                            message: 'RGS timeout',
                            correlationId
                        });
                    }
                    else if (response.status === 401 || response.status === 403) {
                        lastError = (0, rw_1.buildError)('RW-RGS-003', {
                            message: 'Unauthorized',
                            correlationId
                        });
                    }
                    else {
                        lastError = (0, rw_1.buildError)('RW-SYS-000', {
                            message: 'RGS error',
                            correlationId,
                            httpOverride: response.status
                        });
                    }
                    if (attempt < this.maxRetries) {
                        const backoff = this.backoffMs[Math.min(attempt, this.backoffMs.length - 1)];
                        logger_1.logger.info('orch.retry', {
                            action: 'orch.retry',
                            attempt: attempt + 1,
                            backoffMs: backoff,
                            endpoint
                        });
                        orchMetrics_1.mRetry.inc({ endpoint });
                        logger_1.logger.warn(`RGS call failed, retrying in ${backoff}ms`, { attempt, endpoint });
                        await new Promise(resolve => setTimeout(resolve, backoff));
                        continue;
                    }
                    throw lastError;
                }
                // Success - record it
                this.recordSuccess();
                // Check for business errors (status: "REJECTED")
                if (response.data.status === 'REJECTED') {
                    // Map business rejections
                    const reason = response.data.reason;
                    if (reason === 'INSUFFICIENT_FUNDS' || reason === 'RW-RGS-002') {
                        return {
                            ...response.data,
                            reason: 'RW-RGS-002'
                        };
                    }
                    else if (reason === 'LIMITS_EXCEEDED') {
                        return {
                            ...response.data,
                            reason: 'RW-RGS-002'
                        };
                    }
                }
                return response.data;
            }
            catch (error) {
                if (axios_1.default.isAxiosError(error)) {
                    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
                        lastError = (0, rw_1.buildError)('RW-RGS-008', {
                            message: 'RGS timeout',
                            correlationId
                        });
                    }
                    else if (error.code === 'ECONNREFUSED') {
                        lastError = (0, rw_1.buildError)('RW-RGS-008', {
                            message: 'RGS unavailable',
                            correlationId
                        });
                    }
                    else {
                        lastError = error;
                    }
                }
                else {
                    lastError = error;
                }
                if (attempt < this.maxRetries) {
                    const backoff = this.backoffMs[Math.min(attempt, this.backoffMs.length - 1)];
                    logger_1.logger.info('orch.retry', {
                        action: 'orch.retry',
                        attempt: attempt + 1,
                        backoffMs: backoff,
                        endpoint
                    });
                    orchMetrics_1.mRetry.inc({ endpoint });
                    logger_1.logger.warn(`RGS call failed, retrying in ${backoff}ms`, { attempt, endpoint, error: lastError.message });
                    await new Promise(resolve => setTimeout(resolve, backoff));
                }
            }
        }
        // All retries exhausted
        this.recordFailure();
        throw lastError;
    }
    async startRound(params) {
        const correlationId = params.correlationId || (0, uuid_1.v4)();
        // Check idempotency
        const cached = this.checkIdempotency('startRound', params.idempotencyKey);
        if (cached)
            return cached;
        try {
            const response = await this.callRgsWithRetry('startRound', '/round/start', {
                playerId: params.playerId,
                gameId: params.gameId,
                roundId: params.roundId
            }, correlationId, params.idempotencyKey);
            // Store for idempotency
            this.storeIdempotentResponse('startRound', params.idempotencyKey, response);
            // Publish event
            await this.bus.publish({
                eventId: (0, uuid_1.v4)(),
                type: events_1.EventType.ROUND_STARTED,
                occurredAt: new Date().toISOString(),
                correlationId,
                modelVersion: '1.0.0',
                payload: {
                    playerId: params.playerId,
                    gameId: params.gameId,
                    roundId: params.roundId,
                    status: response.status
                }
            });
            return response;
        }
        catch (error) {
            logger_1.logger.error('Failed to start round', { error, params });
            throw error;
        }
    }
    async debit(params) {
        const correlationId = params.correlationId || (0, uuid_1.v4)();
        // Check idempotency
        const cached = this.checkIdempotency('debit', params.idempotencyKey);
        if (cached)
            return cached;
        try {
            const response = await this.callRgsWithRetry('debit', '/transaction/debit', {
                playerId: params.playerId,
                amount: params.amount,
                roundId: params.roundId,
                transactionId: params.transactionId
            }, correlationId, params.idempotencyKey);
            // Store for idempotency
            this.storeIdempotentResponse('debit', params.idempotencyKey, response);
            // Publish event
            if (response.status === 'APPROVED') {
                await this.bus.publish({
                    eventId: (0, uuid_1.v4)(),
                    type: events_1.EventType.DEBIT_APPROVED,
                    occurredAt: new Date().toISOString(),
                    correlationId,
                    modelVersion: '1.0.0',
                    payload: {
                        playerId: params.playerId,
                        amount: params.amount,
                        roundId: params.roundId,
                        transactionId: params.transactionId,
                        status: 'APPROVED',
                        balance: response.balance
                    }
                });
            }
            else {
                await this.bus.publish({
                    eventId: (0, uuid_1.v4)(),
                    type: events_1.EventType.DEBIT_REJECTED,
                    occurredAt: new Date().toISOString(),
                    correlationId,
                    modelVersion: '1.0.0',
                    payload: {
                        playerId: params.playerId,
                        amount: params.amount,
                        roundId: params.roundId,
                        transactionId: params.transactionId,
                        status: 'REJECTED',
                        reason: response.reason || 'Unknown'
                    }
                });
            }
            return response;
        }
        catch (error) {
            logger_1.logger.error('Failed to debit', { error, params });
            throw error;
        }
    }
    async credit(params) {
        const correlationId = params.correlationId || (0, uuid_1.v4)();
        // Check idempotency
        const cached = this.checkIdempotency('credit', params.idempotencyKey);
        if (cached)
            return cached;
        try {
            const response = await this.callRgsWithRetry('credit', '/transaction/credit', {
                playerId: params.playerId,
                amount: params.amount,
                roundId: params.roundId,
                transactionId: params.transactionId
            }, correlationId, params.idempotencyKey);
            // Store for idempotency
            this.storeIdempotentResponse('credit', params.idempotencyKey, response);
            // Publish event
            if (response.status === 'APPROVED' || response.status === 'COMPLETED') {
                await this.bus.publish({
                    eventId: (0, uuid_1.v4)(),
                    type: events_1.EventType.CREDIT_COMPLETED,
                    occurredAt: new Date().toISOString(),
                    correlationId,
                    modelVersion: '1.0.0',
                    payload: {
                        playerId: params.playerId,
                        amount: params.amount,
                        roundId: params.roundId,
                        transactionId: params.transactionId,
                        status: response.status === 'APPROVED' ? 'APPROVED' : 'COMPLETED',
                        balance: response.balance
                    }
                });
            }
            else {
                await this.bus.publish({
                    eventId: (0, uuid_1.v4)(),
                    type: events_1.EventType.CREDIT_REJECTED,
                    occurredAt: new Date().toISOString(),
                    correlationId,
                    modelVersion: '1.0.0',
                    payload: {
                        playerId: params.playerId,
                        amount: params.amount,
                        roundId: params.roundId,
                        transactionId: params.transactionId,
                        status: 'REJECTED',
                        reason: response.reason || 'Unknown'
                    }
                });
            }
            return response;
        }
        catch (error) {
            logger_1.logger.error('Failed to credit', { error, params });
            throw error;
        }
    }
    async endRound(params) {
        const correlationId = params.correlationId || (0, uuid_1.v4)();
        // Check idempotency
        const cached = this.checkIdempotency('endRound', params.idempotencyKey);
        if (cached)
            return cached;
        try {
            const response = await this.callRgsWithRetry('endRound', '/round/end', {
                roundId: params.roundId,
                playerId: params.playerId
            }, correlationId, params.idempotencyKey);
            // Store for idempotency
            this.storeIdempotentResponse('endRound', params.idempotencyKey, response);
            // Publish event
            await this.bus.publish({
                eventId: (0, uuid_1.v4)(),
                type: events_1.EventType.ROUND_ENDED,
                occurredAt: new Date().toISOString(),
                correlationId,
                modelVersion: '1.0.0',
                payload: {
                    playerId: params.playerId,
                    roundId: params.roundId,
                    status: response.status
                }
            });
            return response;
        }
        catch (error) {
            logger_1.logger.error('Failed to end round', { error, params });
            throw error;
        }
    }
    getBus() {
        return this.bus;
    }
}
exports.OrchestratorService = OrchestratorService;
// Singleton instance
exports.orchestratorService = new OrchestratorService();
//# sourceMappingURL=OrchestratorService.js.map