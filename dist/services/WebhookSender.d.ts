/**
 * Service per INVIARE webhook dal Casino all'RGS
 * Bibbia: Il casino deve notificare RGS quando player escluso o balance cambia
 */
export declare class WebhookSender {
    private readonly config;
    /**
     * Invia webhook playerExcluded all'RGS
     * Bible riga 389: POST /rgs/playerExcluded { playerId, reason, ts }
     */
    sendPlayerExcluded(playerId: string, reason: string, until?: Date): Promise<void>;
    /**
     * Invia webhook balanceChanged all'RGS
     * Bible riga 390: POST /rgs/balanceChanged { playerId, newBalance, ts }
     */
    sendBalanceChanged(playerId: string, newBalance: string, currency?: string): Promise<void>;
    /**
     * Invia webhook con retry e backoff esponenziale
     * Bibbia: 5 tentativi, backoff con jitter ±50%
     */
    private sendWithRetry;
    private createError;
}
export declare const webhookSender: WebhookSender;
//# sourceMappingURL=WebhookSender.d.ts.map