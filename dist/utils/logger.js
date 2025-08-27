"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logPlayerOperation = exports.logger = exports.testLogCapture = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const winston_1 = __importDefault(require("winston"));
// Global redaction for sensitive keys (case-sensitive + common variants)
const REDACT_KEYS = new Set([
    'authorization', 'Authorization',
    'x-idempotency-key', 'X-Idempotency-Key',
    'cookie', 'Cookie'
]);
function redactDeep(obj, seen = new WeakSet()) {
    if (!obj || typeof obj !== 'object')
        return;
    if (seen.has(obj))
        return;
    seen.add(obj);
    for (const k of Object.keys(obj)) {
        if (REDACT_KEYS.has(k)) {
            obj[k] = '[REDACTED]';
        }
        else {
            const v = obj[k];
            if (v && typeof v === 'object')
                redactDeep(v, seen);
        }
    }
}
const redactFormat = winston_1.default.format((info) => {
    // scrub everything in the structured payload (including nested axios error.config/response)
    redactDeep(info);
    return info;
});
const logsDir = path_1.default.resolve(process.cwd(), 'logs');
if (!fs_1.default.existsSync(logsDir))
    fs_1.default.mkdirSync(logsDir, { recursive: true });
// PII fields to redact
const PII_FIELDS = [
    'password',
    'email',
    'creditCard',
    'ssn',
    'dateOfBirth',
    'phone',
    'address',
    'personalInfo',
    'authorization',
    'cookie'
];
// Test log capture for tests
exports.testLogCapture = [];
// Custom format to redact PII
const redactPII = winston_1.default.format((info) => {
    // Deep clone to avoid mutating original
    const sanitized = JSON.parse(JSON.stringify(info));
    // Recursively redact PII fields
    const redactObject = (obj) => {
        if (!obj || typeof obj !== 'object')
            return obj;
        for (const key in obj) {
            const lowerKey = key.toLowerCase();
            // Check if field should be redacted
            if (PII_FIELDS.some(field => lowerKey.includes(field.toLowerCase()))) {
                obj[key] = '[REDACTED]';
            }
            else if (typeof obj[key] === 'object') {
                obj[key] = redactObject(obj[key]);
            }
        }
        return obj;
    };
    return redactObject(sanitized);
});
const fileFormat = winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json());
const transports = [
    new winston_1.default.transports.File({ filename: path_1.default.join(logsDir, 'error.log'), level: 'error', format: fileFormat }),
    new winston_1.default.transports.File({ filename: path_1.default.join(logsDir, 'combined.log'), format: fileFormat })
];
if (process.env.LOG_TO_CONSOLE === '1') {
    transports.push(new winston_1.default.transports.Console({ format: winston_1.default.format.simple() }));
}
const logger = winston_1.default.createLogger({
    level: 'info',
    format: winston_1.default.format.combine(redactFormat(), winston_1.default.format.json()),
    transports
});
exports.logger = logger;
logger.on('error', (err) => { try {
    console.error('logger-transport-error', err?.message);
}
catch { } });
exports.default = logger;
// Add test transport if in test mode
if (process.env.NODE_ENV === 'test') {
    // Use a custom transport for test mode
    const testTransport = new winston_1.default.transports.Console({
        format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.printf((info) => {
            exports.testLogCapture.push(info);
            // Keep only last 100 logs
            if (exports.testLogCapture.length > 100) {
                exports.testLogCapture.shift();
            }
            return `${info.timestamp} ${info.level}: ${info.message}`;
        })),
        silent: true // Don't actually output to console in test
    });
    logger.add(testTransport);
}
// GDPR allow-list: only these fields can be logged
const ALLOWED_LOG_FIELDS = [
    'playerId', // UUID/hash - pseudonymous
    'sessionId', // Session identifier
    'amount', // Transaction amount
    'correlationId', // Request correlation
    'action', // Action performed
    'result', // Operation result
    'method', // HTTP method
    'path', // Request path
    'status', // Response status
    'newBalance', // Balance after operation
    'currency', // Currency code
    'timestamp', // Operation timestamp
    'reason' // Error/rejection reason
];
// Log player operations with GDPR allow-list
const logPlayerOperation = (operation, data) => {
    const sanitized = {};
    // Only include whitelisted fields
    for (const field of ALLOWED_LOG_FIELDS) {
        if (data[field] !== undefined) {
            sanitized[field] = data[field];
        }
    }
    logger.info(operation, sanitized);
};
exports.logPlayerOperation = logPlayerOperation;
//# sourceMappingURL=logger.js.map