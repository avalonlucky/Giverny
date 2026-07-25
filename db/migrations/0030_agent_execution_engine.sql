ALTER TABLE agent_task_plans ADD COLUMN execution_mode TEXT NOT NULL DEFAULT 'guided';
ALTER TABLE agent_task_plans ADD COLUMN failure_policy TEXT NOT NULL DEFAULT 'stop';
ALTER TABLE agent_task_plans ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE agent_task_plans ADD COLUMN approved_at TEXT;
ALTER TABLE agent_task_plans ADD COLUMN failed_at TEXT;
ALTER TABLE agent_task_plans ADD COLUMN error_message TEXT;

CREATE INDEX IF NOT EXISTS idx_agent_task_plans_execution
ON agent_task_plans(workspace_id, status, approved_at, updated_at DESC);
