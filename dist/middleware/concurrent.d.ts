import { Request, Response, NextFunction } from 'express';
/**
 * Middleware per gestire richieste concorrenti per player
 * Serializza le operazioni wallet per lo stesso playerId
 */
export declare const concurrentRequestHandler: () => (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Global rate limiting middleware
 */
export declare const globalRateLimit: () => (req: Request, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=concurrent.d.ts.map