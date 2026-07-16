CREATE TABLE IF NOT EXISTS task_requirement_edits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ai_output TEXT NOT NULL,
  user_final TEXT NOT NULL,
  design_type TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS task_title_edits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ai_output TEXT NOT NULL,
  user_final TEXT NOT NULL,
  design_type TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS task_style_summaries (
  summary_key TEXT PRIMARY KEY,
  summary TEXT NOT NULL,
  last_processed_id INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS task_type_choices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL DEFAULT '',
  requirement TEXT NOT NULL DEFAULT '',
  final_type TEXT NOT NULL,
  ai_suggested_type TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_text_edits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  context TEXT NOT NULL DEFAULT 'progress',
  ai_output TEXT NOT NULL,
  user_final TEXT NOT NULL,
  design_type TEXT NOT NULL DEFAULT '',
  task_id INTEGER,
  task_title TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_learning_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  context TEXT NOT NULL,
  action TEXT NOT NULL,
  source_input TEXT NOT NULL DEFAULT '',
  ai_output TEXT NOT NULL,
  user_final TEXT NOT NULL DEFAULT '',
  design_type TEXT NOT NULL DEFAULT '',
  task_id INTEGER,
  task_title TEXT NOT NULL DEFAULT '',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_learning_context_created
  ON ai_learning_events(context, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_learning_type_created
  ON ai_learning_events(context, design_type, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_learning_task
  ON ai_learning_events(task_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_text_edits_context_type
  ON ai_text_edits(context, design_type, id);
