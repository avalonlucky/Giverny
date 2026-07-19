ALTER TABLE agent_analysis_jobs ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE agent_analysis_jobs ADD COLUMN max_attempts INTEGER NOT NULL DEFAULT 3;
ALTER TABLE agent_analysis_jobs ADD COLUMN last_heartbeat_at TEXT;
ALTER TABLE agent_analysis_jobs ADD COLUMN timeout_at TEXT;
ALTER TABLE agent_analysis_jobs ADD COLUMN next_retry_at TEXT;

ALTER TABLE ai_learning_events ADD COLUMN feedback_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE ai_learning_events ADD COLUMN reason_category TEXT NOT NULL DEFAULT '';
ALTER TABLE ai_learning_events ADD COLUMN confidence REAL NOT NULL DEFAULT 0;

ALTER TABLE tasks ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE monthly_reports ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'default';

CREATE TABLE IF NOT EXISTS workspace_invites (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  created_by TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
);

CREATE TABLE IF NOT EXISTS ai_operation_alerts (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'default',
  fingerprint TEXT NOT NULL,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  acknowledged_at TEXT,
  acknowledged_by TEXT,
  resolved_at TEXT,
  UNIQUE(workspace_id, fingerprint)
);

CREATE TABLE IF NOT EXISTS ai_learning_calibration_profiles (
  workspace_id TEXT NOT NULL DEFAULT 'default',
  context TEXT NOT NULL,
  design_type TEXT NOT NULL DEFAULT '',
  principal_id TEXT NOT NULL DEFAULT 'system',
  sample_count INTEGER NOT NULL DEFAULT 0,
  adopted_count INTEGER NOT NULL DEFAULT 0,
  edited_count INTEGER NOT NULL DEFAULT 0,
  rejected_count INTEGER NOT NULL DEFAULT 0,
  average_confidence REAL NOT NULL DEFAULT 0,
  top_reason_category TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (workspace_id, context, design_type, principal_id)
);

CREATE INDEX IF NOT EXISTS idx_tasks_workspace_month
ON tasks(workspace_id, settlement_month, deleted_at);

CREATE INDEX IF NOT EXISTS idx_reports_workspace_month
ON monthly_reports(workspace_id, month DESC);

CREATE INDEX IF NOT EXISTS idx_analysis_jobs_recovery
ON agent_analysis_jobs(workspace_id, status, timeout_at, next_retry_at);

CREATE INDEX IF NOT EXISTS idx_ai_alerts_workspace_status
ON ai_operation_alerts(workspace_id, status, severity, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_workspace_invites_workspace
ON workspace_invites(workspace_id, expires_at DESC);
