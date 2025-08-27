import type { Request, Response, NextFunction } from 'express';
export declare function orchRateLimit(opts?: {
    limit?: number;
    windowMs?: number;
    allowlist?: RegExp[];
}): (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
//# sourceMappingURL=orchRateLimit.d.ts.map