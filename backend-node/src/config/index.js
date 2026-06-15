const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const configPaths = [
  path.join(process.cwd(), 'configs', 'config.yaml'),
  path.join(process.cwd(), 'config.yaml'),
  path.join(__dirname, '..', '..', 'configs', 'config.yaml'),
];

// 内存缓存：配置文件在运行期间不会改变，避免每次请求都读磁盘 + YAML 解析
let _cachedConfig = null;

function loadConfig() {
  if (_cachedConfig) return _cachedConfig;
  let raw = null;
  for (const p of configPaths) {
    if (fs.existsSync(p)) {
      raw = fs.readFileSync(p, 'utf8');
      break;
    }
  }
  if (!raw) {
    throw new Error('Config file not found: configs/config.yaml');
  }
  const parsed = yaml.load(raw);
  if (!parsed?.app?.name) {
    throw new Error('Invalid config: missing app section');
  }
  _cachedConfig = parsed;
  return parsed;
}

/** 强制清除缓存（供测试或热重载用） */
function _clearConfigCache() {
  _cachedConfig = null;
}

module.exports = { loadConfig, _clearConfigCache };
