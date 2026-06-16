-- 任务作废（软删除的第二态）：作废任务对非管理员隐藏、不计入工时和结算，但数据保留可恢复。
-- 与 deleted_at 区别：deleted_at 是真删除（从所有视图彻底移除），voided_at 是作废（管理员可见、可恢复）。
ALTER TABLE tasks ADD COLUMN voided_at TEXT;
ALTER TABLE tasks ADD COLUMN void_reason TEXT;
CREATE INDEX IF NOT EXISTS idx_tasks_voided_at ON tasks(voided_at);
