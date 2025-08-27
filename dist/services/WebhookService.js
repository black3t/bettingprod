"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookService = void 0;
const database_1 = require("../config/database");
const logger_1 = require("../utils/logger");
const uuid_1 = require("uuid");
class WebhookService {
    /**
     * Gestisce notifica di giocatore escluso
     * Bibbia §4.5: Casino riceve da RGS quando un giocatore viene escluso
     */
    async handlePlayerExcluded(request) {
        try {
            // Inserisci in outbox invece di chiamate esterne
            await (0, database_1.query)(`INSERT INTO webhook_outbox (id, type, payload, headers, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`, [
                (0, uuid_1.v4)(),
                'playerExcluded',
                JSON.stringify({ playerId: request.playerId, reason: request.reason, ts: request.ts }),
                JSON.stringify({ 'X-Correlation-Id': request.correlationId }),
                'pending',
                new Date().toISOString()
            ]);
            logger_1.logger.info('Player excluded webhook queued', {
                playerId: request.playerId,
                reason: request.reason,
                correlationId: request.correlationId
            });
        }
        catch (error) {
            logger_1.logger.error('Player excluded webhook failed', {
                error: error.message,
                playerId: request.playerId
            });
            // Non rilanciare - ritorna sempre 200/202
        }
    }
    /**
     * Gestisce notifica di cambio balance
     * Bibbia §4.5: Casino riceve da RGS quando il balance cambia esternamente
     */
    async handleBalanceChanged(request) {
        try {
            // Inserisci in outbox invece di chiamate esterne
            await (0, database_1.query)(`INSERT INTO webhook_outbox (id, type, payload, headers, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`, [
                (0, uuid_1.v4)(),
                'balanceChanged',
                JSON.stringify({ playerId: request.playerId, newBalance: request.newBalance, ts: request.ts }),
                JSON.stringify({ 'X-Correlation-Id': request.correlationId }),
                'pending',
                new Date().toISOString()
            ]);
            logger_1.logger.info('Balance changed webhook queued', {
                playerId: request.playerId,
                newBalance: request.newBalance,
                correlationId: request.correlationId
            });
        }
        catch (error) {
            logger_1.logger.error('Balance changed webhook failed', {
                error: error.message,
                playerId: request.playerId
            });
            // Non rilanciare - ritorna sempre 200/202
        }
    }
}
exports.WebhookService = WebhookService;
//# sourceMappingURL=WebhookService.js.map