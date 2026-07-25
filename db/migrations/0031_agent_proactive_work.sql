CREATE TABLE IF NOT EXISTS agent_proactive_items (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'default',
  task_id TEXT NOT NULL,
  task_title TEXT NOT NULL DEFAULT '',
  signal_type TEXT NOT NULL,
  dedupe_key TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  title TEXT NOT NULL,
  evidence_json TEXT NOT NULL DEFAULT '[]',
  recommendation TEXT NOT NULL DEFAULT '',
  suggested_prompt TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  source_updated_at TEXT,
  detected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  snoozed_until TEXT,
  read_at TEXT,
  handled_at TEXT,
  resolution TEXT,
  resolution_note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_proactive_open_dedupe
ON agent_proactive_items(workspace_id, dedupe_key)
WHERE status IN ('open', 'snoozed');

CREATE INDEX IF NOT EXISTS idx_agent_proactive_queue
ON agent_proactive_items(workspace_id, status, priority, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_proactive_task
ON agent_proactive_items(workspace_id, task_id, status, updated_at DESC);
