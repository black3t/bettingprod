"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalRateLimit = exports.concurrentRequestHandler = void 0;
const logger_1 = require("../utils/logger");
// In-memory mutex per player
const playerLocks = new Map();
/**
 * Middleware per gestire richieste concorrenti per player
 * Serializza le operazioni wallet per lo stesso playerId
 */
const concurrentRequestHandler = () => {
    return async (req, res, next) => {
        // Solo per operazioni wallet
        if (!req.path.includes('/wallet/')) {
            return next();
        }
        const playerId = req.body?.playerId;
        if (!playerId) {
            return next();
        }
        // Check if there's an existing lock for this player
        const existingLock = playerLocks.get(playerId);
        if (existingLock) {
            logger_1.logger.info('Waiting for existing operation to complete', {
                playerId,
                path: req.path
            });
            try {
                // Wait for existing operation
                await existingLock;
            }
            catch (error) {
                // Previous operation failed, continue anyway
                logger_1.logger.warn('Previous operation failed, proceeding', {
                    playerId,
                    error
                });
            }
        }
        // Create new lock
        let releaseLock;
        const newLock = new Promise((resolve) => {
            releaseLock = resolve;
        });
        playerLocks.set(playerId, newLock);
        // Ensure lock is released on response end
        const originalEnd = res.end;
        res.end = function (...args) {
            releaseLock();
            playerLocks.delete(playerId);
            return originalEnd.apply(res, args);
        };
        next();
    };
};
exports.concurrentRequestHandler = concurrentRequestHandler;
/**
 * Semaforo per limitare richieste concorrenti globali
 */
class Semaphore {
    permits;
    waiting = [];
    constructor(permits) {
        this.permits = permits;
    }
    async acquire() {
        if (this.permits > 0) {
            this.permits--;
            return;
        }
        return new Promise((resolve) => {
            this.waiting.push(resolve);
        });
    }
    release() {
        this.permits++;
        const next = this.waiting.shift();
        if (next) {
            this.permits--;
            next();
        }
    }
}
// Global semaphore for rate limiting
const globalSemaphore = new Semaphore(100); // Max 100 concurrent requests
/**
 * Global rate limiting middleware
 */
const globalRateLimit = () => {
    return async (req, res, next) => {
        await globalSemaphore.acquire();
        res.on('finish', () => {
            globalSemaphore.release();
        });
        res.on('close', () => {
            globalSemaphore.release();
        });
        next();
    };
};
exports.globalRateLimit = globalRateLimit;
//# sourceMappingURL=concurrent.js.map