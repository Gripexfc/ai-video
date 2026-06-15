-- 积分余额表
CREATE TABLE IF NOT EXISTS credits_balance (
  user_id         INTEGER PRIMARY KEY REFERENCES users(id),
  balance         INTEGER NOT NULL DEFAULT 0,
  total_recharged INTEGER NOT NULL DEFAULT 0,
  total_consumed  INTEGER NOT NULL DEFAULT 0,
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- 积分流水表
CREATE TABLE IF NOT EXISTS credits_transactions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL,
  type            TEXT    NOT NULL,
  amount          INTEGER NOT NULL,
  balance_after   INTEGER NOT NULL,
  operation       TEXT    NOT NULL,
  description     TEXT,
  related_id      INTEGER,
  order_no        TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_credits_tx_user ON credits_transactions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credits_tx_order ON credits_transactions (order_no);
CREATE INDEX IF NOT EXISTS idx_credits_tx_type ON credits_transactions (type, created_at DESC);
