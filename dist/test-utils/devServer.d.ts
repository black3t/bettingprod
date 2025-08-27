export interface ServerOptions {
    env?: Record<string, string>;
    port?: number;
    waitMs?: number;
}
export declare class DevServer {
    private process;
    private port;
    private env;
    constructor(options?: ServerOptions);
    start(waitMs?: number): Promise<void>;
    stop(): Promise<void>;
    getUrl(): string;
}
export declare function withServer(options: ServerOptions, testFn: (url: string) => Promise<void>): Promise<void>;
//# sourceMappingURL=devServer.d.ts.map