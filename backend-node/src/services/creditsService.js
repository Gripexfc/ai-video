/**
 * 积分服务 — 扣减、退还、充值、查询
 */
const { getDb } = require('../db/index.js');

class CreditInsufficientError extends Error {
  constructor(msg) {
    super(msg);
    this.code = 'CREDIT_INSUFFICIENT';
    this.statusCode = 402;
  }
}

// ─── 积分价格键（对应 system_settings 中的 key） ───
const OPERATION_SETTINGS_MAP = {
  text_gen:            'credit_text_gen',
  image_gen:           'credit_image_gen',
  storyboard_image:    'credit_storyboard_image',
  video_gen_standard:  'credit_video_standard',
  video_gen_hd:        'credit_video_hd',
  video_gen_premium:   'credit_video_premium',
  tts:                 'credit_tts',
  prompt_polish:       'credit_prompt_polish',
  storyboard_gen:      'credit_storyboard_gen',
};

/**
 * 读取某项操作的积分价格（从 system_settings 动态读取）
 */
function getCreditPrice(db, operation) {
  const settingKey = OPERATION_SETTINGS_MAP[operation];
  if (!settingKey) throw new Error(`未知操作类型: ${operation}`);
  const row = db.prepare('SELECT value FROM system_settings WHERE key = ?').get(settingKey);
  if (!row || !row.value) throw new Error(`未配置积分价格: ${settingKey}`);
  return parseInt(row.value, 10);
}

/**
 * 获取所有积分价格（后台用）
 */
function getAllCreditPrices(db) {
  const rows = db.prepare(
    "SELECT key, value, description FROM system_settings WHERE key LIKE 'credit_%'"
  ).all();
  const result = {};
  for (const r of rows) {
    result[r.key] = { value: parseInt(r.value, 10), description: r.description };
  }
  return result;
}

/**
 * 更新积分价格（后台用）
 */
function updateCreditPrice(db, key, value) {
  db.prepare(
    "UPDATE system_settings SET value = ?, updated_at = datetime('now') WHERE key = ?"
  ).run(String(value), key);
}

// ─── 核心扣减 ───

/**
 * 扣减积分（原子操作，余额不足抛 CreditInsufficientError）
 * @returns {{ deducted: number, balanceAfter: number }}
 */
function deductCredits(db, userId, operation, relatedId = null, description = '') {
  const amount = getCreditPrice(db, operation);

  // 原子扣减（WHERE balance >= 确保不超扣）
  const stmt = db.prepare(`
    UPDATE credits_balance
    SET balance = balance - ?,
        total_consumed = total_consumed + ?,
        updated_at = datetime('now')
    WHERE user_id = ? AND balance >= ?
  `);
  const result = stmt.run(amount, amount, userId, amount);

  if (result.changes === 0) {
    const row = db.prepare('SELECT balance FROM credits_balance WHERE user_id = ?').get(userId);
    throw new CreditInsufficientError(
      `积分不足，需要 ${amount} 积分，当前余额 ${row ? row.balance : 0}`
    );
  }

  const newBalance = db.prepare('SELECT balance FROM credits_balance WHERE user_id = ?')
    .get(userId).balance;

  // 写流水
  db.prepare(`
    INSERT INTO credits_transactions (user_id, type, amount, balance_after, operation, description, related_id)
    VALUES (?, 'consume', ?, ?, ?, ?, ?)
  `).run(userId, -amount, newBalance, operation, description, relatedId);

  return { deducted: amount, balanceAfter: newBalance };
}

/**
 * 退还积分（AI 调用失败时回退）
 */
function refundCredits(db, userId, operation, amount, relatedId = null, description = '') {
  db.prepare(`
    UPDATE credits_balance
    SET balance = balance + ?,
        total_consumed = total_consumed - ?,
        updated_at = datetime('now')
    WHERE user_id = ?
  `).run(amount, amount, userId);

  const newBalance = db.prepare('SELECT balance FROM credits_balance WHERE user_id = ?')
    .get(userId).balance;

  db.prepare(`
    INSERT INTO credits_transactions (user_id, type, amount, balance_after, operation, description, related_id)
    VALUES (?, 'refund', ?, ?, ?, ?, ?)
  `).run(userId, amount, newBalance, operation || 'refund', description, relatedId);

  return { refunded: amount, balanceAfter: newBalance };
}

/**
 * 充值积分（支付成功后调用）
 */
function rechargeCredits(db, userId, credits, bonus, orderNo) {
  const total = credits + bonus;

  // upsert 余额
  const existing = db.prepare('SELECT user_id FROM credits_balance WHERE user_id = ?').get(userId);
  if (existing) {
    db.prepare(`
      UPDATE credits_balance
      SET balance = balance + ?,
          total_recharged = total_recharged + ?,
          updated_at = datetime('now')
      WHERE user_id = ?
    `).run(total, total, userId);
  } else {
    db.prepare(`
      INSERT INTO credits_balance (user_id, balance, total_recharged) VALUES (?, ?, ?)
    `).run(userId, total, total);
  }

  const newBalance = db.prepare('SELECT balance FROM credits_balance WHERE user_id = ?')
    .get(userId).balance;

  // 主充值流水
  db.prepare(`
    INSERT INTO credits_transactions (user_id, type, amount, balance_after, operation, description, order_no)
    VALUES (?, 'recharge', ?, ?, 'topup', ?, ?)
  `).run(userId, credits, newBalance, `充值 ${credits} 积分`, orderNo);

  // 赠送流水（如果有）
  if (bonus > 0) {
    db.prepare(`
      INSERT INTO credits_transactions (user_id, type, amount, balance_after, operation, description, order_no)
      VALUES (?, 'gift', ?, ?, 'topup_bonus', ?, ?)
    `).run(userId, bonus, newBalance, `赠送 ${bonus} 积分`, orderNo);
  }

  return { total, balanceAfter: newBalance };
}

/**
 * 手动加积分（后台管理员操作）
 */
function adminAddCredits(db, userId, amount, description, adminId) {
  const existing = db.prepare('SELECT user_id FROM credits_balance WHERE user_id = ?').get(userId);
  if (existing) {
    db.prepare(`
      UPDATE credits_balance SET balance = balance + ?, updated_at = datetime('now') WHERE user_id = ?
    `).run(amount, userId);
  } else {
    db.prepare(`INSERT INTO credits_balance (user_id, balance) VALUES (?, ?)`).run(userId, amount);
  }

  const newBalance = db.prepare('SELECT balance FROM credits_balance WHERE user_id = ?')
    .get(userId).balance;

  db.prepare(`
    INSERT INTO credits_transactions (user_id, type, amount, balance_after, operation, description)
    VALUES (?, 'gift', ?, ?, 'admin_adjust', ?)
  `).run(userId, amount, newBalance, description || `管理员手动加积分 (admin:${adminId})`);

  return { added: amount, balanceAfter: newBalance };
}

// ─── 查询 ───

function getBalance(db, userId) {
  const row = db.prepare('SELECT * FROM credits_balance WHERE user_id = ?').get(userId);
  return row || { user_id: userId, balance: 0, total_recharged: 0, total_consumed: 0 };
}

function getTransactions(db, userId, { page = 1, pageSize = 20, type } = {}) {
  const offset = (page - 1) * pageSize;
  let where = 'WHERE user_id = ?';
  const params = [userId];
  if (type) {
    where += ' AND type = ?';
    params.push(type);
  }
  const total = db.prepare(`SELECT COUNT(*) as cnt FROM credits_transactions ${where}`).get(...params).cnt;
  const rows = db.prepare(
    `SELECT * FROM credits_transactions ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all(...params, pageSize, offset);
  return { total, page, pageSize, list: rows };
}

// ─── 初始化用户积分余额（注册时调用） ───
function initBalance(db, userId) {
  db.prepare(`
    INSERT OR IGNORE INTO credits_balance (user_id, balance, total_recharged, total_consumed)
    VALUES (?, 0, 0, 0)
  `).run(userId);
}

module.exports = {
  CreditInsufficientError,
  getCreditPrice,
  getAllCreditPrices,
  updateCreditPrice,
  deductCredits,
  refundCredits,
  rechargeCredits,
  adminAddCredits,
  getBalance,
  getTransactions,
  initBalance,
  OPERATION_SETTINGS_MAP,
};
