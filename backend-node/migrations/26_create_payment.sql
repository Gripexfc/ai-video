-- 充值商品
CREATE TABLE IF NOT EXISTS credit_products (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  credits     INTEGER NOT NULL,
  bonus       INTEGER NOT NULL DEFAULT 0,
  price       REAL    NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- 支付订单
CREATE TABLE IF NOT EXISTS payment_orders (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no        TEXT    NOT NULL UNIQUE,
  trade_no        TEXT,
  user_id         INTEGER NOT NULL,
  product_id      INTEGER,
  amount          REAL    NOT NULL,
  credits         INTEGER NOT NULL,
  bonus           INTEGER NOT NULL DEFAULT 0,
  status          TEXT    NOT NULL DEFAULT 'pending',
  pay_url         TEXT,
  paid_at         TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  expired_at      TEXT
);

CREATE INDEX IF NOT EXISTS idx_payment_orders_user ON payment_orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON payment_orders (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_orders_trade ON payment_orders (trade_no);

-- 预置充值商品
INSERT INTO credit_products (name, credits, bonus, price, sort_order, is_active) VALUES
  ('体验包', 99,  0,   9.9,  1, 1),
  ('基础包', 490, 50,  49,   2, 1),
  ('创作包', 990, 160, 99,   3, 1),
  ('专业包', 2990, 600, 299, 4, 1),
  ('旗舰包', 4990, 1200, 499, 5, 1);
