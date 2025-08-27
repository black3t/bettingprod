import { Router } from 'express';
import { setDegradeState, resetDegradeState } from '../utils/healthDegrade';
import { buildError } from '../registry/rw';

const router = Router();

// Only allow in non-production
router.post('/degrade/:component', (req, res) => {
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_DEGRADE_TEST) {
    const { status, body } = buildError('RW-CAS-005', {
      message: 'Degrade simulation not allowed in production',
      correlationId: (req as any).correlationId
    });
    return res.status(status).json(body);
  }

  const { component } = req.params;
  const { state } = req.body;

  if (component !== 'db' && component !== 'redis') {
    const { status, body } = buildError('RW-CAS-006', {
      message: 'Invalid component',
      correlationId: (req as any).correlationId
    });
    return res.status(status).json(body);
  }

  setDegradeState(component, state === true);
  res.json({ success: true, component, degraded: state === true });
});

router.post('/reset', (req, res) => {
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_DEGRADE_TEST) {
    const { status, body } = buildError('RW-CAS-005', {
      message: 'Degrade simulation not allowed in production',
      correlationId: (req as any).correlationId
    });
    return res.status(status).json(body);
  }

  resetDegradeState();
  res.json({ success: true, message: 'Degrade state reset' });
});

export default router;