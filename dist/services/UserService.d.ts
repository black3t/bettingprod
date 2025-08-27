import { User, UserWallet, WalletTransaction } from '../types';
export declare class UserService {
    getUser(userId: string): Promise<User | null>;
    getWallet(userId: string): Promise<UserWallet>;
    updateBalance(userId: string, amount: number, type: 'bet' | 'win' | 'bonus' | 'deposit' | 'withdrawal', description?: string, referenceId?: string): Promise<UserWallet>;
    getTransactionHistory(userId: string, limit?: number, offset?: number): Promise<WalletTransaction[]>;
    updateProfile(userId: string, updates: Partial<User>): Promise<User>;
    getStats(userId: string): Promise<any>;
    private createError;
}
//# sourceMappingURL=UserService.d.ts.map