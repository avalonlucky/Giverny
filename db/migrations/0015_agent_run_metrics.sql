CREATE TABLE IF NOT EXISTS agent_run_metrics (
  id TEXT PRIMARY KEY,
  intent TEXT NOT NULL,
  outcome TEXT NOT NULL,
  model TEXT,
  tools_json TEXT NOT NULL DEFAULT '[]',
  tool_count INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  approval_action TEXT,
  selection_count INTEGER NOT NULL DEFAULT 0,
  fallback_used INTEGER NOT NULL DEFAULT 0,
  http_status INTEGER NOT NULL DEFAULT 200,
  is_eval INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agent_run_metrics_created ON agent_run_metrics(created_at);
CREATE INDEX IF NOT EXISTS idx_agent_run_metrics_outcome ON agent_run_metrics(is_eval, outcome, created_at);
CREATE INDEX IF NOT EXISTS idx_agent_run_metrics_intent ON agent_run_metrics(is_eval, intent, created_at);
