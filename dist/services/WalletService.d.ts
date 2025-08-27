interface WalletOperation {
    playerId: string;
    amount: string;
    currency: string;
    idempotencyKey: string;
    correlationId: string;
}
interface WalletResponse {
    status: 'APPROVED' | 'REJECTED';
    reason?: string;
    newBalance?: string;
}
export declare class WalletService {
    private readonly IDEMPOTENCY_WINDOW;
    private readonly playerService;
    /**
     * Helper per formattare importi sempre come stringa "xx.yy"
     */
    private toAmountString2;
    /**
     * Canonicalizza la risposta per garantire formato identico in replay
     * Bible r.144: replay deve essere byte-for-byte identico
     */
    private canonicalizeResponse;
    /**
     * Addebita fondi dal wallet (per scommesse)
     * Bibbia §4.5: amount deve essere stringa decimale
     */
    debit(operation: WalletOperation): Promise<WalletResponse>;
    /**
     * Accredita fondi al wallet (per vincite)
     * Bibbia §4.5: amount deve essere stringa decimale
     */
    credit(operation: WalletOperation): Promise<WalletResponse>;
    cancelTransaction(playerId: string, transactionId: string, amount: string, reason: string, correlationId: string, idempotencyKey: string): Promise<WalletResponse>;
    private checkIdempotencyTx;
    private checkIdempotency;
    private storeIdempotency;
    private createError;
}
export {};
//# sourceMappingURL=WalletService.d.ts.map