import { query } from '../config/database';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

interface PlayerExcludedRequest {
  playerId: string;
  reason: string;
  ts: string; // ISO8601
  correlationId: string;
}

interface BalanceChangedRequest {
  playerId: string;
  newBalance: string; // stringa "1000.00"
  ts: string; // ISO8601
  correlationId: string;
}

export class WebhookService {
  
  /**
   * Gestisce notifica di giocatore escluso
   * Bibbia §4.5: Casino riceve da RGS quando un giocatore viene escluso
   */
  async handlePlayerExcluded(request: PlayerExcludedRequest): Promise<void> {
    try {
      // Inserisci in outbox invece di chiamate esterne
      await query(
        `INSERT INTO webhook_outbox (id, type, payload, headers, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          uuidv4(),
          'playerExcluded',
          JSON.stringify({ playerId: request.playerId, reason: request.reason, ts: request.ts }),
          JSON.stringify({ 'X-Correlation-Id': request.correlationId }),
          'pending',
          new Date().toISOString()
        ]
      );

      logger.info('Player excluded webhook queued', {
        playerId: request.playerId,
        reason: request.reason,
        correlationId: request.correlationId
      });

    } catch (error: any) {
      logger.error('Player excluded webhook failed', {
        error: error.message,
        playerId: request.playerId
      });
      // Non rilanciare - ritorna sempre 200/202
    }
  }

  /**
   * Gestisce notifica di cambio balance
   * Bibbia §4.5: Casino riceve da RGS quando il balance cambia esternamente
   */
  async handleBalanceChanged(request: BalanceChangedRequest): Promise<void> {
    try {
      // Inserisci in outbox invece di chiamate esterne
      await query(
        `INSERT INTO webhook_outbox (id, type, payload, headers, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          uuidv4(),
          'balanceChanged',
          JSON.stringify({ playerId: request.playerId, newBalance: request.newBalance, ts: request.ts }),
          JSON.stringify({ 'X-Correlation-Id': request.correlationId }),
          'pending',
          new Date().toISOString()
        ]
      );

      logger.info('Balance changed webhook queued', {
        playerId: request.playerId,
        newBalance: request.newBalance,
        correlationId: request.correlationId
      });

    } catch (error: any) {
      logger.error('Balance changed webhook failed', {
        error: error.message,
        playerId: request.playerId
      });
      // Non rilanciare - ritorna sempre 200/202
    }
  }
}