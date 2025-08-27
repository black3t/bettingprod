export declare class PlayerService {
    /**
     * Ottieni stato completo del giocatore
     * Bibbia: ritorna balance, currency, limits
     */
    getPlayerStatus(playerId: string): Promise<{
        playerId: string;
        currency: any;
        balance: string;
        limits: {
            minBet: string;
            maxBet: string;
            maxWin: string;
        };
    }>;
    /**
     * Ottieni limiti per il giocatore
     * Bibbia §0.7: DEFAULT min_bet 0.10, max_bet 100.00, max_win 3000.00
     */
    getLimitsFor(playerId: string): Promise<{
        minBetMinor: number;
        maxBetMinor: number;
        maxWinMinor: number;
    }>;
    /**
     * Ottieni currency del giocatore
     */
    currencyFor(playerId: string): Promise<string>;
}
//# sourceMappingURL=PlayerService.d.ts.map