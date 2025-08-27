import { Router } from 'express';
import { AuthService } from '../services/AuthService';
import { validate } from '../middleware/validation';
import { authenticate, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { buildError } from '../registry/rw';

const router = Router();
const authService = new AuthService();

// Signup
router.post('/signup', validate('signup'), async (req, res) => {
  try {
    const ipAddress = req.ip || req.socket.remoteAddress;
    const response = await authService.signup(req.body, ipAddress);
    
    // Set cookie
    res.cookie('token', response.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7200000 // 2 hours
    });

    res.status(201).json(response);
  } catch (error: any) {
    logger.error('Signup error', error);
    const correlationId = req.headers['x-correlation-id'] as string;
    const errorCode = error.code && error.code.startsWith('RW-') ? error.code : 'RW-CAS-006';
    const { status, body } = buildError(errorCode, {
      message: error.message,
      correlationId
    });
    res.status(status).json(body);
  }
});

// Login
router.post('/login', validate('login'), async (req, res) => {
  try {
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const response = await authService.login(req.body, ipAddress, userAgent);
    
    // Set cookie
    res.cookie('token', response.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7200000 // 2 hours
    });

    res.json(response);
  } catch (error: any) {
    logger.error('Login error', error);
    const correlationId = req.headers['x-correlation-id'] as string;
    const errorCode = error.code && error.code.startsWith('RW-') ? error.code : 'RW-CAS-001';
    const { status, body } = buildError(errorCode, {
      message: error.message,
      correlationId
    });
    res.status(status).json(body);
  }
});

// Logout
router.post('/logout', authenticate, async (req: AuthRequest, res) => {
  try {
    await authService.logout(req.token!);
    
    // Clear cookie
    res.clearCookie('token');
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error: any) {
    logger.error('Logout error', error);
    const correlationId = req.headers['x-correlation-id'] as string;
    const { status, body } = buildError('RW-SYS-000', {
      message: 'Logout failed',
      correlationId
    });
    res.status(status).json(body);
  }
});

// Validate session
router.get('/validate', authenticate, async (req: AuthRequest, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

export default router;