CREATE TABLE IF NOT EXISTS agent_adk_pending_actions (
  workspace_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  approval_id TEXT NOT NULL,
  principal_id TEXT NOT NULL,
  action TEXT NOT NULL,
  label TEXT NOT NULL,
  preview_endpoint TEXT NOT NULL,
  execute_endpoint TEXT NOT NULL,
  confirmation_token TEXT NOT NULL,
  draft_json TEXT NOT NULL,
  warnings_json TEXT NOT NULL DEFAULT '[]',
  created_at_ms INTEGER NOT NULL,
  expires_at_ms INTEGER NOT NULL,
  PRIMARY KEY (workspace_id, conversation_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_adk_pending_expiry
ON agent_adk_pending_actions(expires_at_ms);
