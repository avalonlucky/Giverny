-- 任务结算归属月份：支持把历史实际完成任务补录到后续月份结算。
ALTER TABLE tasks ADD COLUMN settlement_month TEXT;

UPDATE tasks
SET settlement_month = substr(start_date, 1, 7)
WHERE settlement_month IS NULL
  AND start_date IS NOT NULL
  AND length(start_date) >= 7;

CREATE INDEX IF NOT EXISTS idx_tasks_settlement_month ON tasks(settlement_month);
