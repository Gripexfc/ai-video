-- 公告表
CREATE TABLE IF NOT EXISTS announcements (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT    NOT NULL,
  content     TEXT    NOT NULL,
  type        TEXT    NOT NULL DEFAULT 'banner',
  is_active   INTEGER NOT NULL DEFAULT 0,
  start_at    TEXT,
  end_at      TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
