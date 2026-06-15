/**
 * JWT 鉴权中间件
 * 验证请求头 Authorization: Bearer <token>
 * 成功后 req.user = { uid, username, role }
 */
const { verifyToken } = require('../services/userService.js');

// ── 共享 token 提取 ──
function extractToken(req) {
  const authHeader = req.headers.authorization || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
}

function authMiddleware(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({ success: false, error: '未登录' });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ success: false, error: '登录已过期，请重新登录' });
  }

  req.user = { uid: payload.uid, username: payload.username, role: payload.role };
  next();
}

/**
 * 管理员鉴权
 */
function adminAuthMiddleware(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({ success: false, error: '未登录' });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ success: false, error: '登录已过期' });
  }

  if (payload.role !== 'admin') {
    return res.status(403).json({ success: false, error: '无管理员权限' });
  }

  req.admin = { id: payload.uid, username: payload.username };
  next();
}

/**
 * 可选鉴权（有 token 就解析，没有也不拦截）
 * 用于首页等公开页面，登录用户可看自己的项目
 */
function optionalAuth(req, res, next) {
  const token = extractToken(req);
  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      req.user = { uid: payload.uid, username: payload.username, role: payload.role };
    }
  }
  next();
}

module.exports = { authMiddleware, adminAuthMiddleware, optionalAuth, extractToken };
