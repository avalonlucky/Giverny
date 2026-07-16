ALTER TABLE agent_task_plans ADD COLUMN paused_at TEXT;

ALTER TABLE agent_task_memories ADD COLUMN user_notes_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE agent_task_memories ADD COLUMN ignored_items_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE agent_task_memories ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE agent_task_memories ADD COLUMN reviewed_at TEXT;

ALTER TABLE agent_failure_cases ADD COLUMN resolution_note TEXT NOT NULL DEFAULT '';
ALTER TABLE agent_failure_cases ADD COLUMN updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE agent_run_metrics ADD COLUMN prompt_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE agent_run_metrics ADD COLUMN completion_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE agent_run_metrics ADD COLUMN estimated_cost_cny REAL NOT NULL DEFAULT 0;
