export interface User {
    id: string;
    username: string;
    email: string;
    password_hash?: string;
    first_name?: string;
    last_name?: string;
    date_of_birth?: Date;
    status: 'active' | 'suspended' | 'banned' | 'pending_verification';
    email_verified: boolean;
    created_at: Date;
    updated_at: Date;
    last_login?: Date;
    metadata?: Record<string, any>;
}
export interface UserWallet {
    id: string;
    user_id: string;
    balance: string;
    bonus_balance: string;
    currency: string;
    created_at: Date;
    updated_at: Date;
}
export interface UserSession {
    id: string;
    user_id: string;
    token: string;
    ip_address?: string;
    user_agent?: string;
    created_at: Date;
    expires_at: Date;
    last_activity: Date;
    is_active: boolean;
}
export interface SignupRequest {
    username: string;
    email: string;
    password: string;
    first_name?: string;
    last_name?: string;
    date_of_birth?: string;
}
export interface LoginRequest {
    email: string;
    password: string;
}
export interface AuthResponse {
    success: boolean;
    token?: string;
    user?: {
        id: string;
        username: string;
        email: string;
        first_name?: string;
        last_name?: string;
        balance: string;
        currency: string;
    };
    error?: string;
}
export interface Game {
    id: string;
    code: string;
    name: string;
    description?: string;
    thumbnail_url?: string;
    launch_url?: string;
    provider: string;
    category: string;
    is_active: boolean;
    min_bet: number;
    max_bet: number;
    rtp?: number;
    metadata?: Record<string, any>;
}
export interface GameLaunchRequest {
    game_code: string;
    demo_mode?: boolean;
}
export interface GameLaunchResponse {
    success: boolean;
    game_url?: string;
    session_id?: string;
    error?: string;
}
export interface WalletTransaction {
    id: string;
    user_id: string;
    wallet_id: string;
    type: 'deposit' | 'withdrawal' | 'bet' | 'win' | 'bonus';
    amount: number;
    balance_before: number;
    balance_after: number;
    description?: string;
    reference_id?: string;
    created_at: Date;
    metadata?: Record<string, any>;
}
export interface ApiError extends Error {
    statusCode: number;
    code: string;
}
//# sourceMappingURL=index.d.ts.map