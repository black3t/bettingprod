"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameService = void 0;
const axios_1 = __importDefault(require("axios"));
const uuid_1 = require("uuid");
const database_1 = require("../config/database");
const logger_1 = require("../utils/logger");
class GameService {
    RGS_URL = process.env.RGS_URL || 'http://localhost:4000/api/v1';
    OPERATOR_KEY = process.env.OPERATOR_KEY || 'op_test_key_2024';
    GAME_BASE_URL = process.env.GAME_BASE_URL || 'http://localhost:3004';
    async getGames(category) {
        let queryText = 'SELECT * FROM games WHERE is_active = true';
        const params = [];
        if (category) {
            queryText += ' AND category = $1';
            params.push(category);
        }
        queryText += ' ORDER BY name ASC';
        const result = await (0, database_1.query)(queryText, params);
        return result.rows;
    }
    async getGame(gameCode) {
        const result = await (0, database_1.query)('SELECT * FROM games WHERE code = $1 AND is_active = true', [gameCode]);
        return result.rows.length > 0 ? result.rows[0] : null;
    }
    async launchGame(userId, request) {
        try {
            // Get game info
            const game = await this.getGame(request.game_code);
            if (!game) {
                throw this.createError('Game not found', 404, 'GAME_NOT_FOUND');
            }
            // Get user info
            const userResult = await (0, database_1.query)('SELECT id, username, email FROM users WHERE id = $1', [userId]);
            if (userResult.rows.length === 0) {
                throw this.createError('User not found', 404, 'USER_NOT_FOUND');
            }
            const user = userResult.rows[0];
            // Create RGS session
            const rgsResponse = await this.createRGSSession(user.id, game.code, request.demo_mode);
            if (!rgsResponse.success) {
                throw this.createError('Failed to create game session', 500, 'RGS_ERROR');
            }
            // Record game session in database
            const gameSessionId = await this.recordGameSession(userId, game.code, rgsResponse.session_id, rgsResponse.session_token);
            // Build game URL
            const gameUrl = this.buildGameUrl(game.code, rgsResponse.session_token, request.demo_mode);
            logger_1.logger.info('Game launched', {
                userId,
                gameCode: game.code,
                sessionId: gameSessionId,
                demoMode: request.demo_mode
            });
            return {
                success: true,
                game_url: gameUrl,
                session_id: gameSessionId
            };
        }
        catch (error) {
            logger_1.logger.error('Game launch failed', {
                userId,
                gameCode: request.game_code,
                error: error.message
            });
            if (error.code) {
                throw error;
            }
            throw this.createError('Failed to launch game', 500, 'LAUNCH_ERROR');
        }
    }
    async endGameSession(userId, sessionId) {
        await (0, database_1.transaction)(async (client) => {
            // Get session
            const sessionResult = await client.query(`SELECT * FROM game_sessions 
         WHERE id = $1 AND user_id = $2 AND is_active = true`, [sessionId, userId]);
            if (sessionResult.rows.length === 0) {
                throw this.createError('Game session not found', 404, 'SESSION_NOT_FOUND');
            }
            const session = sessionResult.rows[0];
            // End session in database
            await client.query(`UPDATE game_sessions 
         SET ended_at = NOW(), is_active = false 
         WHERE id = $1`, [sessionId]);
            // End RGS session if exists
            if (session.rgs_session_id) {
                try {
                    await this.endRGSSession(session.rgs_session_id);
                }
                catch (error) {
                    logger_1.logger.error('Failed to end RGS session', {
                        sessionId: session.rgs_session_id,
                        error
                    });
                }
            }
            logger_1.logger.info('Game session ended', {
                userId,
                sessionId,
                gameId: session.game_id
            });
        });
    }
    async getActiveGameSessions(userId) {
        const result = await (0, database_1.query)(`SELECT 
        gs.*,
        g.name as game_name,
        g.thumbnail_url
       FROM game_sessions gs
       JOIN games g ON g.code = gs.game_id
       WHERE gs.user_id = $1 AND gs.is_active = true
       ORDER BY gs.started_at DESC`, [userId]);
        return result.rows;
    }
    async getGameHistory(userId, limit = 20, offset = 0) {
        const result = await (0, database_1.query)(`SELECT 
        gs.*,
        g.name as game_name,
        g.thumbnail_url,
        (gs.total_win - gs.total_bet) as profit_loss
       FROM game_sessions gs
       JOIN games g ON g.code = gs.game_id
       WHERE gs.user_id = $1
       ORDER BY gs.started_at DESC
       LIMIT $2 OFFSET $3`, [userId, Math.min(limit, 100), offset]);
        return result.rows;
    }
    async createRGSSession(playerId, gameId, demoMode) {
        try {
            const response = await axios_1.default.post(`${this.RGS_URL}/session/init`, {
                player_id: playerId,
                game_id: gameId,
                currency: demoMode ? 'DEMO' : 'EUR',
                metadata: {
                    demo_mode: demoMode || false,
                    casino: 'casino_mock'
                }
            }, {
                headers: {
                    'x-api-key': this.OPERATOR_KEY,
                    'Content-Type': 'application/json'
                },
                timeout: 5000
            });
            return response.data;
        }
        catch (error) {
            logger_1.logger.error('RGS session creation failed', {
                playerId,
                gameId,
                error: error.response?.data || error.message
            });
            return {
                success: false,
                error: 'RGS connection failed'
            };
        }
    }
    async endRGSSession(sessionId) {
        try {
            await axios_1.default.post(`${this.RGS_URL}/session/end`, { session_id: sessionId }, {
                headers: {
                    'x-api-key': this.OPERATOR_KEY,
                    'Content-Type': 'application/json'
                },
                timeout: 5000
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to end RGS session', { sessionId, error });
        }
    }
    async recordGameSession(userId, gameId, rgsSessionId, rgsSessionToken) {
        const sessionId = (0, uuid_1.v4)();
        await (0, database_1.query)(`INSERT INTO game_sessions (
        id, user_id, game_id, rgs_session_id, rgs_session_token
      ) VALUES ($1, $2, $3, $4, $5)`, [sessionId, userId, gameId, rgsSessionId, rgsSessionToken]);
        return sessionId;
    }
    buildGameUrl(gameCode, sessionToken, demoMode) {
        // Map game codes to actual game URLs
        const gameUrls = {
            'rawwar': '/rawwar',
            'demo-slots': '/demo/slots',
            'demo-roulette': '/demo/roulette',
            'demo-blackjack': '/demo/blackjack'
        };
        const gamePath = gameUrls[gameCode] || '/';
        const params = new URLSearchParams({
            token: sessionToken,
            rgs: 'true',
            demo: demoMode ? 'true' : 'false',
            casino: 'casino_mock'
        });
        return `${this.GAME_BASE_URL}${gamePath}?${params.toString()}`;
    }
    createError(message, statusCode, code) {
        const error = new Error(message);
        error.statusCode = statusCode;
        error.code = code;
        return error;
    }
}
exports.GameService = GameService;
//# sourceMappingURL=GameService.js.map