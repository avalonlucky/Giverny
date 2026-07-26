UPDATE workspaces SET name = 'Giverny 演示空间' WHERE id = 'demo';
UPDATE tasks SET requester = '许清河' WHERE workspace_id = 'demo' AND id = '860000002';

ALTER TABLE hour_estimate_suggestions ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_hour_estimate_workspace_type
  ON hour_estimate_suggestions(workspace_id, design_type, requested_at);
