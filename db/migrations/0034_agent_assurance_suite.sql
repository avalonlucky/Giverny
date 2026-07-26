CREATE TABLE IF NOT EXISTS agent_consistency_runs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'default',
  trigger_type TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'completed',
  scope_json TEXT NOT NULL DEFAULT '{}',
  summary_json TEXT NOT NULL DEFAULT '{}',
  findings_json TEXT NOT NULL DEFAULT '[]',
  snapshot_checksum TEXT NOT NULL,
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_agent_consistency_runs_workspace ON agent_consistency_runs(workspace_id, created_at DESC);

CREATE TABLE IF NOT EXISTS agent_formal_deliverables (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'default',
  deliverable_type TEXT NOT NULL,
  title TEXT NOT NULL,
  task_id TEXT,
  audit_run_id TEXT,
  status TEXT NOT NULL DEFAULT 'ready',
  source_snapshot_json TEXT NOT NULL DEFAULT '{}',
  content_html TEXT NOT NULL,
  content_text TEXT NOT NULL,
  snapshot_checksum TEXT NOT NULL,
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id),
  FOREIGN KEY (audit_run_id) REFERENCES agent_consistency_runs(id)
);
CREATE INDEX IF NOT EXISTS idx_agent_formal_deliverables_workspace ON agent_formal_deliverables(workspace_id, created_at DESC);

CREATE TABLE IF NOT EXISTS agent_high_risk_cases (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'default',
  principal_id TEXT NOT NULL DEFAULT 'system',
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL DEFAULT 'agent_action',
  entity_id TEXT NOT NULL DEFAULT '',
  risk_level TEXT NOT NULL DEFAULT 'high',
  status TEXT NOT NULL DEFAULT 'pending',
  reason TEXT NOT NULL,
  evidence_json TEXT NOT NULL DEFAULT '{}',
  evidence_checksum TEXT NOT NULL,
  retention_until TEXT NOT NULL,
  acknowledged_at TEXT,
  executed_at TEXT,
  cancelled_at TEXT,
  failure_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_agent_high_risk_cases_queue ON agent_high_risk_cases(workspace_id, status, created_at DESC);
