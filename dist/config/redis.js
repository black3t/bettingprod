"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionStore = exports.redis = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const logger_1 = require("../utils/logger");
// Check if we're in test mode
const USE_SQLITE = process.env.USE_SQLITE === 'true';
// Create Redis connection only if not in test mode
let redis = null;
exports.redis = redis;
let sessionStore = null;
exports.sessionStore = sessionStore;
if (!USE_SQLITE) {
    exports.redis = redis = new ioredis_1.default({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6380'),
        retryStrategy: (times) => {
            const delay = Math.min(times * 50, 2000);
            return delay;
        },
        maxRetriesPerRequest: 3,
    });
    redis.on('connect', () => {
        logger_1.logger.info('Redis connected');
    });
    redis.on('error', (err) => {
        logger_1.logger.error('Redis connection error', err);
    });
    exports.sessionStore = sessionStore = redis;
}
else {
    // Use in-memory storage for test mode
    logger_1.logger.info('Using in-memory session storage (test mode)');
    exports.sessionStore = sessionStore = new Map();
}
//# sourceMappingURL=redis.js.map