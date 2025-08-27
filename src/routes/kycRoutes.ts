import { Router } from 'express';
import { kycService, KYCStatus } from '../services/KYCService';
import { validateRGSAuth } from '../middleware/rgsAuth';
import { logger } from '../utils/logger';
import { buildError } from '../registry/rw';

const router = Router();

/**
 * GET /kyc/status
 * Bible riga 691: kyc status endpoint (canonical)
 */
router.get('/status', validateRGSAuth, async (req, res) => {
  try {
    const playerId = req.query.playerId as string;
    
    if (!playerId) {
      const { status, body } = buildError('RW-CAS-006', {
        message: 'playerId required',
        correlationId: (req as any).correlationId
      });
      return res.status(status).json(body);
    }
    
    const kycStatus = await kycService.getKYCStatus(playerId);
    res.json(kycStatus);
    
  } catch (error: any) {
    logger.error('KYC status error', error);
    const { status, body } = buildError('RW-SYS-000', {
      message: error.message,
      correlationId: (req as any).correlationId
    });
    res.status(status).json(body);
  }
});

/**
 * POST /kyc/status
 * Deprecated compatibility alias - use GET /kyc/status
 */
router.post('/status', validateRGSAuth, async (req, res) => {
  const sunsetDate = new Date();
  sunsetDate.setDate(sunsetDate.getDate() + 90);
  res.setHeader('Deprecation', 'true');
  res.setHeader('Sunset', sunsetDate.toISOString());
  res.setHeader('Link', '</kyc/status>; rel="successor-version"');
  
  try {
    const playerId = req.body.playerId;
    
    if (!playerId) {
      const { status, body } = buildError('RW-CAS-006', {
        message: 'playerId required',
        correlationId: (req as any).correlationId
      });
      return res.status(status).json(body);
    }
    
    const kycStatus = await kycService.getKYCStatus(playerId);
    res.json(kycStatus);
    
  } catch (error: any) {
    logger.error('KYC status error', error);
    const { status, body } = buildError('RW-SYS-000', {
      message: error.message,
      correlationId: (req as any).correlationId
    });
    res.status(status).json(body);
  }
});

/**
 * POST /kyc/update
 * Update KYC status
 */
router.post('/update', validateRGSAuth, async (req, res) => {
  try {
    const { playerId, status } = req.body;
    
    if (!playerId || !status) {
      const { status: httpStatus, body } = buildError('RW-CAS-006', {
        message: 'playerId and status required',
        correlationId: (req as any).correlationId
      });
      return res.status(httpStatus).json(body);
    }
    
    if (!Object.values(KYCStatus).includes(status)) {
      const { status: httpStatus, body } = buildError('RW-CAS-006', {
        message: 'Invalid KYC status',
        correlationId: (req as any).correlationId
      });
      return res.status(httpStatus).json(body);
    }
    
    await kycService.updateKYCStatus(playerId, status as KYCStatus);
    
    res.json({
      status: 'OK',
      message: 'KYC status updated'
    });
    
  } catch (error: any) {
    logger.error('KYC update error', error);
    const { status, body } = buildError('RW-SYS-000', {
      message: error.message,
      correlationId: (req as any).correlationId
    });
    res.status(status).json(body);
  }
});

/**
 * GET /kyc/exclusions
 * Bible riga 691: exclusions endpoint (canonical)
 */
router.get('/exclusions', validateRGSAuth, async (req, res) => {
  try {
    const playerId = req.query.playerId as string;
    
    if (!playerId) {
      const { status, body } = buildError('RW-CAS-006', {
        message: 'playerId required',
        correlationId: (req as any).correlationId
      });
      return res.status(status).json(body);
    }
    
    const exclusions = await kycService.getExclusions(playerId);
    res.json(exclusions);
    
  } catch (error: any) {
    logger.error('Exclusions error', error);
    const { status, body } = buildError('RW-SYS-000', {
      message: error.message,
      correlationId: (req as any).correlationId
    });
    res.status(status).json(body);
  }
});

/**
 * POST /kyc/exclusions
 * Deprecated compatibility alias - use GET /kyc/exclusions
 */
router.post('/exclusions', validateRGSAuth, async (req, res) => {
  const sunsetDate = new Date();
  sunsetDate.setDate(sunsetDate.getDate() + 90);
  res.setHeader('Deprecation', 'true');
  res.setHeader('Sunset', sunsetDate.toISOString());
  res.setHeader('Link', '</kyc/exclusions>; rel="successor-version"');
  
  try {
    const playerId = req.body.playerId;
    
    if (!playerId) {
      const { status, body } = buildError('RW-CAS-006', {
        message: 'playerId required',
        correlationId: (req as any).correlationId
      });
      return res.status(status).json(body);
    }
    
    const exclusions = await kycService.getExclusions(playerId);
    res.json(exclusions);
    
  } catch (error: any) {
    logger.error('Exclusions error', error);
    const { status, body } = buildError('RW-SYS-000', {
      message: error.message,
      correlationId: (req as any).correlationId
    });
    res.status(status).json(body);
  }
});

export default router;