interface RGStatus {
    playerId: string;
    selfExcluded: boolean;
    selfExcludedUntil?: Date;
    coolingOff: boolean;
    coolingOffUntil?: Date;
    lastRealityCheck?: Date;
    realityCheckAcknowledged: boolean;
}
export declare class ResponsibleGamingService {
    private readonly REALITY_CHECK_MINUTES;
    /**
     * Self-exclude player
     * Bible riga 717: "Self-exclusion immediate upon reception"
     */
    selfExclude(playerId: string, until: Date): Promise<void>;
    /**
     * Set cooling-off period
     * Bible riga 717: "cooling-off aumento limiti"
     */
    setCoolingOff(playerId: string, until: Date): Promise<void>;
    /**
     * Check if player can perform operation
     * Bible riga 719-720: RW-RG-001/002 for blocks
     */
    checkRestrictions(playerId: string): Promise<{
        allowed: boolean;
        reason?: string;
    }>;
    /**
     * Send reality check to player
     * Bible riga 714-715: "reality check configurabile + ACK obbligatorio"
     */
    sendRealityCheck(playerId: string): Promise<void>;
    /**
     * Acknowledge reality check
     */
    acknowledgeRealityCheck(playerId: string): Promise<void>;
    /**
     * Get RG status for player
     */
    getStatus(playerId: string): Promise<RGStatus>;
}
export declare const responsibleGamingService: ResponsibleGamingService;
export {};
//# sourceMappingURL=ResponsibleGamingService.d.ts.map