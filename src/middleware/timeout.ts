import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { buildError } from '../registry/rw';

/**
 * Timeout middleware per gestire timeout HTTP
 * Bibbia: HTTP timeout 2s, ritorna RW-RGS-008
 */
export const timeoutMiddleware = (timeoutMs: number = 2000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Set timeout on the request
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        logger.warn('Request timeout', {
          method: req.method,
          path: req.path,
          timeout: timeoutMs
        });
        
        const { status, body } = buildError('RW-RGS-008', {
          message: 'Request timeout',
          correlationId: (req as any).correlationId
        });
        res.status(status).json(body);
      }
    }, timeoutMs);

    // Clear timeout when response finishes
    res.on('finish', () => {
      clearTimeout(timeout);
    });

    // Clear timeout on close
    res.on('close', () => {
      clearTimeout(timeout);
    });

    next();
  };
};

/**
 * Simulate timeout for testing
 * Set SIMULATE_TIMEOUT=true to trigger timeouts
 */
export const simulateTimeout = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (process.env.SIMULATE_TIMEOUT === 'true') {
      // Random 10% chance of timeout in test mode
      if (Math.random() < 0.1) {
        logger.info('Simulating timeout', { 
          path: req.path 
        });
        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait longer than timeout
      }
    }
    next();
  };
};