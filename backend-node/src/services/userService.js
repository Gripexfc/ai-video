/**
 * 用户服务 — 注册、登录、密码、用户管理
 */
const crypto = require('crypto');
const { getDb } = require('../db/index.js');
const { initBalance } = require('./creditsService.js');
const { loadConfig } = require('../config/index.js');

// ─── 密码工具 ───

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const verify = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return hash === verify;
}

// ─── 注册 ───

/**
 * 注册（含 IP 限流防刷号）
 * @returns {{ id, username }}
 */
function register(db, { username, password }, ip) {
  // 校验
  if (!username || username.length < 4 || username.length > 20) {
    throw new Error('用户名需 4-20 位');
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    throw new Error('用户名仅支持字母、数字、下划线');
  }
  if (!password || password.length < 6) {
    throw new Error('密码至少 6 位');
  }

  // 检查注册开关
  const regEnabled = db.prepare("SELECT value FROM system_settings WHERE key = 'registration_enabled'").get();
  if (regEnabled && regEnabled.value === 'false') {
    throw new Error('暂未开放注册');
  }

  // IP 限流：24 小时内同一 IP 最多注册 3 个
  const ipCount = db.prepare(`
    SELECT COUNT(*) as cnt FROM registration_log
    WHERE ip = ? AND created_at > datetime('now', '-1 day')
  `).get(ip).cnt;
  if (ipCount >= 3) {
    throw new Error('注册过于频繁，请明天再试');
  }

  // 检查用户名重复
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    throw new Error('用户名已存在');
  }

  // 入库
  const passwordHash = hashPassword(password);
  const result = db.prepare(`
    INSERT INTO users (username, password_hash, created_at, updated_at)
    VALUES (?, ?, datetime('now'), datetime('now'))
  `).run(username, passwordHash);

  const userId = result.lastInsertRowid;

  // 记录注册 IP
  db.prepare('INSERT INTO registration_log (user_id, ip, username, created_at) VALUES (?, ?, ?, datetime("now"))')
    .run(userId, ip, username);

  // 初始化积分余额
  initBalance(db, userId);

  // 新人赠送积分（如果开启了）
  const bonusEnabled = db.prepare("SELECT value FROM system_settings WHERE key = 'welcome_bonus_enabled'").get();
  if (bonusEnabled && bonusEnabled.value === 'true') {
    const bonusAmount = db.prepare("SELECT value FROM system_settings WHERE key = 'welcome_bonus_amount'").get();
    const amount = parseInt(bonusAmount?.value || '0', 10);
    if (amount > 0) {
      const { adminAddCredits } = require('./creditsService.js');
      adminAddCredits(db, userId, amount, '新人赠送积分', 0);
    }
  }

  return { id: userId, username };
}

// ─── 登录 ───

/**
 * 登录（含失败锁定）
 * @returns {{ id, username, role, token }}
 */
function login(db, { username, password }, ip) {
  if (!username || !password) {
    throw new Error('请输入用户名和密码');
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) {
    throw new Error('用户名或密码错误');
  }

  // 检查锁定
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    const remain = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
    throw new Error(`账号已锁定，请 ${remain} 分钟后重试`);
  }

  // 检查封禁
  if (user.status === 'banned') {
    throw new Error('账号已被封禁');
  }

  // 验证密码
  if (!verifyPassword(password, user.password_hash)) {
    // 累加失败次数，5 次锁定 30 分钟
    const newFailCount = (user.login_fail_count || 0) + 1;
    if (newFailCount >= 5) {
      db.prepare(`
        UPDATE users SET login_fail_count = ?, locked_until = datetime('now', '+30 minutes')
        WHERE id = ?
      `).run(newFailCount, user.id);
      throw new Error('密码错误次数过多，账号锁定 30 分钟');
    } else {
      db.prepare('UPDATE users SET login_fail_count = ? WHERE id = ?').run(newFailCount, user.id);
      throw new Error(`用户名或密码错误（还剩 ${5 - newFailCount} 次机会）`);
    }
  }

  // 登录成功：重置失败计数，更新最后登录
  db.prepare(`
    UPDATE users SET login_fail_count = 0, locked_until = NULL, last_login_at = datetime('now'), last_login_ip = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(ip, user.id);

  // 生成 JWT token
  const token = generateToken(user.id, user.username, user.role);

  return {
    id: user.id,
    username: user.username,
    nickname: user.nickname,
    role: user.role,
    token,
  };
}

// ─── JWT（简单 HMAC-SHA256，不引入外部依赖） ───

const JWT_SECRET = process.env.JWT_SECRET || (loadConfig().auth && loadConfig().auth.jwt_secret) || 'localminidrama_jwt_secret_2026';
const JWT_EXPIRES = 7 * 24 * 60 * 60 * 1000; // 7 天

function generateToken(userId, username, role) {
  const payload = { uid: userId, username, role, exp: Date.now() + JWT_EXPIRES };
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(payloadStr).digest('base64url');
  return `${payloadStr}.${sig}`;
}

function verifyToken(token) {
  if (!token) return null;
  const [payloadStr, sig] = token.split('.');
  if (!payloadStr || !sig) return null;

  const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(payloadStr).digest('base64url');
  if (sig !== expectedSig) return null;

  try {
    const payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString());
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// ─── 用户信息 ───

function getProfile(db, userId) {
  const user = db.prepare('SELECT id, username, nickname, role, status, created_at FROM users WHERE id = ?').get(userId);
  if (!user) return null;
  const { getBalance } = require('./creditsService.js');
  const balance = getBalance(db, userId);
  return { ...user, credits: balance.balance };
}

function changePassword(db, userId, oldPassword, newPassword) {
  if (!newPassword || newPassword.length < 6) throw new Error('新密码至少 6 位');
  const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId);
  if (!user) throw new Error('用户不存在');
  if (!verifyPassword(oldPassword, user.password_hash)) throw new Error('原密码错误');
  db.prepare('UPDATE users SET password_hash = ?, updated_at = datetime("now") WHERE id = ?')
    .run(hashPassword(newPassword), userId);
  return true;
}

// ─── 后台：用户管理 ───

function listUsers(db, { page = 1, pageSize = 20, keyword, status } = {}) {
  const offset = (page - 1) * pageSize;
  let where = 'WHERE 1=1';
  const params = [];
  if (keyword) {
    where += ' AND (u.username LIKE ? OR u.nickname LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`);
  }
  if (status) {
    where += ' AND u.status = ?';
    params.push(status);
  }

  const total = db.prepare(`SELECT COUNT(*) as cnt FROM users u ${where}`).get(...params).cnt;
  const rows = db.prepare(`
    SELECT u.id, u.username, u.nickname, u.role, u.status, u.created_at, u.last_login_at, u.last_login_ip,
           COALESCE(cb.balance, 0) as balance,
           COALESCE(cb.total_recharged, 0) as total_recharged,
           COALESCE(cb.total_consumed, 0) as total_consumed
    FROM users u
    LEFT JOIN credits_balance cb ON cb.user_id = u.id
    ${where}
    ORDER BY u.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, pageSize, offset);

  return { total, page, pageSize, list: rows };
}

function banUser(db, userId) {
  db.prepare("UPDATE users SET status = 'banned', updated_at = datetime('now') WHERE id = ?").run(userId);
}

function unbanUser(db, userId) {
  db.prepare("UPDATE users SET status = 'active', updated_at = datetime('now') WHERE id = ?").run(userId);
}

function resetUserPassword(db, userId, newPassword) {
  if (!newPassword || newPassword.length < 6) throw new Error('密码至少 6 位');
  db.prepare('UPDATE users SET password_hash = ?, updated_at = datetime("now") WHERE id = ?')
    .run(hashPassword(newPassword), userId);
}

// ─── 管理员（复用 users 表结构，独立 admins 表） ───

function adminLogin(db, { username, password }) {
  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
  if (!admin) throw new Error('管理员账号不存在');
  if (admin.status !== 'active') throw new Error('账号已禁用');
  if (!verifyPassword(password, admin.password_hash)) throw new Error('密码错误');

  db.prepare("UPDATE admins SET last_login_at = datetime('now') WHERE id = ?").run(admin.id);
  const token = generateToken(admin.id, admin.username, 'admin');

  return { id: admin.id, username: admin.username, nickname: admin.nickname, token };
}

function createDefaultAdmin(db) {
  const existing = db.prepare('SELECT id FROM admins WHERE username = ?').get('admin');
  if (!existing) {
    db.prepare(`
      INSERT INTO admins (username, password_hash, nickname, created_at, updated_at)
      VALUES ('admin', ?, '超级管理员', datetime('now'), datetime('now'))
    `).run(hashPassword('admin123'));
  }
}

module.exports = {
  hashPassword,
  verifyPassword,
  register,
  login,
  generateToken,
  verifyToken,
  getProfile,
  changePassword,
  listUsers,
  banUser,
  unbanUser,
  resetUserPassword,
  adminLogin,
  createDefaultAdmin,
};
