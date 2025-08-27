import { InMemoryBus } from './bus/InMemoryBus';
export type Room = {
    id: string;
    gameId: string;
    players: Set<string>;
    createdAt: string;
};
export declare class RoomManager {
    private maxPlayersPerRoom;
    private rooms;
    constructor(maxPlayersPerRoom?: number);
    allocate(gameId: string, playerId: string): Room;
    get(roomId: string): Room | null;
    state(): {
        id: string;
        gameId: string;
        players: string[];
        createdAt: string;
    }[];
    join(roomId: string, playerId: string): Room | null;
    leave(roomId: string, playerId: string): {
        room: Room | null;
        removed: boolean;
    };
    close(roomId: string): boolean;
}
export declare class OrchestratorService {
    private idempotencyCache;
    private circuitBreaker;
    private bus;
    emit(topic: string, payload: any): void;
    private rgsBaseUrl;
    private maxRetries;
    rooms: RoomManager;
    private backoffMs;
    private idempotencyTtlMs;
    private circuitBreakerOpenDurationMs;
    private circuitBreakerThreshold;
    constructor();
    private cleanupCache;
    private getCacheKey;
    private checkIdempotency;
    private storeIdempotentResponse;
    private checkCircuitBreaker;
    private recordSuccess;
    private recordFailure;
    private callRgsWithRetry;
    startRound(params: {
        playerId: string;
        gameId: string;
        roundId: string;
        correlationId?: string;
        idempotencyKey?: string;
    }): Promise<any>;
    debit(params: {
        playerId: string;
        amount: string;
        roundId: string;
        transactionId: string;
        correlationId?: string;
        idempotencyKey?: string;
    }): Promise<any>;
    credit(params: {
        playerId: string;
        amount: string;
        roundId: string;
        transactionId: string;
        correlationId?: string;
        idempotencyKey?: string;
    }): Promise<any>;
    endRound(params: {
        roundId: string;
        playerId: string;
        correlationId?: string;
        idempotencyKey?: string;
    }): Promise<any>;
    getBus(): InMemoryBus;
}
export declare const orchestratorService: OrchestratorService;
//# sourceMappingURL=OrchestratorService.d.ts.map