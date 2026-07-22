CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  contact_name TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'default',
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
  scope TEXT DEFAULT 'guest',
  expires_at TEXT,
  disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TEXT,
  workspace_id TEXT NOT NULL DEFAULT 'default'
);

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS workspace_memberships (
  workspace_id TEXT NOT NULL,
  principal_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (workspace_id, principal_id),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
);

INSERT OR IGNORE INTO workspaces (id, name) VALUES ('default', 'Giverny 默认工作区');

CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  email TEXT,
  role TEXT NOT NULL,
  principal_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL DEFAULT 'default',
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agent_confirmation_uses (
  jti TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agent_write_operations (
  operation_id TEXT PRIMARY KEY,
  endpoint TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing',
  result_json TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agent_write_operations_updated
ON agent_write_operations(status, updated_at);

CREATE TABLE IF NOT EXISTS agent_analysis_jobs (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL UNIQUE,
  conversation_id TEXT,
  workspace_id TEXT NOT NULL DEFAULT 'default',
  principal_id TEXT NOT NULL DEFAULT 'system',
  job_type TEXT NOT NULL DEFAULT 'monthly_review',
  title TEXT NOT NULL,
  month TEXT NOT NULL,
  query TEXT NOT NULL DEFAULT '',
  scope_json TEXT NOT NULL DEFAULT '{}',
  source TEXT NOT NULL DEFAULT 'manual',
  dedupe_key TEXT,
  read_at TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  phase TEXT NOT NULL DEFAULT 'queued',
  progress INTEGER NOT NULL DEFAULT 5,
  source_snapshot_json TEXT,
  result_markdown TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  last_heartbeat_at TEXT,
  timeout_at TEXT,
  next_retry_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_agent_analysis_jobs_status
ON agent_analysis_jobs(status, updated_at);

CREATE INDEX IF NOT EXISTS idx_agent_analysis_jobs_conversation
ON agent_analysis_jobs(conversation_id, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_analysis_jobs_dedupe
ON agent_analysis_jobs(dedupe_key) WHERE dedupe_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agent_analysis_jobs_unread
ON agent_analysis_jobs(read_at, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS agent_conversations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'default',
  title TEXT NOT NULL,
  last_message_preview TEXT NOT NULL DEFAULT '',
  message_count INTEGER NOT NULL DEFAULT 0,
  project_id TEXT,
  project_name TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_agent_conversations_updated
ON agent_conversations(deleted_at, updated_at DESC);

CREATE TABLE IF NOT EXISTS agent_task_plans (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'default',
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
  completed_at TEXT,
  paused_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_agent_task_plans_status
ON agent_task_plans(status, next_action_at, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_task_plans_task
ON agent_task_plans(task_id, status, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_task_plans_reminder
ON agent_task_plans(kind, task_id, goal) WHERE kind = 'reminder' AND status = 'active';

CREATE TABLE IF NOT EXISTS agent_task_memories (
  task_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'default',
  task_title TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  open_items_json TEXT NOT NULL DEFAULT '[]',
  preferences_json TEXT NOT NULL DEFAULT '[]',
  user_notes_json TEXT NOT NULL DEFAULT '[]',
  ignored_items_json TEXT NOT NULL DEFAULT '[]',
  disabled INTEGER NOT NULL DEFAULT 0,
  reviewed_at TEXT,
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
  resolution_note TEXT NOT NULL DEFAULT '',
  first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agent_failure_cases_priority
ON agent_failure_cases(regression_status, occurrences DESC, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS agent_run_metrics (
  id TEXT PRIMARY KEY,
  intent TEXT NOT NULL,
  outcome TEXT NOT NULL,
  model TEXT,
  workspace_id TEXT NOT NULL DEFAULT 'default',
  principal_id TEXT NOT NULL DEFAULT 'system',
  tools_json TEXT NOT NULL DEFAULT '[]',
  tool_count INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  approval_action TEXT,
  selection_count INTEGER NOT NULL DEFAULT 0,
  fallback_used INTEGER NOT NULL DEFAULT 0,
  http_status INTEGER NOT NULL DEFAULT 200,
  is_eval INTEGER NOT NULL DEFAULT 0,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost_cny REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agent_turn_runs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'default',
  principal_id TEXT NOT NULL DEFAULT 'system',
  runtime TEXT NOT NULL DEFAULT 'cloud',
  model TEXT NOT NULL DEFAULT '',
  intent TEXT NOT NULL DEFAULT 'unknown',
  phase TEXT NOT NULL DEFAULT 'failed',
  outcome TEXT NOT NULL DEFAULT 'failed',
  planned_tools_json TEXT NOT NULL DEFAULT '[]',
  evidence_summary_json TEXT NOT NULL DEFAULT '[]',
  verification_json TEXT NOT NULL DEFAULT '{}',
  attempts INTEGER NOT NULL DEFAULT 0,
  fallback_used INTEGER NOT NULL DEFAULT 0,
  fallback_reason TEXT NOT NULL DEFAULT '',
  duration_ms INTEGER NOT NULL DEFAULT 0,
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
  workspace_id TEXT NOT NULL DEFAULT 'default',
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

CREATE TABLE IF NOT EXISTS settlement_exports (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'default',
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  task_count INTEGER NOT NULL DEFAULT 0,
  billable_hours REAL NOT NULL DEFAULT 0,
  total_amount REAL NOT NULL DEFAULT 0,
  locked INTEGER NOT NULL DEFAULT 0,
  public_token TEXT NOT NULL UNIQUE,
  snapshot_json TEXT NOT NULL,
  generated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  viewed_at TEXT,
  view_count INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT,
  disabled INTEGER NOT NULL DEFAULT 0,
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
  workspace_id TEXT NOT NULL DEFAULT 'default',
  principal_id TEXT NOT NULL DEFAULT 'system',
  action TEXT NOT NULL,
  source_input TEXT NOT NULL DEFAULT '',
  ai_output TEXT NOT NULL,
  user_final TEXT NOT NULL DEFAULT '',
  design_type TEXT NOT NULL DEFAULT '',
  task_id INTEGER,
  task_title TEXT NOT NULL DEFAULT '',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  feedback_reason TEXT NOT NULL DEFAULT '',
  reason_category TEXT NOT NULL DEFAULT '',
  confidence REAL NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS workspace_invites (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  created_by TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_operation_alerts (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'default',
  fingerprint TEXT NOT NULL,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  acknowledged_at TEXT,
  acknowledged_by TEXT,
  resolved_at TEXT,
  UNIQUE(workspace_id, fingerprint)
);

CREATE TABLE IF NOT EXISTS ai_learning_calibration_profiles (
  workspace_id TEXT NOT NULL DEFAULT 'default',
  context TEXT NOT NULL,
  design_type TEXT NOT NULL DEFAULT '',
  principal_id TEXT NOT NULL DEFAULT 'system',
  sample_count INTEGER NOT NULL DEFAULT 0,
  adopted_count INTEGER NOT NULL DEFAULT 0,
  edited_count INTEGER NOT NULL DEFAULT 0,
  rejected_count INTEGER NOT NULL DEFAULT 0,
  average_confidence REAL NOT NULL DEFAULT 0,
  top_reason_category TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (workspace_id, context, design_type, principal_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_learning_context_created ON ai_learning_events(context, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_learning_type_created ON ai_learning_events(context, design_type, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_learning_task ON ai_learning_events(task_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_text_edits_context_type ON ai_text_edits(context, design_type, id);
CREATE INDEX IF NOT EXISTS idx_monthly_reports_month ON monthly_reports(month);
CREATE INDEX IF NOT EXISTS idx_settlement_exports_workspace_generated ON settlement_exports(workspace_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_settlement_exports_public_token ON settlement_exports(public_token);
CREATE INDEX IF NOT EXISTS idx_settlement_exports_access ON settlement_exports(public_token, disabled, expires_at);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_access_tokens_token ON access_tokens(token);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_token_hash ON auth_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_principal ON auth_sessions(principal_id);
CREATE INDEX IF NOT EXISTS idx_agent_confirmation_uses_expiry ON agent_confirmation_uses(expires_at);
CREATE INDEX IF NOT EXISTS idx_agent_run_metrics_created ON agent_run_metrics(created_at);
CREATE INDEX IF NOT EXISTS idx_agent_run_metrics_outcome ON agent_run_metrics(is_eval, outcome, created_at);
CREATE INDEX IF NOT EXISTS idx_agent_run_metrics_intent ON agent_run_metrics(is_eval, intent, created_at);
CREATE INDEX IF NOT EXISTS idx_agent_turn_runs_workspace ON agent_turn_runs(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_turn_runs_outcome ON agent_turn_runs(workspace_id, outcome, created_at DESC);

CREATE TABLE IF NOT EXISTS local_cli_pairings (
  id TEXT PRIMARY KEY,
  principal_id TEXT NOT NULL,
  role TEXT NOT NULL,
  code_hash TEXT NOT NULL UNIQUE,
  browser_device_key TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_local_cli_pairings_expiry ON local_cli_pairings(expires_at, consumed_at);

CREATE TABLE IF NOT EXISTS local_cli_devices (
  id TEXT PRIMARY KEY,
  principal_id TEXT NOT NULL,
  role TEXT NOT NULL,
  browser_device_key TEXT NOT NULL,
  name TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT '',
  arch TEXT NOT NULL DEFAULT '',
  bridge_version TEXT NOT NULL DEFAULT '',
  token_hash TEXT NOT NULL UNIQUE,
  selected_cli_id TEXT,
  last_seen_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_local_cli_devices_owner ON local_cli_devices(principal_id, browser_device_key, revoked_at, updated_at DESC);

CREATE TABLE IF NOT EXISTS local_cli_adapters (
  device_id TEXT NOT NULL,
  adapter_id TEXT NOT NULL,
  name TEXT NOT NULL,
  command TEXT NOT NULL DEFAULT '',
  version TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'unavailable',
  auth_status TEXT NOT NULL DEFAULT 'unknown',
  supports_streaming INTEGER NOT NULL DEFAULT 0,
  supports_mcp INTEGER NOT NULL DEFAULT 0,
  detail TEXT NOT NULL DEFAULT '',
  detected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (device_id, adapter_id),
  FOREIGN KEY (device_id) REFERENCES local_cli_devices(id)
);

CREATE INDEX IF NOT EXISTS idx_local_cli_adapters_device ON local_cli_adapters(device_id, status, adapter_id);

CREATE TABLE IF NOT EXISTS local_cli_commands (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  principal_id TEXT NOT NULL,
  command_type TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'queued',
  result_json TEXT,
  error_message TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  claimed_at TEXT,
  completed_at TEXT,
  FOREIGN KEY (device_id) REFERENCES local_cli_devices(id)
);

CREATE INDEX IF NOT EXISTS idx_local_cli_commands_poll ON local_cli_commands(device_id, status, expires_at, created_at);
CREATE INDEX IF NOT EXISTS idx_local_cli_commands_owner ON local_cli_commands(principal_id, created_at DESC);
