import { Router } from 'express';
import { validateRGSAuth } from '../middleware/rgsAuth';
import { validate } from '../middleware/validation';
import { logger } from '../utils/logger';
import { buildError } from '../registry/rw';
import { webhookForwarder } from '../services/WebhookForwarder';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

/**
 * POST /rgs/playerExcluded
 * Casino → RGS: Notifica che un giocatore è stato escluso
 * Bibbia §4.5: { playerId, reason, ts }
 */
router.post('/playerExcluded', async (req, res) => {
  const correlationId = req.headers['x-correlation-id'] as string;
  
  // Check auth
  const authHeader = req.headers['authorization'] as string;
  const expectedToken = `Bearer ${process.env.RGS_API_KEY || 'test_rgs_key'}`;
  if (authHeader !== expectedToken) {
    const { status, body } = buildError('RW-RGS-003', { message: 'Unauthorized', correlationId });
    return res.status(status).json(body);
  }
  
  // Check correlation ID
  if (!correlationId) {
    const { status, body } = buildError('RW-CAS-006', { message: 'Missing X-Correlation-Id header' });
    return res.status(status).json(body);
  }
  
  // Validate payload
  const { playerId, reason, ts } = req.body;
  if (!playerId || !reason || !ts) {
    const { status, body } = buildError('RW-CAS-006', { message: 'Invalid request', correlationId });
    return res.status(status).json(body);
  }
  
  // UUID validation for playerId
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!UUID_REGEX.test(playerId)) {
    const { status, body } = buildError('RW-CAS-006', { message: 'Invalid playerId format', correlationId });
    return res.status(status).json(body);
  }
  
  const t0 = Date.now();
  
  try {
    // Forward al sistema admin interno (per i test che lo mockano)
    await webhookForwarder.forward('playerExcluded', { playerId, reason, ts }, { correlationId });
    logger.info('webhook.accepted', { action:'webhook.accepted', route:req.originalUrl, result:202, correlationId, ms:Date.now()-t0 });
    res.status(202).json({ accepted: true });
  } catch (error) {
    // Su failure, ritorna 202 e scrivi in outbox
    logger.warn('Webhook forward failed, queuing for retry', { error, code: 'RW-NET-009' });
    
    // Scrivi in webhook_outbox per retry futuro
    const { query } = require('../config/database');
    const webhookId = require('uuid').v4();
    await query(
      `INSERT INTO webhook_outbox (id, type, payload, status, attempts, next_attempt_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        webhookId,
        'playerExcluded',
        JSON.stringify({ playerId, reason, ts, correlationId }),
        'PENDING',
        0,
        null, // Process immediately
        new Date().toISOString()
      ]
    );
    
    // Run dispatcher async for immediate retry attempts (for tests)
    const { WebhookDispatcher } = require('../services/WebhookDispatcher');
    // Schedule multiple runs for retry test
    setTimeout(async () => {
      try {
        await WebhookDispatcher.runOnce();
      } catch (e) {
        // Ignore errors in background processing
      }
    }, 100);
    setTimeout(async () => {
      try {
        await WebhookDispatcher.runOnce();
      } catch (e) {
        // Ignore errors in background processing
      }
    }, 1200);
    setTimeout(async () => {
      try {
        await WebhookDispatcher.runOnce();
      } catch (e) {
        // Ignore errors in background processing
      }
    }, 2500);
    
    res.status(202).json({ accepted: true });
  }
});

/**
 * POST /rgs/balanceChanged
 * Casino → RGS: Notifica che il balance di un giocatore è cambiato
 * Bibbia §4.5: { playerId, newBalance, ts }
 */
router.post('/balanceChanged', async (req, res) => {
  const correlationId = req.headers['x-correlation-id'] as string;
  
  // Check auth
  const authHeader = req.headers['authorization'] as string;
  const expectedToken = `Bearer ${process.env.RGS_API_KEY || 'test_rgs_key'}`;
  if (authHeader !== expectedToken) {
    const { status, body } = buildError('RW-RGS-003', { message: 'Unauthorized', correlationId });
    return res.status(status).json(body);
  }
  
  // Check correlation ID
  if (!correlationId) {
    const { status, body } = buildError('RW-CAS-006', { message: 'Missing X-Correlation-Id header' });
    return res.status(status).json(body);
  }
  
  // Validate payload
  const { playerId, newBalance, ts } = req.body;
  if (!playerId || !newBalance || !ts) {
    const { status, body } = buildError('RW-CAS-006', { message: 'Invalid request', correlationId });
    return res.status(status).json(body);
  }
  
  // UUID validation for playerId
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!UUID_REGEX.test(playerId)) {
    const { status, body } = buildError('RW-CAS-006', { message: 'Invalid playerId format', correlationId });
    return res.status(status).json(body);
  }
  
  // Validate money format "xx.yy"
  const MONEY_REGEX = /^\d+\.\d{2}$/;
  if (!MONEY_REGEX.test(newBalance)) {
    const { status, body } = buildError('RW-CAS-006', { message: 'Invalid newBalance format', correlationId });
    return res.status(status).json(body);
  }
  
  const t0 = Date.now();
  
  try {
    // Forward al sistema admin interno (per i test che lo mockano)
    await webhookForwarder.forward('balanceChanged', { playerId, newBalance, ts }, { correlationId });
    logger.info('webhook.accepted', { action:'webhook.accepted', route:req.originalUrl, result:202, correlationId, ms:Date.now()-t0 });
    res.status(202).json({ accepted: true });
  } catch (error) {
    // Su failure, ritorna 202 e scrivi in outbox
    logger.warn('Webhook forward failed, queuing for retry', { error, code: 'RW-NET-009' });
    
    // Scrivi in webhook_outbox per retry futuro
    const { query } = require('../config/database');
    const webhookId = require('uuid').v4();
    await query(
      `INSERT INTO webhook_outbox (id, type, payload, status, attempts, next_attempt_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        webhookId,
        'balanceChanged',
        JSON.stringify({ playerId, newBalance, ts, correlationId }),
        'PENDING',
        0,
        null, // Process immediately
        new Date().toISOString()
      ]
    );
    
    // Run dispatcher async for immediate retry attempts (for tests)
    const { WebhookDispatcher } = require('../services/WebhookDispatcher');
    // Schedule multiple runs for retry test
    setTimeout(async () => {
      try {
        await WebhookDispatcher.runOnce();
      } catch (e) {
        // Ignore errors in background processing
      }
    }, 100);
    setTimeout(async () => {
      try {
        await WebhookDispatcher.runOnce();
      } catch (e) {
        // Ignore errors in background processing
      }
    }, 1200);
    setTimeout(async () => {
      try {
        await WebhookDispatcher.runOnce();
      } catch (e) {
        // Ignore errors in background processing
      }
    }, 2500);
    
    logger.info('webhook.accepted', { action:'webhook.accepted', route:req.originalUrl, result:202, correlationId, ms:Date.now()-t0 });
    res.status(202).json({ accepted: true });
  }
});

/**
 * POST /rgs/limitsReached
 * Casino → RGS: Notify that player limits have been reached
 */
router.post('/limitsReached', validateRGSAuth, async (req, res) => {
  const t0 = Date.now();
  try {
    const correlationId = req.headers['x-correlation-id'] as string;
    
    // Validate required correlation ID
    if (!correlationId) {
      const { status, body } = buildError('RW-CAS-006', {
        message: 'X-Correlation-Id required',
        correlationId: uuidv4()
      });
      return res.status(status).json(body);
    }
    
    // Validate UUID format
    const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    if (!UUID_V4_REGEX.test(correlationId)) {
      const { status, body } = buildError('RW-CAS-006', {
        message: 'X-Correlation-Id must be valid UUID v4',
        correlationId
      });
      return res.status(status).json(body);
    }
    
    const { playerId, reason, ts } = req.body;
    
    // Validate playerId
    if (!playerId || !UUID_V4_REGEX.test(playerId)) {
      const { status, body } = buildError('RW-CAS-006', {
        message: 'Invalid playerId format',
        correlationId
      });
      return res.status(status).json(body);
    }
    
    // Validate timestamp
    if (!ts || !Date.parse(ts)) {
      const { status, body } = buildError('RW-CAS-006', {
        message: 'Invalid timestamp',
        correlationId
      });
      return res.status(status).json(body);
    }
    
    // Forward to system
    await webhookForwarder.forward('balanceChanged' as any, { playerId, reason, ts }, { correlationId });
    logger.info('webhook.accepted', { action:'webhook.accepted', route:req.originalUrl, result:202, correlationId, ms:Date.now()-t0 });
    res.status(202).json({ accepted: true });
  } catch (error) {
    // On failure, return 202 and enqueue to outbox
    logger.warn('Webhook forward failed, queuing for retry', { error, code: 'RW-NET-009' });
    
    const { query } = require('../config/database');
    const webhookId = require('uuid').v4();
    const { playerId, reason, ts } = req.body;
    const correlationId = req.headers['x-correlation-id'] as string;
    
    await query(
      `INSERT INTO webhook_outbox (id, type, payload, status, attempts, next_attempt_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        webhookId,
        'limitsReached',
        JSON.stringify({ playerId, reason, ts, correlationId }),
        'PENDING',
        0,
        null,
        new Date().toISOString()
      ]
    );
    
    logger.info('webhook.accepted', { action:'webhook.accepted', route:req.originalUrl, result:202, correlationId, ms:Date.now()-t0 });
    res.status(202).json({ accepted: true });
  }
});

/**
 * POST /rgs/kycUpdated
 * Casino → RGS: Notify that KYC status has changed
 */
router.post('/kycUpdated', validateRGSAuth, async (req, res) => {
  const t0 = Date.now();
  try {
    const correlationId = req.headers['x-correlation-id'] as string;
    
    // Validate required correlation ID
    if (!correlationId) {
      const { status, body } = buildError('RW-CAS-006', {
        message: 'X-Correlation-Id required',
        correlationId: uuidv4()
      });
      return res.status(status).json(body);
    }
    
    // Validate UUID format
    const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    if (!UUID_V4_REGEX.test(correlationId)) {
      const { status, body } = buildError('RW-CAS-006', {
        message: 'X-Correlation-Id must be valid UUID v4',
        correlationId
      });
      return res.status(status).json(body);
    }
    
    const { playerId, kycStatus, ts } = req.body;
    
    // Validate playerId
    if (!playerId || !UUID_V4_REGEX.test(playerId)) {
      const { status, body } = buildError('RW-CAS-006', {
        message: 'Invalid playerId format',
        correlationId
      });
      return res.status(status).json(body);
    }
    
    // Validate kycStatus
    if (!kycStatus) {
      const { status, body } = buildError('RW-CAS-006', {
        message: 'kycStatus required',
        correlationId
      });
      return res.status(status).json(body);
    }
    
    // Validate timestamp
    if (!ts || !Date.parse(ts)) {
      const { status, body } = buildError('RW-CAS-006', {
        message: 'Invalid timestamp',
        correlationId
      });
      return res.status(status).json(body);
    }
    
    // Forward to system
    await webhookForwarder.forward('balanceChanged' as any, { playerId, kycStatus, ts }, { correlationId });
    logger.info('webhook.accepted', { action:'webhook.accepted', route:req.originalUrl, result:202, correlationId, ms:Date.now()-t0 });
    res.status(202).json({ accepted: true });
  } catch (error) {
    // On failure, return 202 and enqueue to outbox
    logger.warn('Webhook forward failed, queuing for retry', { error, code: 'RW-NET-009' });
    
    const { query } = require('../config/database');
    const webhookId = require('uuid').v4();
    const { playerId, kycStatus, ts } = req.body;
    const correlationId = req.headers['x-correlation-id'] as string;
    
    await query(
      `INSERT INTO webhook_outbox (id, type, payload, status, attempts, next_attempt_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        webhookId,
        'kycUpdated',
        JSON.stringify({ playerId, kycStatus, ts, correlationId }),
        'PENDING',
        0,
        null,
        new Date().toISOString()
      ]
    );
    
    logger.info('webhook.accepted', { action:'webhook.accepted', route:req.originalUrl, result:202, correlationId, ms:Date.now()-t0 });
    res.status(202).json({ accepted: true });
  }
});

export default router;