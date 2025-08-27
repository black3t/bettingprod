import { Router } from 'express';
import { responsibleGamingService } from '../services/ResponsibleGamingService';
import { validateRGSAuth } from '../middleware/rgsAuth';
import { logger } from '../utils/logger';
import { buildError } from '../registry/rw';

const router = Router();

/**
 * POST /rg/self-exclude
 * Bible riga 717: "Self-exclusion immediate upon reception"
 */
router.post('/self-exclude', validateRGSAuth, async (req, res) => {
  try {
    const { playerId, until } = req.body;
    
    if (!playerId || !until) {
      const { status, body } = buildError('RW-CAS-006', {
        message: 'playerId and until required',
        correlationId: (req as any).correlationId
      });
      return res.status(status).json(body);
    }
    
    const untilDate = new Date(until);
    if (isNaN(untilDate.getTime()) || untilDate <= new Date()) {
      const { status, body } = buildError('RW-CAS-006', {
        message: 'Invalid until date',
        correlationId: (req as any).correlationId
      });
      return res.status(status).json(body);
    }
    
    await responsibleGamingService.selfExclude(playerId, untilDate);
    
    res.json({
      status: 'OK',
      message: 'Self-exclusion activated',
      until: untilDate.toISOString()
    });
    
  } catch (error: any) {
    logger.error('Self-exclude error', error);
    const { status, body } = buildError('RW-SYS-000', {
      message: error.message,
      correlationId: (req as any).correlationId
    });
    res.status(status).json(body);
  }
});

/**
 * POST /rg/cooling-off
 * Bible riga 717: "cooling-off aumento limiti"
 */
router.post('/cooling-off', validateRGSAuth, async (req, res) => {
  try {
    const { playerId, until } = req.body;
    
    if (!playerId || !until) {
      const { status, body } = buildError('RW-CAS-006', {
        message: 'playerId and until required',
        correlationId: (req as any).correlationId
      });
      return res.status(status).json(body);
    }
    
    const untilDate = new Date(until);
    if (isNaN(untilDate.getTime()) || untilDate <= new Date()) {
      const { status, body } = buildError('RW-CAS-006', {
        message: 'Invalid until date',
        correlationId: (req as any).correlationId
      });
      return res.status(status).json(body);
    }
    
    await responsibleGamingService.setCoolingOff(playerId, untilDate);
    
    res.json({
      status: 'OK',
      message: 'Cooling-off period activated',
      until: untilDate.toISOString()
    });
    
  } catch (error: any) {
    logger.error('Cooling-off error', error);
    const { status, body } = buildError('RW-SYS-000', {
      message: error.message,
      correlationId: (req as any).correlationId
    });
    res.status(status).json(body);
  }
});

/**
 * POST /rg/reality-check/ack
 * Bible riga 715: "ACK obbligatorio"
 */
router.post('/reality-check/ack', validateRGSAuth, async (req, res) => {
  try {
    const { playerId } = req.body;
    
    if (!playerId) {
      const { status, body } = buildError('RW-CAS-006', {
        message: 'playerId required',
        correlationId: (req as any).correlationId
      });
      return res.status(status).json(body);
    }
    
    await responsibleGamingService.acknowledgeRealityCheck(playerId);
    
    res.json({
      status: 'OK',
      message: 'Reality check acknowledged'
    });
    
  } catch (error: any) {
    logger.error('Reality check ack error', error);
    const { status, body } = buildError('RW-SYS-000', {
      message: error.message,
      correlationId: (req as any).correlationId
    });
    res.status(status).json(body);
  }
});

/**
 * GET /rg/status
 * Get RG status for player
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
    
    const rgStatus = await responsibleGamingService.getStatus(playerId);
    res.json(rgStatus);
    
  } catch (error: any) {
    logger.error('RG status error', error);
    const { status, body } = buildError('RW-SYS-000', {
      message: error.message,
      correlationId: (req as any).correlationId
    });
    res.status(status).json(body);
  }
});

export default router;