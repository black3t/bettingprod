interface LimitsCheckRequest {
    playerId: string;
    stake: string;
    correlationId: string;
}
interface LimitsCheckResponse {
    ok: boolean;
    reason?: string;
}
export declare class LimitsService {
    /**
     * Verifica se il giocatore può piazzare la scommessa
     * Bibbia §4.5: POST /limits/check { playerId, stake } → { ok:true|false, reason? }
     */
    checkLimits(request: LimitsCheckRequest): Promise<LimitsCheckResponse>;
}
export {};
//# sourceMappingURL=LimitsService.d.ts.map