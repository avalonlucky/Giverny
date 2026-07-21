CREATE TABLE IF NOT EXISTS settlement_exports (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'default',
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  task_count INTEGER NOT NULL DEFAULT 0,
  billable_hours REAL NOT NULL DEFAULT 0,
  total_amount REAL NOT NULL DEFAULT 0,
  locked INTEGER NOT NULL DEFAULT 0,
  public_token TEXT NOT NULL UNIQUE,
  snapshot_json TEXT NOT NULL,
  generated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  viewed_at TEXT,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_settlement_exports_workspace_generated
ON settlement_exports(workspace_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_settlement_exports_public_token
ON settlement_exports(public_token);
