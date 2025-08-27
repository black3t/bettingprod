import { Game, GameLaunchRequest, GameLaunchResponse } from '../types';
export declare class GameService {
    private readonly RGS_URL;
    private readonly OPERATOR_KEY;
    private readonly GAME_BASE_URL;
    getGames(category?: string): Promise<Game[]>;
    getGame(gameCode: string): Promise<Game | null>;
    launchGame(userId: string, request: GameLaunchRequest): Promise<GameLaunchResponse>;
    endGameSession(userId: string, sessionId: string): Promise<void>;
    getActiveGameSessions(userId: string): Promise<any[]>;
    getGameHistory(userId: string, limit?: number, offset?: number): Promise<any[]>;
    private createRGSSession;
    private endRGSSession;
    private recordGameSession;
    private buildGameUrl;
    private createError;
}
//# sourceMappingURL=GameService.d.ts.map