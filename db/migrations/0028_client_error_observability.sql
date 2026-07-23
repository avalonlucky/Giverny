CREATE TABLE IF NOT EXISTS client_error_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'default',
  principal_id TEXT NOT NULL DEFAULT 'anonymous',
  fingerprint TEXT NOT NULL,
  error_kind TEXT NOT NULL,
  message TEXT NOT NULL,
  stack TEXT NOT NULL DEFAULT '',
  component_stack TEXT NOT NULL DEFAULT '',
  path TEXT NOT NULL DEFAULT '/',
  app_version TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workspace_id, fingerprint, app_version, path)
);

CREATE INDEX IF NOT EXISTS idx_client_errors_workspace_last_seen
ON client_error_events(workspace_id, last_seen_at DESC);
