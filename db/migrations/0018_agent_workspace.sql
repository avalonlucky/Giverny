CREATE TABLE IF NOT EXISTS agent_conversations (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  last_message_preview TEXT NOT NULL DEFAULT '',
  message_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_agent_conversations_updated
ON agent_conversations(deleted_at, updated_at DESC);

ALTER TABLE agent_analysis_jobs ADD COLUMN query TEXT NOT NULL DEFAULT '';
ALTER TABLE agent_analysis_jobs ADD COLUMN scope_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE agent_analysis_jobs ADD COLUMN source TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE agent_analysis_jobs ADD COLUMN dedupe_key TEXT;
ALTER TABLE agent_analysis_jobs ADD COLUMN read_at TEXT;

UPDATE agent_analysis_jobs
SET read_at = CURRENT_TIMESTAMP
WHERE status IN ('completed', 'failed', 'cancelled');

CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_analysis_jobs_dedupe
ON agent_analysis_jobs(dedupe_key) WHERE dedupe_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agent_analysis_jobs_unread
ON agent_analysis_jobs(read_at, status, updated_at DESC);
