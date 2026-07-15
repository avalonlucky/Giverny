CREATE TABLE IF NOT EXISTS agent_write_operations (
  operation_id TEXT PRIMARY KEY,
  endpoint TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing',
  result_json TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agent_write_operations_updated
ON agent_write_operations(status, updated_at);
