const { checkActivation } = require('../services/activationService');
const response = require('../response');

function requireActivation(db) {
  return (req, res, next) => {
    try {
      const result = checkActivation(db);
      if (!result.activated) {
        return response.forbidden(res, result.error || '应用未激活，请先输入激活码');
      }
      next();
    } catch (err) {
      return response.internalError(res, '激活验证失败');
    }
  };
}

module.exports = { requireActivation };
