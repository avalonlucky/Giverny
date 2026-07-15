CREATE TABLE IF NOT EXISTS agent_analysis_jobs (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL UNIQUE,
  conversation_id TEXT,
  job_type TEXT NOT NULL DEFAULT 'monthly_review',
  title TEXT NOT NULL,
  month TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  phase TEXT NOT NULL DEFAULT 'queued',
  progress INTEGER NOT NULL DEFAULT 5,
  source_snapshot_json TEXT,
  result_markdown TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_agent_analysis_jobs_status
ON agent_analysis_jobs(status, updated_at);

CREATE INDEX IF NOT EXISTS idx_agent_analysis_jobs_conversation
ON agent_analysis_jobs(conversation_id, created_at);
