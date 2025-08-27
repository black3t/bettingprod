"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletService = void 0;
const uuid_1 = require("uuid");
const database_1 = require("../config/database");
const redis_1 = require("../config/redis");
const logger_1 = require("../utils/logger");
const errorCodes_1 = require("../utils/errorCodes");
const money_1 = require("../utils/money");
const PlayerService_1 = require("./PlayerService");
const ResponsibleGamingService_1 = require("./ResponsibleGamingService");
function exp48hISO() { return new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(); }
// Read by key (prima della business logic)
async function idmpGet(key) {
    try {
        const { rows } = await (0, database_1.query)(`SELECT response FROM idempotency_keys WHERE key=$1`, [key]);
        if (!rows?.[0])
            return null;
        const env = JSON.parse(rows[0].response);
        if (env?.exp && Date.parse(env.exp) < Date.now())
            return null;
        return (env && 'payload' in env) ? env.payload : env; // compat
    }
    catch {
        return null;
    }
}
// Write WITHIN the current UoW (stessa connessione/tx)
async function idmpPutTx(client, key, response) {
    try {
        const body = JSON.stringify({ exp: exp48hISO(), payload: response });
        const expiresAt = exp48hISO();
        await client.query(`INSERT INTO idempotency_keys(key,response,expires_at) VALUES($1,$2,$3)
       ON CONFLICT(key) DO UPDATE SET response=$2, expires_at=$3`, [key, body, expiresAt]);
    }
    catch { /* mai rompere il flusso */ }
}
class WalletService {
    IDEMPOTENCY_WINDOW = 48 * 3600 * 1000; // 48h in ms
    playerService = new PlayerService_1.PlayerService();
    /**
     * Helper per formattare importi sempre come stringa "xx.yy"
     */
    toAmountString2(v) {
        const num = typeof v === 'string' ? parseFloat(v) : v;
        const formatted = num.toFixed(2);
        // Handle -0.00 -> 0.00
        return formatted === '-0.00' ? '0.00' : formatted;
    }
    /**
     * Canonicalizza la risposta per garantire formato identico in replay
     * Bible r.144: replay deve essere byte-for-byte identico
     */
    canonicalizeResponse(r) {
        const out = { status: r.status };
        // Include reason solo se definito e non vuoto
        if (r.reason !== undefined && r.reason !== null && r.reason !== '') {
            out.reason = String(r.reason);
        }
        // Include newBalance solo se definito
        if (r.newBalance !== undefined && r.newBalance !== null) {
            out.newBalance = this.toAmountString2(r.newBalance);
        }
        return out;
    }
    /**
     * Addebita fondi dal wallet (per scommesse)
     * Bibbia §4.5: amount deve essere stringa decimale
     */
    async debit(operation) {
        if (operation?.idempotencyKey) {
            const hit = await idmpGet(operation.idempotencyKey);
            if (hit) {
                logger_1.logger.info('Idempotency hit (debit)', { correlationId: operation.correlationId });
                return hit;
            }
        }
        // Check Responsible Gaming restrictions
        const rgCheck = await ResponsibleGamingService_1.responsibleGamingService.checkRestrictions(operation.playerId);
        if (!rgCheck.allowed) {
            const response = {
                status: 'REJECTED',
                reason: 'RW-CAS-003' // Limits exceeded per spec TR-08
            };
            const canonicalResponse = this.canonicalizeResponse(response);
            await (0, database_1.transaction)(async (client) => {
                await idmpPutTx(client, operation.idempotencyKey, canonicalResponse);
            });
            return canonicalResponse;
        }
        // Valida currency
        const expectedCurrency = await this.playerService.currencyFor(operation.playerId);
        if (operation.currency !== expectedCurrency) {
            const response = {
                status: 'REJECTED',
                reason: 'RW-CAS-008' // Currency mismatch
            };
            const canonicalResponse = this.canonicalizeResponse(response);
            await (0, database_1.transaction)(async (client) => {
                await idmpPutTx(client, operation.idempotencyKey, canonicalResponse);
            });
            return canonicalResponse;
        }
        let response;
        try {
            response = await (0, database_1.transaction)(async (client) => {
                // Legacy check - commented per PROD-IDMP
                // const existing = await this.checkIdempotencyTx(client, operation.idempotencyKey);
                // if (existing) { 
                //   return existing; 
                // }
                // Lock wallet per update atomico (FOR UPDATE non supportato in SQLite)
                const USE_SQLITE = process.env.USE_SQLITE === 'true';
                const lockQuery = USE_SQLITE
                    ? 'SELECT * FROM user_wallets WHERE user_id = $1'
                    : 'SELECT * FROM user_wallets WHERE user_id = $1 FOR UPDATE';
                const walletResult = await client.query(lockQuery, [operation.playerId]);
                let wallet;
                let currentBalance;
                if (walletResult.rows.length === 0) {
                    // Se il giocatore non esiste, crealo con balance 0
                    // La bibbia non richiede che i giocatori pre-esistano
                    const walletId = (0, uuid_1.v4)();
                    await client.query('INSERT INTO user_wallets (id, user_id, balance, currency) VALUES ($1, $2, $3, $4)', [walletId, operation.playerId, 0, operation.currency]);
                    wallet = { id: walletId, balance: 0 };
                    currentBalance = 0;
                }
                else {
                    wallet = walletResult.rows[0];
                    currentBalance = Math.round(parseFloat(wallet.balance) * 100); // Convert to minor units
                }
                // Verifica currency match
                if (wallet.currency && wallet.currency !== operation.currency) {
                    const response = {
                        status: 'REJECTED',
                        reason: 'RW-CAS-008' // Currency mismatch
                    };
                    const canonicalResponse = this.canonicalizeResponse(response);
                    await idmpPutTx(client, operation.idempotencyKey, canonicalResponse);
                    return canonicalResponse;
                }
                const debitAmountMinor = (0, money_1.toMinor)(operation.amount);
                // Verifica amount valido (deve essere positivo)
                if (debitAmountMinor <= 0) {
                    const response = {
                        status: 'REJECTED',
                        reason: 'RW-CAS-002' // Invalid amount as insufficient funds
                    };
                    const canonicalResponse = this.canonicalizeResponse(response);
                    await idmpPutTx(client, operation.idempotencyKey, canonicalResponse);
                    return canonicalResponse;
                }
                // Verifica fondi sufficienti (in minor units)
                if (currentBalance < debitAmountMinor) {
                    const response = {
                        status: 'REJECTED',
                        reason: 'RW-CAS-002' // Insufficient funds
                    };
                    const canonicalResponse = this.canonicalizeResponse(response);
                    await idmpPutTx(client, operation.idempotencyKey, canonicalResponse);
                    return canonicalResponse;
                }
                // Esegui addebito (in minor units)
                const newBalanceMinor = currentBalance - debitAmountMinor;
                await client.query('UPDATE user_wallets SET balance = $1 WHERE user_id = $2', [newBalanceMinor / 100, operation.playerId] // Store as decimal for compatibility
                );
                // Registra transazione nel ledger - SOLO campi esistenti
                const txId = (0, uuid_1.v4)();
                await client.query(`INSERT INTO wallet_transactions 
           (id, wallet_id, user_id, type, amount, balance_before, balance_after, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [
                    txId,
                    wallet.id, // wallet_id necessario
                    operation.playerId,
                    'debit', // Lowercase come si aspettano i test
                    this.toAmountString2(debitAmountMinor / 100),
                    this.toAmountString2(currentBalance / 100),
                    this.toAmountString2(newBalanceMinor / 100),
                    new Date().toISOString()
                ]);
                const resp = {
                    status: 'APPROVED',
                    newBalance: (0, money_1.toMajor)(newBalanceMinor) // stringa da minor units!
                };
                // Canonicalizza prima di salvare e ritornare
                const canonicalResponse = this.canonicalizeResponse(resp);
                await idmpPutTx(client, operation.idempotencyKey, canonicalResponse);
                return canonicalResponse;
            });
            (0, logger_1.logPlayerOperation)('Wallet debit successful', {
                playerId: operation.playerId,
                amount: operation.amount,
                newBalance: response.newBalance,
                correlationId: operation.correlationId
            });
            // Webhook via outbox - non più HTTP nel path (Bible r.142, r.231-232)
            // try {
            //   await webhookSender.sendBalanceChanged(operation.playerId, response.newBalance!);
            // } catch (error) {
            //   logger.warn('Failed to send balance changed webhook', { error });
            // }
            // Response già salvata nella transazione
            return response;
        }
        catch (error) {
            logger_1.logger.error('Wallet debit failed', {
                error: error.message,
                playerId: operation.playerId,
                amount: operation.amount
            });
            throw this.createError('Transaction failed', 500, errorCodes_1.CasinoErrorCodes.TRANSACTION_FAILED);
        }
    }
    /**
     * Accredita fondi al wallet (per vincite)
     * Bibbia §4.5: amount deve essere stringa decimale
     */
    async credit(operation) {
        if (operation?.idempotencyKey) {
            const hit = await idmpGet(operation.idempotencyKey);
            if (hit) {
                logger_1.logger.info('Idempotency hit (credit)', { correlationId: operation.correlationId });
                return hit;
            }
        }
        // Valida currency
        const expectedCurrency = await this.playerService.currencyFor(operation.playerId);
        if (operation.currency !== expectedCurrency) {
            const response = {
                status: 'REJECTED',
                reason: 'RW-CAS-008' // Currency mismatch
            };
            const canonicalResponse = this.canonicalizeResponse(response);
            await (0, database_1.transaction)(async (client) => {
                await idmpPutTx(client, operation.idempotencyKey, canonicalResponse);
            });
            return canonicalResponse;
        }
        let response;
        try {
            response = await (0, database_1.transaction)(async (client) => {
                // Legacy check - commented per PROD-IDMP
                // const existing = await this.checkIdempotencyTx(client, operation.idempotencyKey);
                // if (existing) { 
                //   return existing; 
                // }
                // Lock wallet per update atomico (FOR UPDATE non supportato in SQLite)
                const USE_SQLITE = process.env.USE_SQLITE === 'true';
                const lockQuery = USE_SQLITE
                    ? 'SELECT * FROM user_wallets WHERE user_id = $1'
                    : 'SELECT * FROM user_wallets WHERE user_id = $1 FOR UPDATE';
                const walletResult = await client.query(lockQuery, [operation.playerId]);
                let wallet;
                let currentBalance;
                if (walletResult.rows.length === 0) {
                    // Se il giocatore non esiste, crealo con balance 0
                    // La bibbia non richiede che i giocatori pre-esistano
                    const walletId = (0, uuid_1.v4)();
                    await client.query('INSERT INTO user_wallets (id, user_id, balance, currency) VALUES ($1, $2, $3, $4)', [walletId, operation.playerId, 0, operation.currency]);
                    wallet = { id: walletId, balance: 0 };
                    currentBalance = 0;
                }
                else {
                    wallet = walletResult.rows[0];
                    currentBalance = Math.round(parseFloat(wallet.balance) * 100); // Convert to minor units
                }
                // Verifica currency match
                if (wallet.currency && wallet.currency !== operation.currency) {
                    const response = {
                        status: 'REJECTED',
                        reason: 'RW-CAS-008' // Currency mismatch
                    };
                    const canonicalResponse = this.canonicalizeResponse(response);
                    await idmpPutTx(client, operation.idempotencyKey, canonicalResponse);
                    return canonicalResponse;
                }
                const creditAmountMinor = (0, money_1.toMinor)(operation.amount);
                // Verifica amount valido (deve essere positivo)
                if (creditAmountMinor <= 0) {
                    const response = {
                        status: 'REJECTED',
                        reason: 'RW-CAS-002' // Invalid amount as insufficient funds
                    };
                    const canonicalResponse = this.canonicalizeResponse(response);
                    await idmpPutTx(client, operation.idempotencyKey, canonicalResponse);
                    return canonicalResponse;
                }
                // Esegui accredito (in minor units)
                const newBalanceMinor = currentBalance + creditAmountMinor;
                await client.query('UPDATE user_wallets SET balance = $1 WHERE user_id = $2', [newBalanceMinor / 100, operation.playerId] // Store as decimal for compatibility
                );
                // Registra transazione nel ledger - SOLO campi esistenti
                const txId = (0, uuid_1.v4)();
                await client.query(`INSERT INTO wallet_transactions 
           (id, wallet_id, user_id, type, amount, balance_before, balance_after, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [
                    txId,
                    wallet.id, // wallet_id necessario
                    operation.playerId,
                    'credit', // Lowercase come si aspettano i test
                    this.toAmountString2(creditAmountMinor / 100),
                    this.toAmountString2(currentBalance / 100),
                    this.toAmountString2(newBalanceMinor / 100),
                    new Date().toISOString()
                ]);
                const resp = {
                    status: 'APPROVED',
                    newBalance: (0, money_1.toMajor)(newBalanceMinor) // stringa da minor units!
                };
                // Canonicalizza prima di salvare e ritornare
                const canonicalResponse = this.canonicalizeResponse(resp);
                await idmpPutTx(client, operation.idempotencyKey, canonicalResponse);
                return canonicalResponse;
            });
            return response;
        }
        catch (error) {
            logger_1.logger.error('Wallet credit failed', {
                error: error.message,
                playerId: operation.playerId,
                amount: operation.amount
            });
            throw this.createError('Transaction failed', 500, errorCodes_1.CasinoErrorCodes.TRANSACTION_FAILED);
        }
    }
    async cancelTransaction(playerId, transactionId, amount, reason, correlationId, idempotencyKey) {
        try {
            if (idempotencyKey) {
                const hit = await idmpGet(idempotencyKey);
                if (hit) {
                    logger_1.logger.info('Idempotency hit (cancel)', { correlationId });
                    return hit;
                }
            }
            // Use transaction pattern from debit/credit
            const response = await (0, database_1.transaction)(async (client) => {
                // Legacy check - commented per PROD-IDMP
                // const existingTx = await this.checkIdempotencyTx(client, idempotencyKey);
                // if (existingTx) {
                //   return existingTx;
                // }
                // Check if transaction exists and is cancellable
                const txResult = await client.query('SELECT * FROM wallet_transactions WHERE id = $1 AND user_id = $2', [transactionId, playerId]);
                if (txResult.rows.length === 0) {
                    const response = {
                        status: 'REJECTED',
                        reason: 'RW-CAS-001' // Transaction not found
                    };
                    const canonicalResponse = this.canonicalizeResponse(response);
                    await idmpPutTx(client, idempotencyKey, canonicalResponse);
                    return canonicalResponse;
                }
                const tx = txResult.rows[0];
                // Check if already cancelled
                if (tx.status === 'cancelled') {
                    const response = {
                        status: 'REJECTED',
                        reason: 'RW-CAS-006' // Already cancelled
                    };
                    const canonicalResponse = this.canonicalizeResponse(response);
                    await idmpPutTx(client, idempotencyKey, canonicalResponse);
                    return canonicalResponse;
                }
                // Lock wallet for atomic update
                const USE_SQLITE = process.env.USE_SQLITE === 'true';
                const lockQuery = USE_SQLITE
                    ? 'SELECT * FROM user_wallets WHERE user_id = $1'
                    : 'SELECT * FROM user_wallets WHERE user_id = $1 FOR UPDATE';
                const walletResult = await client.query(lockQuery, [playerId]);
                if (walletResult.rows.length === 0) {
                    const response = {
                        status: 'REJECTED',
                        reason: 'RW-CAS-001' // Player not found
                    };
                    const canonicalResponse = this.canonicalizeResponse(response);
                    await idmpPutTx(client, idempotencyKey, canonicalResponse);
                    return canonicalResponse;
                }
                const wallet = walletResult.rows[0];
                const currentBalance = Math.round(parseFloat(wallet.balance) * 100);
                const cancelAmountMinor = (0, money_1.toMinor)(amount);
                // Reverse the original transaction
                let newBalanceMinor;
                if (tx.type === 'debit') {
                    // Cancel debit = credit back
                    newBalanceMinor = currentBalance + cancelAmountMinor;
                }
                else if (tx.type === 'credit') {
                    // Cancel credit = debit back
                    if (currentBalance < cancelAmountMinor) {
                        const response = {
                            status: 'REJECTED',
                            reason: 'RW-CAS-002' // Insufficient funds to cancel credit
                        };
                        const canonicalResponse = this.canonicalizeResponse(response);
                        await idmpPutTx(client, idempotencyKey, canonicalResponse);
                        return canonicalResponse;
                    }
                    newBalanceMinor = currentBalance - cancelAmountMinor;
                }
                else {
                    const response = {
                        status: 'REJECTED',
                        reason: 'RW-CAS-006' // Invalid transaction type
                    };
                    const canonicalResponse = this.canonicalizeResponse(response);
                    await idmpPutTx(client, idempotencyKey, canonicalResponse);
                    return canonicalResponse;
                }
                // Update balance
                await client.query('UPDATE user_wallets SET balance = $1 WHERE user_id = $2', [newBalanceMinor / 100, playerId]);
                // Mark original transaction as cancelled
                await client.query('UPDATE wallet_transactions SET status = $1 WHERE id = $2', ['cancelled', transactionId]);
                // Record cancellation transaction
                const cancelTxId = (0, uuid_1.v4)();
                await client.query(`INSERT INTO wallet_transactions 
           (id, wallet_id, user_id, type, amount, balance_before, balance_after, created_at, reference_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`, [
                    cancelTxId,
                    wallet.id,
                    playerId,
                    'cancel',
                    this.toAmountString2(cancelAmountMinor / 100),
                    this.toAmountString2(currentBalance / 100),
                    this.toAmountString2(newBalanceMinor / 100),
                    new Date().toISOString(),
                    transactionId
                ]);
                const resp = {
                    status: 'APPROVED',
                    newBalance: (0, money_1.toMajor)(newBalanceMinor)
                };
                const canonicalResponse = this.canonicalizeResponse(resp);
                // Legacy: await this.storeIdempotency(idempotencyKey, canonicalResponse, client);
                return canonicalResponse;
            });
            // Response già salvata nella transazione
            return response;
        }
        catch (error) {
            logger_1.logger.error('Wallet cancel failed', {
                error: error.message,
                playerId,
                transactionId
            });
            throw this.createError('Cancel failed', 500, errorCodes_1.CasinoErrorCodes.TRANSACTION_FAILED);
        }
    }
    async checkIdempotencyTx(client, key) {
        const USE_SQLITE = process.env.USE_SQLITE === 'true';
        const timeQuery = USE_SQLITE
            ? `SELECT response FROM idempotency_keys WHERE key = $1 AND expires_at > datetime('now') LIMIT 1`
            : `SELECT response FROM idempotency_keys WHERE key = $1 AND expires_at > CURRENT_TIMESTAMP LIMIT 1`;
        const { rows } = await client.query(timeQuery, [key]);
        if (!rows || rows.length === 0)
            return null;
        // Parse e canonicalizza la risposta salvata
        try {
            const parsed = JSON.parse(rows[0].response);
            return this.canonicalizeResponse(parsed);
        }
        catch {
            return this.canonicalizeResponse(rows[0].response);
        }
    }
    async checkIdempotency(key) {
        const USE_SQLITE = process.env.USE_SQLITE === 'true';
        if (!USE_SQLITE && redis_1.redis) {
            // Prod: usa Redis
            const cached = await redis_1.redis.get(`idempotency:${key}`);
            if (cached) {
                return JSON.parse(cached);
            }
        }
        else {
            // Pre-Prod: usa DB
            const timeQuery = USE_SQLITE
                ? "SELECT response FROM idempotency_keys WHERE key = $1 AND expires_at > datetime('now')"
                : 'SELECT response FROM idempotency_keys WHERE key = $1 AND expires_at > NOW()';
            const result = await (0, database_1.query)(timeQuery, [key]);
            if (result.rows.length > 0) {
                // response è salvata come JSON string nel DB
                const responseStr = result.rows[0].response;
                return typeof responseStr === 'string' ? JSON.parse(responseStr) : responseStr;
            }
        }
        return null;
    }
    async storeIdempotency(key, response, client) {
        const USE_SQLITE = process.env.USE_SQLITE === 'true';
        if (!USE_SQLITE && redis_1.redis) {
            // Prod: usa Redis con TTL 48h (Bible r.144: finestra 48h)
            await redis_1.redis.setex(`idempotency:${key}`, this.IDEMPOTENCY_WINDOW / 1000, JSON.stringify(response));
        }
        else {
            // Pre-Prod: usa DB - Bible r.144: "replay identico"
            // Bible r.25/r.142: tutte le scritture nello stesso UoW/transaction
            const expiresAt = new Date(Date.now() + this.IDEMPOTENCY_WINDOW);
            await client.query(`INSERT INTO idempotency_keys (key, response, expires_at) 
         VALUES ($1, $2, $3)
         ON CONFLICT (key) DO NOTHING`, [key, JSON.stringify(response), expiresAt.toISOString()]);
        }
    }
    createError(message, statusCode, code) {
        const error = new Error(message);
        error.statusCode = statusCode;
        error.code = code;
        return error;
    }
}
exports.WalletService = WalletService;
//# sourceMappingURL=WalletService.js.map