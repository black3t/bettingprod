import { Request, Response, NextFunction } from 'express';
/**
 * Middleware di normalizzazione idempotency
 * Se manca header Idempotency-Key ma c'è body.idempotencyKey,
 * normalizza spostando il valore nell'header e rimuovendolo dal body
 * per mantenere gli schemi stretti (Bibbia §144: header obbligatorio)
 */
export declare const normalizeIdempotency: (req: Request, res: Response, next: NextFunction) => void;
/**
 * Middleware che richiede header Idempotency-Key obbligatorio
 * Bibbia §144: Idempotency obbligatoria via header
 */
export declare const requireIdempotencyKey: (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=idempotency.d.ts.map