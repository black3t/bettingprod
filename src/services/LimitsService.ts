import { query } from '../config/database';
import { logger } from '../utils/logger';
import { CasinoErrorCodes } from '../utils/errorCodes';
import { toMinor } from '../utils/money';

interface LimitsCheckRequest {
  playerId: string;
  stake: string; // stringa "10.00" dalla bibbia
  correlationId: string;
}

interface LimitsCheckResponse {
  ok: boolean;
  reason?: string; // codice RW-CAS-003 per domain errors
}

export class LimitsService {
  
  /**
   * Verifica se il giocatore può piazzare la scommessa
   * Bibbia §4.5: POST /limits/check { playerId, stake } → { ok:true|false, reason? }
   */
  async checkLimits(request: LimitsCheckRequest): Promise<LimitsCheckResponse> {
    try {
      // Converti stake in minor units per precisione
      const stakeMinor = toMinor(request.stake);
      
      // Per il mock, usa limiti di default
      // Dalla bibbia §0.7 - DEFAULT: min_bet 0.10, max_bet 100.00, max_win 3000.00
      const MIN_BET_MINOR = 10;     // 0.10 EUR
      const MAX_BET_MINOR = 10000;  // 100.00 EUR
      
      if (stakeMinor < MIN_BET_MINOR) {
        return {
          ok: false,
          reason: CasinoErrorCodes.LIMIT_EXCEEDED // RW-CAS-003
        };
      }
      
      if (stakeMinor > MAX_BET_MINOR) {
        return {
          ok: false,
          reason: CasinoErrorCodes.LIMIT_EXCEEDED // RW-CAS-003
        };
      }
      
      // Verifica balance del giocatore
      const walletResult = await query(
        'SELECT balance FROM user_wallets WHERE user_id = $1',
        [request.playerId]
      );
      
      if (walletResult.rows.length === 0) {
        // Player non esiste - ritorna deterministic response
        return {
          ok: false,
          reason: 'RW-CAS-006' // Invalid request per player non esistenti
        };
      }
      
      const balanceMinor = Math.round(parseFloat(walletResult.rows[0].balance) * 100);
      
      if (balanceMinor < stakeMinor) {
        return {
          ok: false,
          reason: CasinoErrorCodes.INSUFFICIENT_FUNDS // RW-CAS-002
        };
      }
      
      // Tutto OK
      return {
        ok: true
      };
      
    } catch (error: any) {
      logger.error('Limits check failed', {
        error: error.message,
        playerId: request.playerId
      });
      
      // Return deterministic response on DB error
      return {
        ok: false,
        reason: 'RW-SYS-000'
      };
    }
  }
}