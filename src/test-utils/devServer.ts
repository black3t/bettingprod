import { spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';

const sleep = promisify(setTimeout);

export interface ServerOptions {
  env?: Record<string, string>;
  port?: number;
  waitMs?: number;
}

export class DevServer {
  private process: ChildProcess | null = null;
  private port: number;
  private env: Record<string, string>;

  constructor(options: ServerOptions = {}) {
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

  async start(waitMs: number = 3000): Promise<void> {
    if (this.process) {
      throw new Error('Server already started');
    }

    this.process = spawn('node', ['dist/index.js'], {
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

  async stop(): Promise<void> {
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

  getUrl(): string {
    return `http://localhost:${this.port}`;
  }
}

export async function withServer(
  options: ServerOptions,
  testFn: (url: string) => Promise<void>
): Promise<void> {
  const server = new DevServer(options);
  try {
    await server.start();
    await testFn(server.getUrl());
  } finally {
    await server.stop();
  }
}