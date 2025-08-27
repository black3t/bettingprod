/**
 * Retention Policy for Casino
 * Bible riga 723-724: "AML: retention min 5 anni su record AML/ledger"
 * Bible riga 725: "GDPR: anonimizzazione post-retention"
 */
export declare class RetentionPolicy {
    private static instance;
    private readonly AML_RETENTION;
    private readonly TRANSACTION_RETENTION;
    private readonly LOG_RETENTION;
    private readonly IDEMPOTENCY_RETENTION;
    private constructor();
    static getInstance(): RetentionPolicy;
    /**
     * Schedule daily cleanup at 3 AM
     */
    private scheduleCleanup;
    /**
     * Cleanup old records based on retention policy
     */
    cleanupOldRecords(): Promise<void>;
    /**
     * Manual trigger for cleanup (for testing)
     */
    triggerCleanup(): Promise<void>;
    /**
     * Archive old transactions (dopo 7 anni)
     * Nel mock solo log, in prod sposti su cold storage
     */
    archiveOldTransactions(): Promise<void>;
    /**
     * GDPR Anonymization
     * Bible riga 725: "GDPR: anonimizzazione post-retention"
     */
    anonymizeOldData(): Promise<void>;
}
export declare const retentionPolicy: RetentionPolicy;
//# sourceMappingURL=retention.d.ts.map