"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderMetrics = exports.hHttp = exports.gRoomsActive = exports.mIdemMiss = exports.mIdemHit = exports.mCbBlock = exports.mCbOpen = exports.mRetry = exports.registry = void 0;
const prom_client_1 = require("prom-client");
exports.registry = new prom_client_1.Registry();
(0, prom_client_1.collectDefaultMetrics)({ register: exports.registry });
exports.mRetry = new prom_client_1.Counter({
    name: 'orch_retry_total',
    help: 'Retry attempts',
    labelNames: ['endpoint'],
    registers: [exports.registry]
});
exports.mCbOpen = new prom_client_1.Counter({
    name: 'orch_cb_open_total',
    help: 'Circuit breaker opened',
    registers: [exports.registry]
});
exports.mCbBlock = new prom_client_1.Counter({
    name: 'orch_cb_block_total',
    help: 'Requests blocked by open CB',
    registers: [exports.registry]
});
exports.mIdemHit = new prom_client_1.Counter({
    name: 'orch_idem_hits_total',
    help: 'Idempotency cache hits',
    labelNames: ['endpoint'],
    registers: [exports.registry]
});
exports.mIdemMiss = new prom_client_1.Counter({
    name: 'orch_idem_misses_total',
    help: 'Idempotency cache misses',
    labelNames: ['endpoint'],
    registers: [exports.registry]
});
exports.gRoomsActive = new prom_client_1.Gauge({
    name: 'orch_rooms_active',
    help: 'Active rooms',
    registers: [exports.registry]
});
exports.hHttp = new prom_client_1.Histogram({
    name: 'orch_http_duration_ms',
    help: 'HTTP duration (ms)',
    labelNames: ['route', 'method', 'status'],
    buckets: [1, 2, 5, 10, 20, 50, 100, 250, 500, 1000, 2000],
    registers: [exports.registry]
});
const renderMetrics = () => exports.registry.metrics();
exports.renderMetrics = renderMetrics;
//# sourceMappingURL=orchMetrics.js.map