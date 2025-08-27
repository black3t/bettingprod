"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.responsibleGamingService = exports.ResponsibleGamingService = void 0;
const database_1 = require("../config/database");
const logger_1 = require("../utils/logger");
const errorCodes_1 = require("../utils/errorCodes");
const WebhookSender_1 = require("./WebhookSender");
class ResponsibleGamingService {
    REALITY_CHECK_MINUTES = parseInt(process.env.REALITY_CHECK_MINUTES || '5');
    /**
     * Self-exclude player
     * Bible riga 717: "Self-exclusion immediate upon reception"
     */
    async selfExclude(playerId, until) {
        await (0, database_1.transaction)(async (client) => {
            // Check if RG record exists
            const existing = await client.query('SELECT * FROM responsible_gaming WHERE player_id = $1', [playerId]);
            if (existing.rows.length === 0) {
                // Create new RG record
                await client.query(`INSERT INTO responsible_gaming 
           (player_id, self_excluded, self_excluded_until, cooling_off, cooling_off_until, reality_check_ack)
           VALUES ($1, $2, $3, $4, $5, $6)`, [playerId, true, until, false, null, true]);
            }
            else {
                // Update existing
                await client.query(`UPDATE responsible_gaming 
           SET self_excluded = $2, self_excluded_until = $3
           WHERE player_id = $1`, [playerId, true, until]);
            }
            // Log exclusion
            logger_1.logger.info('Player self-excluded', {
                playerId,
                until: until.toISOString()
            });
        });
        // Send webhook
        try {
            await WebhookSender_1.webhookSender.sendPlayerExcluded(playerId, 'SELF_EXCLUSION', until);
        }
        catch (error) {
            logger_1.logger.warn('Failed to send playerExcluded webhook', { error });
        }
    }
    /**
     * Set cooling-off period
     * Bible riga 717: "cooling-off aumento limiti"
     */
    async setCoolingOff(playerId, until) {
        await (0, database_1.transaction)(async (client) => {
            const existing = await client.query('SELECT * FROM responsible_gaming WHERE player_id = $1', [playerId]);
            if (existing.rows.length === 0) {
                await client.query(`INSERT INTO responsible_gaming 
           (player_id, self_excluded, self_excluded_until, cooling_off, cooling_off_until, reality_check_ack)
           VALUES ($1, $2, $3, $4, $5, $6)`, [playerId, false, null, true, until, true]);
            }
            else {
                await client.query(`UPDATE responsible_gaming 
           SET cooling_off = $2, cooling_off_until = $3
           WHERE player_id = $1`, [playerId, true, until]);
            }
            logger_1.logger.info('Player cooling-off set', {
                playerId,
                until: until.toISOString()
            });
        });
    }
    /**
     * Check if player can perform operation
     * Bible riga 719-720: RW-RG-001/002 for blocks
     */
    async checkRestrictions(playerId) {
        const result = await (0, database_1.query)('SELECT * FROM responsible_gaming WHERE player_id = $1', [playerId]);
        if (result.rows.length === 0) {
            return { allowed: true };
        }
        const rg = result.rows[0];
        const now = new Date();
        // Check self-exclusion
        if (rg.self_excluded) {
            const until = new Date(rg.self_excluded_until);
            if (until > now) {
                return {
                    allowed: false,
                    reason: errorCodes_1.CasinoErrorCodes.SELF_EXCLUSION_ACTIVE // RW-RG-001
                };
            }
            else {
                // Exclusion expired, clear it
                await (0, database_1.query)('UPDATE responsible_gaming SET self_excluded = $2, self_excluded_until = NULL WHERE player_id = $1', [playerId, false]);
            }
        }
        // Check cooling-off
        if (rg.cooling_off) {
            const until = new Date(rg.cooling_off_until);
            if (until > now) {
                return {
                    allowed: false,
                    reason: errorCodes_1.CasinoErrorCodes.COOLING_OFF_ACTIVE // RW-RG-002
                };
            }
            else {
                // Cooling-off expired, clear it
                await (0, database_1.query)('UPDATE responsible_gaming SET cooling_off = $2, cooling_off_until = NULL WHERE player_id = $1', [playerId, false]);
            }
        }
        // Check reality check
        // Bible riga 715-716: "Se l'ACK non viene ricevuto entro un intervallo configurabile (default 5 minuti)"
        if (!rg.reality_check_ack && rg.last_reality_check) {
            const lastCheck = new Date(rg.last_reality_check);
            const minutesSince = (now.getTime() - lastCheck.getTime()) / (1000 * 60);
            if (minutesSince > this.REALITY_CHECK_MINUTES) {
                return {
                    allowed: false,
                    reason: errorCodes_1.CasinoErrorCodes.SELF_EXCLUSION_ACTIVE // Use RG-001 for reality check block
                };
            }
        }
        return { allowed: true };
    }
    /**
     * Send reality check to player
     * Bible riga 714-715: "reality check configurabile + ACK obbligatorio"
     */
    async sendRealityCheck(playerId) {
        await (0, database_1.query)(`UPDATE responsible_gaming 
       SET last_reality_check = $2, reality_check_ack = $3
       WHERE player_id = $1`, [playerId, new Date(), false]);
        logger_1.logger.info('Reality check sent', { playerId });
    }
    /**
     * Acknowledge reality check
     */
    async acknowledgeRealityCheck(playerId) {
        await (0, database_1.query)('UPDATE responsible_gaming SET reality_check_ack = $2 WHERE player_id = $1', [playerId, true]);
        logger_1.logger.info('Reality check acknowledged', { playerId });
    }
    /**
     * Get RG status for player
     */
    async getStatus(playerId) {
        const result = await (0, database_1.query)('SELECT * FROM responsible_gaming WHERE player_id = $1', [playerId]);
        if (result.rows.length === 0) {
            return {
                playerId,
                selfExcluded: false,
                coolingOff: false,
                realityCheckAcknowledged: true
            };
        }
        const rg = result.rows[0];
        return {
            playerId,
            selfExcluded: rg.self_excluded,
            selfExcludedUntil: rg.self_excluded_until ? new Date(rg.self_excluded_until) : undefined,
            coolingOff: rg.cooling_off,
            coolingOffUntil: rg.cooling_off_until ? new Date(rg.cooling_off_until) : undefined,
            lastRealityCheck: rg.last_reality_check ? new Date(rg.last_reality_check) : undefined,
            realityCheckAcknowledged: rg.reality_check_ack
        };
    }
}
exports.ResponsibleGamingService = ResponsibleGamingService;
exports.responsibleGamingService = new ResponsibleGamingService();
//# sourceMappingURL=ResponsibleGamingService.js.map