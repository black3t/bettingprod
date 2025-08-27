import { query } from '../config/database';
import { logger } from '../utils/logger';
import { toMajor } from '../utils/money';

export class PlayerService {
  
  /**
   * Ottieni stato completo del giocatore
   * Bibbia: ritorna balance, currency, limits
   */
  async getPlayerStatus(playerId: string) {
    try {
      // Get wallet info
      const walletResult = await query(
        'SELECT balance, currency FROM user_wallets WHERE user_id = $1',
        [playerId]
      );
      
      if (walletResult.rows.length === 0) {
        // Player non esiste - crea wallet di default
        const currency = 'EUR'; // Default currency
        await query(
          'INSERT INTO user_wallets (id, user_id, balance, currency) VALUES ($1, $2, $3, $4)',
          [require('uuid').v4(), playerId, 0, currency]
        );
        
        return {
          playerId,
          currency,
          balance: '0.00',
          limits: {
            minBet: '0.10',
            maxBet: '100.00',
            maxWin: '3000.00'
          }
        };
      }
      
      const wallet = walletResult.rows[0];
      const balanceMinor = Math.round(parseFloat(wallet.balance) * 100); // Convert to minor units
      
      // Get limits (dalla bibbia §0.7 - DEFAULT)
      const limits = await this.getLimitsFor(playerId);
      
      return {
        playerId,
        currency: wallet.currency || 'EUR',
        balance: toMajor(balanceMinor),
        limits: {
          minBet: toMajor(limits.minBetMinor),
          maxBet: toMajor(limits.maxBetMinor),
          maxWin: toMajor(limits.maxWinMinor)
        }
      };
      
    } catch (error: any) {
      logger.error('Get player status failed', {
        error: error.message,
        playerId
      });
      throw error;
    }
  }
  
  /**
   * Ottieni limiti per il giocatore
   * Bibbia §0.7: DEFAULT min_bet 0.10, max_bet 100.00, max_win 3000.00
   */
  async getLimitsFor(playerId: string) {
    // Per il mock, usa limiti di default dalla bibbia
    return {
      minBetMinor: 10,    // 0.10 EUR
      maxBetMinor: 10000, // 100.00 EUR
      maxWinMinor: 300000 // 3000.00 EUR
    };
  }
  
  /**
   * Ottieni currency del giocatore
   */
  async currencyFor(playerId: string): Promise<string> {
    const result = await query(
      'SELECT currency FROM user_wallets WHERE user_id = $1',
      [playerId]
    );
    
    if (result.rows.length === 0) {
      return 'EUR'; // Default
    }
    
    return result.rows[0].currency || 'EUR';
  }
}