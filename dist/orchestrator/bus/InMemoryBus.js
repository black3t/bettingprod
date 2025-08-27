"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryBus = void 0;
const events_1 = require("events");
const logger_1 = require("../../utils/logger");
class InMemoryBus {
    emitter;
    subscriptions;
    constructor() {
        this.emitter = new events_1.EventEmitter();
        this.emitter.setMaxListeners(100); // Increase for multiple subscriptions
        this.subscriptions = new Map();
    }
    async publish(event) {
        const topic = `events.orch.${event.type}`;
        logger_1.logger.info('Publishing event', {
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
    subscribe(topic, handler) {
        // Normalize topic
        const normalizedTopic = topic.startsWith('events.orch.') ? topic : `events.orch.${topic}`;
        // Track subscription
        if (!this.subscriptions.has(normalizedTopic)) {
            this.subscriptions.set(normalizedTopic, new Set());
        }
        this.subscriptions.get(normalizedTopic).add(handler);
        // Add listener
        this.emitter.on(normalizedTopic, handler);
        logger_1.logger.info('Subscription added', { topic: normalizedTopic });
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
                logger_1.logger.info('Subscription removed', { topic: normalizedTopic });
            }
        };
    }
    // Subscribe to all events
    subscribeAll(handler) {
        return this.subscribe('*', handler);
    }
    // Get active subscriptions count
    getSubscriptionCount(topic) {
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
    clear() {
        this.emitter.removeAllListeners();
        this.subscriptions.clear();
        logger_1.logger.info('All subscriptions cleared');
    }
}
exports.InMemoryBus = InMemoryBus;
//# sourceMappingURL=InMemoryBus.js.map