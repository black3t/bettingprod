import { User, SignupRequest, LoginRequest, AuthResponse } from '../types';
export declare class AuthService {
    private readonly SALT_ROUNDS;
    private readonly JWT_SECRET;
    private readonly SESSION_TTL;
    private readonly MAX_LOGIN_ATTEMPTS;
    private readonly LOCKOUT_DURATION;
    signup(request: SignupRequest, ipAddress?: string): Promise<AuthResponse>;
    login(request: LoginRequest, ipAddress?: string, userAgent?: string): Promise<AuthResponse>;
    validateSession(token: string): Promise<User | null>;
    logout(token: string): Promise<void>;
    private createSession;
    private checkLoginAttempts;
    private recordLoginAttempt;
    private validateSignupInput;
    private createError;
}
//# sourceMappingURL=AuthService.d.ts.map