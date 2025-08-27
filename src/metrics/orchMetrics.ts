import { Registry, collectDefaultMetrics, Counter, Gauge, Histogram } from 'prom-client';

export const registry = new Registry();
collectDefaultMetrics({ register: registry });

export const mRetry = new Counter({
  name: 'orch_retry_total',
  help: 'Retry attempts',
  labelNames: ['endpoint'],
  registers: [registry]
});

export const mCbOpen = new Counter({
  name: 'orch_cb_open_total',
  help: 'Circuit breaker opened',
  registers: [registry]
});

export const mCbBlock = new Counter({
  name: 'orch_cb_block_total',
  help: 'Requests blocked by open CB',
  registers: [registry]
});

export const mIdemHit = new Counter({
  name: 'orch_idem_hits_total',
  help: 'Idempotency cache hits',
  labelNames: ['endpoint'],
  registers: [registry]
});

export const mIdemMiss = new Counter({
  name: 'orch_idem_misses_total',
  help: 'Idempotency cache misses',
  labelNames: ['endpoint'],
  registers: [registry]
});

export const gRoomsActive = new Gauge({
  name: 'orch_rooms_active',
  help: 'Active rooms',
  registers: [registry]
});

export const hHttp = new Histogram({
  name: 'orch_http_duration_ms',
  help: 'HTTP duration (ms)',
  labelNames: ['route', 'method', 'status'],
  buckets: [1, 2, 5, 10, 20, 50, 100, 250, 500, 1000, 2000],
  registers: [registry]
});

export const renderMetrics = () => registry.metrics();