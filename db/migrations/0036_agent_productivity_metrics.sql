ALTER TABLE agent_run_metrics ADD COLUMN productivity_status TEXT NOT NULL DEFAULT '';
ALTER TABLE agent_run_metrics ADD COLUMN productivity_cycles INTEGER NOT NULL DEFAULT 0;
ALTER TABLE agent_run_metrics ADD COLUMN productivity_tool_calls INTEGER NOT NULL DEFAULT 0;
ALTER TABLE agent_run_metrics ADD COLUMN productivity_reason_code TEXT NOT NULL DEFAULT '';
ALTER TABLE agent_run_metrics ADD COLUMN conversation_hash TEXT NOT NULL DEFAULT '';

ALTER TABLE agent_turn_runs ADD COLUMN productivity_status TEXT NOT NULL DEFAULT '';
ALTER TABLE agent_turn_runs ADD COLUMN productivity_cycles INTEGER NOT NULL DEFAULT 0;
ALTER TABLE agent_turn_runs ADD COLUMN productivity_tool_calls INTEGER NOT NULL DEFAULT 0;
ALTER TABLE agent_turn_runs ADD COLUMN productivity_reason_code TEXT NOT NULL DEFAULT '';
ALTER TABLE agent_turn_runs ADD COLUMN conversation_hash TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_agent_run_metrics_productivity
ON agent_run_metrics(workspace_id, is_eval, productivity_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_run_metrics_conversation
ON agent_run_metrics(workspace_id, conversation_hash, created_at ASC);
