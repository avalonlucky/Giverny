ALTER TABLE attachments ADD COLUMN attachment_scope TEXT NOT NULL DEFAULT 'progress';

UPDATE attachments
SET attachment_scope = 'acceptance'
WHERE is_final = 1 OR file_tag = '验收文件';

CREATE INDEX IF NOT EXISTS idx_attachments_scope_uploaded_at
ON attachments(attachment_scope, uploaded_at);
