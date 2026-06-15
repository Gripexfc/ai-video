/**
 * videoProviders/shared.js
 * 共享工具函数：配置查找、URL 构建、视频地址解析、协议推断
 */
const aiConfigService = require('../aiConfigService');
const { inferVideoProtocol } = require('../../utils/protocolResolver');

/**
 * 显式 api_protocol 优先；未配置时推断。
 * Grok / xAI 官方为 prompt + aspect_ratio + GET /v1/videos/{request_id}，与中转站用的 ratio + content 不同。
 */
function resolveVideoProtocol(config, modelHint) {
  const provider = (config.provider || '').toLowerCase();
  const explicit = String(config.api_protocol || '').trim();
  let protocol = explicit.toLowerCase() || inferVideoProtocol(provider);
  const baseLower = String(config.base_url || '').toLowerCase();
  const modelLower = String(modelHint || '').toLowerCase();
  if (!explicit && protocol === 'openai') {
    if (/api\.x\.ai(\/|$)/.test(baseLower)) protocol = 'xai';
    else if (/grok-imagine|grok.*video/.test(modelLower)) protocol = 'xai';
  }
  return protocol;
}

// 按优先级选默认配置：is_default DESC, priority DESC
function getDefaultVideoConfig(db, preferredModel) {
  const configs = aiConfigService.listConfigs(db, 'video');
  const active = configs.filter((c) => c.is_active);
  if (active.length === 0) return null;
  if (preferredModel) {
    for (const c of active) {
      const models = Array.isArray(c.model) ? c.model : (c.model != null ? [c.model] : []);
      if (models.includes(preferredModel)) return c;
    }
  }
  const defaultOne = active.find((c) => c.is_default);
  return defaultOne != null ? defaultOne : active[0];
}

/** 火山引擎 /contents/generations/tasks?base 路径 */
const VOLC_VIDEO_CREATE_PATH = '/contents/generations/tasks';
const VOLC_VIDEO_QUERY_PATH = '/contents/generations/tasks';

function getVolcVideoBase(config) {
  let base = (config.base_url || '').replace(/\/$/, '');
  base = base.replace(/\/(contents|video)\/.*$/i, '');
  return base || 'https://ark.cn-beijing.volces.com/api/v3';
}

/**
 * 非官方火山厂商（中转、自托管等）走 OpenAI/即梦类路径；默认 /video/generations 为旧版中转。
 * volcengine_omni 传入 defaultEndpoint: '/v1/videos/generations' 以对齐方舟文档与 302.ai / jimeng-free-api。
 */
function buildVideoUrl(config, options = {}) {
  const p = (config.provider || '').toLowerCase();
  const isVolc = p === 'volces' || p === 'volcengine' || p === 'volc';
  if (isVolc) return getVolcVideoBase(config) + VOLC_VIDEO_CREATE_PATH;
  const base = (config.base_url || '').replace(/\/$/, '');
  const fallbackEp = options.defaultEndpoint != null ? options.defaultEndpoint : '/video/generations';
  let ep = config.endpoint || fallbackEp;
  if (!ep.startsWith('/')) ep = '/' + ep;
  return base + ep;
}

function buildQueryUrl(config, taskId) {
  const p = (config.provider || '').toLowerCase();
  const proto = resolveVideoProtocol(config);
  const isDashScope = proto === 'dashscope' || p === 'dashscope';
  const isVolc = p === 'volces' || p === 'volcengine' || p === 'volc';
  const isSora = proto === 'sora';
  if (isVolc) return getVolcVideoBase(config) + VOLC_VIDEO_QUERY_PATH + '/' + encodeURIComponent(taskId);
  const base = (config.base_url || '').replace(/\/$/, '');
  let defaultEp;
  if (isSora) defaultEp = '/v1/videos/{taskId}';
  else if (proto === 'xai') defaultEp = '/v1/videos/{taskId}';
  else if (proto === 'veo3') defaultEp = '/v1/video/query?id={taskId}';
  else if (isDashScope) defaultEp = '/api/v1/tasks/{taskId}';
  else if (proto === 'volcengine_omni') defaultEp = '/v1/videos/generations/async/{taskId}';
  else defaultEp = '/video/task/{taskId}';
  let ep = config.query_endpoint || defaultEp;
  ep = String(ep).replace(/\{taskId\}/gi, encodeURIComponent(taskId)).replace(/\{task_id\}/gi, encodeURIComponent(taskId)).replace(/\{id\}/gi, encodeURIComponent(taskId));
  if (!ep.startsWith('/')) ep = '/' + ep;
  return base + ep;
}

function getModelFromConfig(config, preferredModel) {
  const models = Array.isArray(config.model) ? config.model : (config.model != null ? [config.model] : []);
  if (preferredModel && models.includes(preferredModel)) return preferredModel;
  if (config.default_model && models.includes(config.default_model)) return config.default_model;
  return models[0] || '';
}

/** 仅把 http(s) 当作可下载直链，避免方舟/中转让 result_url 填入错误文案 */
function isPlausibleHttpVideoUrl(s) {
  if (typeof s !== 'string') return false;
  const t = s.trim();
  return /^https?:\/\//i.test(t);
}

/** 单层对象上的视频地址：兼容中转站使用 result_url 而非 video_url */
function videoUrlFromRecord(rec) {
  if (!rec || typeof rec !== 'object') return null;
  for (const k of ['video_url', 'result_url', 'url', 'output_url']) {
    const v = rec[k];
    if (typeof v !== 'string' || !v.trim()) continue;
    const t = v.trim();
    if (isPlausibleHttpVideoUrl(t)) return t;
  }
  return null;
}

/** 方舟 / 豆包 Seedance 等：video.transcoded_video.origin.video_url，或 play/download 直链 */
function videoUrlFromArkVideoNode(video) {
  if (!video || typeof video !== 'object') return null;
  const origin =
    video.transcoded_video && typeof video.transcoded_video === 'object' ? video.transcoded_video.origin : null;
  if (origin && typeof origin === 'object' && typeof origin.video_url === 'string' && origin.video_url.trim()) {
    return origin.video_url.trim();
  }
  for (const k of ['download_url', 'play_url', 'url', 'video_url']) {
    const v = video[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

/** 查询结果里 item_list[0] 形态（与中转站 videos 控制器一致） */
function pickVideoUrlFromItemList(list) {
  if (!Array.isArray(list) || !list.length) return null;
  const item = list[0];
  if (!item || typeof item !== 'object') return null;
  const ca = item.common_attr;
  const fromCommon =
    ca &&
    ca.transcoded_video &&
    typeof ca.transcoded_video === 'object' &&
    ca.transcoded_video.origin &&
    typeof ca.transcoded_video.origin.video_url === 'string' &&
    ca.transcoded_video.origin.video_url.trim()
      ? ca.transcoded_video.origin.video_url.trim()
      : null;
  const fromVideo = videoUrlFromArkVideoNode(item.video);
  const fromResult =
    typeof item.result_url === 'string' && item.result_url.trim() && isPlausibleHttpVideoUrl(item.result_url)
      ? item.result_url.trim()
      : null;
  const flat = videoUrlFromRecord(item);
  return fromCommon || fromVideo || fromResult || flat || null;
}

/**
 * 方舟类「任务查询」里常见：result 本体无 video_url，而在 result.content.video_url
 */
function pickVideoUrlFromResultShape(obj) {
  if (!obj || typeof obj !== 'object') return null;
  let x = videoUrlFromRecord(obj);
  if (x) return typeof x === 'string' ? x.trim() : x;
  const inner = obj.content;
  if (inner && typeof inner === 'object') {
    x = videoUrlFromRecord(inner);
    if (x) return typeof x === 'string' ? x.trim() : x;
    const il = pickVideoUrlFromItemList(inner.item_list);
    if (il) return il;
    if (inner.video && typeof inner.video === 'object') {
      const v = videoUrlFromArkVideoNode(inner.video) || inner.video.url || inner.video.video_url;
      if (v && typeof v === 'string') return v.trim();
    }
  }
  return null;
}

/**
 * OpenAI/Veo/Sora 类中转 JSON 中解析直链（含各层 result_url）
 */
function pickProxyVideoUrl(data) {
  if (!data || typeof data !== 'object') return null;
  const topList = pickVideoUrlFromItemList(data.item_list);
  if (topList) return topList;
  if (data.video && typeof data.video === 'object') {
    const vu = videoUrlFromArkVideoNode(data.video) || data.video.url || data.video.video_url;
    if (vu && typeof vu === 'string') return vu.trim();
  }
  let u = videoUrlFromRecord(data);
  if (u) return u;
  const d = data.data;
  if (d && typeof d === 'object' && !Array.isArray(d)) {
    const nestedList = pickVideoUrlFromItemList(d.item_list);
    if (nestedList) return nestedList;
    u = videoUrlFromRecord(d);
    if (u) return u;
    if (d.video && typeof d.video === 'object') {
      const dv = videoUrlFromArkVideoNode(d.video) || d.video.url || d.video.video_url;
      if (dv && typeof dv === 'string') return dv.trim();
    }
    if (d.result && typeof d.result === 'object') {
      const dr = pickVideoUrlFromResultShape(d.result);
      if (dr) return dr;
    }
  }
  const r = data.result;
  if (r && typeof r === 'object') {
    const pr = pickVideoUrlFromResultShape(r);
    if (pr) return pr;
  }
  const c = data.content;
  if (c && typeof c === 'object') {
    const cl = pickVideoUrlFromItemList(c.item_list);
    if (cl) return cl;
    u = videoUrlFromRecord(c);
    if (u) return u;
    if (c.video && typeof c.video === 'object') {
      const cv = videoUrlFromArkVideoNode(c.video) || c.video.url || c.video.video_url;
      if (cv && typeof cv === 'string') return cv.trim();
    }
  }
  for (const k of ['videos', 'generations', 'works']) {
    const arr = data[k];
    if (Array.isArray(arr) && arr[0]) {
      u = videoUrlFromRecord(arr[0]);
      if (u) return u;
      const res = arr[0].resource;
      if (res && res.resource) return res.resource;
    }
  }
  if (Array.isArray(d) && d[0]) {
    u = videoUrlFromRecord(d[0]);
    if (u) return u;
  }
  return null;
}

// Omni-Video 文档支持的 aspect_ratio；有参考图时也必须传，否则接口易默认 16:9
const KLING_OMNI_ASPECT_RATIOS = new Set(['9:16', '16:9', '1:1', '4:3', '3:4', '3:2', '2:3']);

/**
 * 归一化前端/元数据里的画幅字符串，便于命中可灵枚举（全角冒号、别名等）
 * @returns {string|null} 可灵支持的比值，无法识别时返回 null
 */
function normalizeAspectRatioForApi(raw) {
  if (raw == null) return null;
  let s = String(raw)
    .trim()
    .replace(/\uFF1A/g, ':')
    .replace(/[×xX＊*]/g, ':')
    .replace(/\s+/g, '');
  if (!s) return null;
  const lower = s.toLowerCase();
  const aliases = {
    portrait: '9:16',
    landscape: '16:9',
    square: '1:1',
    vertical: '9:16',
    horizontal: '16:9',
  };
  if (aliases[lower]) s = aliases[lower];
  return KLING_OMNI_ASPECT_RATIOS.has(s) ? s : null;
}

module.exports = {
  resolveVideoProtocol,
  getDefaultVideoConfig,
  VOLC_VIDEO_CREATE_PATH,
  VOLC_VIDEO_QUERY_PATH,
  getVolcVideoBase,
  buildVideoUrl,
  buildQueryUrl,
  getModelFromConfig,
  isPlausibleHttpVideoUrl,
  videoUrlFromRecord,
  videoUrlFromArkVideoNode,
  pickVideoUrlFromItemList,
  pickVideoUrlFromResultShape,
  pickProxyVideoUrl,
  normalizeAspectRatioForApi,
  KLING_OMNI_ASPECT_RATIOS,
};
