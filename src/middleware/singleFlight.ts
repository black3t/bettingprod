import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// In-memory lock per player
const playerLocks = new Map<string, Promise<void>>();

/**
 * Single-flight middleware per evitare richieste concorrenti per lo stesso player
 */
export function singleFlightByPlayer(req: Request, res: Response, next: NextFunction): void {
  const playerId = req.body?.playerId;
  
  if (!playerId) {
    // No playerId, proceed without lock
    next();
    return;
  }
  
  const existingLock = playerLocks.get(playerId);
  
  if (existingLock) {
    // Wait for existing request to complete
    existingLock.then(() => {
      // After lock released, process this request
      processWithLock(playerId, req, res, next);
    }).catch(() => {
      // Even if previous failed, process this request
      processWithLock(playerId, req, res, next);
    });
  } else {
    // No existing lock, process immediately
    processWithLock(playerId, req, res, next);
  }
}

function processWithLock(playerId: string, req: Request, res: Response, next: NextFunction): void {
  let lockResolve: () => void;
  
  // Create a new lock promise
  const lockPromise = new Promise<void>((resolve) => {
    lockResolve = resolve;
  });
  
  playerLocks.set(playerId, lockPromise);
  
  // Ensure lock is released on response end
  const originalEnd = res.end.bind(res);
  (res as any).end = function(...args: any[]): any {
    try {
      // Release lock before calling original end
      lockResolve!();
      // Clean up if this was the current lock
      if (playerLocks.get(playerId) === lockPromise) {
        playerLocks.delete(playerId);
      }
    } finally {
      // Always call original end
      return originalEnd.apply(res, args as any);
    }
  };
  
  next();
}