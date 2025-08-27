import { Request, Response, NextFunction } from 'express';

const locks = new Map<string, Promise<void>>();
const LOCK_TTL = 10000; // 10 seconds TTL

export const rgsSingleFlight = (req: Request, res: Response, next: NextFunction): void => {
  // Only active in test or if explicitly enabled
  if (process.env.NODE_ENV !== 'test' && process.env.RGS_SINGLE_FLIGHT !== 'true') {
    next();
    return;
  }
  
  const playerId = req.body?.playerId;
  if (!playerId) {
    next();
    return;
  }
  
  // Check if there's an existing lock
  const existingLock = locks.get(playerId);
  if (existingLock) {
    // Wait for existing request to complete
    existingLock.then(() => next()).catch(() => next());
    return;
  }
  
  // Create new lock
  let releaseLock: () => void;
  const lockPromise = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  
  locks.set(playerId, lockPromise);
  
  // Set TTL to auto-release lock
  const ttlTimer = setTimeout(() => {
    locks.delete(playerId);
    releaseLock();
  }, LOCK_TTL);
  
  // Release lock when response ends
  const cleanup = () => {
    clearTimeout(ttlTimer);
    locks.delete(playerId);
    releaseLock();
  };
  
  res.on('finish', cleanup);
  res.on('close', cleanup);
  res.on('error', cleanup);
  
  next();
};