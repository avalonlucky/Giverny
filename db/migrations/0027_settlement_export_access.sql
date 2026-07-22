ALTER TABLE settlement_exports ADD COLUMN expires_at TEXT;
ALTER TABLE settlement_exports ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_settlement_exports_access
ON settlement_exports(public_token, disabled, expires_at);
