-- 迁移追踪表：记录已执行的迁移文件，避免重复执行
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename  TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
