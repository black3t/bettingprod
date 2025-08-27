import { Request, Response } from 'express';
declare const router: import("express-serve-static-core").Router;
/**
 * GET /health or /admin/health
 * Health check endpoint per monitoraggio
 * Returns consistent JSON format
 */
export declare function healthHandler(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export default router;
//# sourceMappingURL=healthRoutes.d.ts.map