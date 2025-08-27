interface PlayerExcludedRequest {
    playerId: string;
    reason: string;
    ts: string;
    correlationId: string;
}
interface BalanceChangedRequest {
    playerId: string;
    newBalance: string;
    ts: string;
    correlationId: string;
}
export declare class WebhookService {
    /**
     * Gestisce notifica di giocatore escluso
     * Bibbia §4.5: Casino riceve da RGS quando un giocatore viene escluso
     */
    handlePlayerExcluded(request: PlayerExcludedRequest): Promise<void>;
    /**
     * Gestisce notifica di cambio balance
     * Bibbia §4.5: Casino riceve da RGS quando il balance cambia esternamente
     */
    handleBalanceChanged(request: BalanceChangedRequest): Promise<void>;
}
export {};
//# sourceMappingURL=WebhookService.d.ts.map