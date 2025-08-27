"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookForwarder = exports.WebhookForwarder = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../utils/logger");
class WebhookForwarder {
    /**
     * Costruisce l'URL di destinazione per il webhook
     */
    static buildTargetUrl(kind) {
        const baseUrl = process.env.ADMIN_WEBHOOK_URL || 'https://internal-admin-webhooks.local';
        return `${baseUrl}/${kind}`;
    }
    /**
     * Inoltra il webhook al sistema admin interno
     * Non fa retry/backoff - lascia propagare gli errori per i test
     */
    static async forward(kind, payload, opts) {
        const url = this.buildTargetUrl(kind);
        const headers = {
            'Authorization': `Bearer ${process.env.INTERNAL_WEBHOOK_KEY || 'casino_internal_key'}`,
            'X-Correlation-Id': opts?.correlationId || '<none>',
            'Content-Type': 'application/json'
        };
        logger_1.logger.info(`Forwarding webhook ${kind}`, { url, correlationId: opts?.correlationId });
        // No try/catch - lascia propagare l'errore
        await axios_1.default.post(url, payload, { headers, timeout: 500 });
    }
}
exports.WebhookForwarder = WebhookForwarder;
// Export singleton instance for convenience
exports.webhookForwarder = WebhookForwarder;
//# sourceMappingURL=WebhookForwarder.js.map