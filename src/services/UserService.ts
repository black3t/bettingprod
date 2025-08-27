import { query, transaction } from '../config/database';
import { logger } from '../utils/logger';
import { 
  User, 
  UserWallet, 
  WalletTransaction,
  ApiError 
} from '../types';

export class UserService {
  async getUser(userId: string): Promise<User | null> {
    const result = await query(
      `SELECT id, username, email, first_name, last_name, 
              date_of_birth, status, email_verified, 
              created_at, updated_at, last_login
       FROM users 
       WHERE id = $1`,
      [userId]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  async getWallet(userId: string): Promise<UserWallet> {
    const result = await query(
      'SELECT * FROM user_wallets WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      throw this.createError('Wallet not found', 404, 'WALLET_NOT_FOUND');
    }

    const wallet = result.rows[0];
    
    // IMPORTANTE: Money come stringa (dalla bibbia §0.6)
    return {
      ...wallet,
      balance: parseFloat(wallet.balance).toFixed(2), // stringa "1000.00"
      bonus_balance: wallet.bonus_balance ? parseFloat(wallet.bonus_balance).toFixed(2) : "0.00" // stringa "0.00"
    };
  }

  async updateBalance(
    userId: string,
    amount: number,
    type: 'bet' | 'win' | 'bonus' | 'deposit' | 'withdrawal',
    description?: string,
    referenceId?: string
  ): Promise<UserWallet> {
    return await transaction(async (client) => {
      // Lock wallet for update
      const walletResult = await client.query(
        'SELECT * FROM user_wallets WHERE user_id = $1 FOR UPDATE',
        [userId]
      );

      if (walletResult.rows.length === 0) {
        throw this.createError('Wallet not found', 404, 'WALLET_NOT_FOUND');
      }

      const wallet = walletResult.rows[0];
      const balanceBefore = parseFloat(wallet.balance);
      let balanceAfter: number;

      // Calculate new balance based on transaction type
      switch (type) {
        case 'bet':
        case 'withdrawal':
          if (balanceBefore < amount) {
            throw this.createError('Insufficient balance', 400, 'INSUFFICIENT_FUNDS');
          }
          balanceAfter = balanceBefore - amount;
          break;
        
        case 'win':
        case 'deposit':
        case 'bonus':
          balanceAfter = balanceBefore + amount;
          break;
        
        default:
          throw this.createError('Invalid transaction type', 400, 'INVALID_TYPE');
      }

      // Update wallet balance
      const updatedWallet = await client.query(
        `UPDATE user_wallets 
         SET balance = $1, updated_at = NOW() 
         WHERE id = $2
         RETURNING *`,
        [balanceAfter, wallet.id]
      );

      // Record transaction
      await client.query(
        `INSERT INTO wallet_transactions (
          user_id, wallet_id, type, amount, 
          balance_before, balance_after, 
          description, reference_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          userId,
          wallet.id,
          type,
          amount,
          balanceBefore,
          balanceAfter,
          description || `${type} transaction`,
          referenceId
        ]
      );

      logger.info('Balance updated', {
        userId,
        type,
        amount,
        balanceBefore,
        balanceAfter
      });

      return updatedWallet.rows[0];
    });
  }

  async getTransactionHistory(
    userId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<WalletTransaction[]> {
    const result = await query(
      `SELECT * FROM wallet_transactions 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [userId, Math.min(limit, 100), offset]
    );

    return result.rows;
  }

  async updateProfile(
    userId: string,
    updates: Partial<User>
  ): Promise<User> {
    // Build dynamic update query
    const allowedFields = ['first_name', 'last_name', 'date_of_birth'];
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    for (const field of allowedFields) {
      if (updates[field as keyof User] !== undefined) {
        updateFields.push(`${field} = $${paramCount}`);
        values.push(updates[field as keyof User]);
        paramCount++;
      }
    }

    if (updateFields.length === 0) {
      throw this.createError('No valid fields to update', 400, 'NO_UPDATES');
    }

    values.push(userId);

    const result = await query(
      `UPDATE users 
       SET ${updateFields.join(', ')}, updated_at = NOW() 
       WHERE id = $${paramCount}
       RETURNING id, username, email, first_name, last_name, 
                 date_of_birth, status, email_verified`,
      values
    );

    if (result.rows.length === 0) {
      throw this.createError('User not found', 404, 'USER_NOT_FOUND');
    }

    logger.info('Profile updated', { userId, updates });

    return result.rows[0];
  }

  async getStats(userId: string): Promise<any> {
    const stats = await query(
      `SELECT 
        COUNT(CASE WHEN type = 'bet' THEN 1 END) as total_bets,
        COUNT(CASE WHEN type = 'win' THEN 1 END) as total_wins,
        COALESCE(SUM(CASE WHEN type = 'bet' THEN amount END), 0) as total_wagered,
        COALESCE(SUM(CASE WHEN type = 'win' THEN amount END), 0) as total_won,
        COUNT(DISTINCT DATE(created_at)) as days_played
       FROM wallet_transactions
       WHERE user_id = $1`,
      [userId]
    );

    const gameStats = await query(
      `SELECT 
        COUNT(*) as sessions_played,
        COUNT(DISTINCT game_id) as games_played,
        COALESCE(SUM(total_bet), 0) as lifetime_wagered,
        COALESCE(SUM(total_win), 0) as lifetime_won
       FROM game_sessions
       WHERE user_id = $1`,
      [userId]
    );

    return {
      transactions: stats.rows[0],
      gaming: gameStats.rows[0],
      profit_loss: parseFloat(stats.rows[0].total_won) - parseFloat(stats.rows[0].total_wagered)
    };
  }

  private createError(message: string, statusCode: number, code: string): ApiError {
    const error = new Error(message) as ApiError;
    error.statusCode = statusCode;
    error.code = code;
    return error;
  }
}