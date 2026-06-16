-- 任务改为软删除：避免有进展、文件、时间段时触发外键约束。
ALTER TABLE tasks ADD COLUMN deleted_at TEXT;
CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at ON tasks(deleted_at);
