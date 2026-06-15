const { checkActivation, activateCode, getMachineId } = require('../services/activationService');
const response = require('../response');

// 简易速率限制：5次/分钟/IP
const attempts = new Map();
function checkRateLimit(ip) {
  const now = Date.now();
  // Clean up expired entries (older than 2 minutes)
  for (const [key, record] of attempts) {
    if (now - record.windowStart > 120000) {
      attempts.delete(key);
    }
  }
  const record = attempts.get(ip) || { count: 0, windowStart: now };
  if (now - record.windowStart > 60000) {
    record.count = 1;
    record.windowStart = now;
  } else {
    record.count++;
  }
  attempts.set(ip, record);
  return record.count <= 5;
}

module.exports = function (config, db, log) {
  const router = require('express').Router();

  // GET /api/v1/activation/status
  router.get('/status', (req, res) => {
    const result = checkActivation(db);
    // 附带 credits_mode，让前端感知当前是否为积分付费模式
    try {
      const row = db.prepare("SELECT value FROM system_settings WHERE key = 'credits_mode'").get();
      result.credits_mode = (row && row.value === 'on') ? 'on' : 'off';
    } catch (_) {
      result.credits_mode = 'off';
    }
    response.success(res, result);
  });

  // GET /api/v1/activation/machine-id
  router.get('/machine-id', (req, res) => {
    response.success(res, { machine_id: getMachineId() });
  });

  // POST /api/v1/activation/activate
  router.post('/activate', (req, res) => {
    const ip = req.ip || req.connection.remoteAddress;
    if (!checkRateLimit(ip)) {
      return response.error(res, 429, 'TOO_MANY_REQUESTS', '尝试次数过多，请一分钟后再试');
    }

    const { code } = req.body || {};
    if (!code) {
      return response.badRequest(res, '请输入激活码');
    }

    const result = activateCode(db, code);
    if (!result.ok) {
      return response.badRequest(res, result.error);
    }

    log.infow('Application activated', { machine_id: getMachineId() });
    response.success(res, result);
  });

  return router;
};
