import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService';
import { logger } from '../utils/logger';
import { buildError } from '../registry/rw';

export interface AuthRequest extends Request {
  user?: any;
  token?: string;
}

const authService = new AuthService();

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from multiple sources
    const token = 
      req.headers.authorization?.replace('Bearer ', '') ||
      req.cookies?.token ||
      req.query.token as string;

    if (!token) {
      const { status, body } = buildError('RW-RGS-003', {
        message: 'Authentication required',
        correlationId: (req as any).correlationId
      });
      res.status(status).json(body);
      return;
    }

    // Validate session
    const user = await authService.validateSession(token);

    if (!user) {
      const { status, body } = buildError('RW-RGS-003', {
        message: 'Invalid or expired session',
        correlationId: (req as any).correlationId
      });
      res.status(status).json(body);
      return;
    }

    // Attach user to request
    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    logger.error('Authentication error', error);
    const { status, body } = buildError('RW-SYS-000', {
      message: 'Authentication failed',
      correlationId: (req as any).correlationId
    });
    res.status(status).json(body);
  }
};

export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = 
      req.headers.authorization?.replace('Bearer ', '') ||
      req.cookies?.token ||
      req.query.token as string;

    if (token) {
      const user = await authService.validateSession(token);
      if (user) {
        req.user = user;
        req.token = token;
      }
    }

    next();
  } catch (error) {
    // Continue without auth
    next();
  }
};