/**
 * Admin service layer — encapsulates all SQL queries used by the admin route.
 * Route handlers call these functions; the key whitelist is enforced by
 * validateAdmin.js middleware, so this module does not duplicate it.
 */

// ── Dashboard ──

function getDashboardStats(db) {
  const today = new Date().toISOString().slice(0, 10);

  const totalUsers = db.prepare('SELECT COUNT(*) as cnt FROM users').get().cnt;
  const todayUsers = db.prepare("SELECT COUNT(*) as cnt FROM users WHERE created_at >= ?").get(today + 'T00:00:00').cnt;
  const activeUsers = db.prepare("SELECT COUNT(*) as cnt FROM users WHERE last_login_at >= datetime('now', '-7 days')").get().cnt;

  const totalRecharged = db.prepare('SELECT COALESCE(SUM(total_recharged), 0) as total FROM credits_balance').get().total;
  const todayRecharged = db.prepare(
    "SELECT COALESCE(SUM(ct.amount), 0) as total FROM credits_transactions ct WHERE ct.type = 'recharge' AND ct.created_at >= ?"
  ).get(today + 'T00:00:00').total;

  const totalConsumed = db.prepare('SELECT COALESCE(SUM(total_consumed), 0) as total FROM credits_balance').get().total;
  const todayConsumed = db.prepare(
    "SELECT COALESCE(SUM(ABS(ct.amount)), 0) as total FROM credits_transactions ct WHERE ct.type = 'consume' AND ct.created_at >= ?"
  ).get(today + 'T00:00:00').total;

  // 最近 7 天趋势
  const trend = db.prepare(`
    SELECT DATE(created_at) as date, COUNT(*) as cnt
    FROM users WHERE created_at >= datetime('now', '-7 days')
    GROUP BY DATE(created_at) ORDER BY date
  `).all();

  const rechargeTrend = db.prepare(`
    SELECT DATE(ct.created_at) as date, COALESCE(SUM(ct.amount), 0) as total
    FROM credits_transactions ct WHERE ct.type = 'recharge' AND ct.created_at >= datetime('now', '-7 days')
    GROUP BY DATE(ct.created_at) ORDER BY date
  `).all();

  return {
    totalUsers, todayUsers, activeUsers,
    totalRecharged: totalRecharged * 0.1,  // 积分→元
    todayRecharged: todayRecharged * 0.1,
    totalConsumed: totalConsumed * 0.1,
    todayConsumed: todayConsumed * 0.1,
    trend, rechargeTrend,
  };
}

// ── Relay config ──

function getRelayConfig(db) {
  const rows = db.prepare("SELECT key, value, description FROM system_settings WHERE key LIKE 'relay_%'").all();
  const config = {};
  for (const r of rows) config[r.key] = { value: r.value, description: r.description };
  return config;
}

function updateRelayConfig(db, updates) {
  const stmt = db.prepare("UPDATE system_settings SET value = ?, updated_at = datetime('now') WHERE key = ?");
  for (const [key, value] of Object.entries(updates)) {
    if (key.startsWith('relay_')) {
      stmt.run(String(value), key);
    }
  }
}

// ── Products ──

function getProducts(db) {
  return db.prepare('SELECT * FROM credit_products ORDER BY sort_order ASC').all();
}

function createProduct(db, data) {
  const { name, credits, bonus, price, sort_order, is_active } = data;
  db.prepare('INSERT INTO credit_products (name, credits, bonus, price, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?)')
    .run(name, credits, bonus || 0, price, sort_order || 0, is_active !== undefined ? is_active : 1);
}

function updateProduct(db, id, data) {
  const { name, credits, bonus, price, sort_order, is_active } = data;
  db.prepare('UPDATE credit_products SET name=?, credits=?, bonus=?, price=?, sort_order=?, is_active=? WHERE id=?')
    .run(name, credits, bonus || 0, price, sort_order || 0, is_active !== undefined ? is_active : 1, id);
}

function deleteProduct(db, id) {
  db.prepare('DELETE FROM credit_products WHERE id = ?').run(id);
}

// ── System settings ──

const SETTINGS_KEYS = [
  'registration_enabled',
  'maintenance_mode',
  'welcome_bonus_enabled',
  'welcome_bonus_amount',
];

function getSettings(db) {
  const rows = db.prepare(
    `SELECT key, value, description FROM system_settings WHERE key IN (${SETTINGS_KEYS.map(() => '?').join(', ')})`
  ).all(...SETTINGS_KEYS);
  const settings = {};
  for (const r of rows) settings[r.key] = { value: r.value, description: r.description };
  return settings;
}

function updateSettings(db, updates) {
  const stmt = db.prepare("UPDATE system_settings SET value = ?, updated_at = datetime('now') WHERE key = ?");
  for (const [key, value] of Object.entries(updates)) {
    stmt.run(String(value), key);
  }
}

// ── Announcements ──

function getAnnouncements(db) {
  return db.prepare('SELECT * FROM announcements ORDER BY created_at DESC').all();
}

function createAnnouncement(db, data) {
  const { title, content, type, is_active, start_at, end_at } = data;
  db.prepare('INSERT INTO announcements (title, content, type, is_active, start_at, end_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(title, content, type || 'banner', is_active || 0, start_at || null, end_at || null);
}

function updateAnnouncement(db, id, data) {
  const { title, content, type, is_active, start_at, end_at } = data;
  db.prepare('UPDATE announcements SET title=?, content=?, type=?, is_active=?, start_at=?, end_at=? WHERE id=?')
    .run(title, content, type || 'banner', is_active || 0, start_at || null, end_at || null, id);
}

function deleteAnnouncement(db, id) {
  db.prepare('DELETE FROM announcements WHERE id = ?').run(id);
}

// ── Orders ──

function getOrders(db, query) {
  const { page = 1, pageSize = 20, status } = query;
  const offset = (+page - 1) * +pageSize;
  let where = '';
  const params = [];
  if (status) { where = 'WHERE o.status = ?'; params.push(status); }
  const total = db.prepare(`SELECT COUNT(*) as cnt FROM payment_orders o ${where}`).get(...params).cnt;
  const list = db.prepare(`
    SELECT o.*, u.username FROM payment_orders o LEFT JOIN users u ON u.id = o.user_id
    ${where} ORDER BY o.created_at DESC LIMIT ? OFFSET ?
  `).all(...params, +pageSize, offset);
  return { total, page: +page, pageSize: +pageSize, list };
}

module.exports = {
  getDashboardStats,
  getRelayConfig, updateRelayConfig,
  getProducts, createProduct, updateProduct, deleteProduct,
  getSettings, updateSettings,
  getAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement,
  getOrders,
};
