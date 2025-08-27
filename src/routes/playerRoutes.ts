import { Router } from 'express';
import { PlayerService } from '../services/PlayerService';
import { validateRGSAuth } from '../middleware/rgsAuth';
import { logger } from '../utils/logger';
import { buildError } from '../registry/rw';

const router = Router();
const playerService = new PlayerService();

/**
 * GET /player/status
 * RGS → Casino: Get player status (canonical)
 * Bible: returns playerId, status, kyc, rgFlags, activeSessions
 */
router.get('/status', validateRGSAuth, async (req, res) => {
  try {
    const playerId = req.query.playerId as string;
    
    if (!playerId) {
      const { status, body } = buildError('RW-CAS-006', {
        message: 'playerId required',
        correlationId: (req as any).correlationId
      });
      return res.status(status).json(body);
    }
    
    const playerStatus = await playerService.getPlayerStatus(playerId);
    res.json(playerStatus);
    
  } catch (error: any) {
    logger.error('Player status error', error);
    const errorCode = error.code && error.code.startsWith('RW-') ? error.code : 'RW-SYS-000';
    const { status, body } = buildError(errorCode, {
      message: error.message,
      correlationId: (req as any).correlationId
    });
    res.status(status).json(body);
  }
});

/**
 * POST /player/status
 * Deprecated compatibility alias - use GET /player/status
 */
router.post('/status', validateRGSAuth, async (req, res) => {
  // Add deprecation headers
  const sunsetDate = new Date();
  sunsetDate.setDate(sunsetDate.getDate() + 90);
  res.setHeader('Deprecation', 'true');
  res.setHeader('Sunset', sunsetDate.toISOString());
  res.setHeader('Link', '</player/status>; rel="successor-version"');
  
  try {
    const playerId = req.body.playerId;
    
    if (!playerId) {
      const { status, body } = buildError('RW-CAS-006', {
        message: 'playerId required',
        correlationId: (req as any).correlationId
      });
      return res.status(status).json(body);
    }
    
    const playerStatus = await playerService.getPlayerStatus(playerId);
    res.json(playerStatus);
    
  } catch (error: any) {
    logger.error('Player status error', error);
    const errorCode = error.code && error.code.startsWith('RW-') ? error.code : 'RW-SYS-000';
    const { status, body } = buildError(errorCode, {
      message: error.message,
      correlationId: (req as any).correlationId
    });
    res.status(status).json(body);
  }
});

export default router;