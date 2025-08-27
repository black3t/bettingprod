import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// In-memory mutex per player
const playerLocks = new Map<string, Promise<void>>();

/**
 * Middleware per gestire richieste concorrenti per player
 * Serializza le operazioni wallet per lo stesso playerId
 */
export const concurrentRequestHandler = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
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
      logger.info('Waiting for existing operation to complete', {
        playerId,
        path: req.path
      });
      
      try {
        // Wait for existing operation
        await existingLock;
      } catch (error) {
        // Previous operation failed, continue anyway
        logger.warn('Previous operation failed, proceeding', {
          playerId,
          error
        });
      }
    }

    // Create new lock
    let releaseLock: () => void;
    const newLock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    
    playerLocks.set(playerId, newLock);

    // Ensure lock is released on response end
    const originalEnd = res.end;
    res.end = function(...args: any[]): any {
      releaseLock!();
      playerLocks.delete(playerId);
      return originalEnd.apply(res, args as any);
    };

    next();
  };
};

/**
 * Semaforo per limitare richieste concorrenti globali
 */
class Semaphore {
  private permits: number;
  private waiting: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    return new Promise<void>((resolve) => {
      this.waiting.push(resolve);
    });
  }

  release(): void {
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
export const globalRateLimit = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
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