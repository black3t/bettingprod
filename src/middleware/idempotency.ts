import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import { buildError } from '../registry/rw';

/**
 * Middleware di normalizzazione idempotency
 * Se manca header Idempotency-Key ma c'è body.idempotencyKey,
 * normalizza spostando il valore nell'header e rimuovendolo dal body
 * per mantenere gli schemi stretti (Bibbia §144: header obbligatorio)
 */
export const normalizeIdempotency = (req: Request, res: Response, next: NextFunction): void => {
  // Header standard
  const headerKey = (req.headers['idempotency-key'] as string | undefined || '').trim();
  
  // Se manca header ma c'è nel body, normalizza (compatibilità)
  if (!headerKey && req.body && req.body.idempotencyKey) {
    req.headers['idempotency-key'] = req.body.idempotencyKey;
    delete req.body.idempotencyKey;
  }
  
  const finalHeaderKey = (req.headers['idempotency-key'] as string | undefined || '').trim();
  (req as any).idempotencyHeader = finalHeaderKey; // mai loggare questo valore

  // Body hash deterministico (idempotency vale su body identico)
  const bodyStr = JSON.stringify(req.body ?? {});
  const bodyHash = createHash('sha256').update(bodyStr).digest('hex');

  // Path/method stabili
  const method = (req.method || 'GET').toUpperCase();
  const path = `${req.baseUrl || ''}${(req as any).route?.path || req.path || ''}`;

  // PlayerId (se presente)
  const playerId =
    (req.body && (req.body.playerId as string)) ||
    (req.query && (req.query.playerId as string)) ||
    'na';

  // Fingerprint composita anti-collisione tra endpoint
  const composite = `H:${method}|P:${path}|PID:${playerId}|BH:${bodyHash}|K:${finalHeaderKey}`;
  (req as any).idempotencyKey = composite;
  next();
};

/**
 * Middleware che richiede header Idempotency-Key obbligatorio
 * Bibbia §144: Idempotency obbligatoria via header
 */
export const requireIdempotencyKey = (req: Request, res: Response, next: NextFunction): void => {
  const idempotencyKey = req.headers['idempotency-key'] as string;
  
  if (!idempotencyKey || idempotencyKey === '') {
    const correlationId = req.headers['x-correlation-id'] as string;
    const { status, body } = buildError('RW-CAS-010', {
      message: 'Idempotency-Key header required',
      correlationId
    });
    res.status(status).json(body);
    return;
  } 
  (req as any).idempotencyHeader = idempotencyKey; // keep composite from normalizeIdempotency
  next();
};