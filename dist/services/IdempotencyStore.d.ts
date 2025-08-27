export declare function storageKey(ik: string, endpoint: string): string;
export declare function get(ik: string, endpoint: string): Promise<{
    status: number;
    body: any;
    headers: Record<string, string>;
} | null>;
export declare function put(ik: string, endpoint: string, status: number, body: any, headers: Record<string, string>): Promise<void>;
//# sourceMappingURL=IdempotencyStore.d.ts.map