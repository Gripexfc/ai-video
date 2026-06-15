/**
 * videoProviders/volcengineOmni.js
 * 火山引擎方舟 — Seedance 2.0 等「全能/多参考图」视频
 */
const fs = require('fs');
const path = require('path');
const { uploadLocalImageToProxy } = require('../uploadService');
const {
  buildVideoUrl,
  getModelFromConfig,
  pickProxyVideoUrl,
} = require('./shared');
const { resolveImageInputForOmniLocalBase64 } = require('./klingOmni');

/** 火山引擎 /contents/generations/tasks 路径 */
const VOLC_VIDEO_CREATE_PATH = '/contents/generations/tasks';
const VOLC_VIDEO_QUERY_PATH = '/contents/generations/tasks';

function getVolcVideoBase(config) {
  let base = (config.base_url || '').replace(/\/$/, '');
  base = base.replace(/\/(contents|video)\/.*$/i, '');
  return base || 'https://ark.cn-beijing.volces.com/api/v3';
}

const VOLC_MODEL_ALIASES = {
  'doubao-seedance-1.0-pro-fast':  'doubao-seedance-1-0-pro-250528',
  'doubao-seedance-1.0-pro':       'doubao-seedance-1-0-pro-250528',
  'doubao-seedance-1-0-pro':       'doubao-seedance-1-0-pro-250528',
  'doubao-seedance-1.0-lite':      'doubao-seedance-1-0-lite-250428',
  'doubao-seedance-1-0-lite':      'doubao-seedance-1-0-lite-250428',
  'doubao-seedance-1.5-pro':       'doubao-seedance-1-5-pro-251215',
  'doubao-seedance-1-5-pro':       'doubao-seedance-1-5-pro-251215',
  'doubao-seedance-2.0-pro':       'doubao-seedance-2-0-260128',
  'doubao-seedance-2-0-pro':       'doubao-seedance-2-0-260128',
  'doubao-seedance-2.0-fast':      'doubao-seedance-2-0-fast-260128',
  'doubao-seedance-2-0-fast':      'doubao-seedance-2-0-fast-260128',
};

function normalizeVolcModel(name) {
  if (!name) return name;
  return VOLC_MODEL_ALIASES[name.toLowerCase()] || name;
}

/**
 * 火山方舟 Seedance 全能/多图参考：参考图解析（公网 URL / 图床 / 本地 base64），与可灵 Omni 逻辑一致
 */
async function resolveVolcOmniImageAsync(rawUrl, files_base_url, storage_local_path, log, video_gen_id, index) {
  const raw = (rawUrl || '').trim();
  if (!raw) return null;
  if (raw.startsWith('data:')) return raw;
  if (raw.startsWith('asset://')) return raw;

  const isPublicHttp = /^https?:\/\//i.test(raw) && !/localhost|127\.0\.0\.1/i.test(raw);
  if (isPublicHttp) return raw;

  if (storage_local_path) {
    const tag = `volc_omni_vg${video_gen_id}_${index}`;
    const proxyUrl = await uploadLocalImageToProxy(storage_local_path, raw, log, tag);
    if (proxyUrl) {
      log.info('[VolcOmni] 已上传图床', { video_gen_id, index, url_head: proxyUrl.slice(0, 64) });
      return proxyUrl;
    }
    log.warn('[VolcOmni] 图床上传未返回 URL，尝试 base64', { video_gen_id, index });
  }

  return resolveImageInputForOmniLocalBase64(raw, files_base_url, storage_local_path, log, video_gen_id);
}

/** Seedance 2.x：时长吸附到 4–15 秒；旧版 Seedance 仍用 5/10 */
function normalizeVolcOmniDuration(modelName, durationNum) {
  const m = String(modelName || '').trim().toLowerCase();
  // 方舟控制台常用推理接入点为 ep-xxxx，名称里不含 seedance-2，但仍多为 Seedance 2.x，需走 4–15 秒档位
  const isV2 = /seedance[-_]?2|seedance2|2[-_]0[-_]/.test(m) || /^ep-/.test(m);
  const d = Number(durationNum);
  const safe = Number.isFinite(d) && d > 0 ? d : 5;
  if (isV2) {
    const allowed = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
    let best = 5;
    let bestDiff = 999;
    for (const a of allowed) {
      const diff = Math.abs(a - safe);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = a;
      }
    }
    return best;
  }
  return safe <= 7 ? 5 : 10;
}

/** Seedance 2.x 且名称含 fast（如 doubao-seedance-2-0-fast）：方舟侧不支持 1080p（含 r2v）。不含 fast 的 2.0 等保持 1080p。 */
function isVolcOmniSeedance2FastModel(modelName) {
  const m = String(modelName || '').trim().toLowerCase();
  if (!m.includes('seedance') || !m.includes('fast')) return false;
  const is2x =
    /(?:seedance[-_])?2\b|seedance2\b|[-_]2[-_]0[-_]|2\.0/.test(m);
  return is2x;
}

/**
 * 仅对 Seedance 2.x **fast** 将 1080p 降为 720p，避免 r2v 400；其余模型原样提交。
 * 未知 resolution 枚举则省略，由接口默认。
 */
function normalizeVolcOmniResolution(modelName, resolution, log, video_gen_id) {
  let r = (resolution != null ? String(resolution) : '').trim().toLowerCase();
  if (!r) return { value: null };
  if (r === '1080') r = '1080p';
  if (r === '720') r = '720p';
  if (r === '480') r = '480p';

  if (isVolcOmniSeedance2FastModel(modelName) && r === '1080p') {
    if (log?.info) {
      log.info('[VolcOmni] resolution 1080p 对 Seedance 2.x fast 不可用，已改为 720p', {
        video_gen_id,
        model: modelName,
      });
    }
    return { value: '720p' };
  }
  const allowed = ['480p', '720p', '1080p'];
  if (!allowed.includes(r)) {
    if (log?.warn) {
      log.warn('[VolcOmni] resolution 非标准枚举，已省略', { video_gen_id, resolution });
    }
    return { value: null };
  }
  return { value: r };
}

/**
 * 火山引擎方舟 — Seedance 2.0 等「全能/多参考图」视频
 * 与标准 volcengine 共用：POST {base}/contents/generations/tasks，GET {base}/contents/generations/tasks/{id}
 * content：首条 text；全能模式每张均为参考图（场景/角色/道具…），每张必须带 role：一律 reference_image
 */
async function callVolcengineOmniVideoApi(config, log, opts) {
  const {
    prompt,
    model: preferredModel,
    duration,
    aspect_ratio,
    resolution,
    seed,
    camera_fixed,
    watermark,
    image_url,
    reference_urls,
    files_base_url,
    storage_local_path,
    video_gen_id,
  } = opts;

  const url = buildVideoUrl(config, { defaultEndpoint: '/v1/videos/generations' });
  const model = getModelFromConfig(config, preferredModel);
  const finalModel = normalizeVolcModel(model);
  const ratio = aspect_ratio || '16:9';
  const effectiveDuration = normalizeVolcOmniDuration(finalModel, duration);
  const { value: effectiveResolution } = normalizeVolcOmniResolution(finalModel, resolution, log, video_gen_id);

  const refList = Array.isArray(reference_urls) ? reference_urls.filter(Boolean) : [];
  const primary = (image_url || '').trim();
  const orderedUrls = [...(primary ? [primary] : []), ...refList.filter((u) => u !== primary)];
  const maxRef = 9;
  const urls = orderedUrls.slice(0, maxRef);

  const body = {
    model: finalModel,
    content: [{ type: 'text', text: (prompt || '').trim() }],
    ratio,
    duration: effectiveDuration,
    watermark: watermark != null ? Boolean(watermark) : false,
  };
  if (effectiveResolution) body.resolution = effectiveResolution;
  if (seed != null) body.seed = Number(seed);
  if (camera_fixed != null) body.camera_fixed = Boolean(camera_fixed);

  let volcOmniAssetRefCount = 0;
  if (urls.length) {
    for (let i = 0; i < urls.length; i++) {
      let u = await resolveVolcOmniImageAsync(
        urls[i],
        files_base_url,
        storage_local_path,
        log,
        video_gen_id,
        i
      );
      if (!u) continue;
      if (String(u).startsWith('asset://')) volcOmniAssetRefCount += 1;
      if (/localhost|127\.0\.0\.1/i.test(u) && storage_local_path && (files_base_url || '').match(/localhost|127\.0\.0\.1/i)) {
        const baseUrl = (files_base_url || '').replace(/\/$/, '');
        const afterStatic = u.split('/static/')[1] || (baseUrl ? u.replace(baseUrl + '/', '').replace(baseUrl, '') : null);
        const relPath = afterStatic ? afterStatic.replace(/^\//, '') : null;
        if (relPath) {
          const filePath = path.join(storage_local_path, relPath);
          try {
            if (fs.existsSync(filePath)) {
              const buf = fs.readFileSync(filePath);
              const ext = path.extname(filePath).toLowerCase();
              const mime =
                { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.bmp': 'image/bmp' }[
                  ext
                ] || 'image/png';
              u = 'data:' + mime + ';base64,' + buf.toString('base64');
            }
          } catch (_) {}
        }
      }
      const part = {
        type: 'image_url',
        image_url: { url: u },
        role: 'reference_image',
      };
      body.content.push(part);
      if (String(u).startsWith('asset://') && log?.info) {
        log.info('[VolcOmni][SD2] content 使用素材库 asset 引用', { video_gen_id, index: i, asset_head: String(u).slice(0, 80) });
      }
    }
  }

  log.info('[VolcOmni] 创建任务', { url, body });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + (config.api_key || ''),
    },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  log.info('[VolcOmni] 创建响应', { video_gen_id, status: res.status, raw: raw.slice(0, 1000) });

  if (!res.ok) {
    let errMsg = '火山 Seedance 全能创建失败: ' + res.status;
    try {
      const errJson = JSON.parse(raw);
      const msg = errJson.error?.message || errJson.message || errJson.error;
      if (msg) errMsg += ' - ' + String(msg).slice(0, 300);
    } catch (_) {
      if (raw) errMsg += ' - ' + raw.slice(0, 200);
    }
    return { error: errMsg };
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    return { error: '火山 Seedance 全能响应非 JSON: ' + raw.slice(0, 200) };
  }

  const taskId = data.id || data.task_id || (data.data && data.data.id);
  const status = data.status || (data.data && data.data.status);
  const videoUrl = pickProxyVideoUrl(data);
  if (videoUrl) {
    log.info('[VolcOmni] 直接返回 video_url', { video_gen_id });
    return { video_url: videoUrl };
  }
  if (taskId) {
    log.info('[VolcOmni] 返回 task_id', { video_gen_id, task_id: taskId, status });
    return { task_id: taskId, status: status || 'processing' };
  }
  return { error: '火山 Seedance 全能未返回 task_id 或 video_url: ' + JSON.stringify(data).slice(0, 300) };
}

module.exports = {
  callVolcengineOmniVideoApi,
  normalizeVolcModel,
  getVolcVideoBase,
  VOLC_VIDEO_CREATE_PATH,
  VOLC_VIDEO_QUERY_PATH,
};
