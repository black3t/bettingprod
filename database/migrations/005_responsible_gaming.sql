-- Responsible Gaming table
-- Bible riga 714-720: RG requirements

CREATE TABLE IF NOT EXISTS responsible_gaming (
  player_id VARCHAR(255) PRIMARY KEY,
  self_excluded BOOLEAN DEFAULT FALSE,
  self_excluded_until TIMESTAMP,
  cooling_off BOOLEAN DEFAULT FALSE,
  cooling_off_until TIMESTAMP,
  last_reality_check TIMESTAMP,
  reality_check_ack BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_rg_player ON responsible_gaming(player_id);
CREATE INDEX idx_rg_exclusion ON responsible_gaming(self_excluded, self_excluded_until);
CREATE INDEX idx_rg_cooling ON responsible_gaming(cooling_off, cooling_off_until);