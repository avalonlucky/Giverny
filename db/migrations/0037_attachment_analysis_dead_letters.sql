CREATE TABLE IF NOT EXISTS attachment_analysis_dead_letters (
  attachment_id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL DEFAULT 'default',
  queue_message_id TEXT NOT NULL DEFAULT '',
  delivery_attempts INTEGER NOT NULL DEFAULT 0,
  error_message TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  first_failed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_failed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  requeued_at TEXT,
  resolved_at TEXT,
  FOREIGN KEY (attachment_id) REFERENCES attachments(id),
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);

CREATE INDEX IF NOT EXISTS idx_attachment_analysis_dead_letters_workspace
ON attachment_analysis_dead_letters(workspace_id, status, last_failed_at DESC);
