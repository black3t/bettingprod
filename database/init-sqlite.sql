-- Casino Mock SQLite Schema
-- Per Pre-Production / Test

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    date_of_birth DATE,
    status TEXT NOT NULL DEFAULT 'active',
    email_verified INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    metadata TEXT DEFAULT '{}'
);

-- User wallets
CREATE TABLE IF NOT EXISTS user_wallets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    balance DECIMAL(20, 2) NOT NULL DEFAULT 10000.00,
    bonus_balance DECIMAL(20, 2) NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'EUR',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- User sessions
CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active INTEGER DEFAULT 1
);

-- Login attempts
CREATE TABLE IF NOT EXISTS login_attempts (
    id TEXT PRIMARY KEY,
    email TEXT,
    ip_address TEXT,
    success INTEGER NOT NULL,
    attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    error_message TEXT
);

-- Wallet transactions
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    wallet_id TEXT NOT NULL REFERENCES user_wallets(id),
    type TEXT NOT NULL, -- 'deposit', 'withdrawal', 'bet', 'win', 'bonus', 'debit', 'credit'
    amount DECIMAL(20, 2) NOT NULL,
    balance_before DECIMAL(20, 2) NOT NULL,
    balance_after DECIMAL(20, 2) NOT NULL,
    description TEXT,
    reference_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT DEFAULT '{}'
);

-- Game sessions
CREATE TABLE IF NOT EXISTS game_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    game_id TEXT NOT NULL,
    rgs_session_id TEXT,
    rgs_session_token TEXT,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    total_bet DECIMAL(20, 2) DEFAULT 0,
    total_win DECIMAL(20, 2) DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    metadata TEXT DEFAULT '{}'
);

-- Games
CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    thumbnail_url TEXT,
    launch_url TEXT,
    provider TEXT,
    category TEXT,
    is_active INTEGER DEFAULT 1,
    min_bet DECIMAL(10, 2) DEFAULT 0.10,
    max_bet DECIMAL(10, 2) DEFAULT 1000.00,
    rtp DECIMAL(5, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT DEFAULT '{}'
);

-- TABELLE AGGIUNTE PER CONFORMITÀ BIBBIA

-- Jurisdiction limits (dalla bibbia §0.7)
CREATE TABLE IF NOT EXISTS jurisdiction_limits (
  jurisdiction TEXT PRIMARY KEY,
  min_bet DECIMAL(10,2) NOT NULL,
  max_bet DECIMAL(10,2) NOT NULL,
  max_win DECIMAL(10,2) NOT NULL
);

-- Inserisci limiti dalla bibbia
INSERT OR IGNORE INTO jurisdiction_limits (jurisdiction, min_bet, max_bet, max_win) VALUES
  ('MGA', 0.20, 200.00, 3000.00),
  ('UKGC', 0.10, 1000.00, 5000.00),
  ('DEFAULT', 0.10, 100.00, 3000.00);

-- Idempotency keys (finestra 48h dalla bibbia)
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key TEXT PRIMARY KEY,
  response TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL
);

-- Player limits (Responsible Gaming)
CREATE TABLE IF NOT EXISTS player_limits (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  daily_limit DECIMAL(10,2),
  weekly_limit DECIMAL(10,2),
  monthly_limit DECIMAL(10,2),
  daily_spent DECIMAL(10,2) DEFAULT 0,
  weekly_spent DECIMAL(10,2) DEFAULT 0,
  monthly_spent DECIMAL(10,2) DEFAULT 0,
  last_reset_daily TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_reset_weekly TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_reset_monthly TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Self exclusions
CREATE TABLE IF NOT EXISTS self_exclusions (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  reason TEXT,
  excluded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  permanent INTEGER DEFAULT 0
);

-- Responsible Gaming (dalla bibbia)
CREATE TABLE IF NOT EXISTS responsible_gaming (
  player_id TEXT PRIMARY KEY REFERENCES users(id),
  self_excluded INTEGER DEFAULT 0,
  self_excluded_until TIMESTAMP,
  cooling_off INTEGER DEFAULT 0,
  cooling_off_until TIMESTAMP,
  last_reality_check TIMESTAMP,
  reality_check_ack INTEGER DEFAULT 1
);

-- Reality checks (dalla bibbia)
CREATE TABLE IF NOT EXISTS reality_checks (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  acknowledged_at TIMESTAMP,
  interval_minutes INTEGER DEFAULT 5,
  message_shown TEXT
);

-- Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  user_id TEXT,
  correlation_id TEXT,
  details TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Webhook outbox (Bible r.142, r.231-232)
CREATE TABLE IF NOT EXISTS webhook_outbox (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,                -- 'balanceChanged' | 'playerExcluded'
  payload TEXT NOT NULL,             -- JSON
  status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING|SENT|FAILED
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_error TEXT
);
CREATE INDEX IF NOT EXISTS idx_outbox_status ON webhook_outbox(status, next_attempt_at);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON wallet_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON idempotency_keys(expires_at);
CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_login_attempts_time ON login_attempts(attempted_at DESC);

-- Insert default games
INSERT OR IGNORE INTO games (id, code, name, description, provider, category, thumbnail_url, is_active, rtp) VALUES
    ('game-1', 'rawwar', 'RawWar Battle Royale', 'Epic 8-player battle royale game', 'ZBet Games', 'instant', '/images/rawwar.png', 1, 95.50),
    ('game-2', 'demo-slots', 'Demo Slots', 'Classic slot machine', 'Demo Provider', 'slots', '/images/slots.png', 1, 96.00),
    ('game-3', 'demo-roulette', 'Demo Roulette', 'European Roulette', 'Demo Provider', 'table', '/images/roulette.png', 1, 97.30),
    ('game-4', 'demo-blackjack', 'Demo Blackjack', 'Classic Blackjack', 'Demo Provider', 'table', '/images/blackjack.png', 0, 99.50);