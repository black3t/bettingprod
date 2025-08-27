-- Casino Mock Database Schema
-- Version: 1.0.0

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- User status enum
CREATE TYPE user_status AS ENUM ('active', 'suspended', 'banned', 'pending_verification');

-- Tables
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    date_of_birth DATE,
    status user_status NOT NULL DEFAULT 'active',
    email_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    CONSTRAINT username_length CHECK (LENGTH(username) >= 3),
    CONSTRAINT email_valid CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    INDEX idx_users_username (username),
    INDEX idx_users_email (email),
    INDEX idx_users_status (status)
);

-- User wallets
CREATE TABLE user_wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    balance DECIMAL(20, 2) NOT NULL DEFAULT 10000.00, -- 10k initial credits
    bonus_balance DECIMAL(20, 2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id),
    CONSTRAINT positive_balance CHECK (balance >= 0),
    CONSTRAINT positive_bonus CHECK (bonus_balance >= 0),
    INDEX idx_wallets_user_id (user_id)
);

-- User sessions
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(500) UNIQUE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    INDEX idx_sessions_token (token),
    INDEX idx_sessions_user_id (user_id),
    INDEX idx_sessions_active (is_active, expires_at)
);

-- Login attempts (for security)
CREATE TABLE login_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255),
    ip_address INET,
    success BOOLEAN NOT NULL,
    attempted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    error_message TEXT,
    INDEX idx_login_attempts_email (email),
    INDEX idx_login_attempts_ip (ip_address),
    INDEX idx_login_attempts_time (attempted_at DESC)
);

-- Transactions log
CREATE TABLE wallet_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    wallet_id UUID NOT NULL REFERENCES user_wallets(id),
    type VARCHAR(50) NOT NULL, -- 'deposit', 'withdrawal', 'bet', 'win', 'bonus'
    amount DECIMAL(20, 2) NOT NULL,
    balance_before DECIMAL(20, 2) NOT NULL,
    balance_after DECIMAL(20, 2) NOT NULL,
    description TEXT,
    reference_id VARCHAR(255), -- External reference (e.g., RGS transaction)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    INDEX idx_transactions_user_id (user_id),
    INDEX idx_transactions_created (created_at DESC)
);

-- Game sessions
CREATE TABLE game_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    game_id VARCHAR(100) NOT NULL,
    rgs_session_id VARCHAR(255),
    rgs_session_token TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE,
    total_bet DECIMAL(20, 2) DEFAULT 0,
    total_win DECIMAL(20, 2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    INDEX idx_game_sessions_user (user_id),
    INDEX idx_game_sessions_active (is_active)
);

-- Available games
CREATE TABLE games (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    thumbnail_url VARCHAR(500),
    launch_url VARCHAR(500),
    provider VARCHAR(100),
    category VARCHAR(50), -- 'slots', 'table', 'live', 'instant'
    is_active BOOLEAN DEFAULT true,
    min_bet DECIMAL(10, 2) DEFAULT 0.10,
    max_bet DECIMAL(10, 2) DEFAULT 1000.00,
    rtp DECIMAL(5, 2), -- Return to player percentage
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    INDEX idx_games_code (code),
    INDEX idx_games_active (is_active)
);

-- Functions
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON user_wallets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create wallet for new user
CREATE OR REPLACE FUNCTION create_user_wallet()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_wallets (user_id, balance, currency)
    VALUES (NEW.id, 10000.00, 'EUR');
    
    -- Log the initial bonus transaction
    INSERT INTO wallet_transactions (
        user_id,
        wallet_id,
        type,
        amount,
        balance_before,
        balance_after,
        description
    )
    SELECT 
        NEW.id,
        w.id,
        'bonus',
        10000.00,
        0,
        10000.00,
        'Welcome bonus - 10,000 credits'
    FROM user_wallets w
    WHERE w.user_id = NEW.id;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-create wallet on user creation
CREATE TRIGGER create_wallet_on_user_creation
    AFTER INSERT ON users
    FOR EACH ROW EXECUTE FUNCTION create_user_wallet();

-- Insert default games
INSERT INTO games (code, name, description, provider, category, thumbnail_url, is_active, rtp) VALUES
    ('rawwar', 'RawWar Battle Royale', 'Epic 8-player battle royale game', 'ZBet Games', 'instant', '/images/rawwar.png', true, 95.50),
    ('demo-slots', 'Demo Slots', 'Classic slot machine', 'Demo Provider', 'slots', '/images/slots.png', true, 96.00),
    ('demo-roulette', 'Demo Roulette', 'European Roulette', 'Demo Provider', 'table', '/images/roulette.png', true, 97.30),
    ('demo-blackjack', 'Demo Blackjack', 'Classic Blackjack', 'Demo Provider', 'table', '/images/blackjack.png', false, 99.50);

-- Create indexes for performance
CREATE INDEX idx_users_login ON users(email, password_hash) WHERE status = 'active';
CREATE INDEX idx_transactions_recent ON wallet_transactions(user_id, created_at DESC);
CREATE INDEX idx_sessions_cleanup ON user_sessions(expires_at) WHERE is_active = true;

-- TABELLE AGGIUNTE PER CONFORMITÀ BIBBIA

-- Jurisdiction limits (dalla bibbia §0.7)
CREATE TABLE IF NOT EXISTS jurisdiction_limits (
  jurisdiction VARCHAR(10) PRIMARY KEY,
  min_bet DECIMAL(10,2) NOT NULL,
  max_bet DECIMAL(10,2) NOT NULL,
  max_win DECIMAL(10,2) NOT NULL
);

-- Inserisci limiti dalla bibbia
INSERT INTO jurisdiction_limits (jurisdiction, min_bet, max_bet, max_win) VALUES
  ('MGA', 0.20, 200.00, 3000.00),
  ('UKGC', 0.10, 1000.00, 5000.00),
  ('DEFAULT', 0.10, 100.00, 3000.00)
ON CONFLICT (jurisdiction) DO NOTHING;

-- Idempotency keys (finestra 48h dalla bibbia)
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key VARCHAR(255) PRIMARY KEY,
  response JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_idempotency_expires ON idempotency_keys(expires_at);

-- Player limits (Responsible Gaming)
CREATE TABLE IF NOT EXISTS player_limits (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  daily_limit DECIMAL(10,2),
  weekly_limit DECIMAL(10,2),
  monthly_limit DECIMAL(10,2),
  daily_spent DECIMAL(10,2) DEFAULT 0,
  weekly_spent DECIMAL(10,2) DEFAULT 0,
  monthly_spent DECIMAL(10,2) DEFAULT 0,
  last_reset_daily TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_reset_weekly TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_reset_monthly TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Self exclusions
CREATE TABLE IF NOT EXISTS self_exclusions (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  reason TEXT,
  excluded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE,
  permanent BOOLEAN DEFAULT false
);

-- Reality checks (dalla bibbia)
CREATE TABLE IF NOT EXISTS reality_checks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  triggered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  interval_minutes INTEGER DEFAULT 5,
  message_shown TEXT
);