import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { buildError } from '../registry/rw';

// Pattern per validare money come stringa decimale (dalla bibbia)
const MONEY_PATTERN = /^\d+\.\d{2}$/;

const schemas = {
  // Schema esistenti per UI casino
  signup: Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    first_name: Joi.string().max(100).optional(),
    last_name: Joi.string().max(100).optional(),
    date_of_birth: Joi.date().max('now').optional()
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),

  launchGame: Joi.object({
    game_code: Joi.string().required(),
    demo_mode: Joi.boolean().optional()
  }),

  updateProfile: Joi.object({
    first_name: Joi.string().max(100).optional(),
    last_name: Joi.string().max(100).optional(),
    date_of_birth: Joi.date().max('now').optional()
  }).min(1),

  // NUOVI SCHEMA PER RGS (dalla bibbia §4.5)
  walletDebit: Joi.object({
    playerId: Joi.string().required(),
    amount: Joi.string().regex(MONEY_PATTERN).required(), // STRINGA "10.00"
    currency: Joi.string().length(3).required()
    // idempotencyKey ora richiesto in header Idempotency-Key
  }),

  walletCredit: Joi.object({
    playerId: Joi.string().required(),
    amount: Joi.string().regex(MONEY_PATTERN).required(), // STRINGA "10.00"
    currency: Joi.string().length(3).required()
    // idempotencyKey ora richiesto in header Idempotency-Key
  }),

  limitsCheck: Joi.object({
    playerId: Joi.string().required(),
    stake: Joi.string().regex(MONEY_PATTERN).required() // STRINGA "10.00"
  }),

  playerExcluded: Joi.object({
    playerId: Joi.string().uuid().required(),
    reason: Joi.string().required(),
    ts: Joi.string().isoDate().required() // ISO8601
  }),

  balanceChanged: Joi.object({
    playerId: Joi.string().uuid().required(),
    newBalance: Joi.string().regex(MONEY_PATTERN).required(), // STRINGA "1000.00"
    ts: Joi.string().isoDate().required() // ISO8601
  })
};

export const validate = (schemaName: keyof typeof schemas) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const schema = schemas[schemaName];
    
    if (!schema) {
      next();
      return;
    }

    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const correlationId = req.headers['x-correlation-id'] as string;
      const { status, body } = buildError('RW-CAS-006', {
        message: 'Validation failed',
        correlationId,
        extra: {
          details: error.details.map(d => ({
            field: d.path.join('.'),
            message: d.message
          }))
        }
      });
      res.status(status).json(body);
      return;
    }

    req.body = value;
    next();
  };
};