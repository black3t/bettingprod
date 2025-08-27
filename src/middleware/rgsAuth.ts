import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { CasinoErrorCodes } from '../utils/errorCodes';
import { buildError } from '../registry/rw';

/**
 * Middleware per autenticare le richieste provenienti da RGS
 * In Pre-Prod: validazione base API key
 * In Prod: mTLS + API key + signature
 */
export const validateRGSAuth = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Verifica API key RGS - supporta sia x-api-key che Authorization Bearer
    const apiKeyHeader = req.headers['x-api-key'] as string;
    const authHeader = req.headers['authorization'] as string;
    
    let apiKey: string | undefined;
    if (apiKeyHeader) {
      apiKey = apiKeyHeader;
    } else if (authHeader && authHeader.startsWith('Bearer ')) {
      apiKey = authHeader.substring(7);
    }
    
    const expectedKey = process.env.RGS_API_KEY || 'test_rgs_key';
    
    if (!apiKey || apiKey !== expectedKey) {
      logger.warn('Invalid RGS API key', {
        provided: apiKey ? 'yes' : 'no',
        ip: req.ip
      });
      
      const { status, body } = buildError('RW-RGS-003', {
        message: 'Unauthorized',
        correlationId: req.headers['x-correlation-id'] as string
      });
      res.status(status).json(body);
      return;
    }

    // Il controllo del correlation ID è fatto dal middleware requireCorrelationId nel router

    // In Prod aggiungeremmo:
    // - Verifica certificato mTLS
    // - Verifica signature HMAC del body
    // - Rate limiting per API key
    
    next();
  } catch (error) {
    logger.error('RGS auth middleware error', error);
    const { status, body } = buildError('RW-SYS-000', {
      message: 'Internal server error',
      correlationId: req.headers['x-correlation-id'] as string
    });
    res.status(status).json(body);
  }
};