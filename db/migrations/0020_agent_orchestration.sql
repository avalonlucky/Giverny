CREATE TABLE IF NOT EXISTS agent_task_plans (
  id TEXT PRIMARY KEY,
  conversation_id TEXT,
  task_id TEXT,
  kind TEXT NOT NULL DEFAULT 'goal',
  goal TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  steps_json TEXT NOT NULL DEFAULT '[]',
  current_step INTEGER NOT NULL DEFAULT 0,
  next_action_at TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_agent_task_plans_status
ON agent_task_plans(status, next_action_at, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_task_plans_task
ON agent_task_plans(task_id, status, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_task_plans_reminder
ON agent_task_plans(kind, task_id, goal) WHERE kind = 'reminder' AND status = 'active';

CREATE TABLE IF NOT EXISTS agent_task_memories (
  task_id TEXT PRIMARY KEY,
  task_title TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  open_items_json TEXT NOT NULL DEFAULT '[]',
  preferences_json TEXT NOT NULL DEFAULT '[]',
  last_event_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);

CREATE TABLE IF NOT EXISTS agent_failure_cases (
  fingerprint TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  intent TEXT NOT NULL,
  tool_name TEXT,
  http_status INTEGER NOT NULL DEFAULT 0,
  occurrences INTEGER NOT NULL DEFAULT 1,
  regression_status TEXT NOT NULL DEFAULT 'candidate',
  first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agent_failure_cases_priority
ON agent_failure_cases(regression_status, occurrences DESC, last_seen_at DESC);
