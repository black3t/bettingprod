"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = void 0;
const joi_1 = __importDefault(require("joi"));
const rw_1 = require("../registry/rw");
// Pattern per validare money come stringa decimale (dalla bibbia)
const MONEY_PATTERN = /^\d+\.\d{2}$/;
const schemas = {
    // Schema esistenti per UI casino
    signup: joi_1.default.object({
        username: joi_1.default.string().alphanum().min(3).max(30).required(),
        email: joi_1.default.string().email().required(),
        password: joi_1.default.string().min(8).required(),
        first_name: joi_1.default.string().max(100).optional(),
        last_name: joi_1.default.string().max(100).optional(),
        date_of_birth: joi_1.default.date().max('now').optional()
    }),
    login: joi_1.default.object({
        email: joi_1.default.string().email().required(),
        password: joi_1.default.string().required()
    }),
    launchGame: joi_1.default.object({
        game_code: joi_1.default.string().required(),
        demo_mode: joi_1.default.boolean().optional()
    }),
    updateProfile: joi_1.default.object({
        first_name: joi_1.default.string().max(100).optional(),
        last_name: joi_1.default.string().max(100).optional(),
        date_of_birth: joi_1.default.date().max('now').optional()
    }).min(1),
    // NUOVI SCHEMA PER RGS (dalla bibbia §4.5)
    walletDebit: joi_1.default.object({
        playerId: joi_1.default.string().required(),
        amount: joi_1.default.string().regex(MONEY_PATTERN).required(), // STRINGA "10.00"
        currency: joi_1.default.string().length(3).required()
        // idempotencyKey ora richiesto in header Idempotency-Key
    }),
    walletCredit: joi_1.default.object({
        playerId: joi_1.default.string().required(),
        amount: joi_1.default.string().regex(MONEY_PATTERN).required(), // STRINGA "10.00"
        currency: joi_1.default.string().length(3).required()
        // idempotencyKey ora richiesto in header Idempotency-Key
    }),
    limitsCheck: joi_1.default.object({
        playerId: joi_1.default.string().required(),
        stake: joi_1.default.string().regex(MONEY_PATTERN).required() // STRINGA "10.00"
    }),
    playerExcluded: joi_1.default.object({
        playerId: joi_1.default.string().uuid().required(),
        reason: joi_1.default.string().required(),
        ts: joi_1.default.string().isoDate().required() // ISO8601
    }),
    balanceChanged: joi_1.default.object({
        playerId: joi_1.default.string().uuid().required(),
        newBalance: joi_1.default.string().regex(MONEY_PATTERN).required(), // STRINGA "1000.00"
        ts: joi_1.default.string().isoDate().required() // ISO8601
    })
};
const validate = (schemaName) => {
    return (req, res, next) => {
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
            const correlationId = req.headers['x-correlation-id'];
            const { status, body } = (0, rw_1.buildError)('RW-CAS-006', {
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
exports.validate = validate;
//# sourceMappingURL=validation.js.map