"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DevServer = void 0;
exports.withServer = withServer;
const child_process_1 = require("child_process");
const util_1 = require("util");
const sleep = (0, util_1.promisify)(setTimeout);
class DevServer {
    process = null;
    port;
    env;
    constructor(options = {}) {
        this.port = options.port || 3001;
        this.env = {
            PORT: String(this.port),
            USE_SQLITE: 'true',
            API_BASE_PATH: '/casino/api/v1',
            RGS_BASE_PATH: '/rgs/api/v1',
            ORCH_BASE_PATH: '/orch/api/v1',
            ...options.env
        };
    }
    async start(waitMs = 3000) {
        if (this.process) {
            throw new Error('Server already started');
        }
        this.process = (0, child_process_1.spawn)('node', ['dist/index.js'], {
            env: { ...process.env, ...this.env },
            detached: false,
            stdio: 'pipe'
        });
        this.process.on('error', (err) => {
            console.error('Server process error:', err);
        });
        // Wait for server to be ready
        await sleep(waitMs);
    }
    async stop() {
        if (!this.process) {
            return;
        }
        return new Promise((resolve) => {
            if (this.process) {
                this.process.on('exit', () => resolve());
                this.process.kill('SIGTERM');
                this.process = null;
            }
            setTimeout(() => resolve(), 1000);
        });
    }
    getUrl() {
        return `http://localhost:${this.port}`;
    }
}
exports.DevServer = DevServer;
async function withServer(options, testFn) {
    const server = new DevServer(options);
    try {
        await server.start();
        await testFn(server.getUrl());
    }
    finally {
        await server.stop();
    }
}
//# sourceMappingURL=devServer.js.map