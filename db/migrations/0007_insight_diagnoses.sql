CREATE TABLE IF NOT EXISTS insight_diagnoses (
  id TEXT PRIMARY KEY,
  period_key TEXT NOT NULL,
  period_type TEXT NOT NULL,
  data_fingerprint TEXT NOT NULL,
  result_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_insight_diagnoses_period ON insight_diagnoses(period_type, created_at);
