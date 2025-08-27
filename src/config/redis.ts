import Redis from 'ioredis';
import { logger } from '../utils/logger';

// Check if we're in test mode
const USE_SQLITE = process.env.USE_SQLITE === 'true';

// Create Redis connection only if not in test mode
let redis: Redis | null = null;
let sessionStore: Redis | Map<string, any> | null = null;

if (!USE_SQLITE) {
  redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6380'),
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    maxRetriesPerRequest: 3,
  });

  redis.on('connect', () => {
    logger.info('Redis connected');
  });

  redis.on('error', (err) => {
    logger.error('Redis connection error', err);
  });

  sessionStore = redis;
} else {
  // Use in-memory storage for test mode
  logger.info('Using in-memory session storage (test mode)');
  sessionStore = new Map();
}

export { redis, sessionStore };