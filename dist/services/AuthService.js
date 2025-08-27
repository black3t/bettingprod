"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const uuid_1 = require("uuid");
const database_1 = require("../config/database");
const sessionStore_1 = require("../utils/sessionStore");
const logger_1 = require("../utils/logger");
class AuthService {
    SALT_ROUNDS = 12; // OWASP recommendation for bcrypt
    JWT_SECRET = process.env.JWT_SECRET || 'casino_jwt_secret_2024_change_in_production';
    SESSION_TTL = 7200; // 2 hours
    MAX_LOGIN_ATTEMPTS = 5;
    LOCKOUT_DURATION = 900; // 15 minutes in seconds
    async signup(request, ipAddress) {
        // Validate input
        this.validateSignupInput(request);
        try {
            return await (0, database_1.transaction)(async (client) => {
                // Check if user already exists
                const existingUser = await client.query('SELECT id FROM users WHERE email = $1 OR username = $2', [request.email.toLowerCase(), request.username.toLowerCase()]);
                if (existingUser.rows.length > 0) {
                    throw this.createError('User already exists with this email or username', 409, 'USER_EXISTS');
                }
                // Hash password with salt
                const passwordHash = await bcrypt_1.default.hash(request.password, this.SALT_ROUNDS);
                // Create user
                const userId = (0, uuid_1.v4)();
                const userResult = await client.query(`INSERT INTO users (
            id, username, email, password_hash, 
            first_name, last_name, date_of_birth, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING id, username, email, first_name, last_name, created_at`, [
                    userId,
                    request.username.toLowerCase(),
                    request.email.toLowerCase(),
                    passwordHash,
                    request.first_name || null,
                    request.last_name || null,
                    request.date_of_birth || null,
                    'active'
                ]);
                const newUser = userResult.rows[0];
                // Create wallet for new user (in SQLite mode, no trigger)
                const walletId = (0, uuid_1.v4)();
                await client.query(`INSERT INTO user_wallets (id, user_id, balance, currency) 
           VALUES ($1, $2, $3, $4)`, [walletId, userId, 10000, 'EUR']);
                // Get wallet
                const walletResult = await client.query('SELECT balance, currency FROM user_wallets WHERE user_id = $1', [userId]);
                const wallet = walletResult.rows[0];
                // Create session
                const session = await this.createSession(userId, ipAddress);
                logger_1.logger.info('User signup successful', {
                    userId,
                    username: request.username,
                    email: request.email
                });
                return {
                    success: true,
                    token: session.token,
                    user: {
                        id: newUser.id,
                        username: newUser.username,
                        email: newUser.email,
                        first_name: newUser.first_name,
                        last_name: newUser.last_name,
                        balance: parseFloat(wallet.balance).toFixed(2), // stringa "10000.00"
                        currency: wallet.currency
                    }
                };
            });
        }
        catch (error) {
            logger_1.logger.error('Signup failed', { error: error.message, email: request.email });
            if (error.code) {
                throw error;
            }
            throw this.createError('Signup failed', 500, 'SIGNUP_ERROR');
        }
    }
    async login(request, ipAddress, userAgent) {
        const email = request.email.toLowerCase();
        try {
            // Check login attempts
            await this.checkLoginAttempts(email, ipAddress);
            // Get user
            const userResult = await (0, database_1.query)(`SELECT id, username, email, password_hash, first_name, last_name, status 
         FROM users 
         WHERE email = $1`, [email]);
            if (userResult.rows.length === 0) {
                await this.recordLoginAttempt(email, ipAddress, false, 'User not found');
                throw this.createError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
            }
            const user = userResult.rows[0];
            // Check user status
            if (user.status !== 'active') {
                await this.recordLoginAttempt(email, ipAddress, false, `Account ${user.status}`);
                throw this.createError(`Account is ${user.status}`, 403, 'ACCOUNT_INACTIVE');
            }
            // Verify password
            const passwordValid = await bcrypt_1.default.compare(request.password, user.password_hash);
            if (!passwordValid) {
                await this.recordLoginAttempt(email, ipAddress, false, 'Invalid password');
                throw this.createError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
            }
            // Record successful login
            await this.recordLoginAttempt(email, ipAddress, true);
            // Update last login
            await (0, database_1.query)('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
            // Get wallet
            const walletResult = await (0, database_1.query)('SELECT balance, currency FROM user_wallets WHERE user_id = $1', [user.id]);
            const wallet = walletResult.rows[0];
            // Create session
            const session = await this.createSession(user.id, ipAddress, userAgent);
            logger_1.logger.info('User login successful', {
                userId: user.id,
                username: user.username,
                email: user.email
            });
            return {
                success: true,
                token: session.token,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    first_name: user.first_name,
                    last_name: user.last_name,
                    balance: parseFloat(wallet.balance).toFixed(2), // stringa "10000.00"
                    currency: wallet.currency
                }
            };
        }
        catch (error) {
            logger_1.logger.error('Login failed', { error: error.message, email });
            if (error.code) {
                throw error;
            }
            throw this.createError('Login failed', 500, 'LOGIN_ERROR');
        }
    }
    async validateSession(token) {
        try {
            // Verify JWT
            const decoded = jsonwebtoken_1.default.verify(token, this.JWT_SECRET);
            // Check Redis cache
            const cachedSession = await sessionStore_1.sessionStore.get(`session:${decoded.session_id}`);
            if (!cachedSession) {
                // Check database
                const sessionResult = await (0, database_1.query)(`SELECT * FROM user_sessions 
           WHERE id = $1 AND token = $2 AND is_active = true AND expires_at > NOW()`, [decoded.session_id, token]);
                if (sessionResult.rows.length === 0) {
                    return null;
                }
                // Cache the session
                await sessionStore_1.sessionStore.setex(`session:${decoded.session_id}`, this.SESSION_TTL, JSON.stringify(sessionResult.rows[0]));
            }
            // Get user
            const userResult = await (0, database_1.query)(`SELECT id, username, email, first_name, last_name, status, email_verified 
         FROM users 
         WHERE id = $1 AND status = 'active'`, [decoded.user_id]);
            if (userResult.rows.length === 0) {
                return null;
            }
            // Update session activity
            await (0, database_1.query)('UPDATE user_sessions SET last_activity = NOW() WHERE id = $1', [decoded.session_id]);
            return userResult.rows[0];
        }
        catch (error) {
            logger_1.logger.warn('Session validation failed', { token: token.substring(0, 20) });
            return null;
        }
    }
    async logout(token) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, this.JWT_SECRET);
            // Invalidate session in database
            await (0, database_1.query)('UPDATE user_sessions SET is_active = false WHERE id = $1', [decoded.session_id]);
            // Remove from Redis
            await sessionStore_1.sessionStore.del(`session:${decoded.session_id}`);
            logger_1.logger.info('User logged out', { sessionId: decoded.session_id });
        }
        catch (error) {
            logger_1.logger.error('Logout failed', error);
        }
    }
    async createSession(userId, ipAddress, userAgent) {
        const sessionId = (0, uuid_1.v4)();
        const expiresAt = new Date(Date.now() + this.SESSION_TTL * 1000);
        // Create JWT token
        const token = jsonwebtoken_1.default.sign({
            session_id: sessionId,
            user_id: userId,
            exp: Math.floor(expiresAt.getTime() / 1000)
        }, this.JWT_SECRET);
        // Store in database
        const result = await (0, database_1.query)(`INSERT INTO user_sessions (
        id, user_id, token, ip_address, user_agent, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`, [sessionId, userId, token, ipAddress || null, userAgent || null, expiresAt]);
        const session = result.rows[0];
        // Cache in Redis
        await sessionStore_1.sessionStore.setex(`session:${sessionId}`, this.SESSION_TTL, JSON.stringify(session));
        return session;
    }
    async checkLoginAttempts(email, ipAddress) {
        // Use different query syntax based on database type (SQLite vs PostgreSQL)
        const USE_SQLITE = process.env.USE_SQLITE === 'true';
        const queryText = USE_SQLITE
            ? `SELECT COUNT(*) as count 
         FROM login_attempts 
         WHERE (email = $1 OR ip_address = $2) 
         AND success = 0 
         AND attempted_at > datetime('now', '-${this.LOCKOUT_DURATION} seconds')`
            : `SELECT COUNT(*) as count 
         FROM login_attempts 
         WHERE (email = $1 OR ip_address = $2) 
         AND success = false 
         AND attempted_at > NOW() - INTERVAL '${this.LOCKOUT_DURATION} seconds'`;
        const recentAttempts = await (0, database_1.query)(queryText, [email, ipAddress]);
        const attemptCount = parseInt(recentAttempts.rows[0].count);
        if (attemptCount >= this.MAX_LOGIN_ATTEMPTS) {
            throw this.createError(`Too many login attempts. Please try again in ${Math.floor(this.LOCKOUT_DURATION / 60)} minutes`, 429, 'TOO_MANY_ATTEMPTS');
        }
    }
    async recordLoginAttempt(email, ipAddress, success, errorMessage) {
        const USE_SQLITE = process.env.USE_SQLITE === 'true';
        await (0, database_1.query)(`INSERT INTO login_attempts (email, ip_address, success, error_message)
       VALUES ($1, $2, $3, $4)`, [email, ipAddress || null, USE_SQLITE ? (success ? 1 : 0) : success, errorMessage || null]);
    }
    validateSignupInput(request) {
        // Username validation
        if (!request.username || request.username.length < 3) {
            throw this.createError('Username must be at least 3 characters', 400, 'INVALID_USERNAME');
        }
        if (!/^[a-zA-Z0-9_-]+$/.test(request.username)) {
            throw this.createError('Username can only contain letters, numbers, - and _', 400, 'INVALID_USERNAME');
        }
        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(request.email)) {
            throw this.createError('Invalid email address', 400, 'INVALID_EMAIL');
        }
        // Password validation (OWASP guidelines)
        if (!request.password || request.password.length < 8) {
            throw this.createError('Password must be at least 8 characters', 400, 'WEAK_PASSWORD');
        }
        // Check password complexity
        const hasUpperCase = /[A-Z]/.test(request.password);
        const hasLowerCase = /[a-z]/.test(request.password);
        const hasNumbers = /\d/.test(request.password);
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(request.password);
        const complexity = [hasUpperCase, hasLowerCase, hasNumbers, hasSpecialChar].filter(Boolean).length;
        if (complexity < 3) {
            throw this.createError('Password must contain at least 3 of: uppercase, lowercase, numbers, special characters', 400, 'WEAK_PASSWORD');
        }
        // Date of birth validation (optional but if provided, must be valid)
        if (request.date_of_birth) {
            const dob = new Date(request.date_of_birth);
            const age = (Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
            if (age < 18) {
                throw this.createError('Must be 18 or older to register', 400, 'UNDERAGE');
            }
            if (age > 150) {
                throw this.createError('Invalid date of birth', 400, 'INVALID_DOB');
            }
        }
    }
    createError(message, statusCode, code) {
        const error = new Error(message);
        error.statusCode = statusCode;
        error.code = code;
        return error;
    }
}
exports.AuthService = AuthService;
//# sourceMappingURL=AuthService.js.map