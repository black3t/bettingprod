export declare enum EventType {
    ROUND_STARTED = "round.started",
    DEBIT_APPROVED = "debit.approved",
    DEBIT_REJECTED = "debit.rejected",
    CREDIT_COMPLETED = "credit.completed",
    CREDIT_REJECTED = "credit.rejected",
    ROUND_ENDED = "round.ended"
}
export interface BaseEvent {
    eventId: string;
    occurredAt: string;
    correlationId: string;
    modelVersion: string;
}
export interface RoundStartedEvent extends BaseEvent {
    type: EventType.ROUND_STARTED;
    payload: {
        playerId: string;
        gameId: string;
        roundId: string;
        status: 'APPROVED' | 'REJECTED';
    };
}
export interface DebitApprovedEvent extends BaseEvent {
    type: EventType.DEBIT_APPROVED;
    payload: {
        playerId: string;
        amount: string;
        roundId: string;
        transactionId: string;
        status: 'APPROVED';
        balance?: string;
    };
}
export interface DebitRejectedEvent extends BaseEvent {
    type: EventType.DEBIT_REJECTED;
    payload: {
        playerId: string;
        amount: string;
        roundId: string;
        transactionId: string;
        status: 'REJECTED';
        reason: string;
    };
}
export interface CreditCompletedEvent extends BaseEvent {
    type: EventType.CREDIT_COMPLETED;
    payload: {
        playerId: string;
        amount: string;
        roundId: string;
        transactionId: string;
        status: 'COMPLETED' | 'APPROVED';
        balance?: string;
    };
}
export interface CreditRejectedEvent extends BaseEvent {
    type: EventType.CREDIT_REJECTED;
    payload: {
        playerId: string;
        amount: string;
        roundId: string;
        transactionId: string;
        status: 'REJECTED';
        reason: string;
    };
}
export interface RoundEndedEvent extends BaseEvent {
    type: EventType.ROUND_ENDED;
    payload: {
        playerId: string;
        roundId: string;
        status: 'COMPLETED' | 'CANCELLED';
        summary?: {
            totalDebit: string;
            totalCredit: string;
            netResult: string;
        };
    };
}
export type OrchestratorEvent = RoundStartedEvent | DebitApprovedEvent | DebitRejectedEvent | CreditCompletedEvent | CreditRejectedEvent | RoundEndedEvent;
export declare function isValidEvent(event: any): event is OrchestratorEvent;
export declare function createEvent<T extends OrchestratorEvent>(type: T['type'], payload: T['payload'], correlationId: string, eventId?: string): T;
//# sourceMappingURL=events.d.ts.map