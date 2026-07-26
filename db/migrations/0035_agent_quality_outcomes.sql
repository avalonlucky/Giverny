ALTER TABLE agent_failure_cases ADD COLUMN regression_case_id TEXT NOT NULL DEFAULT '';
ALTER TABLE agent_failure_cases ADD COLUMN last_verified_version TEXT NOT NULL DEFAULT '';
ALTER TABLE agent_failure_cases ADD COLUMN covered_at TEXT;
ALTER TABLE agent_run_metrics ADD COLUMN app_version TEXT NOT NULL DEFAULT '';
ALTER TABLE agent_turn_runs ADD COLUMN app_version TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS agent_effect_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'default',
  principal_id TEXT NOT NULL DEFAULT 'system',
  event_type TEXT NOT NULL,
  entity_id TEXT NOT NULL DEFAULT '',
  app_version TEXT NOT NULL DEFAULT '',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  estimated_minutes_saved REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agent_effect_events_workspace_created
ON agent_effect_events(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_effect_events_version_type
ON agent_effect_events(workspace_id, app_version, event_type, created_at DESC);

CREATE TABLE IF NOT EXISTS agent_effect_snapshots (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'default',
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  app_version TEXT NOT NULL DEFAULT '',
  total_turns INTEGER NOT NULL DEFAULT 0,
  completed_turns INTEGER NOT NULL DEFAULT 0,
  approval_previews INTEGER NOT NULL DEFAULT 0,
  approval_revisions INTEGER NOT NULL DEFAULT 0,
  verified_turns INTEGER NOT NULL DEFAULT 0,
  executed_writes INTEGER NOT NULL DEFAULT 0,
  failed_writes INTEGER NOT NULL DEFAULT 0,
  estimated_minutes_saved REAL NOT NULL DEFAULT 0,
  metrics_json TEXT NOT NULL DEFAULT '{}',
  generated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workspace_id, period_start, period_end, app_version)
);

CREATE INDEX IF NOT EXISTS idx_agent_effect_snapshots_workspace_period
ON agent_effect_snapshots(workspace_id, period_end DESC, app_version);
