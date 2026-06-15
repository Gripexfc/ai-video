/**
 * 积分守卫 — AI 调用前检查并扣减积分
 * 用法：在 AI 调用的路由/服务层调用 deductCreditsGuard(db, userId, operation, relatedId, desc)
 * 返回 { txId } 供失败时 refundCreditsGuard 回退
 */
const { deductCredits, refundCredits, CreditInsufficientError } = require('../services/creditsService.js');

/**
 * 扣减积分（AI 调用前调用）
 * @returns {{ deducted: number, balanceAfter: number }}
 * @throws CreditInsufficientError 余额不足时
 */
function deductCreditsGuard(db, userId, operation, relatedId = null, description = '') {
  return deductCredits(db, userId, operation, relatedId, description);
}

/**
 * 退还积分（AI 调用失败时调用）
 */
function refundCreditsGuard(db, userId, operation, amount, relatedId = null, description = '') {
  return refundCredits(db, userId, operation, amount, relatedId, description);
}

/**
 * 视频模型 → 积分操作类型映射
 */
function getVideoCreditOperation(model) {
  if (!model) return 'video_gen_standard';
  const m = model.toLowerCase();
  const premium = ['seedance-2', 'veo3', 'grok-video', 'viduq3-pro', 'kling-omni'];
  const hd = ['seedance-1-5', 'seedance-1-0-pro', 'wan2.1-t2v-plus', 'viduq2-pro', 'viduq3-turbo', 'kling-video'];
  if (premium.some(k => m.includes(k))) return 'video_gen_premium';
  if (hd.some(k => m.includes(k))) return 'video_gen_hd';
  return 'video_gen_standard';
}

module.exports = { deductCreditsGuard, refundCreditsGuard, getVideoCreditOperation };
