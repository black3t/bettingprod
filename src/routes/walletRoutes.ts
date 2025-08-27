import { Router } from 'express';
import { WalletService } from '../services/WalletService';
import { validateRGSAuth } from '../middleware/rgsAuth';
import { validate } from '../middleware/validation';
import { requireIdempotencyKey, normalizeIdempotency } from '../middleware/idempotency';
import { logger } from '../utils/logger';
import { buildError, sendError } from '../registry/rw';

const router = Router();
const walletService = new WalletService();

/**
 * POST /wallet/debit
 * RGS → Casino: Addebita fondi dal wallet del giocatore
 * Bibbia §4.5: { playerId, amount, currency, idempotencyKey } → { status, reason?, newBalance? }
 */
router.post('/debit', validateRGSAuth, normalizeIdempotency, requireIdempotencyKey, validate('walletDebit'), async (req, res) => {
  try {
    const correlationId = req.headers['x-correlation-id'] as string;
    
    const response = await walletService.debit({
      playerId: req.body.playerId,
      amount: req.body.amount, // DEVE essere stringa "10.00"
      currency: req.body.currency,
      idempotencyKey: (req as any).idempotencyKey, // DA HEADER come da bibbia!
      correlationId
    });

    res.json(response);
  } catch (error: any) {
    logger.error('Wallet debit error', error);
    const correlationId = req.headers['x-correlation-id'] as string;
    const { status, body } = buildError(error.code || 'RW-SYS-000', {
      message: error.message || 'Transaction failed',
      correlationId
    });
    res.status(status).json(body);
  }
});

/**
 * POST /wallet/credit
 * RGS → Casino: Accredita fondi al wallet del giocatore
 * Bibbia §4.5: stesso formato di debit
 */
router.post('/credit', validateRGSAuth, normalizeIdempotency, requireIdempotencyKey, validate('walletCredit'), async (req, res) => {
  try {
    const correlationId = req.headers['x-correlation-id'] as string;
    
    const response = await walletService.credit({
      playerId: req.body.playerId,
      amount: req.body.amount, // DEVE essere stringa "10.00"
      currency: req.body.currency,
      idempotencyKey: (req as any).idempotencyKey, // DA HEADER come da bibbia!
      correlationId
    });

    res.json(response);
  } catch (error: any) {
    logger.error('Wallet credit error', error);
    const correlationId = req.headers['x-correlation-id'] as string;
    const { status, body } = buildError(error.code || 'RW-SYS-000', {
      message: error.message || 'Transaction failed',
      correlationId
    });
    res.status(status).json(body);
  }
});

/**
 * POST /wallet/cancel
 * RGS → Casino: Cancel a transaction
 * Bible: void/abort unsettled financial operation
 */
router.post('/cancel', validateRGSAuth, normalizeIdempotency, requireIdempotencyKey, async (req: any, res: any) => {
  try {
    const correlationId = req.headers['x-correlation-id'] as string;
    
    // Bible: amount must be string "xx.yy"
    const { playerId, transactionId, amount, reason } = req.body;
    
    // Normalized by middleware from header 'Idempotency-Key'
    const idempotencyKey = (req as any).idempotencyKey as string;
    
    const result = await walletService.cancelTransaction(
      playerId,
      transactionId,
      amount,
      reason || 'RGS requested',
      correlationId,
      idempotencyKey
    );
    
    res.json(result);
  } catch (error: any) {
    logger.error('Cancel transaction error', error);
    const correlationId = req.headers['x-correlation-id'] as string;
    const errorCode = error.code && error.code.startsWith('RW-') ? error.code : 'RW-SYS-000';
    const { status, body } = buildError(errorCode, {
      message: error.message,
      correlationId
    });
    res.status(status).json(body);
  }
});

export default router;