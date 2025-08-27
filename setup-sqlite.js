const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const db = new sqlite3.Database('./casino.db');

db.serialize(() => {
  // Create users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      first_name TEXT,
      last_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME,
      is_active BOOLEAN DEFAULT 1,
      is_verified BOOLEAN DEFAULT 0
    )
  `);

  // Create wallets table
  db.run(`
    CREATE TABLE IF NOT EXISTS wallets (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      balance REAL DEFAULT 10000,
      currency TEXT DEFAULT 'EUR',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Create games table
  db.run(`
    CREATE TABLE IF NOT EXISTS games (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      provider TEXT NOT NULL,
      thumbnail_url TEXT,
      is_active BOOLEAN DEFAULT 1,
      min_bet REAL DEFAULT 0.1,
      max_bet REAL DEFAULT 1000,
      rtp REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create game_sessions table
  db.run(`
    CREATE TABLE IF NOT EXISTS game_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      game_id TEXT NOT NULL,
      rgs_session_id TEXT,
      rgs_session_token TEXT,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME,
      is_active BOOLEAN DEFAULT 1,
      total_bet REAL DEFAULT 0,
      total_win REAL DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (game_id) REFERENCES games(code)
    )
  `);

  // Insert sample games
  const games = [
    { code: 'rawwar', name: 'RawWar', category: 'multiplayer', provider: 'InHouse', rtp: 95.5 },
    { code: 'demo-slots', name: 'Demo Slots', category: 'slots', provider: 'Demo', rtp: 96.0 },
    { code: 'demo-roulette', name: 'Demo Roulette', category: 'table', provider: 'Demo', rtp: 97.3 },
    { code: 'demo-blackjack', name: 'Demo Blackjack', category: 'table', provider: 'Demo', rtp: 99.5 }
  ];

  const stmt = db.prepare("INSERT OR IGNORE INTO games (code, name, category, provider, rtp) VALUES (?, ?, ?, ?, ?)");
  games.forEach(game => {
    stmt.run(game.code, game.name, game.category, game.provider, game.rtp);
  });
  stmt.finalize();

  console.log('✅ SQLite database initialized');
});

db.close();
