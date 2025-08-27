import { Router } from 'express';
import { LimitsService } from '../services/LimitsService';
import { validateRGSAuth } from '../middleware/rgsAuth';
import { validate } from '../middleware/validation';
import { logger } from '../utils/logger';
import { buildError } from '../registry/rw';
import { singleFlightByPlayer } from '../middleware/singleFlight';
import { normalizeIdempotency } from '../middleware/idempotency';

const router = Router();
const limitsService = new LimitsService();

/**
 * POST /limits/check
 * RGS → Casino: Verifica se il giocatore può piazzare la scommessa
 * Bibbia §4.5: { playerId, stake } → { ok:true|false, reason? }
 */
router.post('/check', [validateRGSAuth, normalizeIdempotency, validate('limitsCheck'), singleFlightByPlayer], async (req: any, res: any) => {
  try {
    const correlationId = req.headers['x-correlation-id'] as string;
    
    // Extract only required fields, ignore extras
    const response = await limitsService.checkLimits({
      playerId: req.body.playerId,
      stake: req.body.stake, // stringa "10.00"
      correlationId
    });

    // Ensure response always has ok boolean and reason when false
    const safeResponse = {
      ok: response?.ok === true,
      ...((!response?.ok || response?.reason) && { 
        reason: response?.reason || 'RW-SYS-000' 
      })
    };

    // Always return 200 with {ok, reason?} for business logic
    return res.status(200).json(safeResponse);
  } catch (error: any) {
    // Map all errors to deterministic response
    logger.error('Limits check error', error);
    
    // Always return 200 with deterministic response on error
    return res.status(200).json({ 
      ok: false, 
      reason: 'RW-SYS-000' 
    });
  }
});

export default router;