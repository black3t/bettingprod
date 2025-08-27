import { v4 as uuidv4 } from 'uuid';
import { query, transaction } from '../config/database';
import { redis } from '../config/redis';
import { logger, logPlayerOperation } from '../utils/logger';
import { CasinoErrorCodes } from '../utils/errorCodes';
import { webhookSender } from './WebhookSender';
import { toMinor, toMajor } from '../utils/money';
import { PlayerService } from './PlayerService';
import { responsibleGamingService } from './ResponsibleGamingService';

// === PROD IDMP helpers (48h, single-source) ===
type IdmpEnvelope = { exp: string; payload: any };

function exp48hISO() { return new Date(Date.now() + 48*60*60*1000).toISOString(); }

// Read by key (prima della business logic)
async function idmpGet(key: string): Promise<any|null> {
  try {
    const { rows } = await query(`SELECT response FROM idempotency_keys WHERE key=$1`, [key]);
    if (!rows?.[0]) return null;
    const env = JSON.parse(rows[0].response) as IdmpEnvelope | any;
    if (env?.exp && Date.parse(env.exp) < Date.now()) return null;
    return (env && 'payload' in env) ? env.payload : env; // compat
  } catch { return null; }
}

// Write WITHIN the current UoW (stessa connessione/tx)
async function idmpPutTx(
  client: { query: (sql: string, params?: any[]) => Promise<any> },
  key: string,
  response: any
): Promise<void> {
  try {
    const body = JSON.stringify({ exp: exp48hISO(), payload: response } as IdmpEnvelope);
    const expiresAt = exp48hISO();
    await client.query(
      `INSERT INTO idempotency_keys(key,response,expires_at) VALUES($1,$2,$3)
       ON CONFLICT(key) DO UPDATE SET response=$2, expires_at=$3`,
      [key, body, expiresAt]
    );
  } catch { /* mai rompere il flusso */ }
}

interface WalletOperation {
  playerId: string;
  amount: string; // SEMPRE stringa formato "10.00"
  currency: string;
  idempotencyKey: string;
  correlationId: string;
}

interface WalletResponse {
  status: 'APPROVED' | 'REJECTED';
  reason?: string; // codice RW-CAS-*
  newBalance?: string; // stringa "1000.00"
}

export class WalletService {
  private readonly IDEMPOTENCY_WINDOW = 48 * 3600 * 1000; // 48h in ms
  private readonly playerService = new PlayerService();

  /**
   * Helper per formattare importi sempre come stringa "xx.yy"
   */
  private toAmountString2(v: string | number): string {
    const num = typeof v === 'string' ? parseFloat(v) : v;
    const formatted = num.toFixed(2);
    // Handle -0.00 -> 0.00
    return formatted === '-0.00' ? '0.00' : formatted;
  }

  /**
   * Canonicalizza la risposta per garantire formato identico in replay
   * Bible r.144: replay deve essere byte-for-byte identico
   */
  private canonicalizeResponse(r: any): { status: 'APPROVED' | 'REJECTED', reason?: string, newBalance?: string } {
    const out: any = { status: r.status };
    
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
  async debit(operation: WalletOperation): Promise<WalletResponse> {
    if (operation?.idempotencyKey) {
      const hit = await idmpGet(operation.idempotencyKey);
      if (hit) { logger.info('Idempotency hit (debit)', { correlationId: operation.correlationId }); return hit; }
    }
    
    // Check Responsible Gaming restrictions
    const rgCheck = await responsibleGamingService.checkRestrictions(operation.playerId);
    if (!rgCheck.allowed) {
      const response: WalletResponse = {
        status: 'REJECTED',
        reason: 'RW-CAS-003' // Limits exceeded per spec TR-08
      };
      const canonicalResponse = this.canonicalizeResponse(response);
      await transaction(async (client) => {
        await idmpPutTx(client, operation.idempotencyKey, canonicalResponse);
      });
      return canonicalResponse;
    }

    // Valida currency
    const expectedCurrency = await this.playerService.currencyFor(operation.playerId);
    if (operation.currency !== expectedCurrency) {
      const response: WalletResponse = {
        status: 'REJECTED',
        reason: 'RW-CAS-008' // Currency mismatch
      };
      const canonicalResponse = this.canonicalizeResponse(response);
      await transaction(async (client) => {
        await idmpPutTx(client, operation.idempotencyKey, canonicalResponse);
      });
      return canonicalResponse;
    }

    let response: WalletResponse;
    
    try {
      response = await transaction(async (client) => {
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
        let currentBalance: number;
        
        if (walletResult.rows.length === 0) {
          // Se il giocatore non esiste, crealo con balance 0
          // La bibbia non richiede che i giocatori pre-esistano
          const walletId = uuidv4();
          await client.query(
            'INSERT INTO user_wallets (id, user_id, balance, currency) VALUES ($1, $2, $3, $4)',
            [walletId, operation.playerId, 0, operation.currency]
          );
          wallet = { id: walletId, balance: 0 };
          currentBalance = 0;
        } else {
          wallet = walletResult.rows[0];
          currentBalance = Math.round(parseFloat(wallet.balance) * 100); // Convert to minor units
        }
        
        // Verifica currency match
        if (wallet.currency && wallet.currency !== operation.currency) {
          const response: WalletResponse = {
            status: 'REJECTED',
            reason: 'RW-CAS-008' // Currency mismatch
          };
          const canonicalResponse = this.canonicalizeResponse(response);
          await idmpPutTx(client, operation.idempotencyKey, canonicalResponse);
          return canonicalResponse;
        }
        
        const debitAmountMinor = toMinor(operation.amount);

        // Verifica amount valido (deve essere positivo)
        if (debitAmountMinor <= 0) {
          const response: WalletResponse = {
            status: 'REJECTED',
            reason: 'RW-CAS-002' // Invalid amount as insufficient funds
          };
          const canonicalResponse = this.canonicalizeResponse(response);
          await idmpPutTx(client, operation.idempotencyKey, canonicalResponse);
          return canonicalResponse;
        }

        // Verifica fondi sufficienti (in minor units)
        if (currentBalance < debitAmountMinor) {
          const response: WalletResponse = {
            status: 'REJECTED',
            reason: 'RW-CAS-002' // Insufficient funds
          };
          const canonicalResponse = this.canonicalizeResponse(response);
          await idmpPutTx(client, operation.idempotencyKey, canonicalResponse);
          return canonicalResponse;
        }

        // Esegui addebito (in minor units)
        const newBalanceMinor = currentBalance - debitAmountMinor;
        await client.query(
          'UPDATE user_wallets SET balance = $1 WHERE user_id = $2',
          [newBalanceMinor / 100, operation.playerId] // Store as decimal for compatibility
        );

        // Registra transazione nel ledger - SOLO campi esistenti
        const txId = uuidv4();
        await client.query(
          `INSERT INTO wallet_transactions 
           (id, wallet_id, user_id, type, amount, balance_before, balance_after, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            txId,
            wallet.id, // wallet_id necessario
            operation.playerId,
            'debit', // Lowercase come si aspettano i test
            this.toAmountString2(debitAmountMinor / 100),
            this.toAmountString2(currentBalance / 100),
            this.toAmountString2(newBalanceMinor / 100),
            new Date().toISOString()
          ]
        );

        const resp: WalletResponse = {
          status: 'APPROVED',
          newBalance: toMajor(newBalanceMinor) // stringa da minor units!
        };
        
        // Canonicalizza prima di salvare e ritornare
        const canonicalResponse = this.canonicalizeResponse(resp);
        
        await idmpPutTx(client, operation.idempotencyKey, canonicalResponse);
        
        return canonicalResponse;
      });
      
      logPlayerOperation('Wallet debit successful', {
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
    } catch (error: any) {
      logger.error('Wallet debit failed', {
        error: error.message,
        playerId: operation.playerId,
        amount: operation.amount
      });
      
      throw this.createError('Transaction failed', 500, CasinoErrorCodes.TRANSACTION_FAILED);
    }
  }

  /**
   * Accredita fondi al wallet (per vincite)
   * Bibbia §4.5: amount deve essere stringa decimale
   */
  async credit(operation: WalletOperation): Promise<WalletResponse> {
    if (operation?.idempotencyKey) {
      const hit = await idmpGet(operation.idempotencyKey);
      if (hit) { logger.info('Idempotency hit (credit)', { correlationId: operation.correlationId }); return hit; }
    }
    
    // Valida currency
    const expectedCurrency = await this.playerService.currencyFor(operation.playerId);
    if (operation.currency !== expectedCurrency) {
      const response: WalletResponse = {
        status: 'REJECTED',
        reason: 'RW-CAS-008' // Currency mismatch
      };
      const canonicalResponse = this.canonicalizeResponse(response);
      await transaction(async (client) => {
        await idmpPutTx(client, operation.idempotencyKey, canonicalResponse);
      });
      return canonicalResponse;
    }

    let response: WalletResponse;
    
    try {
      response = await transaction(async (client) => {
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
        let currentBalance: number;
        
        if (walletResult.rows.length === 0) {
          // Se il giocatore non esiste, crealo con balance 0
          // La bibbia non richiede che i giocatori pre-esistano
          const walletId = uuidv4();
          await client.query(
            'INSERT INTO user_wallets (id, user_id, balance, currency) VALUES ($1, $2, $3, $4)',
            [walletId, operation.playerId, 0, operation.currency]
          );
          wallet = { id: walletId, balance: 0 };
          currentBalance = 0;
        } else {
          wallet = walletResult.rows[0];
          currentBalance = Math.round(parseFloat(wallet.balance) * 100); // Convert to minor units
        }
        
        // Verifica currency match
        if (wallet.currency && wallet.currency !== operation.currency) {
          const response: WalletResponse = {
            status: 'REJECTED',
            reason: 'RW-CAS-008' // Currency mismatch
          };
          const canonicalResponse = this.canonicalizeResponse(response);
          await idmpPutTx(client, operation.idempotencyKey, canonicalResponse);
          return canonicalResponse;
        }
        
        const creditAmountMinor = toMinor(operation.amount);

        // Verifica amount valido (deve essere positivo)
        if (creditAmountMinor <= 0) {
          const response: WalletResponse = {
            status: 'REJECTED',
            reason: 'RW-CAS-002' // Invalid amount as insufficient funds
          };
          const canonicalResponse = this.canonicalizeResponse(response);
          await idmpPutTx(client, operation.idempotencyKey, canonicalResponse);
          return canonicalResponse;
        }

        // Esegui accredito (in minor units)
        const newBalanceMinor = currentBalance + creditAmountMinor;
        await client.query(
          'UPDATE user_wallets SET balance = $1 WHERE user_id = $2',
          [newBalanceMinor / 100, operation.playerId] // Store as decimal for compatibility
        );

        // Registra transazione nel ledger - SOLO campi esistenti
        const txId = uuidv4();
        await client.query(
          `INSERT INTO wallet_transactions 
           (id, wallet_id, user_id, type, amount, balance_before, balance_after, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            txId,
            wallet.id, // wallet_id necessario
            operation.playerId,
            'credit', // Lowercase come si aspettano i test
            this.toAmountString2(creditAmountMinor / 100),
            this.toAmountString2(currentBalance / 100),
            this.toAmountString2(newBalanceMinor / 100),
            new Date().toISOString()
          ]
        );

        const resp: WalletResponse = {
          status: 'APPROVED',
          newBalance: toMajor(newBalanceMinor) // stringa da minor units!
        };
        
        // Canonicalizza prima di salvare e ritornare
        const canonicalResponse = this.canonicalizeResponse(resp);
        
        await idmpPutTx(client, operation.idempotencyKey, canonicalResponse);
        
        return canonicalResponse;
      });
      
      return response;
    } catch (error: any) {
      logger.error('Wallet credit failed', {
        error: error.message,
        playerId: operation.playerId,
        amount: operation.amount
      });
      
      throw this.createError('Transaction failed', 500, CasinoErrorCodes.TRANSACTION_FAILED);
    }
  }

  async cancelTransaction(
    playerId: string,
    transactionId: string,
    amount: string,
    reason: string,
    correlationId: string,
    idempotencyKey: string
  ): Promise<WalletResponse> {
    try {
      if (idempotencyKey) {
        const hit = await idmpGet(idempotencyKey);
        if (hit) { logger.info('Idempotency hit (cancel)', { correlationId }); return hit; }
      }

      // Use transaction pattern from debit/credit
      const response = await transaction(async (client) => {
        // Legacy check - commented per PROD-IDMP
        // const existingTx = await this.checkIdempotencyTx(client, idempotencyKey);
        // if (existingTx) {
        //   return existingTx;
        // }

        // Check if transaction exists and is cancellable
        const txResult = await client.query(
          'SELECT * FROM wallet_transactions WHERE id = $1 AND user_id = $2',
          [transactionId, playerId]
        );

        if (txResult.rows.length === 0) {
          const response: WalletResponse = {
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
          const response: WalletResponse = {
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
          const response: WalletResponse = {
            status: 'REJECTED',
            reason: 'RW-CAS-001' // Player not found
          };
          const canonicalResponse = this.canonicalizeResponse(response);
          await idmpPutTx(client, idempotencyKey, canonicalResponse);
          return canonicalResponse;
        }

        const wallet = walletResult.rows[0];
        const currentBalance = Math.round(parseFloat(wallet.balance) * 100);
        const cancelAmountMinor = toMinor(amount);

        // Reverse the original transaction
        let newBalanceMinor: number;
        if (tx.type === 'debit') {
          // Cancel debit = credit back
          newBalanceMinor = currentBalance + cancelAmountMinor;
        } else if (tx.type === 'credit') {
          // Cancel credit = debit back
          if (currentBalance < cancelAmountMinor) {
            const response: WalletResponse = {
              status: 'REJECTED',
              reason: 'RW-CAS-002' // Insufficient funds to cancel credit
            };
            const canonicalResponse = this.canonicalizeResponse(response);
            await idmpPutTx(client, idempotencyKey, canonicalResponse);
            return canonicalResponse;
          }
          newBalanceMinor = currentBalance - cancelAmountMinor;
        } else {
          const response: WalletResponse = {
            status: 'REJECTED',
            reason: 'RW-CAS-006' // Invalid transaction type
          };
          const canonicalResponse = this.canonicalizeResponse(response);
          await idmpPutTx(client, idempotencyKey, canonicalResponse);
          return canonicalResponse;
        }

        // Update balance
        await client.query(
          'UPDATE user_wallets SET balance = $1 WHERE user_id = $2',
          [newBalanceMinor / 100, playerId]
        );

        // Mark original transaction as cancelled
        await client.query(
          'UPDATE wallet_transactions SET status = $1 WHERE id = $2',
          ['cancelled', transactionId]
        );

        // Record cancellation transaction
        const cancelTxId = uuidv4();
        await client.query(
          `INSERT INTO wallet_transactions 
           (id, wallet_id, user_id, type, amount, balance_before, balance_after, created_at, reference_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            cancelTxId,
            wallet.id,
            playerId,
            'cancel',
            this.toAmountString2(cancelAmountMinor / 100),
            this.toAmountString2(currentBalance / 100),
            this.toAmountString2(newBalanceMinor / 100),
            new Date().toISOString(),
            transactionId
          ]
        );

        const resp: WalletResponse = {
          status: 'APPROVED',
          newBalance: toMajor(newBalanceMinor)
        };
        
        const canonicalResponse = this.canonicalizeResponse(resp);
        // Legacy: await this.storeIdempotency(idempotencyKey, canonicalResponse, client);
        
        return canonicalResponse;
      });
      
      // Response già salvata nella transazione
      
      return response;
    } catch (error: any) {
      logger.error('Wallet cancel failed', {
        error: error.message,
        playerId,
        transactionId
      });
      
      throw this.createError('Cancel failed', 500, CasinoErrorCodes.TRANSACTION_FAILED);
    }
  }

  private async checkIdempotencyTx(
    client: { query: (text: string, params?: any[]) => Promise<{ rows: any[] }> },
    key: string
  ): Promise<any | null> {
    const USE_SQLITE = process.env.USE_SQLITE === 'true';
    const timeQuery = USE_SQLITE
      ? `SELECT response FROM idempotency_keys WHERE key = $1 AND expires_at > datetime('now') LIMIT 1`
      : `SELECT response FROM idempotency_keys WHERE key = $1 AND expires_at > CURRENT_TIMESTAMP LIMIT 1`;
    const { rows } = await client.query(timeQuery, [key]);
    if (!rows || rows.length === 0) return null;
    
    // Parse e canonicalizza la risposta salvata
    try { 
      const parsed = JSON.parse(rows[0].response);
      return this.canonicalizeResponse(parsed);
    } catch { 
      return this.canonicalizeResponse(rows[0].response);
    }
  }

  private async checkIdempotency(key: string): Promise<WalletResponse | null> {
    const USE_SQLITE = process.env.USE_SQLITE === 'true';
    
    if (!USE_SQLITE && redis) {
      // Prod: usa Redis
      const cached = await redis.get(`idempotency:${key}`);
      if (cached) {
        return JSON.parse(cached);
      }
    } else {
      // Pre-Prod: usa DB
      const timeQuery = USE_SQLITE
        ? "SELECT response FROM idempotency_keys WHERE key = $1 AND expires_at > datetime('now')"
        : 'SELECT response FROM idempotency_keys WHERE key = $1 AND expires_at > NOW()';
      
      const result = await query(timeQuery, [key]);
      if (result.rows.length > 0) {
        // response è salvata come JSON string nel DB
        const responseStr = result.rows[0].response;
        return typeof responseStr === 'string' ? JSON.parse(responseStr) : responseStr;
      }
    }
    
    return null;
  }

  private async storeIdempotency(
    key: string,
    response: WalletResponse,
    client: { query: (text: string, params?: any[]) => Promise<any> }
  ): Promise<void> {
    const USE_SQLITE = process.env.USE_SQLITE === 'true';
    
    if (!USE_SQLITE && redis) {
      // Prod: usa Redis con TTL 48h (Bible r.144: finestra 48h)
      await redis.setex(
        `idempotency:${key}`,
        this.IDEMPOTENCY_WINDOW / 1000,
        JSON.stringify(response)
      );
    } else {
      // Pre-Prod: usa DB - Bible r.144: "replay identico"
      // Bible r.25/r.142: tutte le scritture nello stesso UoW/transaction
      const expiresAt = new Date(Date.now() + this.IDEMPOTENCY_WINDOW);
      await client.query(
        `INSERT INTO idempotency_keys (key, response, expires_at) 
         VALUES ($1, $2, $3)
         ON CONFLICT (key) DO NOTHING`,
        [key, JSON.stringify(response), expiresAt.toISOString()]
      );
    }
  }

  private createError(message: string, statusCode: number, code: string): any {
    const error = new Error(message) as any;
    error.statusCode = statusCode;
    error.code = code;
    return error;
  }
}