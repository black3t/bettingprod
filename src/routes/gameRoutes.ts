import { Router } from 'express';
import { GameService } from '../services/GameService';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { logger } from '../utils/logger';
import { buildError } from '../registry/rw';

const router = Router();
const gameService = new GameService();

// Get all available games
router.get('/list', optionalAuth, async (req, res) => {
  try {
    const category = req.query.category as string;
    const games = await gameService.getGames(category);
    
    res.json({
      success: true,
      games,
      count: games.length
    });
  } catch (error: any) {
    logger.error('Get games error', error);
    const correlationId = req.headers['x-correlation-id'] as string;
    const { status, body } = buildError('RW-SYS-000', {
      message: error.message,
      correlationId
    });
    res.status(status).json(body);
  }
});

// Get specific game
router.get('/:gameCode', async (req, res) => {
  try {
    const game = await gameService.getGame(req.params.gameCode);
    
    if (!game) {
      const correlationId = req.headers['x-correlation-id'] as string;
      const { status, body } = buildError('RW-RGS-006', {
        message: 'Game not found',
        correlationId
      });
      res.status(status).json(body);
      return;
    }
    
    res.json({
      success: true,
      game
    });
  } catch (error: any) {
    logger.error('Get game error', error);
    const correlationId = req.headers['x-correlation-id'] as string;
    const { status, body } = buildError('RW-SYS-000', {
      message: error.message,
      correlationId
    });
    res.status(status).json(body);
  }
});

// Launch game
router.post('/launch', authenticate, validate('launchGame'), async (req: AuthRequest, res) => {
  try {
    const response = await gameService.launchGame(req.user.id, req.body);
    
    res.json(response);
  } catch (error: any) {
    logger.error('Launch game error', error);
    const correlationId = req.headers['x-correlation-id'] as string;
    const errorCode = error.code && error.code.startsWith('RW-') ? error.code : 'RW-SYS-000';
    const { status, body } = buildError(errorCode, {
      message: error.message,
      correlationId
    });
    res.status(status).json(body);
  }
});

// End game session
router.post('/end/:sessionId', authenticate, async (req: AuthRequest, res) => {
  try {
    await gameService.endGameSession(req.user.id, req.params.sessionId);
    
    res.json({
      success: true,
      message: 'Game session ended'
    });
  } catch (error: any) {
    logger.error('End game session error', error);
    const correlationId = req.headers['x-correlation-id'] as string;
    const errorCode = error.code && error.code.startsWith('RW-') ? error.code : 'RW-SYS-000';
    const { status, body } = buildError(errorCode, {
      message: error.message,
      correlationId
    });
    res.status(status).json(body);
  }
});

// Get active game sessions
router.get('/sessions/active', authenticate, async (req: AuthRequest, res) => {
  try {
    const sessions = await gameService.getActiveGameSessions(req.user.id);
    
    res.json({
      success: true,
      sessions,
      count: sessions.length
    });
  } catch (error: any) {
    logger.error('Get active sessions error', error);
    const correlationId = req.headers['x-correlation-id'] as string;
    const { status, body } = buildError('RW-SYS-000', {
      message: error.message,
      correlationId
    });
    res.status(status).json(body);
  }
});

// Get game history
router.get('/history', authenticate, async (req: AuthRequest, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    
    const history = await gameService.getGameHistory(
      req.user.id,
      limit,
      offset
    );
    
    res.json({
      success: true,
      history,
      pagination: {
        limit,
        offset
      }
    });
  } catch (error: any) {
    logger.error('Get game history error', error);
    const correlationId = req.headers['x-correlation-id'] as string;
    const { status, body } = buildError('RW-SYS-000', {
      message: error.message,
      correlationId
    });
    res.status(status).json(body);
  }
});

export default router;