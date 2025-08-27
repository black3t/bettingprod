import { Router, Request, Response } from 'express';
import logger from '../utils/logger';
import { healthDbCheck, healthRedisCheck } from '../utils/health';
import { buildError } from '../registry/rw';
import { getDegradeState, isDbDegradeOn } from '../utils/healthDegrade';

const router = Router();

/**
 * GET /health or /admin/health
 * Health check endpoint per monitoraggio
 * Returns consistent JSON format
 */
export async function healthHandler(req: Request, res: Response) {
  console.log('[RGS-HEALTH-HIT]', req.method, req.originalUrl, 'pathInRouter=', req.path);
  const t0 = Date.now();
  try {
    // Check for simulated degrade state
    const degradeState = getDegradeState();
    
    // Check env at request time (test can change it)
    const useSqlite = process.env.USE_SQLITE === 'true';
    
    // Check DB - simulate failure if degraded
    const dbHealthy = isDbDegradeOn() ? false : await healthDbCheck();
    
    let redisHealthy = true;
    
    if (!useSqlite) {
      // Non-SQLite mode: check Redis with timeout
      if (degradeState.redis) {
        // Simulate Redis failure
        redisHealthy = false;
      } else {
        try {
          const { redis } = require('../config/redis');
          if (redis) {
            // Set a short timeout for Redis ping
            await Promise.race([
              redis.ping(),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Redis timeout')), 300)
              )
            ]);
            redisHealthy = true;
          } else {
            // Redis not configured in non-SQLite mode
            redisHealthy = false;
          }
        } catch (error) {
          logger.warn('Redis health check failed', error);
          redisHealthy = false;
        }
      }
    }
    
    const allHealthy = dbHealthy && redisHealthy;
    
    if (!allHealthy) {
      // One or more services unhealthy => 503
      res.setHeader('Content-Type', 'application/json');
      logger.info('health.check', { action:'health.check', route:req.originalUrl, result:503, code:'RW-DB-003', correlationId:(req as any).correlationId, ms:Date.now()-t0 });
      const { status, body } = buildError('RW-DB-003', {
        message: 'Health check failed',
        correlationId: (req as any).correlationId,
        extra: {
          status: 'unhealthy',
          checks: {
            database: dbHealthy ? 'connected' : 'disconnected',
            redis: useSqlite ? 'not-required' : (redisHealthy ? 'connected' : 'disconnected')
          },
          ts: new Date().toISOString()
        }
      });
      return res.status(status).json(body);
    }
    
    // All healthy => 200
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({
      success: true,
      status: 'healthy',
      checks: {
        database: 'connected',
        redis: useSqlite ? 'not-required' : 'connected'
      },
      ts: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Health check error', error);
    res.setHeader('Content-Type', 'application/json');
    const { status, body } = buildError('RW-SYS-000', {
      message: 'Health check error',
      correlationId: (req as any).correlationId,
      extra: {
        status: 'unhealthy',
        checks: {
          database: 'error',
          redis: 'unknown'
        },
        ts: new Date().toISOString()
      }
    });
    res.status(status).json(body);
  }
}

router.get('/', healthHandler);

/**
 * GET /admin/readiness
 * Readiness probe for k8s
 */
router.get('/readiness', async (req, res) => {
  try {
    // Quick DB check using utils
    const dbReady = await healthDbCheck();
    
    if (dbReady) {
      res.status(200).json({ ready: true });
    } else {
      const { status, body } = buildError('RW-DB-003', {
        message: 'Database not ready',
        correlationId: (req as any).correlationId,
        extra: { ready: false }
      });
      res.status(status).json(body);
    }
  } catch (error) {
    const { status, body } = buildError('RW-SYS-000', {
      message: 'Readiness check failed',
      correlationId: (req as any).correlationId,
      extra: { ready: false }
    });
    res.status(status).json(body);
  }
});

/**
 * POST /health, POST /admin/health
 * Return 405 Method Not Allowed
 */
router.post('/', (req, res) => {
  const t0 = Date.now();
  res.setHeader('Allow', 'GET');
  logger.info('health.method_discipline', { action:'health.method_discipline', route:req.originalUrl, result:405, code:'RW-SYS-000', correlationId:(req as any).correlationId, ms:Date.now()-t0 });
  const { status, body } = buildError('RW-SYS-000', {
    message: 'Method Not Allowed',
    correlationId: (req as any).correlationId,
    httpOverride: 405
  });
  res.status(status).json(body);
});

/**
 * GET /admin/liveness
 * Liveness probe for k8s
 */
router.get('/liveness', (req, res) => {
  // Always return 200 if the process is alive
  res.status(200).json({ alive: true });
});

/**
 * POST /admin/health/degrade/:component
 * Toggle degrade state for testing (only in test mode)
 */
router.post('/degrade/:component', (req, res) => {
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_DEGRADE_TEST) {
    const { status, body } = buildError('RW-SYS-000', {
      message: 'Not allowed in production',
      correlationId: (req as any).correlationId
    });
    return res.status(status).json(body);
  }

  const { component } = req.params;
  const { state } = req.body;

  if (component !== 'db' && component !== 'redis') {
    const { status, body } = buildError('RW-SYS-000', {
      message: 'Invalid component',
      correlationId: (req as any).correlationId
    });
    return res.status(status).json(body);
  }

  const { setDegradeState } = require('../utils/healthDegrade');
  setDegradeState(component as 'db' | 'redis', state === true);
  res.json({ success: true, component, degraded: state === true });
});


export default router;