import axios from 'axios';
import { logger } from '../utils/logger';

export class WebhookForwarder {
  /**
   * Costruisce l'URL di destinazione per il webhook
   */
  static buildTargetUrl(kind: 'playerExcluded' | 'balanceChanged'): string {
    const baseUrl = process.env.ADMIN_WEBHOOK_URL || 'https://internal-admin-webhooks.local';
    return `${baseUrl}/${kind}`;
  }

  /**
   * Inoltra il webhook al sistema admin interno
   * Non fa retry/backoff - lascia propagare gli errori per i test
   */
  static async forward(
    kind: 'playerExcluded' | 'balanceChanged',
    payload: any,
    opts?: { correlationId?: string }
  ): Promise<void> {
    const url = this.buildTargetUrl(kind);
    
    const headers = {
      'Authorization': `Bearer ${process.env.INTERNAL_WEBHOOK_KEY || 'casino_internal_key'}`,
      'X-Correlation-Id': opts?.correlationId || '<none>',
      'Content-Type': 'application/json'
    };

    logger.info(`Forwarding webhook ${kind}`, { url, correlationId: opts?.correlationId });
    
    // No try/catch - lascia propagare l'errore
    await axios.post(url, payload, { headers, timeout: 500 });
  }
}

// Export singleton instance for convenience
export const webhookForwarder = WebhookForwarder;