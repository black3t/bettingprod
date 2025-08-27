"use strict";
/**
 * Retention Policy for Casino
 * Bible riga 723-724: "AML: retention min 5 anni su record AML/ledger"
 * Bible riga 725: "GDPR: anonimizzazione post-retention"
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.retentionPolicy = exports.RetentionPolicy = void 0;
const database_1 = require("../config/database");
const logger_1 = require("../utils/logger");
const node_cron_1 = __importDefault(require("node-cron"));
class RetentionPolicy {
    static instance;
    // Retention periods (in days) - Bible riga 723-724
    AML_RETENTION = 1825; // 5 anni per AML (Bible requirement)
    TRANSACTION_RETENTION = 2555; // 7 anni per transazioni (più conservativo)
    LOG_RETENTION = 365; // 1 anno per logs operativi
    IDEMPOTENCY_RETENTION = 2; // 48 ore per idempotency keys
    constructor() {
        this.scheduleCleanup();
    }
    static getInstance() {
        if (!RetentionPolicy.instance) {
            RetentionPolicy.instance = new RetentionPolicy();
        }
        return RetentionPolicy.instance;
    }
    /**
     * Schedule daily cleanup at 3 AM
     */
    scheduleCleanup() {
        // Run every day at 3:00 AM
        node_cron_1.default.schedule('0 3 * * *', async () => {
            logger_1.logger.info('Starting retention policy cleanup');
            await this.cleanupOldRecords();
        });
        logger_1.logger.info('Retention policy scheduled');
    }
    /**
     * Cleanup old records based on retention policy
     */
    async cleanupOldRecords() {
        const USE_SQLITE = process.env.USE_SQLITE === 'true';
        try {
            // Cleanup old idempotency keys (48 hours)
            const idempotencyQuery = USE_SQLITE
                ? "DELETE FROM idempotency_keys WHERE expires_at < datetime('now')"
                : "DELETE FROM idempotency_keys WHERE expires_at < NOW()";
            const idempResult = await (0, database_1.query)(idempotencyQuery);
            logger_1.logger.info(`Cleaned up ${idempResult.rowCount || 0} expired idempotency keys`);
            // Cleanup old operational logs (1 year)
            const logsQuery = USE_SQLITE
                ? "DELETE FROM operation_logs WHERE created_at < datetime('now', '-365 days')"
                : "DELETE FROM operation_logs WHERE created_at < NOW() - INTERVAL '365 days'";
            const logsResult = await (0, database_1.query)(logsQuery);
            logger_1.logger.info(`Cleaned up ${logsResult.rowCount || 0} old operational logs`);
            // GDPR anonymization (Bible riga 725)
            await this.anonymizeOldData();
            // Note: Non eliminiamo MAI le transazioni wallet (min 5 anni AML, 7 anni conservativo)
            // Solo archiviazione dopo 7 anni (non implementata nel mock)
        }
        catch (error) {
            logger_1.logger.error('Retention policy cleanup failed', {
                error: error.message
            });
        }
    }
    /**
     * Manual trigger for cleanup (for testing)
     */
    async triggerCleanup() {
        await this.cleanupOldRecords();
    }
    /**
     * Archive old transactions (dopo 7 anni)
     * Nel mock solo log, in prod sposti su cold storage
     */
    async archiveOldTransactions() {
        const USE_SQLITE = process.env.USE_SQLITE === 'true';
        const archiveQuery = USE_SQLITE
            ? "SELECT COUNT(*) as count FROM wallet_transactions WHERE created_at < datetime('now', '-2555 days')"
            : "SELECT COUNT(*) as count FROM wallet_transactions WHERE created_at < NOW() - INTERVAL '2555 days'";
        const result = await (0, database_1.query)(archiveQuery);
        const count = result.rows[0]?.count || 0;
        if (count > 0) {
            logger_1.logger.warn(`${count} transactions ready for archival (>7 years old)`);
            // In produzione qui faremmo l'export su S3/cold storage
        }
    }
    /**
     * GDPR Anonymization
     * Bible riga 725: "GDPR: anonimizzazione post-retention"
     */
    async anonymizeOldData() {
        const USE_SQLITE = process.env.USE_SQLITE === 'true';
        try {
            // Anonymize old user data (dopo retention AML)
            const anonQuery = USE_SQLITE
                ? `UPDATE users 
           SET email = 'anon_' || id || '@deleted.com',
               first_name = 'ANON',
               last_name = 'USER',
               date_of_birth = NULL
           WHERE created_at < datetime('now', '-${this.AML_RETENTION} days')
           AND email NOT LIKE 'anon_%'`
                : `UPDATE users 
           SET email = CONCAT('anon_', id, '@deleted.com'),
               first_name = 'ANON',
               last_name = 'USER',
               date_of_birth = NULL
           WHERE created_at < NOW() - INTERVAL '${this.AML_RETENTION} days'
           AND email NOT LIKE 'anon_%'`;
            const anonResult = await (0, database_1.query)(anonQuery);
            if (anonResult.rowCount && anonResult.rowCount > 0) {
                logger_1.logger.info(`Anonymized ${anonResult.rowCount} user records for GDPR compliance`);
            }
            // Keep transaction amounts but anonymize metadata
            const txAnonQuery = USE_SQLITE
                ? `UPDATE wallet_transactions 
           SET metadata = '{"anonymized": true}'
           WHERE created_at < datetime('now', '-${this.AML_RETENTION} days')
           AND metadata NOT LIKE '%anonymized%'`
                : `UPDATE wallet_transactions 
           SET metadata = '{"anonymized": true}'::jsonb
           WHERE created_at < NOW() - INTERVAL '${this.AML_RETENTION} days'
           AND metadata::text NOT LIKE '%anonymized%'`;
            await (0, database_1.query)(txAnonQuery);
        }
        catch (error) {
            logger_1.logger.error('GDPR anonymization failed', {
                error: error.message
            });
        }
    }
}
exports.RetentionPolicy = RetentionPolicy;
// Initialize retention policy
exports.retentionPolicy = RetentionPolicy.getInstance();
//# sourceMappingURL=retention.js.map