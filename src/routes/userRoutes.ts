import { Router } from 'express';
import { UserService } from '../services/UserService';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { logger } from '../utils/logger';
import { buildError } from '../registry/rw';

const router = Router();
const userService = new UserService();

// Get current user profile
router.get('/profile', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = await userService.getUser(req.user.id);
    const wallet = await userService.getWallet(req.user.id);
    
    res.json({
      success: true,
      user: {
        ...user,
        balance: wallet.balance,
        currency: wallet.currency
      }
    });
  } catch (error: any) {
    logger.error('Get profile error', error);
    const correlationId = req.headers['x-correlation-id'] as string;
    const errorCode = error.code && error.code.startsWith('RW-') ? error.code : 'RW-SYS-000';
    const { status, body } = buildError(errorCode, {
      message: error.message,
      correlationId
    });
    res.status(status).json(body);
  }
});

// Update profile
router.put('/profile', authenticate, validate('updateProfile'), async (req: AuthRequest, res) => {
  try {
    const updatedUser = await userService.updateProfile(req.user.id, req.body);
    
    res.json({
      success: true,
      user: updatedUser
    });
  } catch (error: any) {
    logger.error('Update profile error', error);
    const correlationId = req.headers['x-correlation-id'] as string;
    const errorCode = error.code && error.code.startsWith('RW-') ? error.code : 'RW-SYS-000';
    const { status, body } = buildError(errorCode, {
      message: error.message,
      correlationId
    });
    res.status(status).json(body);
  }
});

// Get wallet balance
router.get('/wallet', authenticate, async (req: AuthRequest, res) => {
  try {
    const wallet = await userService.getWallet(req.user.id);
    
    res.json({
      success: true,
      wallet
    });
  } catch (error: any) {
    logger.error('Get wallet error', error);
    const correlationId = req.headers['x-correlation-id'] as string;
    const errorCode = error.code && error.code.startsWith('RW-') ? error.code : 'RW-SYS-000';
    const { status, body } = buildError(errorCode, {
      message: error.message,
      correlationId
    });
    res.status(status).json(body);
  }
});

// Get transaction history
router.get('/transactions', authenticate, async (req: AuthRequest, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    
    const transactions = await userService.getTransactionHistory(
      req.user.id,
      limit,
      offset
    );
    
    res.json({
      success: true,
      transactions,
      pagination: {
        limit,
        offset
      }
    });
  } catch (error: any) {
    logger.error('Get transactions error', error);
    const correlationId = req.headers['x-correlation-id'] as string;
    const { status, body } = buildError('RW-SYS-000', {
      message: error.message,
      correlationId
    });
    res.status(status).json(body);
  }
});

// Get user statistics
router.get('/stats', authenticate, async (req: AuthRequest, res) => {
  try {
    const stats = await userService.getStats(req.user.id);
    
    res.json({
      success: true,
      stats
    });
  } catch (error: any) {
    logger.error('Get stats error', error);
    const correlationId = req.headers['x-correlation-id'] as string;
    const { status, body } = buildError('RW-SYS-000', {
      message: error.message,
      correlationId
    });
    res.status(status).json(body);
  }
});

export default router;