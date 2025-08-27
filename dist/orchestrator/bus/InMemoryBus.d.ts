import { OrchestratorEvent } from '../schemas/events';
export interface Subscription {
    unsubscribe(): void;
}
export declare class InMemoryBus {
    private emitter;
    private subscriptions;
    constructor();
    publish(event: OrchestratorEvent): Promise<void>;
    subscribe(topic: string, handler: (event: OrchestratorEvent) => void): Subscription;
    subscribeAll(handler: (event: OrchestratorEvent) => void): Subscription;
    getSubscriptionCount(topic?: string): number;
    clear(): void;
}
//# sourceMappingURL=InMemoryBus.d.ts.map