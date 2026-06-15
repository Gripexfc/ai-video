/**
 * 友好错误信息映射
 * 将技术性错误翻译为用户可理解的中文提示
 */

const ERROR_MAP = [
  // 网络
  { pattern: /ECONNREFUSED|Network Error/i, message: '网络连接失败，请检查服务器是否启动' },
  { pattern: /timeout of|request timed out|ETIMEDOUT/i, message: '请求超时，请稍后重试' },
  { pattern: /ERR_CONNECTION/i, message: '无法连接到服务器，请检查网络' },

  // API 限流
  { pattern: /429|rate.?limit|too many requests/i, message: '请求过于频繁，请稍后再试' },

  // 认证
  { pattern: /401|unauthorized|invalid.?api.?key|api.?key.*invalid/i, message: 'API 密钥无效或未配置，请在「AI 配置」中检查' },
  { pattern: /403|forbidden/i, message: '没有权限访问该资源，请检查 API 配置' },

  // 服务端
  { pattern: /500|internal.?server.?error/i, message: '服务器内部错误，请稍后重试' },
  { pattern: /502|bad.?gateway/i, message: '服务暂时不可用，请稍后重试' },
  { pattern: /503|service.?unavailable/i, message: '服务暂时不可用，请稍后重试' },

  // AI 模型
  { pattern: /model.?not.?found|model.?does.?not.?exist/i, message: 'AI 模型不可用，请在「AI 配置」中检查模型名称' },
  { pattern: /quota|insufficient|余额/i, message: 'AI 服务额度不足，请检查账户余额' },

  // 文件
  { pattern: /file too large|exceeds.*limit/i, message: '文件过大，请选择更小的文件' },
  { pattern: /unsupported.*format|invalid.*format/i, message: '不支持的文件格式' },

  // 生成
  { pattern: /生成超时|generation.*timeout/i, message: '生成超时，请稍后重试' },
  { pattern: /生成失败|generation.*failed/i, message: '生成失败，请检查 AI 配置后重试' },

  // 内容安全
  { pattern: /content.?policy|safety|content.?filter|blocked/i, message: '内容未通过安全审核，请修改提示词后重试' },
]

/**
 * 将错误对象或字符串转换为友好的中文提示
 * @param {Error|string} err
 * @returns {string}
 */
export function friendlyError(err) {
  const msg = typeof err === 'string' ? err : (err?.message || '')
  if (!msg) return '操作失败，请重试'

  for (const { pattern, message } of ERROR_MAP) {
    if (pattern.test(msg)) return message
  }

  // 如果已经是中文友好消息，直接返回
  if (/[\u4e00-\u9fff]/.test(msg) && msg.length < 50) return msg

  return '操作失败，请重试'
}
