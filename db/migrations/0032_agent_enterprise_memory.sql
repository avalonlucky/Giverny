CREATE TABLE IF NOT EXISTS agent_enterprise_memories (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'default',
  scope_type TEXT NOT NULL,
  scope_key TEXT NOT NULL DEFAULT '',
  memory_type TEXT NOT NULL DEFAULT 'fact',
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'manual',
  source_ref TEXT NOT NULL DEFAULT '',
  source_label TEXT NOT NULL,
  source_excerpt TEXT NOT NULL DEFAULT '',
  confidence TEXT NOT NULL DEFAULT 'confirmed',
  status TEXT NOT NULL DEFAULT 'active',
  version INTEGER NOT NULL DEFAULT 1,
  supersedes_id TEXT,
  valid_from TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT,
  created_by TEXT NOT NULL DEFAULT 'system',
  updated_by TEXT NOT NULL DEFAULT 'system',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT,
  FOREIGN KEY (supersedes_id) REFERENCES agent_enterprise_memories(id)
);

CREATE INDEX IF NOT EXISTS idx_agent_enterprise_memory_scope
ON agent_enterprise_memories(workspace_id, scope_type, scope_key, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_enterprise_memory_active
ON agent_enterprise_memories(workspace_id, status, expires_at, updated_at DESC);

CREATE TABLE IF NOT EXISTS agent_enterprise_memory_revisions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'default',
  memory_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor_id TEXT NOT NULL DEFAULT 'system',
  snapshot_json TEXT NOT NULL DEFAULT '{}',
  reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (memory_id) REFERENCES agent_enterprise_memories(id)
);

CREATE INDEX IF NOT EXISTS idx_agent_enterprise_memory_revision
ON agent_enterprise_memory_revisions(workspace_id, memory_id, created_at DESC);
