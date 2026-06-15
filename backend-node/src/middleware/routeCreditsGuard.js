/**
 * 路由级积分守卫
 * 在需要扣积分的 AI 调用路由上使用，自动鉴权 + 扣积分 + 失败退还
 *
 * 用法：wrapWithCredits(operation)(originalHandler)
 */
const { authMiddleware } = require('../middleware/authMiddleware.js');
const { deductCreditsGuard, refundCreditsGuard } = require('../middleware/creditsGuard.js');
const { getCreditPrice } = require('../services/creditsService.js');
const { getDb } = require('../db/index.js');

/**
 * 不需要登录的路径前缀（白名单）
 */
const AUTH_WHITELIST = [
  '/auth/',
  '/admin/',
  '/credits/payment/',
  '/credits/products',
  '/announcements',
  '/health',
];

/**
 * 鉴权中间件：白名单路径跳过，其他路径要求登录
 */
function selectiveAuth(req, res, next) {
  const path = req.path;
  if (AUTH_WHITELIST.some(p => path.startsWith(p) || path === p)) {
    return next();
  }
  return authMiddleware(req, res, next);
}

/**
 * 创建带积分扣减的路由包装器
 * @param {string} operation - 操作类型 text_gen/image_gen/storyboard_image/video_gen/tts
 * @param {function} [getModelFn] - 可选，从 req 中提取模型名（用于视频档位判断）
 * @returns {function} 包装后的路由处理函数
 */
function withCredits(operation, getModelFn) {
  return function(handler) {
    return async function(req, res, next) {
      // 如果没有用户信息（白名单路径），直接执行原逻辑
      if (!req.user) return handler(req, res, next);

      const db = getDb();
      const userId = req.user.uid;
      const actualOp = getModelFn ? getModelFn(req) : operation;

      // 获取积分价格
      let price;
      try {
        price = getCreditPrice(db, actualOp);
      } catch (e) {
        return res.status(500).json({ success: false, error: '积分配置错误: ' + e.message });
      }

      // 扣积分
      try {
        deductCreditsGuard(db, userId, actualOp, null, `${actualOp} via ${req.method} ${req.path}`);
      } catch (e) {
        if (e.code === 'CREDIT_INSUFFICIENT') {
          return res.status(402).json({
            success: false,
            error: e.message,
            code: 'CREDIT_INSUFFICIENT',
            required: price,
          });
        }
        return res.status(500).json({ success: false, error: e.message });
      }

      // 执行原路由逻辑
      try {
        await handler(req, res, next);
      } catch (err) {
        // 路由层异常，退还积分
        try {
          refundCreditsGuard(db, userId, actualOp, price, null, `退还: ${actualOp} 失败`);
        } catch (_) {}
        throw err;
      }
    };
  };
}

/**
 * 异步任务的积分守卫（用于 setImmediate 异步执行的 AI 任务）
 * 调用方式：在路由中先扣积分，把 deduction 记录传给异步任务，异步任务失败时退还
 */
function deductForAsyncTask(userId, operation, relatedId, description) {
  const db = getDb();
  return deductCreditsGuard(db, userId, operation, relatedId, description);
}

function refundForAsyncTask(userId, operation, amount, relatedId, description) {
  const db = getDb();
  return refundCreditsGuard(db, userId, operation, amount, relatedId, description);
}

/**
 * 视频模型 → 操作类型映射（路由级，从 request body 提取 model）
 */
function inferVideoOperation(req) {
  const { getVideoCreditOperation } = require('../middleware/creditsGuard.js');
  const model = req.body?.model || '';
  return getVideoCreditOperation(model);
}

module.exports = {
  selectiveAuth,
  withCredits,
  deductForAsyncTask,
  refundForAsyncTask,
  inferVideoOperation,
};
