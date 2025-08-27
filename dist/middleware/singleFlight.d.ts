import { Request, Response, NextFunction } from 'express';
/**
 * Single-flight middleware per evitare richieste concorrenti per lo stesso player
 */
export declare function singleFlightByPlayer(req: Request, res: Response, next: NextFunction): void;
//# sourceMappingURL=singleFlight.d.ts.map