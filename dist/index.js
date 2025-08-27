"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importStar(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const compression_1 = __importDefault(require("compression"));
const dotenv_1 = __importDefault(require("dotenv"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
const gameRoutes_1 = __importDefault(require("./routes/gameRoutes"));
const walletRoutes_1 = __importDefault(require("./routes/walletRoutes"));
const limitsRoutes_1 = __importDefault(require("./routes/limitsRoutes"));
const webhookRoutes_1 = __importDefault(require("./routes/webhookRoutes"));
const healthRoutes_1 = __importStar(require("./routes/healthRoutes"));
const playerRoutes_1 = __importDefault(require("./routes/playerRoutes"));
const rgRoutes_1 = __importDefault(require("./routes/rgRoutes"));
const kycRoutes_1 = __importDefault(require("./routes/kycRoutes"));
const rgsGameRoutes_1 = __importDefault(require("./routes/rgsGameRoutes"));
const rwRegistryRoutes_1 = __importDefault(require("./routes/rwRegistryRoutes"));
const logger_1 = require("./utils/logger");
const timeout_1 = require("./middleware/timeout");
const concurrent_1 = require("./middleware/concurrent");
const database_1 = require("./config/database");
const redis_1 = require("./config/redis");
const uuid_1 = require("uuid");
const rw_1 = require("./registry/rw");
const USE_SQLITE = process.env.USE_SQLITE === 'true';
// Load environment variables
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
console.log('[BOOT]', new Date().toISOString(), 'express', require('express/package.json').version);
// LOG 1: TOP level
app.use((req, res, next) => {
    console.log('[TOP]', req.method, req.originalUrl);
    next();
});
// Test endpoint
app.get('/__up', (req, res) => {
    console.log('[UP] Server is up');
    res.json({ up: true, pid: process.pid });
});
// Security middleware
app.use((0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            frameSrc: ["'self'", "http://localhost:3004"], // Allow game iframe
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
}));
// Rate limiting
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later'
});
const authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit auth attempts
    skipSuccessfulRequests: true
});
// CORS configuration - parse comma-separated string from env
const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
    : ['http://localhost:3000', 'http://localhost:3004', 'http://localhost:5173', 'http://localhost:5174'];
// Middleware
app.use((0, compression_1.default)());
app.use((0, cors_1.default)({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or Postman)
        if (!origin)
            return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, cookie_parser_1.default)());
// Correlation ID middleware (OBBLIGATORIO dalla bibbia)
app.use((req, res, next) => {
    let correlationId = req.headers['x-correlation-id'];
    // Se non presente, genera nuovo UUID v4
    if (!correlationId) {
        correlationId = (0, uuid_1.v4)();
    }
    // Valida formato UUID v4 (richiesto dalla bibbia)
    const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    if (!UUID_V4_REGEX.test(correlationId)) {
        const { status, body } = (0, rw_1.buildError)('RW-CAS-006', {
            message: 'X-Correlation-Id must be valid UUID v4 format',
            correlationId: correlationId // Include even if invalid for debugging
        });
        return res.status(status).json(body);
    }
    // Aggiungi a request e response
    req.correlationId = correlationId;
    res.setHeader('X-Correlation-Id', correlationId);
    next();
});
// Request logging con correlation ID
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        (0, logger_1.logPlayerOperation)('Request', {
            method: req.method,
            path: req.path,
            status: res.statusCode,
            duration,
            ip: req.ip,
            correlationId: req.correlationId,
            playerId: req.body?.playerId || 'anonymous'
        });
    });
    next();
});
// Apply timeout middleware (2s as per bible) - only in non-test mode
if (process.env.NODE_ENV !== 'test') {
    app.use((0, timeout_1.timeoutMiddleware)(2000));
    app.use((0, timeout_1.simulateTimeout)());
}
// Global rate limiting
app.use((0, concurrent_1.globalRateLimit)());
// Concurrent request handling for wallet operations
app.use((0, concurrent_1.concurrentRequestHandler)());
// Routes esistenti per UI Casino
app.use('/api/auth', authLimiter, authRoutes_1.default);
app.use('/api/user', limiter, userRoutes_1.default);
app.use('/api/games', limiter, gameRoutes_1.default);
// Function to mount Casino routes with given base path
function mountRoutes(app, basePath) {
    const base = basePath || '';
    // Mount feature routes
    app.use(`${base}/wallet`, walletRoutes_1.default);
    app.use(`${base}/limits`, limitsRoutes_1.default);
    app.use(`${base}/player`, playerRoutes_1.default);
    app.use(`${base}/rg`, rgRoutes_1.default);
    app.use(`${base}/kyc`, kycRoutes_1.default);
    // Mount webhooks ONLY with full base path (not in compat root)
    if (base) {
        app.use(`${base}/rgs`, webhookRoutes_1.default);
    }
    // Mount RW registry admin route  
    app.use(`${base}/admin/rw`, rwRegistryRoutes_1.default);
    // Mount admin seed routes only in dev/test with DEV_SEED=true
    if (process.env.DEV_SEED === 'true' &&
        (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test')) {
        const adminSeedRoutes = require('./routes/adminSeedRoutes').default;
        app.use(`${base}/admin/seed`, adminSeedRoutes);
    }
}
// Determine base paths and compat mode
const API_BASE_PATH = process.env.API_BASE_PATH || '/casino/api/v1';
const RGS_BASE_PATH = process.env.RGS_BASE_PATH || '/rgs/api/v1';
const isDevOrTest = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
const COMPAT_ROUTES = process.env.COMPAT_ROUTES === 'true' || (isDevOrTest && process.env.COMPAT_ROUTES !== 'false');
// 1) Casino domain
console.log('[MOUNT] Casino routes at:', API_BASE_PATH);
mountRoutes(app, API_BASE_PATH);
console.log('[MOUNT] Casino health at:', `${API_BASE_PATH}/health`);
app.use(`${API_BASE_PATH}/health`, healthRoutes_1.default);
// 2) RGS domain (SUB-ROUTER)
console.log('[MOUNT] Creating RGS router');
const rgsRouter = (0, express_1.Router)();
// LOG for RGS Router
rgsRouter.use((req, res, next) => {
    console.log('[RGS]', req.method, req.originalUrl, 'path=', req.path);
    next();
});
// health FIRST (path EXACT)
rgsRouter.get('/health', healthRoutes_1.healthHandler);
// POST /health returns 405
rgsRouter.post('/health', (req, res) => {
    const t0 = Date.now();
    res.setHeader('Allow', 'GET');
    logger_1.logger.info('health.method_discipline', { action: 'health.method_discipline', route: req.originalUrl, result: 405, code: 'RW-SYS-000', correlationId: req.correlationId, ms: Date.now() - t0 });
    const { status, body } = (0, rw_1.buildError)('RW-SYS-000', {
        message: 'Method Not Allowed',
        correlationId: req.correlationId,
        httpOverride: 405
    });
    res.status(status).json(body);
});
// PROBE ENDPOINT (keep for testing)
rgsRouter.get('/__probe', (req, res) => res.json({ ok: true, at: 'RGS router' }));
// game routes AFTER
rgsRouter.use('/', rgsGameRoutes_1.default);
// router-level 404
rgsRouter.use((req, res) => {
    const { status, body } = (0, rw_1.buildError)('RW-SYS-000', {
        httpOverride: 404,
        message: 'Not found',
        correlationId: req.correlationId
    });
    return res.status(status).json(body);
});
console.log('[MOUNT] RGS router at:', RGS_BASE_PATH);
app.use(RGS_BASE_PATH, rgsRouter);
// 3) Orchestrator domain (SUB-ROUTER) - only if enabled
const ORCH_ENABLED = process.env.ORCH_ENABLED === 'true';
const ORCH_BASE_PATH = process.env.ORCH_BASE_PATH || '/orch/api/v1';
if (ORCH_ENABLED) {
    console.log('[MOUNT] Creating Orchestrator router');
    const orchRouter = (0, express_1.Router)();
    // LOG for Orchestrator Router
    orchRouter.use((req, res, next) => {
        console.log('[ORCH]', req.method, req.originalUrl, 'path=', req.path);
        next();
    });
    // DEV-ONLY rate limit for orchestrator
    if (process.env.NODE_ENV !== 'production') {
        const { orchRateLimit } = require('./middleware/orchRateLimit');
        orchRouter.use(orchRateLimit({}));
    }
    // Mount orchestrator routes
    const orchestratorRoutes = require('./routes/orchestratorRoutes').default;
    orchRouter.use('/', orchestratorRoutes);
    // router-level 404
    orchRouter.use((req, res) => {
        const { status, body } = (0, rw_1.buildError)('RW-SYS-000', {
            httpOverride: 404,
            message: 'Not found',
            correlationId: req.correlationId
        });
        return res.status(status).json(body);
    });
    console.log('[MOUNT] Orchestrator router at:', ORCH_BASE_PATH);
    app.use(ORCH_BASE_PATH, orchRouter);
}
// 4) DEV/TEST compat mounts — SAFE
if (COMPAT_ROUTES && isDevOrTest) {
    // Mount compat routes WITHOUT /rgs prefix collision
    const compatBase = '';
    // Casino compat routes (without /rgs webhooks)
    app.use(`${compatBase}/wallet`, walletRoutes_1.default);
    app.use(`${compatBase}/limits`, limitsRoutes_1.default);
    app.use(`${compatBase}/player`, playerRoutes_1.default);
    app.use(`${compatBase}/rg`, rgRoutes_1.default);
    app.use(`${compatBase}/kyc`, kycRoutes_1.default);
    // Skip /rgs webhooks in compat to avoid collision
    // Compat health at root
    app.use('/health', healthRoutes_1.default);
    app.use('/admin/health', healthRoutes_1.default);
    // RGS game endpoints at root (optional)
    app.use('/', rgsGameRoutes_1.default);
    // Orchestrator compat mount (only in dev/test if enabled)
    if (ORCH_ENABLED) {
        const orchestratorRoutes = require('./routes/orchestratorRoutes').default;
        app.use('/orch', orchestratorRoutes);
    }
}
// Error handling - map to RW codes
app.use((err, req, res, next) => {
    logger_1.logger.error('Unhandled error', err);
    // Map to RW-SYS-000 for unhandled errors
    const errorCode = err.code || 'RW-SYS-000';
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        error: {
            code: errorCode,
            message: process.env.NODE_ENV === 'production'
                ? 'System error'
                : err.message,
            correlationId: req.correlationId
        }
    });
});
// 404 handler
app.use((req, res) => {
    const { status, body } = (0, rw_1.buildError)('RW-SYS-000', {
        httpOverride: 404,
        message: 'Not found',
        correlationId: req.correlationId
    });
    res.status(status).json(body);
});
// Graceful shutdown
process.on('SIGTERM', async () => {
    logger_1.logger.info('SIGTERM received, shutting down gracefully');
    if (database_1.pool) {
        await database_1.pool.end();
    }
    if (redis_1.redis) {
        await redis_1.redis.quit();
    }
    process.exit(0);
});
// Start server
if (process.env.SKIP_LISTEN !== 'true') {
    app.listen(PORT, () => {
        logger_1.logger.info(`Casino Mock Platform running on port ${PORT}`);
        logger_1.logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
        logger_1.logger.info(`Health check: http://localhost:${PORT}/health`);
        // Debug env & versions
        console.log('=== ENV VALUES ===');
        console.log('NODE_ENV:', process.env.NODE_ENV);
        console.log('API_BASE_PATH:', process.env.API_BASE_PATH);
        console.log('RGS_BASE_PATH:', process.env.RGS_BASE_PATH);
        console.log('ORCH_ENABLED:', process.env.ORCH_ENABLED);
        console.log('ORCH_BASE_PATH:', process.env.ORCH_BASE_PATH);
        console.log('COMPAT_ROUTES:', process.env.COMPAT_ROUTES);
        console.log('DEV_SEED:', process.env.DEV_SEED);
        console.log('USE_SQLITE:', process.env.USE_SQLITE);
        if (ORCH_ENABLED) {
            console.log('ORCH_INMEMORY_BUS:', process.env.ORCH_INMEMORY_BUS);
            console.log('ORCH_MAX_RETRIES:', process.env.ORCH_MAX_RETRIES);
            console.log('ORCH_BACKOFF_MS:', process.env.ORCH_BACKOFF_MS);
            console.log('ORCH_IDEMPOTENCY_TTL_H:', process.env.ORCH_IDEMPOTENCY_TTL_H);
            console.log('RGS_BASE_URL:', process.env.RGS_BASE_URL);
            console.log('CASINO_BASE_URL:', process.env.CASINO_BASE_URL);
        }
        console.log('=== VERSIONS ===');
        console.log('Node:', process.version);
        const expressVersion = require('express/package.json').version;
        console.log('Express:', expressVersion);
        console.log('=== RUNTIME VALUES ===');
        console.log('RGS_BASE_PATH runtime:', RGS_BASE_PATH);
        console.log('RGS_BASE_PATH length:', RGS_BASE_PATH.length);
        console.log('RGS_BASE_PATH charCodes:', Array.from(RGS_BASE_PATH).map(c => c.charCodeAt(0)));
    });
}
// Export for debugging
module.exports = app;
//# sourceMappingURL=index.js.map