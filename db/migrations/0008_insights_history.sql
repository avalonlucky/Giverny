CREATE TABLE IF NOT EXISTS insights_history (
  id TEXT PRIMARY KEY,
  generated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  insight_type TEXT NOT NULL,
  finding TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  data_snapshot TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  trigger_key TEXT,
  trigger_fingerprint TEXT
);

CREATE INDEX IF NOT EXISTS idx_insights_history_status ON insights_history(status, generated_at);
CREATE INDEX IF NOT EXISTS idx_insights_history_trigger ON insights_history(trigger_key, generated_at);
