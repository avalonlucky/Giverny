CREATE TABLE IF NOT EXISTS attachment_analyses (
  attachment_id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  parser_kind TEXT,
  provider TEXT,
  model TEXT,
  summary TEXT,
  content_type TEXT,
  extracted_text TEXT,
  findings_json TEXT,
  quality_issues_json TEXT,
  requirement_matches_json TEXT,
  risks_json TEXT,
  suggestions_json TEXT,
  confidence TEXT,
  error_message TEXT,
  requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TEXT,
  completed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (attachment_id) REFERENCES attachments(id),
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);

CREATE INDEX IF NOT EXISTS idx_attachment_analyses_task_id ON attachment_analyses(task_id);
CREATE INDEX IF NOT EXISTS idx_attachment_analyses_status ON attachment_analyses(status, updated_at);
