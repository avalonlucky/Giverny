-- 甲方分享页查看回执：记录最近查看时间和累计次数
-- 已有数据库执行一次即可（新库由 schema.sql 直接建出这两列）
ALTER TABLE monthly_reports ADD COLUMN viewed_at TEXT;
ALTER TABLE monthly_reports ADD COLUMN view_count INTEGER NOT NULL DEFAULT 0;
