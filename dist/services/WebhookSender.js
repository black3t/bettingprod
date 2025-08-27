"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookSender = exports.WebhookSender = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../utils/logger");
/**
 * Service per INVIARE webhook dal Casino all'RGS
 * Bibbia: Il casino deve notificare RGS quando player escluso o balance cambia
 */
class WebhookSender {
    config = {
        maxRetries: 5,
        initialDelay: 3000, // 3s
        maxDelay: 30000, // 30s max
        timeout: 2000 // 2s timeout HTTP
    };
    /**
     * Invia webhook playerExcluded all'RGS
     * Bible riga 389: POST /rgs/playerExcluded { playerId, reason, ts }
     */
    async sendPlayerExcluded(playerId, reason, until) {
        const url = process.env.WH_PLAYER_EXCLUDED || 'http://localhost:4001/rgs/playerExcluded';
        const payload = {
            playerId,
            reason,
            ts: new Date().toISOString()
        };
        if (until) {
            payload.until = until.toISOString();
        }
        await this.sendWithRetry(url, payload, 'playerExcluded');
    }
    /**
     * Invia webhook balanceChanged all'RGS
     * Bible riga 390: POST /rgs/balanceChanged { playerId, newBalance, ts }
     */
    async sendBalanceChanged(playerId, newBalance, currency = 'EUR') {
        const url = process.env.WH_BALANCE_CHANGED || 'http://localhost:4001/rgs/balanceChanged';
        const payload = {
            playerId,
            newBalance: newBalance, // Bible riga 390: campo deve essere "newBalance"
            currency,
            timestamp: new Date().toISOString()
        };
        await this.sendWithRetry(url, payload, 'balanceChanged');
    }
    /**
     * Invia webhook con retry e backoff esponenziale
     * Bibbia: 5 tentativi, backoff con jitter ±50%
     */
    async sendWithRetry(url, payload, webhookType) {
        let lastError;
        for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
            try {
                logger_1.logger.info(`Sending ${webhookType} webhook`, {
                    attempt,
                    playerId: payload.playerId,
                    url
                });
                const response = await axios_1.default.post(url, payload, {
                    timeout: this.config.timeout,
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Correlation-Id': `wh-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
                    }
                });
                if (response.status >= 200 && response.status < 300) {
                    logger_1.logger.info(`${webhookType} webhook sent successfully`, {
                        playerId: payload.playerId,
                        status: response.status
                    });
                    return;
                }
                // 4xx errors - don't retry
                if (response.status >= 400 && response.status < 500) {
                    logger_1.logger.error(`${webhookType} webhook rejected`, {
                        playerId: payload.playerId,
                        status: response.status,
                        error: 'Client error - not retrying'
                    });
                    throw this.createError('RW-CAS-007', response.status);
                }
            }
            catch (error) {
                lastError = error;
                // Don't retry on 4xx
                if (error.response?.status >= 400 && error.response?.status < 500) {
                    throw this.createError('RW-CAS-007', error.response.status);
                }
                // Timeout error
                if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
                    logger_1.logger.warn(`${webhookType} webhook timeout`, {
                        attempt,
                        playerId: payload.playerId
                    });
                    lastError = this.createError('RW-RGS-008', 504); // Timeout code
                }
                // Network error
                if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
                    logger_1.logger.warn(`${webhookType} webhook network error`, {
                        attempt,
                        playerId: payload.playerId,
                        error: error.code
                    });
                    lastError = this.createError('RW-NET-009', 503); // Network busy
                }
                // Calculate backoff with jitter
                if (attempt < this.config.maxRetries) {
                    const baseDelay = Math.min(this.config.initialDelay * Math.pow(2, attempt - 1), this.config.maxDelay);
                    const jitter = baseDelay * (0.5 + Math.random() * 0.5); // ±50% jitter
                    const delay = Math.round(jitter);
                    logger_1.logger.info(`Retrying ${webhookType} webhook in ${delay}ms`, {
                        attempt,
                        playerId: payload.playerId,
                        nextAttempt: attempt + 1
                    });
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        // All retries exhausted
        logger_1.logger.error(`${webhookType} webhook failed after ${this.config.maxRetries} attempts`, {
            playerId: payload.playerId,
            lastError: lastError?.message
        });
        throw lastError || this.createError('RW-CAS-007', 503);
    }
    createError(code, statusCode) {
        const error = new Error(`Webhook failed: ${code}`);
        error.code = code;
        error.statusCode = statusCode;
        return error;
    }
}
exports.WebhookSender = WebhookSender;
// Singleton instance
exports.webhookSender = new WebhookSender();
//# sourceMappingURL=WebhookSender.js.map