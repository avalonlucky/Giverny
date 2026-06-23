ALTER TABLE attachments ADD COLUMN entry_id TEXT;
ALTER TABLE attachments ADD COLUMN deleted_at TEXT;

CREATE INDEX IF NOT EXISTS idx_attachments_entry_id ON attachments(task_id, entry_id);
