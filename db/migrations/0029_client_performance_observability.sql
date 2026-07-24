CREATE TABLE IF NOT EXISTS client_performance_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'default',
  principal_id TEXT NOT NULL DEFAULT 'anonymous',
  path TEXT NOT NULL DEFAULT '/',
  app_version TEXT NOT NULL DEFAULT '',
  navigation_type TEXT NOT NULL DEFAULT 'navigate',
  device_class TEXT NOT NULL DEFAULT 'desktop',
  connection_type TEXT NOT NULL DEFAULT '',
  ttfb_ms REAL NOT NULL DEFAULT 0,
  fcp_ms REAL NOT NULL DEFAULT 0,
  lcp_ms REAL NOT NULL DEFAULT 0,
  inp_ms REAL NOT NULL DEFAULT 0,
  cls REAL NOT NULL DEFAULT 0,
  load_ms REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_client_performance_workspace_created
ON client_performance_events(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_performance_version_path
ON client_performance_events(workspace_id, app_version, path, created_at DESC);
