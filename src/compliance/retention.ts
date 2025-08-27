/**
 * Retention Policy for Casino
 * Bible riga 723-724: "AML: retention min 5 anni su record AML/ledger"
 * Bible riga 725: "GDPR: anonimizzazione post-retention"
 */

import { query } from '../config/database';
import { logger } from '../utils/logger';
import cron from 'node-cron';

export class RetentionPolicy {
  private static instance: RetentionPolicy;
  
  // Retention periods (in days) - Bible riga 723-724
  private readonly AML_RETENTION = 1825; // 5 anni per AML (Bible requirement)
  private readonly TRANSACTION_RETENTION = 2555; // 7 anni per transazioni (più conservativo)
  private readonly LOG_RETENTION = 365; // 1 anno per logs operativi
  private readonly IDEMPOTENCY_RETENTION = 2; // 48 ore per idempotency keys
  
  private constructor() {
    this.scheduleCleanup();
  }
  
  static getInstance(): RetentionPolicy {
    if (!RetentionPolicy.instance) {
      RetentionPolicy.instance = new RetentionPolicy();
    }
    return RetentionPolicy.instance;
  }
  
  /**
   * Schedule daily cleanup at 3 AM
   */
  private scheduleCleanup() {
    // Run every day at 3:00 AM
    cron.schedule('0 3 * * *', async () => {
      logger.info('Starting retention policy cleanup');
      await this.cleanupOldRecords();
    });
    
    logger.info('Retention policy scheduled');
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
      
      const idempResult = await query(idempotencyQuery);
      logger.info(`Cleaned up ${idempResult.rowCount || 0} expired idempotency keys`);
      
      // Cleanup old operational logs (1 year)
      const logsQuery = USE_SQLITE
        ? "DELETE FROM operation_logs WHERE created_at < datetime('now', '-365 days')"
        : "DELETE FROM operation_logs WHERE created_at < NOW() - INTERVAL '365 days'";
      
      const logsResult = await query(logsQuery);
      logger.info(`Cleaned up ${logsResult.rowCount || 0} old operational logs`);
      
      // GDPR anonymization (Bible riga 725)
      await this.anonymizeOldData();
      
      // Note: Non eliminiamo MAI le transazioni wallet (min 5 anni AML, 7 anni conservativo)
      // Solo archiviazione dopo 7 anni (non implementata nel mock)
      
    } catch (error: any) {
      logger.error('Retention policy cleanup failed', {
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
    
    const result = await query(archiveQuery);
    const count = result.rows[0]?.count || 0;
    
    if (count > 0) {
      logger.warn(`${count} transactions ready for archival (>7 years old)`);
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
      
      const anonResult = await query(anonQuery);
      
      if (anonResult.rowCount && anonResult.rowCount > 0) {
        logger.info(`Anonymized ${anonResult.rowCount} user records for GDPR compliance`);
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
      
      await query(txAnonQuery);
      
    } catch (error: any) {
      logger.error('GDPR anonymization failed', {
        error: error.message
      });
    }
  }
}

// Initialize retention policy
export const retentionPolicy = RetentionPolicy.getInstance();