-- KYC Status table
-- Bible riga 691: "Wallet/limits/kyc/exclusions"

CREATE TABLE IF NOT EXISTS kyc_status (
  player_id VARCHAR(255) PRIMARY KEY,
  status VARCHAR(20) NOT NULL DEFAULT 'NONE', -- NONE, PARTIAL, FULL
  verified_at TIMESTAMP,
  documents TEXT, -- JSON array of document IDs
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_kyc_player ON kyc_status(player_id);
CREATE INDEX idx_kyc_status ON kyc_status(status);