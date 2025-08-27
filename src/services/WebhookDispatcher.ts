import axios from 'axios';
import { query, transaction } from '../config/database';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export class WebhookDispatcher {
  /**
   * Map webhook type to target URL
   */
  static mapTypeToUrl(type: string): string {
    const baseUrl = process.env.ADMIN_WEBHOOK_BASE || 'https://internal-admin-webhooks.local';
    switch (type) {
      case 'balanceChanged':
        return `${baseUrl}/balanceChanged`;
      case 'playerExcluded':
        return `${baseUrl}/playerExcluded`;
      default:
        throw new Error(`Unknown webhook type: ${type}`);
    }
  }

  /**
   * Claim a batch of webhooks ready to send
   */
  static async claimBatch(limit: number = 10): Promise<any[]> {
    const USE_SQLITE = process.env.USE_SQLITE === 'true';
    
    // Get ready webhooks (PENDING or FAILED with next_attempt_at passed)
    const query_str = USE_SQLITE
      ? `SELECT * FROM webhook_outbox 
         WHERE status IN ('PENDING', 'FAILED')
         AND (next_attempt_at IS NULL OR next_attempt_at <= datetime('now'))
         ORDER BY created_at ASC
         LIMIT $1`
      : `SELECT * FROM webhook_outbox 
         WHERE status IN ('PENDING', 'FAILED')
         AND (next_attempt_at IS NULL OR next_attempt_at <= NOW())
         ORDER BY created_at ASC
         LIMIT $1`;
    
    const result = await query(query_str, [limit]);
    return result.rows;
  }

  /**
   * Send one webhook
   */
  static async sendOne(row: any): Promise<void> {
    const url = this.mapTypeToUrl(row.type);
    const payload = JSON.parse(row.payload);
    
    // Extract correlation ID if available
    const correlationId = payload.correlationId || uuidv4();
    
    const headers = {
      'X-Correlation-Id': correlationId,
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.INTERNAL_WEBHOOK_KEY || 'casino_internal_key'}`
    };

    try {
      // Attempt to send webhook
      await axios.post(url, payload, { headers, timeout: 5000 });
      
      // Mark as delivered
      await query(
        `UPDATE webhook_outbox SET status = $1 WHERE id = $2`,
        ['SENT', row.id]
      );
      
      logger.info('Webhook sent successfully', { type: row.type, id: row.id });
    } catch (error: any) {
      // Calculate backoff with jitter
      const attempts = (row.attempts || 0) + 1;
      const baseBackoff = Math.min(Math.pow(2, attempts - 1), 30); // 1s, 2s, 4s, 8s, 16s, max 30s
      const jitter = Math.random() * 1000; // 0-1s jitter
      const backoffMs = (baseBackoff * 1000) + jitter;
      
      const USE_SQLITE = process.env.USE_SQLITE === 'true';
      const nextAttempt = USE_SQLITE
        ? `datetime('now', '+${Math.ceil(backoffMs / 1000)} seconds')`
        : `NOW() + INTERVAL '${Math.ceil(backoffMs / 1000)} seconds'`;
      
      // Update with failure info
      const updateQuery = USE_SQLITE
        ? `UPDATE webhook_outbox 
           SET status = $1, attempts = $2, 
               next_attempt_at = datetime('now', '+${Math.ceil(backoffMs / 1000)} seconds'),
               last_error = $3
           WHERE id = $4`
        : `UPDATE webhook_outbox 
           SET status = $1, attempts = $2, 
               next_attempt_at = NOW() + INTERVAL '${Math.ceil(backoffMs / 1000)} seconds',
               last_error = $3
           WHERE id = $4`;
      
      await query(updateQuery, [
        'FAILED',
        attempts,
        error.message || 'Unknown error',
        row.id
      ]);
      
      logger.warn('Webhook send failed, scheduled retry', { 
        type: row.type, 
        id: row.id, 
        attempts,
        nextRetryIn: `${Math.ceil(backoffMs / 1000)}s`
      });
    }
  }

  /**
   * Run one batch processing cycle
   */
  static async runOnce(): Promise<void> {
    const USE_SQLITE = process.env.USE_SQLITE === 'true';
    
    if (USE_SQLITE) {
      // Use transaction for SQLite with BEGIN IMMEDIATE
      const { transactionSQLite } = require('../config/database-sqlite');
      await transactionSQLite(async (client: any) => {
        // SQLite: process in transaction to avoid concurrency
        const batch = await this.claimBatch(10);
        
        // Process each webhook serially
        for (const row of batch) {
          await this.sendOne(row);
        }
      });
    } else {
      // PostgreSQL: no transaction needed for this
      const batch = await this.claimBatch(10);
      
      // Process each webhook serially
      for (const row of batch) {
        await this.sendOne(row);
      }
    }
  }
}