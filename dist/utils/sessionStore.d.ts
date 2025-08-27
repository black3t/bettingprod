export declare const sessionStore: {
    get(key: string): Promise<string | null>;
    setex(key: string, seconds: number, value: string): Promise<void>;
    del(key: string): Promise<void>;
};
//# sourceMappingURL=sessionStore.d.ts.map