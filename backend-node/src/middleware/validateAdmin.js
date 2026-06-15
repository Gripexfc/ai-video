/**
 * Admin 端点输入校验中间件
 * 为 admin CRUD 路由提供轻量级参数验证
 */

// ── Products 校验 ──
function validateProduct(req, res, next) {
  const { name, credits, price } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ success: false, error: '商品名称不能为空' });
  }
  if (credits === undefined || !Number.isFinite(+credits) || +credits <= 0) {
    return res.status(400).json({ success: false, error: '积分数必须为正数' });
  }
  if (price === undefined || !Number.isFinite(+price) || +price < 0) {
    return res.status(400).json({ success: false, error: '价格无效' });
  }
  next();
}

// ── Settings key 白名单 ──
const ALLOWED_SETTING_KEYS = [
  'registration_enabled', 'maintenance_mode',
  'welcome_bonus_enabled', 'welcome_bonus_amount',
  'relay_text_url', 'relay_text_key', 'relay_image_url', 'relay_image_key',
  'relay_video_url', 'relay_video_key',
];

function validateSettings(req, res, next) {
  const updates = req.body;
  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ success: false, error: '参数无效' });
  }
  for (const key of Object.keys(updates)) {
    if (!ALLOWED_SETTING_KEYS.includes(key)) {
      return res.status(400).json({ success: false, error: `不允许修改的设置项: ${key}` });
    }
  }
  next();
}

// ── Announcements 校验 ──
function validateAnnouncement(req, res, next) {
  const { title, content } = req.body;
  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ success: false, error: '公告标题不能为空' });
  }
  if (!content || typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({ success: false, error: '公告内容不能为空' });
  }
  next();
}

// ── Add Credits 校验 ──
function validateAddCredits(req, res, next) {
  const { amount } = req.body;
  if (!amount || !Number.isFinite(+amount) || +amount <= 0) {
    return res.status(400).json({ success: false, error: '积分数必须为正数' });
  }
  next();
}

// ── Relay Test 校验 ──
function validateRelayTest(req, res, next) {
  const { url, key } = req.body;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ success: false, error: '缺少 url' });
  }
  if (!key || typeof key !== 'string') {
    return res.status(400).json({ success: false, error: '缺少 key' });
  }
  next();
}

module.exports = {
  validateProduct,
  validateSettings,
  validateAnnouncement,
  validateAddCredits,
  validateRelayTest,
};
