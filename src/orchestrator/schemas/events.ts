export enum EventType {
  ROUND_STARTED = 'round.started',
  DEBIT_APPROVED = 'debit.approved',
  DEBIT_REJECTED = 'debit.rejected',
  CREDIT_COMPLETED = 'credit.completed',
  CREDIT_REJECTED = 'credit.rejected',
  ROUND_ENDED = 'round.ended'
}

export interface BaseEvent {
  eventId: string;           // UUID v4
  occurredAt: string;        // ISO 8601
  correlationId: string;     // UUID v4
  modelVersion: string;      // Semantic version
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
    amount: string;          // Format: "xx.yy"
    roundId: string;
    transactionId: string;
    status: 'APPROVED';
    balance?: string;        // Optional balance after debit
  };
}

export interface DebitRejectedEvent extends BaseEvent {
  type: EventType.DEBIT_REJECTED;
  payload: {
    playerId: string;
    amount: string;          // Format: "xx.yy"
    roundId: string;
    transactionId: string;
    status: 'REJECTED';
    reason: string;          // RW code or rejection reason
  };
}

export interface CreditCompletedEvent extends BaseEvent {
  type: EventType.CREDIT_COMPLETED;
  payload: {
    playerId: string;
    amount: string;          // Format: "xx.yy"
    roundId: string;
    transactionId: string;
    status: 'COMPLETED' | 'APPROVED';
    balance?: string;        // Optional balance after credit
  };
}

export interface CreditRejectedEvent extends BaseEvent {
  type: EventType.CREDIT_REJECTED;
  payload: {
    playerId: string;
    amount: string;          // Format: "xx.yy"
    roundId: string;
    transactionId: string;
    status: 'REJECTED';
    reason: string;          // RW code or rejection reason
  };
}

export interface RoundEndedEvent extends BaseEvent {
  type: EventType.ROUND_ENDED;
  payload: {
    playerId: string;
    roundId: string;
    status: 'COMPLETED' | 'CANCELLED';
    summary?: {
      totalDebit: string;    // Format: "xx.yy"
      totalCredit: string;   // Format: "xx.yy"
      netResult: string;     // Format: "xx.yy" (credit - debit)
    };
  };
}

export type OrchestratorEvent = 
  | RoundStartedEvent
  | DebitApprovedEvent
  | DebitRejectedEvent
  | CreditCompletedEvent
  | CreditRejectedEvent
  | RoundEndedEvent;

// Helper function to validate event structure
export function isValidEvent(event: any): event is OrchestratorEvent {
  if (!event || typeof event !== 'object') return false;
  
  // Check required base fields
  if (!event.eventId || !event.occurredAt || !event.correlationId || !event.modelVersion || !event.type) {
    return false;
  }
  
  // Check UUID v4 format
  const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  if (!UUID_V4_REGEX.test(event.eventId) || !UUID_V4_REGEX.test(event.correlationId)) {
    return false;
  }
  
  // Check ISO date format
  if (isNaN(Date.parse(event.occurredAt))) {
    return false;
  }
  
  // Check event type
  if (!Object.values(EventType).includes(event.type)) {
    return false;
  }
  
  // Check payload exists
  if (!event.payload || typeof event.payload !== 'object') {
    return false;
  }
  
  return true;
}

// Helper to create event with defaults
export function createEvent<T extends OrchestratorEvent>(
  type: T['type'],
  payload: T['payload'],
  correlationId: string,
  eventId?: string
): T {
  const event = {
    eventId: eventId || require('uuid').v4(),
    occurredAt: new Date().toISOString(),
    correlationId,
    modelVersion: '1.0.0',
    type,
    payload
  } as T;
  
  if (!isValidEvent(event)) {
    throw new Error('Invalid event structure');
  }
  
  return event;
}