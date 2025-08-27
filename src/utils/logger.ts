import fs from 'fs';
import path from 'path';
import winston from 'winston';

// Global redaction for sensitive keys (case-sensitive + common variants)
const REDACT_KEYS = new Set([
  'authorization','Authorization',
  'x-idempotency-key','X-Idempotency-Key',
  'cookie','Cookie'
]);
function redactDeep(obj: any, seen = new WeakSet()): void {
  if (!obj || typeof obj !== 'object') return;
  if (seen.has(obj)) return;
  seen.add(obj);
  for (const k of Object.keys(obj)) {
    if (REDACT_KEYS.has(k)) {
      (obj as any)[k] = '[REDACTED]';
    } else {
      const v = (obj as any)[k];
      if (v && typeof v === 'object') redactDeep(v, seen);
    }
  }
}
const redactFormat = winston.format((info) => {
  // scrub everything in the structured payload (including nested axios error.config/response)
  redactDeep(info);
  return info;
});

const logsDir = path.resolve(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

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
export const testLogCapture: any[] = [];

// Custom format to redact PII
const redactPII = winston.format((info) => {
  // Deep clone to avoid mutating original
  const sanitized = JSON.parse(JSON.stringify(info));
  
  // Recursively redact PII fields
  const redactObject = (obj: any): any => {
    if (!obj || typeof obj !== 'object') return obj;
    
    for (const key in obj) {
      const lowerKey = key.toLowerCase();
      
      // Check if field should be redacted
      if (PII_FIELDS.some(field => lowerKey.includes(field.toLowerCase()))) {
        obj[key] = '[REDACTED]';
      } else if (typeof obj[key] === 'object') {
        obj[key] = redactObject(obj[key]);
      }
    }
    
    return obj;
  };
  
  return redactObject(sanitized);
});

const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json()
);

const transports: winston.transport[] = [
  new winston.transports.File({ filename: path.join(logsDir, 'error.log'), level: 'error', format: fileFormat }),
  new winston.transports.File({ filename: path.join(logsDir, 'combined.log'), format: fileFormat })
];

if (process.env.LOG_TO_CONSOLE === '1') {
  transports.push(new winston.transports.Console({ format: winston.format.simple() }));
}

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    redactFormat(),
    winston.format.json()
  ),
  transports
});

logger.on('error', (err) => { try { console.error('logger-transport-error', err?.message); } catch {} });

export default logger;
export { logger };

// Add test transport if in test mode
if (process.env.NODE_ENV === 'test') {
  // Use a custom transport for test mode
  const testTransport = new winston.transports.Console({
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf((info) => {
        testLogCapture.push(info);
        // Keep only last 100 logs
        if (testLogCapture.length > 100) {
          testLogCapture.shift();
        }
        return `${info.timestamp} ${info.level}: ${info.message}`;
      })
    ),
    silent: true // Don't actually output to console in test
  });
  
  logger.add(testTransport);
}

// GDPR allow-list: only these fields can be logged
const ALLOWED_LOG_FIELDS = [
  'playerId',      // UUID/hash - pseudonymous
  'sessionId',     // Session identifier
  'amount',        // Transaction amount
  'correlationId', // Request correlation
  'action',        // Action performed
  'result',        // Operation result
  'method',        // HTTP method
  'path',          // Request path
  'status',        // Response status
  'newBalance',    // Balance after operation
  'currency',      // Currency code
  'timestamp',     // Operation timestamp
  'reason'         // Error/rejection reason
];

// Log player operations with GDPR allow-list
export const logPlayerOperation = (operation: string, data: any) => {
  const sanitized: any = {};
  
  // Only include whitelisted fields
  for (const field of ALLOWED_LOG_FIELDS) {
    if (data[field] !== undefined) {
      sanitized[field] = data[field];
    }
  }
  
  logger.info(operation, sanitized);
};