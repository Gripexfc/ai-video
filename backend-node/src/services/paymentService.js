/**
 * 彩虹易支付对接 — 下单、回调验签、订单管理
 */
const crypto = require('crypto');
const { getDb } = require('../db/index.js');
const { rechargeCredits } = require('./creditsService.js');

/**
 * 读取支付配置
 */
function getPayConfig(db) {
  const keys = ['pay_pid', 'pay_key', 'pay_url', 'pay_type'];
  const rows = db.prepare(`SELECT key, value FROM system_settings WHERE key IN (${keys.map(() => '?').join(',')})`)
    .all(...keys);
  const cfg = {};
  for (const r of rows) cfg[r.key] = r.value;
  return cfg;
}

/**
 * 生成订单号
 */
function generateOrderNo() {
  const now = new Date();
  const ts = now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0');
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `CZ${ts}${rand}`;
}

/**
 * MD5 签名（彩虹易支付规范）
 * 按 key 字典序拼接待签名字段 + 密钥
 */
function sign(params, key) {
  const sorted = Object.keys(params).sort();
  const str = sorted
    .filter(k => params[k] !== '' && params[k] !== undefined && params[k] !== null)
    .map(k => `${k}=${params[k]}`)
    .join('&');
  return crypto.createHash('md5').update(str + key).digest('hex');
}

/**
 * 创建支付订单
 * @returns {{ orderNo, payUrl }}
 */
function createPaymentOrder(db, userId, productId) {
  const product = db.prepare('SELECT * FROM credit_products WHERE id = ? AND is_active = 1')
    .get(productId);
  if (!product) throw new Error('充值商品不存在或已下架');

  const cfg = getPayConfig(db);
  if (!cfg.pay_pid || !cfg.pay_key || !cfg.pay_url) {
    throw new Error('支付未配置，请联系管理员');
  }

  const orderNo = generateOrderNo();
  const totalCredits = product.credits + product.bonus;

  // 写入订单
  db.prepare(`
    INSERT INTO payment_orders (order_no, user_id, product_id, amount, credits, bonus, status, created_at, expired_at)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', datetime('now'), datetime('now', '+30 minutes'))
  `).run(orderNo, userId, productId, product.price, product.credits, product.bonus);

  // 构建支付请求参数
  const params = {
    pid:      cfg.pay_pid,
    type:     cfg.pay_type || 'alipay',
    out_trade_no: orderNo,
    notify_url: '',  // 需要配置为公网回调地址，从 config 或 system_settings 读取
    return_url: '',  // 前端回调地址
    name:     `充值${totalCredits}积分`,
    money:    String(product.price),
  };

  // 从 system_settings 读回调地址
  const notifyRow = db.prepare("SELECT value FROM system_settings WHERE key = 'pay_notify_url'").get();
  const returnRow = db.prepare("SELECT value FROM system_settings WHERE key = 'pay_return_url'").get();
  params.notify_url = notifyRow?.value || '';
  params.return_url = returnRow?.value || '';

  params.sign = sign(params, cfg.pay_key);
  params.sign_type = 'MD5';

  const payUrl = `${cfg.pay_url}?${Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`;

  // 更新订单的 pay_url
  db.prepare('UPDATE payment_orders SET pay_url = ? WHERE order_no = ?').run(payUrl, orderNo);

  return { orderNo, payUrl, amount: product.price, credits: totalCredits };
}

/**
 * 处理支付回调（彩虹易支付 GET/POST 回调）
 * @param {object} query - 回调参数
 * @returns {{ success: boolean, orderNo: string }}
 */
function handleCallback(db, query) {
  const cfg = getPayConfig(db);
  if (!cfg.pay_key) return { success: false, message: '支付未配置' };

  // 验签
  const { sign: querySign, sign_type, ...params } = query;
  const expectedSign = sign(params, cfg.pay_key);
  if (querySign !== expectedSign) {
    return { success: false, message: '签名验证失败' };
  }

  const orderNo = query.out_trade_no;
  const tradeStatus = query.trade_status;
  const tradeNo = query.trade_no;

  // 查订单
  const order = db.prepare('SELECT * FROM payment_orders WHERE order_no = ?').get(orderNo);
  if (!order) return { success: false, message: '订单不存在' };
  if (order.status === 'paid') return { success: true, orderNo, message: '已处理' }; // 幂等

  // 验金额
  if (Math.abs(parseFloat(query.money) - order.amount) > 0.01) {
    return { success: false, message: '金额不匹配' };
  }

  if (tradeStatus === 'TRADE_SUCCESS') {
    // 标记支付成功
    db.prepare(`
      UPDATE payment_orders SET status = 'paid', trade_no = ?, paid_at = datetime('now')
      WHERE order_no = ? AND status = 'pending'
    `).run(tradeNo, orderNo);

    // 充值积分
    rechargeCredits(db, order.user_id, order.credits, order.bonus, orderNo);

    return { success: true, orderNo };
  }

  return { success: false, message: `未处理的状态: ${tradeStatus}` };
}

/**
 * 查询订单状态（前端轮询用）
 */
function getOrderStatus(db, orderNo, userId) {
  const order = db.prepare('SELECT * FROM payment_orders WHERE order_no = ? AND user_id = ?')
    .get(orderNo, userId);
  if (!order) return null;
  return {
    orderNo:    order.order_no,
    status:     order.status,
    amount:     order.amount,
    credits:    order.credits,
    bonus:      order.bonus,
    payUrl:     order.pay_url,
    createdAt:  order.created_at,
    paidAt:     order.paid_at,
  };
}

/**
 * 获取充值商品列表
 */
function getProducts(db) {
  return db.prepare('SELECT * FROM credit_products WHERE is_active = 1 ORDER BY sort_order ASC').all();
}

/**
 * 清理过期订单（定时任务用）
 */
function cleanExpiredOrders(db) {
  const result = db.prepare(`
    UPDATE payment_orders SET status = 'expired'
    WHERE status = 'pending' AND expired_at < datetime('now')
  `).run();
  return result.changes;
}

/**
 * 手动补单（后台用）
 */
function manualConfirm(db, orderNo, adminId) {
  const order = db.prepare('SELECT * FROM payment_orders WHERE order_no = ?').get(orderNo);
  if (!order) throw new Error('订单不存在');
  if (order.status === 'paid') throw new Error('订单已支付，无需补单');

  db.prepare(`
    UPDATE payment_orders SET status = 'paid', trade_no = ?, paid_at = datetime('now')
    WHERE order_no = ?
  `).run(`manual_${adminId}_${Date.now()}`, orderNo);

  rechargeCredits(db, order.user_id, order.credits, order.bonus, orderNo);
  return { success: true, orderNo };
}

module.exports = {
  createPaymentOrder,
  handleCallback,
  getOrderStatus,
  getProducts,
  cleanExpiredOrders,
  manualConfirm,
  generateOrderNo,
};
