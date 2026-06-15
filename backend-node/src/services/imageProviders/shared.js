/**
 * imageProviders/shared.js
 * 共享工具函数：配置查找、URL 构建、图片地址解析、协议推断、参考图解析、图床缓存
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const aiConfigService = require('../aiConfigService');
const { getSharp } = require('../../utils/sharpLoader');
const { inferImageProtocol: inferProtocol } = require('../../utils/protocolResolver');
const { loadConfig } = require('../../config');

/** 图生 POST 使用 Node http(s)，默认 10 分钟，避免 undici fetch 大包体/慢链路下模糊失败 */
const IMAGE_HTTP_TIMEOUT_MS = 600000;

// 多参考图时注入到所有支持 negative_prompt 的模型，防止生成分割/拼贴布局；同时加入安全词以减少敏感拦截
const ANTI_SPLIT_NEGATIVE_PROMPT = 'nsfw, nudity, naked, violence, blood, gore, sensitive content, split panels, side-by-side layout, collage, diptych, triptych, grid layout, multiple panels, comparison view, composite image, two images in one frame';

function mergeNegativePromptFragments(auto, user) {
  const a = (auto || '').trim();
  const u = (user || '').trim();
  if (a && u) return `${a}, ${u}`;
  return a || u || '';
}

/** 角色/场景/道具资产生图：请求里显式传入 model 且资产上存有负面词时，与自动负面片段合并后传给图生 API */
function resolveAssetUserNegativeForApi(explicitModelName, storedNegative) {
  const hasModel = explicitModelName != null && String(explicitModelName).trim().length > 0;
  const neg = storedNegative != null ? String(storedNegative).trim() : '';
  return hasModel && neg ? neg : '';
}

/**
 * 压缩单张参考图 buffer，目标 ≤ targetKB（默认 2048KB=2MB）
 * 用 JPEG 递减质量压缩直到达标或质量降到最低阈值。
 * 若 sharp 不可用或压缩后更大，返回原始 buffer。
 */
async function compressImageBuffer(buffer, mimeType, targetKB = 2048, log = null) {
  const sharp = getSharp();
  if (!sharp) return { buffer, mimeType };
  const targetBytes = targetKB * 1024;
  if (buffer.length <= targetBytes) return { buffer, mimeType };
  try {
    let quality = 80;
    let compressed = await sharp(buffer).jpeg({ quality }).toBuffer();
    while (compressed.length > targetBytes && quality > 30) {
      quality -= 15;
      compressed = await sharp(buffer).jpeg({ quality }).toBuffer();
    }
    if (compressed.length < buffer.length) {
      if (log) log.info('[参考图压缩] 压缩完成', {
        original_kb: Math.round(buffer.length / 1024),
        compressed_kb: Math.round(compressed.length / 1024),
        quality,
      });
      return { buffer: compressed, mimeType: 'image/jpeg' };
    }
  } catch (e) {
    if (log) log.warn('[参考图压缩] sharp 压缩失败，使用原图', { error: e.message });
  }
  return { buffer, mimeType };
}

// 惰性加载配置，避免循环依赖与启动顺序问题
let _appConfig = null;
function getAppConfig() {
  if (!_appConfig) {
    try { _appConfig = loadConfig(); } catch (_) { _appConfig = {}; }
  }
  return _appConfig;
}

/** 从配置读取图床 URL 有效期（小时），默认 23h 留出余量 */
function getProxyExpireHours() {
  return Number(getAppConfig()?.image_proxy?.expire_hours ?? 23);
}

/**
 * 获取默认图片配置：优先使用前端勾选的「默认」配置（is_default），同类型内按优先级（priority）排序；
 * 可选按 preferredProvider / preferredModel 进一步筛选。
 * @param {object} db
 * @param {string} [preferredModel] - 指定模型名时，在匹配到的配置中选含该模型的
 * @param {string} [preferredProvider] - 指定供应商（如 openai / dashscope），只在该 provider 的配置中选
 * @param {string} [imageServiceType] - 'image' 文本生成图片（角色/场景/道具），'storyboard_image' 分镜图片生成（支持参考图）；缺省为 'image'
 */
function getDefaultImageConfig(db, preferredModel, preferredProvider, imageServiceType) {
  const serviceType = imageServiceType || 'image';
  let configs = aiConfigService.listConfigs(db, serviceType);
  if (configs.length === 0 && serviceType === 'storyboard_image') {
    configs = aiConfigService.listConfigs(db, 'image');
  }
  let active = configs.filter((c) => c.is_active);
  if (active.length === 0) return null;
  if (preferredProvider && String(preferredProvider).trim()) {
    const want = String(preferredProvider).trim().toLowerCase();
    const byProvider = active.filter((c) => (c.provider || '').toLowerCase() === want);
    if (byProvider.length > 0) active = byProvider;
  }
  if (preferredModel) {
    for (const c of active) {
      const models = Array.isArray(c.model) ? c.model : (c.model != null ? [c.model] : []);
      if (models.includes(preferredModel)) return c;
    }
  }
  // 显式使用前端设置的「默认」：优先 is_default，再按 priority 降序（listConfigs 已按 is_default DESC, priority DESC 排序，取第一个即可）
  const defaultOne = active.find((c) => c.is_default);
  if (defaultOne) return defaultOne;
  return active[0];
}

// 与 Go image_generation_service 一致：openai/chatfire 使用 "/images/generations"，base_url 通常已含 /v1
function buildImageUrl(config) {
  const base = (config.base_url || '').replace(/\/$/, '');
  let ep = config.endpoint || '/images/generations';
  if (!ep.startsWith('/')) ep = '/' + ep;
  return base + ep;
}

function getModelFromConfig(config, preferredModel) {
  const models = Array.isArray(config.model) ? config.model : (config.model != null ? [config.model] : []);
  if (preferredModel && models.includes(preferredModel)) return preferredModel;
  if (config.default_model && models.includes(config.default_model)) return config.default_model;
  return models[0] || 'dall-e-3';
}

/**
 * 将参考图值解析为适合传给外部 API 的形式：
 * - 本地相对路径（如 "characters/ig_xxx.jpg"）→ 读文件转 base64 data URL
 * - localhost URL → 从 storageLocalPath 读文件转 base64 data URL
 * - 公网 URL（非 localhost）→ 直接原样返回
 */
function resolveImageRef(value, filesBaseUrl, storageLocalPath) {
  if (!value || !String(value).trim()) return null;
  const s = String(value).trim();
  const baseUrl = (filesBaseUrl || '').replace(/\/$/, '');
  const isLocalhostUrl = /localhost|127\.0\.0\.1/i.test(s);
  const isLocalhostBase = baseUrl && /localhost|127\.0\.0\.1/i.test(baseUrl);
  const isLocalhost = isLocalhostUrl || isLocalhostBase;

  function toPublicUrl(v) {
    if (!v || !String(v).trim()) return null;
    const sv = String(v).trim();
    if (sv.startsWith('http://') || sv.startsWith('https://')) return sv;
    if (baseUrl) return baseUrl + '/' + sv.replace(/^\//, '');
    return sv;
  }

  let relPath = null;
  if (s.startsWith('http://') || s.startsWith('https://')) {
    if (!isLocalhost || !storageLocalPath) return s;
    const afterStatic = s.split('/static/')[1]
      || (baseUrl ? s.replace(baseUrl + '/', '').replace(baseUrl, '') : null)
      || s.replace(/^https?:\/\/[^/]+\//, '');
    if (afterStatic) relPath = afterStatic.replace(/^\//, '');
    else return s;
  } else if (storageLocalPath) {
    relPath = s.replace(/^\//, '');
  }
  if (!relPath) return toPublicUrl(s);
  const filePath = path.join(storageLocalPath, relPath);
  try {
    if (!fs.existsSync(filePath)) return toPublicUrl(s);
    const buf = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.bmp': 'image/bmp' }[ext] || 'image/png';
    return 'data:' + mime + ';base64,' + buf.toString('base64');
  } catch (e) {
    return toPublicUrl(s);
  }
}

// ── 图床缓存 ──

/**
 * 从 image_proxy_cache 表查询已缓存的图床 URL。
 * cache_key 规则：本地相对路径 或 data URL 的 sha256 前 16 字符。
 * 若缓存已过期（超过 config.image_proxy.expire_hours），自动删除并返回 null，触发重新上传。
 */
function getProxyCache(db, cacheKey) {
  try {
    const row = db.prepare('SELECT proxy_url, created_at FROM image_proxy_cache WHERE cache_key = ?').get(cacheKey);
    if (!row?.proxy_url) return null;

    const expireMs = getProxyExpireHours() * 3600 * 1000;
    const createdAt = new Date(row.created_at).getTime();
    if (isNaN(createdAt) || Date.now() - createdAt > expireMs) {
      try { db.prepare('DELETE FROM image_proxy_cache WHERE cache_key = ?').run(cacheKey); } catch (_) {}
      return null;
    }

    return row.proxy_url;
  } catch (_) { return null; }
}

/** 写入 image_proxy_cache 缓存记录 */
function setProxyCache(db, cacheKey, proxyUrl) {
  try {
    db.prepare(
      'INSERT OR REPLACE INTO image_proxy_cache (cache_key, proxy_url, created_at) VALUES (?, ?, ?)'
    ).run(cacheKey, proxyUrl, new Date().toISOString());
  } catch (_) {}
}

/** 根据 ref 字符串计算缓存 key：本地路径直接使用；data URL 取 buffer sha256 前 16 字节的 hex */
function buildCacheKey(ref, imageBuffer) {
  if (!ref.startsWith('data:')) return ref;
  return 'sha256:' + crypto.createHash('sha256').update(imageBuffer).digest('hex').slice(0, 32);
}

module.exports = {
  IMAGE_HTTP_TIMEOUT_MS,
  ANTI_SPLIT_NEGATIVE_PROMPT,
  mergeNegativePromptFragments,
  resolveAssetUserNegativeForApi,
  compressImageBuffer,
  getAppConfig,
  getProxyExpireHours,
  getDefaultImageConfig,
  buildImageUrl,
  getModelFromConfig,
  resolveImageRef,
  getProxyCache,
  setProxyCache,
  buildCacheKey,
  inferProtocol,
};
