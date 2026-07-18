CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS workspace_memberships (
  workspace_id TEXT NOT NULL,
  principal_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (workspace_id, principal_id),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
);

INSERT OR IGNORE INTO workspaces (id, name) VALUES ('default', 'Giverny 默认工作区');
INSERT OR IGNORE INTO workspace_memberships (workspace_id, principal_id, role) VALUES ('default', 'admin', 'owner');

ALTER TABLE auth_sessions ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE agent_analysis_jobs ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE agent_analysis_jobs ADD COLUMN principal_id TEXT NOT NULL DEFAULT 'system';
ALTER TABLE agent_run_metrics ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE agent_run_metrics ADD COLUMN principal_id TEXT NOT NULL DEFAULT 'system';
ALTER TABLE ai_learning_events ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE ai_learning_events ADD COLUMN principal_id TEXT NOT NULL DEFAULT 'system';

CREATE INDEX IF NOT EXISTS idx_workspace_memberships_principal
ON workspace_memberships(principal_id, workspace_id);

CREATE INDEX IF NOT EXISTS idx_agent_run_metrics_workspace_created
ON agent_run_metrics(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_analysis_jobs_workspace_status
ON agent_analysis_jobs(workspace_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_learning_workspace_created
ON ai_learning_events(workspace_id, created_at DESC);
