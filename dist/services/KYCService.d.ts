export declare enum KYCStatus {
    NONE = "NONE",
    PARTIAL = "PARTIAL",
    FULL = "FULL"
}
interface KYCInfo {
    playerId: string;
    status: KYCStatus;
    verifiedAt?: Date;
    documents?: string[];
}
/**
 * KYC Service
 * Bible riga 691: "Wallet/limits/kyc/exclusions"
 */
export declare class KYCService {
    /**
     * Get KYC status for player
     */
    getKYCStatus(playerId: string): Promise<KYCInfo>;
    /**
     * Update KYC status
     */
    updateKYCStatus(playerId: string, status: KYCStatus): Promise<void>;
    /**
     * Check if operation allowed based on KYC
     */
    checkKYCLimits(playerId: string, amount: number): Promise<{
        allowed: boolean;
        reason?: string;
    }>;
    /**
     * Get exclusions for player (combines KYC + RG)
     */
    getExclusions(playerId: string): Promise<any>;
}
export declare const kycService: KYCService;
export {};
//# sourceMappingURL=KYCService.d.ts.map