"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayerService = void 0;
const database_1 = require("../config/database");
const logger_1 = require("../utils/logger");
const money_1 = require("../utils/money");
class PlayerService {
    /**
     * Ottieni stato completo del giocatore
     * Bibbia: ritorna balance, currency, limits
     */
    async getPlayerStatus(playerId) {
        try {
            // Get wallet info
            const walletResult = await (0, database_1.query)('SELECT balance, currency FROM user_wallets WHERE user_id = $1', [playerId]);
            if (walletResult.rows.length === 0) {
                // Player non esiste - crea wallet di default
                const currency = 'EUR'; // Default currency
                await (0, database_1.query)('INSERT INTO user_wallets (id, user_id, balance, currency) VALUES ($1, $2, $3, $4)', [require('uuid').v4(), playerId, 0, currency]);
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
                balance: (0, money_1.toMajor)(balanceMinor),
                limits: {
                    minBet: (0, money_1.toMajor)(limits.minBetMinor),
                    maxBet: (0, money_1.toMajor)(limits.maxBetMinor),
                    maxWin: (0, money_1.toMajor)(limits.maxWinMinor)
                }
            };
        }
        catch (error) {
            logger_1.logger.error('Get player status failed', {
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
    async getLimitsFor(playerId) {
        // Per il mock, usa limiti di default dalla bibbia
        return {
            minBetMinor: 10, // 0.10 EUR
            maxBetMinor: 10000, // 100.00 EUR
            maxWinMinor: 300000 // 3000.00 EUR
        };
    }
    /**
     * Ottieni currency del giocatore
     */
    async currencyFor(playerId) {
        const result = await (0, database_1.query)('SELECT currency FROM user_wallets WHERE user_id = $1', [playerId]);
        if (result.rows.length === 0) {
            return 'EUR'; // Default
        }
        return result.rows[0].currency || 'EUR';
    }
}
exports.PlayerService = PlayerService;
//# sourceMappingURL=PlayerService.js.map