import { Registry, Counter, Gauge, Histogram } from 'prom-client';
export declare const registry: Registry;
export declare const mRetry: Counter<"endpoint">;
export declare const mCbOpen: Counter<string>;
export declare const mCbBlock: Counter<string>;
export declare const mIdemHit: Counter<"endpoint">;
export declare const mIdemMiss: Counter<"endpoint">;
export declare const gRoomsActive: Gauge<string>;
export declare const hHttp: Histogram<"method" | "status" | "route">;
export declare const renderMetrics: () => Promise<string>;
//# sourceMappingURL=orchMetrics.d.ts.map