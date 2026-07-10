CREATE TABLE IF NOT EXISTS hour_estimate_suggestions (
  id TEXT PRIMARY KEY,
  input_fingerprint TEXT NOT NULL,
  task_id TEXT,
  title TEXT,
  requirement TEXT,
  design_type TEXT,
  requester TEXT,
  suggested_hours REAL NOT NULL,
  safe_hours REAL NOT NULL,
  selected_hours REAL,
  actual_hours REAL,
  confidence TEXT NOT NULL,
  exact_sample_count INTEGER NOT NULL DEFAULT 0,
  similar_sample_count INTEGER NOT NULL DEFAULT 0,
  provider TEXT,
  status TEXT NOT NULL DEFAULT 'suggested',
  basis_json TEXT,
  requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);

CREATE INDEX IF NOT EXISTS idx_hour_estimate_task ON hour_estimate_suggestions(task_id, requested_at);
CREATE INDEX IF NOT EXISTS idx_hour_estimate_type ON hour_estimate_suggestions(design_type, requested_at);
