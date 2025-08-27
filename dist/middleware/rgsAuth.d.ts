import { Request, Response, NextFunction } from 'express';
/**
 * Middleware per autenticare le richieste provenienti da RGS
 * In Pre-Prod: validazione base API key
 * In Prod: mTLS + API key + signature
 */
export declare const validateRGSAuth: (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=rgsAuth.d.ts.map