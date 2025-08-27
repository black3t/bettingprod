export declare class WebhookForwarder {
    /**
     * Costruisce l'URL di destinazione per il webhook
     */
    static buildTargetUrl(kind: 'playerExcluded' | 'balanceChanged'): string;
    /**
     * Inoltra il webhook al sistema admin interno
     * Non fa retry/backoff - lascia propagare gli errori per i test
     */
    static forward(kind: 'playerExcluded' | 'balanceChanged', payload: any, opts?: {
        correlationId?: string;
    }): Promise<void>;
}
export declare const webhookForwarder: typeof WebhookForwarder;
//# sourceMappingURL=WebhookForwarder.d.ts.map