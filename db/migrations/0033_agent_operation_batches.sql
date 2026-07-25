CREATE TABLE IF NOT EXISTS agent_operation_batches (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'default',
  principal_id TEXT NOT NULL DEFAULT 'system',
  status TEXT NOT NULL DEFAULT 'processing',
  operation_count INTEGER NOT NULL DEFAULT 0,
  task_count INTEGER NOT NULL DEFAULT 0,
  operations_json TEXT NOT NULL DEFAULT '[]',
  preconditions_json TEXT NOT NULL DEFAULT '[]',
  result_json TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_agent_operation_batches_workspace
ON agent_operation_batches(workspace_id, status, updated_at DESC);
