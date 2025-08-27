export declare class WebhookDispatcher {
    /**
     * Map webhook type to target URL
     */
    static mapTypeToUrl(type: string): string;
    /**
     * Claim a batch of webhooks ready to send
     */
    static claimBatch(limit?: number): Promise<any[]>;
    /**
     * Send one webhook
     */
    static sendOne(row: any): Promise<void>;
    /**
     * Run one batch processing cycle
     */
    static runOnce(): Promise<void>;
}
//# sourceMappingURL=WebhookDispatcher.d.ts.map