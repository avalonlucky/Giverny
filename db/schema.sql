CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  contact_name TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  client_id TEXT,
  title TEXT NOT NULL,
  requirement TEXT,
  design_type TEXT,
  start_date TEXT,
  estimated_delivery_date TEXT,
  actual_delivery_date TEXT,
  settlement_month TEXT,
  is_supplemental INTEGER NOT NULL DEFAULT 0,
  estimated_hours REAL NOT NULL DEFAULT 0,
  actual_hours REAL NOT NULL DEFAULT 0,
  hourly_rate REAL NOT NULL DEFAULT 300,
  requester TEXT,
  contact_person TEXT,
  reviewer TEXT,
  stage TEXT,
  status TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  suspend_reason TEXT,
  terminate_reason TEXT,
  supplemental_note TEXT,
  acceptance_note TEXT,
  feedback_rating TEXT,
  feedback_tags_json TEXT,
  feedback_note TEXT,
  time_entries_json TEXT,
  waiting_entries_json TEXT,
  is_billable INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT,
  voided_at TEXT,
  void_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tasks_voided_at ON tasks(voided_at);

CREATE TABLE IF NOT EXISTS task_updates (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  update_date TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  hours REAL NOT NULL DEFAULT 0,
  visible_to_client INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);

CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  update_id TEXT,
  entry_id TEXT,
  attachment_scope TEXT NOT NULL DEFAULT 'progress',
  file_name TEXT NOT NULL,
  file_type TEXT,
  mime_type TEXT,
  r2_key TEXT NOT NULL,
  preview_r2_key TEXT,
  file_size INTEGER,
  display_size TEXT,
  is_final INTEGER NOT NULL DEFAULT 0,
  visible_to_client INTEGER NOT NULL DEFAULT 1,
  file_tag TEXT,
  uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT,
  FOREIGN KEY (task_id) REFERENCES tasks(id),
  FOREIGN KEY (update_id) REFERENCES task_updates(id)
);

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

CREATE TABLE IF NOT EXISTS insight_diagnoses (
  id TEXT PRIMARY KEY,
  period_key TEXT NOT NULL,
  period_type TEXT NOT NULL,
  data_fingerprint TEXT NOT NULL,
  result_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS insights_history (
  id TEXT PRIMARY KEY,
  generated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  insight_type TEXT NOT NULL,
  finding TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  data_snapshot TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  trigger_key TEXT,
  trigger_fingerprint TEXT
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS access_tokens (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  label TEXT,
  expires_at TEXT,
  disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TEXT
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  email TEXT,
  role TEXT NOT NULL,
  principal_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agent_confirmation_uses (
  jti TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agent_run_metrics (
  id TEXT PRIMARY KEY,
  intent TEXT NOT NULL,
  outcome TEXT NOT NULL,
  model TEXT,
  tools_json TEXT NOT NULL DEFAULT '[]',
  tool_count INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  approval_action TEXT,
  selection_count INTEGER NOT NULL DEFAULT 0,
  fallback_used INTEGER NOT NULL DEFAULT 0,
  http_status INTEGER NOT NULL DEFAULT 200,
  is_eval INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS monthly_reports (
  id TEXT PRIMARY KEY,
  client_id TEXT,
  month TEXT NOT NULL,
  total_hours REAL NOT NULL DEFAULT 0,
  billable_hours REAL NOT NULL DEFAULT 0,
  total_amount REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  r2_pdf_key TEXT,
  public_token TEXT UNIQUE,
  generated_at TEXT,
  viewed_at TEXT,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tasks_start_date ON tasks(start_date);
CREATE INDEX IF NOT EXISTS idx_tasks_settlement_month ON tasks(settlement_month);
CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at ON tasks(deleted_at);
CREATE INDEX IF NOT EXISTS idx_task_updates_task_id ON task_updates(task_id);
CREATE INDEX IF NOT EXISTS idx_attachments_task_id ON attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_attachments_entry_id ON attachments(task_id, entry_id);
CREATE INDEX IF NOT EXISTS idx_attachments_scope_uploaded_at ON attachments(attachment_scope, uploaded_at);
CREATE INDEX IF NOT EXISTS idx_attachment_analyses_task_id ON attachment_analyses(task_id);
CREATE INDEX IF NOT EXISTS idx_attachment_analyses_status ON attachment_analyses(status, updated_at);
CREATE INDEX IF NOT EXISTS idx_insight_diagnoses_period ON insight_diagnoses(period_type, created_at);
CREATE INDEX IF NOT EXISTS idx_insights_history_status ON insights_history(status, generated_at);
CREATE INDEX IF NOT EXISTS idx_insights_history_trigger ON insights_history(trigger_key, generated_at);

CREATE TABLE IF NOT EXISTS hour_estimate_suggestions (
  id TEXT PRIMARY KEY,
  input_fingerprint TEXT NOT NULL,
  task_id TEXT,
  title TEXT,
  requirement TEXT,
  design_type TEXT,
  requester TEXT,
  suggested_hours REAL NOT NULL,
  safe_hours REAL NOT NULL,
  selected_hours REAL,
  actual_hours REAL,
  confidence TEXT NOT NULL,
  exact_sample_count INTEGER NOT NULL DEFAULT 0,
  similar_sample_count INTEGER NOT NULL DEFAULT 0,
  provider TEXT,
  status TEXT NOT NULL DEFAULT 'suggested',
  basis_json TEXT,
  requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);

CREATE INDEX IF NOT EXISTS idx_hour_estimate_task ON hour_estimate_suggestions(task_id, requested_at);
CREATE INDEX IF NOT EXISTS idx_hour_estimate_type ON hour_estimate_suggestions(design_type, requested_at);
CREATE INDEX IF NOT EXISTS idx_monthly_reports_month ON monthly_reports(month);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_access_tokens_token ON access_tokens(token);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_token_hash ON auth_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_principal ON auth_sessions(principal_id);
CREATE INDEX IF NOT EXISTS idx_agent_confirmation_uses_expiry ON agent_confirmation_uses(expires_at);
CREATE INDEX IF NOT EXISTS idx_agent_run_metrics_created ON agent_run_metrics(created_at);
CREATE INDEX IF NOT EXISTS idx_agent_run_metrics_outcome ON agent_run_metrics(is_eval, outcome, created_at);
CREATE INDEX IF NOT EXISTS idx_agent_run_metrics_intent ON agent_run_metrics(is_eval, intent, created_at);
