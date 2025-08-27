import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';
import { OrchestratorEvent } from '../schemas/events';

export interface Subscription {
  unsubscribe(): void;
}

export class InMemoryBus {
  private emitter: EventEmitter;
  private subscriptions: Map<string, Set<Function>>;

  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(100); // Increase for multiple subscriptions
    this.subscriptions = new Map();
  }

  async publish(event: OrchestratorEvent): Promise<void> {
    const topic = `events.orch.${event.type}`;
    
    logger.info('Publishing event', {
      topic,
      eventId: event.eventId,
      type: event.type,
      correlationId: event.correlationId
    });
    
    // Emit asynchronously to avoid blocking
    setImmediate(() => {
      this.emitter.emit(topic, event);
      this.emitter.emit('events.orch.*', event); // Wildcard topic
    });
  }

  subscribe(topic: string, handler: (event: OrchestratorEvent) => void): Subscription {
    // Normalize topic
    const normalizedTopic = topic.startsWith('events.orch.') ? topic : `events.orch.${topic}`;
    
    // Track subscription
    if (!this.subscriptions.has(normalizedTopic)) {
      this.subscriptions.set(normalizedTopic, new Set());
    }
    this.subscriptions.get(normalizedTopic)!.add(handler);
    
    // Add listener
    this.emitter.on(normalizedTopic, handler);
    
    logger.info('Subscription added', { topic: normalizedTopic });
    
    // Return unsubscribe function
    return {
      unsubscribe: () => {
        this.emitter.removeListener(normalizedTopic, handler);
        const subs = this.subscriptions.get(normalizedTopic);
        if (subs) {
          subs.delete(handler);
          if (subs.size === 0) {
            this.subscriptions.delete(normalizedTopic);
          }
        }
        logger.info('Subscription removed', { topic: normalizedTopic });
      }
    };
  }

  // Subscribe to all events
  subscribeAll(handler: (event: OrchestratorEvent) => void): Subscription {
    return this.subscribe('*', handler);
  }

  // Get active subscriptions count
  getSubscriptionCount(topic?: string): number {
    if (topic) {
      const normalizedTopic = topic.startsWith('events.orch.') ? topic : `events.orch.${topic}`;
      return this.subscriptions.get(normalizedTopic)?.size || 0;
    }
    
    let total = 0;
    this.subscriptions.forEach(subs => {
      total += subs.size;
    });
    return total;
  }

  // Clear all subscriptions (useful for testing)
  clear(): void {
    this.emitter.removeAllListeners();
    this.subscriptions.clear();
    logger.info('All subscriptions cleared');
  }
}