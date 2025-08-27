import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { orchestratorService } from '../orchestrator/OrchestratorService';
import { healthHandler } from './healthRoutes';
import { buildError } from '../registry/rw';
import { logger } from '../utils/logger';
import { get as idemGet, put as idemPut } from '../services/IdempotencyStore';
import { mIdemHit, mIdemMiss, gRoomsActive, hHttp, renderMetrics } from '../metrics/orchMetrics';

const router = Router();

// Middleware timing (dev-only)
if (process.env.NODE_ENV !== 'production') {
  router.use((req, res, next) => {
    const end = hHttp.startTimer({ route: req.path, method: req.method });
    res.on('finish', () => end({ status: String(res.statusCode) }));
    next();
  });
}

// Health endpoint - reuse existing healthHandler
router.get('/health', healthHandler);

// Method discipline: POST /health → 405 (Allow: GET) per Bibbia
router.post('/health', (req, res) => {
  const t0 = Date.now();
  res.setHeader('Allow', 'GET');
  logger.info('orch.health.method_discipline', {
    action: 'orch.health.method_discipline',
    route: req.originalUrl,
    result: 405,
    code: 'RW-SYS-000',
    correlationId: (req as any).correlationId,
    ms: Date.now() - t0
  });
  const { status, body } = buildError('RW-SYS-000', {
    message: 'Method Not Allowed',
    correlationId: (req as any).correlationId,
    httpOverride: 405
  });
  return res.status(status).json(body);
});

// Probe endpoint - only in dev/test
router.post('/probe/round', async (req: Request, res: Response) => {
  // Protection: only allow in non-production
  if (process.env.NODE_ENV === 'production') {
    const { status, body } = buildError('RW-CAS-005', {
      message: 'Probe endpoint not available in production',
      correlationId: (req as any).correlationId
    });
    return res.status(status).json(body);
  }
  
  const correlationId = (req as any).correlationId || uuidv4();
  const idempotencyKey = req.headers['idempotency-key'] as string;
  
  try {
    // Generate test IDs
    const playerId = req.body.playerId || 'test-player-' + Date.now();
    const gameId = req.body.gameId || 'test-game';
    const roundId = 'round-' + uuidv4();
    const debitTxId = 'tx-debit-' + uuidv4();
    const creditTxId = 'tx-credit-' + uuidv4();
    
    const results = {
      correlationId,
      playerId,
      gameId,
      roundId,
      sequence: [] as any[]
    };
    
    // 1. Start Round
    logger.info('Probe: Starting round', { roundId, playerId, gameId });
    const startResult = await orchestratorService.startRound({
      playerId,
      gameId,
      roundId,
      correlationId,
      idempotencyKey: idempotencyKey ? `${idempotencyKey}-start` : undefined
    });
    results.sequence.push({
      step: 'startRound',
      status: startResult.status || 'completed',
      data: startResult
    });
    
    // 2. Debit
    logger.info('Probe: Processing debit', { roundId, playerId });
    const debitResult = await orchestratorService.debit({
      playerId,
      amount: '10.00',
      roundId,
      transactionId: debitTxId,
      correlationId,
      idempotencyKey: idempotencyKey ? `${idempotencyKey}-debit` : undefined
    });
    results.sequence.push({
      step: 'debit',
      status: debitResult.status || 'completed',
      data: debitResult
    });
    
    // 3. Credit
    logger.info('Probe: Processing credit', { roundId, playerId });
    const creditResult = await orchestratorService.credit({
      playerId,
      amount: '20.00',
      roundId,
      transactionId: creditTxId,
      correlationId,
      idempotencyKey: idempotencyKey ? `${idempotencyKey}-credit` : undefined
    });
    results.sequence.push({
      step: 'credit',
      status: creditResult.status || 'completed',
      data: creditResult
    });
    
    // 4. End Round
    logger.info('Probe: Ending round', { roundId, playerId });
    const endResult = await orchestratorService.endRound({
      roundId,
      playerId,
      correlationId,
      idempotencyKey: idempotencyKey ? `${idempotencyKey}-end` : undefined
    });
    results.sequence.push({
      step: 'endRound',
      status: endResult.status || 'completed',
      data: endResult
    });
    
    // Return success
    res.status(200).json({
      success: true,
      message: 'Probe sequence completed',
      results
    });
    
  } catch (error: any) {
    logger.error('Probe failed', { error, correlationId });
    
    // If error is already formatted from buildError
    if (error.status && error.body) {
      return res.status(error.status).json(error.body);
    }
    
    // Otherwise, map to generic error
    const { status, body } = buildError('RW-SYS-000', {
      message: 'Probe sequence failed',
      correlationId,
      extra: {
        step: error.step || 'unknown',
        detail: error.message
      }
    });
    res.status(status).json(body);
  }
});

// GET probe info - shows available in dev/test only
router.get('/probe', (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    const { status, body } = buildError('RW-CAS-005', {
      message: 'Probe endpoint not available in production',
      correlationId: (req as any).correlationId
    });
    return res.status(status).json(body);
  }
  
  res.status(200).json({
    success: true,
    message: 'Orchestrator probe endpoint',
    endpoints: {
      'POST /probe/round': 'Execute full round sequence (start → debit → credit → end)'
    },
    note: 'Only available in development/test environments'
  });
});

// === Rooms (DEV-ONLY) ===
router.post('/rooms/allocate', (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    const { status, body } = buildError('RW-CAS-005', { message:'Not allowed in production', correlationId:(req as any).correlationId, httpOverride:404 });
    return res.status(status).json(body);
  }
  const { gameId, playerId } = req.body||{};
  if (!gameId || !playerId) {
    const { status, body } = buildError('RW-CAS-006', { message:'Invalid request', correlationId:(req as any).correlationId, httpOverride:422 });
    return res.status(status).json(body);
  }
  const t0=Date.now();
  const room = orchestratorService.rooms.allocate(String(gameId), String(playerId));
  gRoomsActive.set(orchestratorService.rooms.state().length);
  logger.info('orch.rooms.allocate', { action:'orch.rooms.allocate', route:req.originalUrl, result:200, correlationId:(req as any).correlationId, ms:Date.now()-t0 });
  return res.status(200).json({ ok:true, roomId:room.id, gameId:room.gameId, players:room.players.size });
});

router.get('/rooms/state', (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    const { status, body } = buildError('RW-CAS-005', { message:'Not allowed in production', correlationId:(req as any).correlationId, httpOverride:404 });
    return res.status(status).json(body);
  }
  const t0=Date.now();
  const state = orchestratorService.rooms.state();
  logger.info('orch.rooms.state', { action:'orch.rooms.state', route:req.originalUrl, result:200, correlationId:(req as any).correlationId, ms:Date.now()-t0 });
  return res.status(200).json({ ok:true, rooms:state });
});

// === Rooms control (DEV-ONLY) ===
function blockProd(req: Request, res: Response) {
  const { status, body } = buildError('RW-CAS-005', { message:'Not allowed in production', correlationId:(req as any).correlationId, httpOverride:404 });
  return res.status(status).json(body);
}

// Method discipline (GET → 405) for mutating routes
router.get('/rooms/join',  (req,res)=>{ res.setHeader('Allow','POST');
  const { status, body } = buildError('RW-SYS-000',{ message:'Method Not Allowed', correlationId:(req as any).correlationId, httpOverride:405 }); 
  return res.status(status).json(body); });
router.get('/rooms/leave', (req,res)=>{ res.setHeader('Allow','POST');
  const { status, body } = buildError('RW-SYS-000',{ message:'Method Not Allowed', correlationId:(req as any).correlationId, httpOverride:405 });
  return res.status(status).json(body); });
router.get('/rooms/close', (req,res)=>{ res.setHeader('Allow','POST');
  const { status, body } = buildError('RW-SYS-000',{ message:'Method Not Allowed', correlationId:(req as any).correlationId, httpOverride:405 });
  return res.status(status).json(body); });

router.post('/rooms/join', (req: Request, res: Response) => {
  if (process.env.NODE_ENV==='production') return blockProd(req,res);
  const { roomId, playerId } = req.body||{};
  if (!roomId || !playerId || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(playerId)) {
    const { status, body } = buildError('RW-CAS-006',{ message:'Invalid request', correlationId:(req as any).correlationId, httpOverride:422 });
    return res.status(status).json(body);
  }
  const t0=Date.now();
  const room = orchestratorService.rooms.join(String(roomId), String(playerId));
  if (!room) {
    const { status, body } = buildError('RW-CAS-006',{ message:'Invalid request', correlationId:(req as any).correlationId, httpOverride:422 });
    return res.status(status).json(body);
  }
  logger.info('orch.rooms.join', { action:'orch.rooms.join', route:req.originalUrl, result:200, correlationId:(req as any).correlationId, ms:Date.now()-t0 });
  return res.status(200).json({ ok:true, roomId:room.id, gameId:room.gameId, players:room.players.size });
});

router.post('/rooms/leave', (req: Request, res: Response) => {
  if (process.env.NODE_ENV==='production') return blockProd(req,res);
  const { roomId, playerId } = req.body||{};
  if (!roomId || !playerId || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(playerId)) {
    const { status, body } = buildError('RW-CAS-006',{ message:'Invalid request', correlationId:(req as any).correlationId, httpOverride:422 });
    return res.status(status).json(body);
  }
  const t0=Date.now();
  const { room, removed } = orchestratorService.rooms.leave(String(roomId), String(playerId));
  logger.info('orch.rooms.leave', { action:'orch.rooms.leave', route:req.originalUrl, result:200, correlationId:(req as any).correlationId, ms:Date.now()-t0 });
  return res.status(200).json({ ok:true, roomId, removed, players: room ? room.players.size : 0 });
});

router.post('/rooms/close', (req: Request, res: Response) => {
  if (process.env.NODE_ENV==='production') return blockProd(req,res);
  const { roomId } = req.body||{};
  if (!roomId) {
    const { status, body } = buildError('RW-CAS-006',{ message:'Invalid request', correlationId:(req as any).correlationId, httpOverride:422 });
    return res.status(status).json(body);
  }
  const t0=Date.now();
  const closed = orchestratorService.rooms.close(String(roomId));
  gRoomsActive.set(orchestratorService.rooms.state().length);
  logger.info('orch.rooms.close', { action:'orch.rooms.close', route:req.originalUrl, result:200, correlationId:(req as any).correlationId, ms:Date.now()-t0 });
  return res.status(200).json({ ok: closed, roomId });
});

// === Match shim (DEV-ONLY) ===
function isUuidV4(v:string){ return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v); }

// GET → 405 (disciplina)
router.get('/match/create', (req,res)=>{ res.setHeader('Allow','POST');
  const {status,body}=buildError('RW-SYS-000',{message:'Method Not Allowed',correlationId:(req as any).correlationId,httpOverride:405});
  return res.status(status).json(body); });
router.get('/match/join', (req,res)=>{ res.setHeader('Allow','POST');
  const {status,body}=buildError('RW-SYS-000',{message:'Method Not Allowed',correlationId:(req as any).correlationId,httpOverride:405});
  return res.status(status).json(body); });
router.get('/match/start', (req,res)=>{ res.setHeader('Allow','POST');
  const {status,body}=buildError('RW-SYS-000',{message:'Method Not Allowed',correlationId:(req as any).correlationId,httpOverride:405});
  return res.status(status).json(body); });

// POST /match/create
router.post('/match/create', async (req: Request, res: Response) => {
  const ik = req.header('Idempotency-Key');
  const endpoint = `${req.method} ${req.originalUrl}`;
  if (ik) {
    const hit = await idemGet(ik, endpoint);
    if (hit) {
      Object.entries(hit.headers || {}).forEach(([k, v]) => res.setHeader(k, String(v)));
      logger.info('orch.idem.hit', { action: 'orch.idem.hit', route: req.originalUrl });
      mIdemHit.inc({ endpoint: req.originalUrl });
      return res.status(hit.status).json(hit.body);
    } else {
      mIdemMiss.inc({ endpoint: req.originalUrl });
    }
  }
  
  if (process.env.NODE_ENV==='production') return blockProd(req,res);
  if(!ik){ const {status,body}=buildError('RW-CAS-006',{message:'Invalid request',correlationId:(req as any).correlationId,httpOverride:422}); if(ik){ await idemPut(ik, endpoint, status, body, {'Content-Type':'application/json'}); } return res.status(status).json(body); }
  const { matchId, gameId, playerId, ts } = req.body||{};
  if(!isUuidV4(matchId)||!isUuidV4(playerId)||!gameId||!ts){ const {status,body}=buildError('RW-CAS-006',{message:'Invalid request',correlationId:(req as any).correlationId,httpOverride:422}); if(ik){ await idemPut(ik, endpoint, status, body, {'Content-Type':'application/json'}); } return res.status(status).json(body); }
  orchestratorService.emit('events.orch.match.created', { matchId, gameId, playerId, ts, modelVersion:'1' });
  const body = { accepted:true, matchId, gameId };
  logger.info('orch.match.create.accepted', { action:'orch.match.create.accepted', route:req.originalUrl, result:202, correlationId:(req as any).correlationId, ms:0 });
  if (ik) {
    await idemPut(ik, endpoint, 202, body, { 'Content-Type': 'application/json' });
    logger.info('orch.idem.store', { action: 'orch.idem.store', route: req.originalUrl, status: 202 });
  }
  return res.status(202).json(body);
});

// POST /match/join
router.post('/match/join', async (req: Request, res: Response) => {
  const ik = req.header('Idempotency-Key');
  const endpoint = `${req.method} ${req.originalUrl}`;
  if (ik) {
    const hit = await idemGet(ik, endpoint);
    if (hit) {
      Object.entries(hit.headers || {}).forEach(([k, v]) => res.setHeader(k, String(v)));
      logger.info('orch.idem.hit', { action: 'orch.idem.hit', route: req.originalUrl });
      mIdemHit.inc({ endpoint: req.originalUrl });
      return res.status(hit.status).json(hit.body);
    } else {
      mIdemMiss.inc({ endpoint: req.originalUrl });
    }
  }
  
  if (process.env.NODE_ENV==='production') return blockProd(req,res);
  if(!ik){ const {status,body}=buildError('RW-CAS-006',{message:'Invalid request',correlationId:(req as any).correlationId,httpOverride:422}); if(ik){ await idemPut(ik, endpoint, status, body, {'Content-Type':'application/json'}); } return res.status(status).json(body); }
  const { matchId, playerId, ts } = req.body||{};
  if(!isUuidV4(matchId)||!isUuidV4(playerId)||!ts){ const {status,body}=buildError('RW-CAS-006',{message:'Invalid request',correlationId:(req as any).correlationId,httpOverride:422}); if(ik){ await idemPut(ik, endpoint, status, body, {'Content-Type':'application/json'}); } return res.status(status).json(body); }
  orchestratorService.emit('events.orch.match.joined', { matchId, playerId, ts, modelVersion:'1' });
  const body = { accepted:true, matchId, joined:true };
  logger.info('orch.match.join.accepted', { action:'orch.match.join.accepted', route:req.originalUrl, result:202, correlationId:(req as any).correlationId, ms:0 });
  if (ik) {
    await idemPut(ik, endpoint, 202, body, { 'Content-Type': 'application/json' });
    logger.info('orch.idem.store', { action: 'orch.idem.store', route: req.originalUrl, status: 202 });
  }
  return res.status(202).json(body);
});

// POST /match/start
router.post('/match/start', async (req: Request, res: Response) => {
  const ik = req.header('Idempotency-Key');
  const endpoint = `${req.method} ${req.originalUrl}`;
  if (ik) {
    const hit = await idemGet(ik, endpoint);
    if (hit) {
      Object.entries(hit.headers || {}).forEach(([k, v]) => res.setHeader(k, String(v)));
      logger.info('orch.idem.hit', { action: 'orch.idem.hit', route: req.originalUrl });
      mIdemHit.inc({ endpoint: req.originalUrl });
      return res.status(hit.status).json(hit.body);
    } else {
      mIdemMiss.inc({ endpoint: req.originalUrl });
    }
  }
  
  if (process.env.NODE_ENV==='production') return blockProd(req,res);
  if(!ik){ const {status,body}=buildError('RW-CAS-006',{message:'Invalid request',correlationId:(req as any).correlationId,httpOverride:422}); if(ik){ await idemPut(ik, endpoint, status, body, {'Content-Type':'application/json'}); } return res.status(status).json(body); }
  const { matchId, ts } = req.body||{};
  if(!isUuidV4(matchId)||!ts){ const {status,body}=buildError('RW-CAS-006',{message:'Invalid request',correlationId:(req as any).correlationId,httpOverride:422}); if(ik){ await idemPut(ik, endpoint, status, body, {'Content-Type':'application/json'}); } return res.status(status).json(body); }
  orchestratorService.emit('events.orch.match.started', { matchId, ts, modelVersion:'1' });
  const body = { accepted:true, matchId, started:true };
  logger.info('orch.match.start.accepted', { action:'orch.match.start.accepted', route:req.originalUrl, result:202, correlationId:(req as any).correlationId, ms:0 });
  if (ik) {
    await idemPut(ik, endpoint, 202, body, { 'Content-Type': 'application/json' });
    logger.info('orch.idem.store', { action: 'orch.idem.store', route: req.originalUrl, status: 202 });
  }
  return res.status(202).json(body);
});

// === Metrics endpoint (DEV-ONLY) ===
router.get('/metrics', async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    const { status, body } = buildError('RW-CAS-005', { 
      message: 'Not Found',
      correlationId: (req as any).correlationId,
      httpOverride: 404
    });
    return res.status(status).json(body);
  }
  
  res.setHeader('Content-Type', 'text/plain; version=0.0.4');
  const metrics = await renderMetrics();
  res.send(metrics);
});

router.post('/metrics', (req: Request, res: Response) => {
  res.setHeader('Allow', 'GET');
  const { status, body } = buildError('RW-SYS-000', {
    message: 'Method Not Allowed',
    correlationId: (req as any).correlationId,
    httpOverride: 405
  });
  return res.status(status).json(body);
});

// Dev-only limits info
router.get('/limits', (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    const { status, body } = buildError('RW-CAS-005', { 
      message: 'Not allowed in production', 
      correlationId: (req as any).correlationId, 
      httpOverride: 404 
    });
    return res.status(status).json(body);
  }
  const limit = Number(process.env.ORCH_RATE_LIMIT ?? 5);
  const windowMs = Number(process.env.ORCH_RATE_WINDOW_MS ?? 10000);
  return res.status(200).json({ ok: true, limit, windowMs, env: 'dev' });
});

// Method discipline
router.post('/limits', (req: Request, res: Response) => {
  res.setHeader('Allow', 'GET');
  const { status, body } = buildError('RW-SYS-000', { 
    message: 'Method Not Allowed', 
    correlationId: (req as any).correlationId, 
    httpOverride: 405 
  });
  return res.status(status).json(body);
});

// --- Orchestrator OpenAPI (DEV ONLY) ---
router.get('/openapi.json', (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    const { status, body } = buildError('RW-CAS-005', { message: 'Not allowed in production', correlationId: (req as any).correlationId, httpOverride: 404 });
    return res.status(status).json(body);
  }
  const p = path.join(__dirname, '..', 'orchestrator', 'openapi.orch.dev.json');
  try {
    const json = JSON.parse(fs.readFileSync(p, 'utf-8'));
    logger.info('orch.openapi.served', { action: 'orch.openapi.served', route: req.originalUrl, result: 200, correlationId: (req as any).correlationId });
    return res.status(200).json(json);
  } catch (e: any) {
    const { status, body } = buildError('RW-SYS-000', { message: 'OpenAPI not available', correlationId: (req as any).correlationId, httpOverride: 500 });
    return res.status(status).json(body);
  }
});

router.post('/openapi.json', (req: Request, res: Response) => {
  res.setHeader('Allow', 'GET');
  const { status, body } = buildError('RW-SYS-000', { message: 'Method Not Allowed', correlationId: (req as any).correlationId, httpOverride: 405 });
  return res.status(status).json(body);
});

export default router;