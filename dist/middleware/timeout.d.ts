import { Request, Response, NextFunction } from 'express';
/**
 * Timeout middleware per gestire timeout HTTP
 * Bibbia: HTTP timeout 2s, ritorna RW-RGS-008
 */
export declare const timeoutMiddleware: (timeoutMs?: number) => (req: Request, res: Response, next: NextFunction) => void;
/**
 * Simulate timeout for testing
 * Set SIMULATE_TIMEOUT=true to trigger timeouts
 */
export declare const simulateTimeout: () => (req: Request, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=timeout.d.ts.map