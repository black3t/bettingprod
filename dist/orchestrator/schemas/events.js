"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventType = void 0;
exports.isValidEvent = isValidEvent;
exports.createEvent = createEvent;
var EventType;
(function (EventType) {
    EventType["ROUND_STARTED"] = "round.started";
    EventType["DEBIT_APPROVED"] = "debit.approved";
    EventType["DEBIT_REJECTED"] = "debit.rejected";
    EventType["CREDIT_COMPLETED"] = "credit.completed";
    EventType["CREDIT_REJECTED"] = "credit.rejected";
    EventType["ROUND_ENDED"] = "round.ended";
})(EventType || (exports.EventType = EventType = {}));
// Helper function to validate event structure
function isValidEvent(event) {
    if (!event || typeof event !== 'object')
        return false;
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
function createEvent(type, payload, correlationId, eventId) {
    const event = {
        eventId: eventId || require('uuid').v4(),
        occurredAt: new Date().toISOString(),
        correlationId,
        modelVersion: '1.0.0',
        type,
        payload
    };
    if (!isValidEvent(event)) {
        throw new Error('Invalid event structure');
    }
    return event;
}
//# sourceMappingURL=events.js.map