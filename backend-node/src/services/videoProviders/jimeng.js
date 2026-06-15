/**
 * videoProviders/jimeng.js
 * 即梦 Jimeng AI API（用户自托管 jimeng-free-api-all）
 */
const fs = require('fs');
const path = require('path');
const { uploadLocalImageToProxy } = require('../uploadService');
const { getModelFromConfig } = require('./shared');

function isJimengFreeApiSeedanceModel(model) {
  const m = String(model || '').toLowerCase();
  return m.includes('seedance');
}

/**
 * 参考图 URL → Buffer（multipart），供用户自托管的 Jimeng 免费 API 使用
 */
async function resolveJimengApiImageBuffer(rawUrl, files_base_url, storage_local_path, log, video_gen_id, index) {
  const raw = (rawUrl || '').trim();
  if (!raw) return null;
  if (raw.startsWith('data:')) {
    const m = /^data:([^;]+);base64,(.+)$/i.exec(raw.replace(/\s/g, ''));
    if (m) {
      const mime = (m[1] || '').toLowerCase();
      const buf = Buffer.from(m[2], 'base64');
      const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
      return { buffer: buf, filename: 'ref_' + index + '.' + ext };
    }
    return null;
  }
  if (/localhost|127\.0\.0\.1/i.test(raw) && storage_local_path) {
    const baseUrl = (files_base_url || '').replace(/\/$/, '');
    const afterStatic = raw.split('/static/')[1] || (baseUrl ? raw.replace(baseUrl + '/', '').replace(baseUrl, '') : null);
    const relPath = afterStatic ? afterStatic.replace(/^\//, '') : null;
    if (relPath) {
      const filePath = path.join(storage_local_path, relPath);
      try {
        if (fs.existsSync(filePath)) {
          const buf = fs.readFileSync(filePath);
          return { buffer: buf, filename: path.basename(filePath) || 'ref_' + index + '.jpg' };
        }
      } catch (e) {
        log.warn('[JimengAI] 读本地参考图失败', { error: e.message, video_gen_id, index });
      }
    }
  }
  if (raw.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(raw)) {
    try {
      if (fs.existsSync(raw)) {
        const buf = fs.readFileSync(raw);
        return { buffer: buf, filename: path.basename(raw) || 'ref_' + index + '.jpg' };
      }
    } catch (_) {}
  }
  const isPublicHttp = /^https?:\/\//i.test(raw) && !/localhost|127\.0\.0\.1/i.test(raw);
  if (isPublicHttp) {
    const res = await fetch(raw);
    if (!res.ok) throw new Error('拉取参考图失败 HTTP ' + res.status);
    const ab = await res.arrayBuffer();
    return { buffer: Buffer.from(ab), filename: 'ref_' + index + '.jpg' };
  }
  if (storage_local_path) {
    const proxyUrl = await uploadLocalImageToProxy(storage_local_path, raw, log, 'jimeng_ai_vg' + video_gen_id + '_' + index);
    if (proxyUrl) {
      const res = await fetch(proxyUrl);
      if (!res.ok) throw new Error('图床参考图拉取失败 HTTP ' + res.status);
      const ab = await res.arrayBuffer();
      return { buffer: Buffer.from(ab), filename: 'ref_' + index + '.jpg' };
    }
  }
  return null;
}

/**
 * 用户自托管 jimeng-free-api-all：POST /v1/videos/generations（multipart 或 JSON）
 * @returns {Promise<{ video_url?: string, error?: string }>}
 */
async function callJimengAiApiVideo(config, log, opts) {
  const base = (config.base_url || '').toString().replace(/\/$/, '').trim();
  if (!base) {
    return { error: 'Jimeng AI API 未配置 Base URL（请填写自建服务地址，如 http://127.0.0.1:8000）' };
  }
  let apiKey = (config.api_key || '').trim();
  if (/^bearer\s+/i.test(apiKey)) apiKey = apiKey.replace(/^bearer\s+/i, '').trim();
  if (!apiKey) {
    return { error: 'Jimeng AI API 未配置 Session（填入 API Key 字段，多个用英文逗号分隔）' };
  }

  const model = getModelFromConfig(config, opts.model);
  const seedance = isJimengFreeApiSeedanceModel(model);
  let ratio = (opts.aspect_ratio || '16:9').toString().trim().replace(/\uFF1A/g, ':');
  let dur = opts.duration != null ? Number(opts.duration) : seedance ? 4 : 5;
  if (!Number.isFinite(dur) || dur < 1) dur = seedance ? 4 : 5;
  if (seedance) {
    if (dur === 5) dur = 4;
    dur = Math.min(15, Math.max(4, Math.round(dur)));
    if (ratio === '1:1') ratio = '4:3';
  } else {
    dur = dur <= 7 ? 5 : 10;
  }

  const resolution = (opts.resolution || '720p').toString().trim() || '720p';
  const pathSuffix = (config.endpoint || '/v1/videos/generations').toString().trim();
  const apiPath = pathSuffix.startsWith('/') ? pathSuffix : '/' + pathSuffix;
  const url = base + apiPath;
  const video_gen_id = opts.video_gen_id;

  const urlList = [];
  const refs = Array.isArray(opts.reference_urls) ? opts.reference_urls.filter(Boolean) : [];
  for (const u of refs) urlList.push(String(u).trim());
  if (opts.image_url && String(opts.image_url).trim()) urlList.push(String(opts.image_url).trim());
  if (opts.first_frame_url && String(opts.first_frame_url).trim()) urlList.push(String(opts.first_frame_url).trim());
  if (opts.last_frame_url && String(opts.last_frame_url).trim()) urlList.push(String(opts.last_frame_url).trim());
  const seen = new Set();
  const orderedUrls = [];
  for (const u of urlList) {
    if (!u || seen.has(u)) continue;
    seen.add(u);
    orderedUrls.push(u);
  }

  const fileParts = [];
  for (let i = 0; i < orderedUrls.length; i++) {
    try {
      const part = await resolveJimengApiImageBuffer(
        orderedUrls[i],
        opts.files_base_url,
        opts.storage_local_path,
        log,
        video_gen_id,
        i
      );
      if (part && part.buffer && part.buffer.length) fileParts.push(part);
    } catch (e) {
      log.warn('[JimengAI] 解析参考图失败', { video_gen_id, index: i, message: e.message });
    }
  }

  if (seedance && fileParts.length === 0) {
    return { error: 'Jimeng Seedance 需要至少一张参考图（请设置分镜参考图或 image_url）' };
  }

  const prompt = (opts.prompt || '').toString();
  const headers = { Authorization: 'Bearer ' + apiKey };
  let fetchOpts = { method: 'POST', headers };

  const longWaitMs = 10 * 60 * 1000;
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    fetchOpts.signal = AbortSignal.timeout(longWaitMs);
  }

  if (fileParts.length > 0) {
    const form = new FormData();
    form.append('model', model);
    form.append('prompt', prompt);
    form.append('ratio', ratio);
    form.append('duration', String(dur));
    form.append('resolution', resolution);
    for (const { buffer, filename } of fileParts) {
      const blob = new Blob([buffer]);
      form.append('files', blob, filename || 'image.jpg');
    }
    fetchOpts.body = form;
    log.info('[JimengAI] multipart 提交', {
      video_gen_id,
      url,
      model,
      ratio,
      duration: dur,
      resolution,
      file_count: fileParts.length,
    });
  } else {
    fetchOpts.headers = { ...headers, 'Content-Type': 'application/json' };
    fetchOpts.body = JSON.stringify({
      model,
      prompt,
      ratio,
      duration: dur,
      resolution,
    });
    log.info('[JimengAI] JSON 提交（无参考图）', { video_gen_id, url, model, ratio, duration: dur, resolution });
  }

  let res;
  try {
    res = await fetch(url, fetchOpts);
  } catch (e) {
    const msg = e.name === 'AbortError' || e.name === 'TimeoutError' ? '请求超时（视频生成较慢，可稍后重试）' : e.message;
    log.error('[JimengAI] 请求失败', { video_gen_id, message: e.message });
    return { error: 'Jimeng AI API 请求失败: ' + msg };
  }

  const raw = await res.text();
  log.info('[JimengAI] 响应', { video_gen_id, status: res.status, raw_head: raw.slice(0, 800) });
  let data;
  try {
    data = JSON.parse(raw);
  } catch (_) {
    return { error: 'Jimeng AI API 非 JSON 响应 (' + res.status + '): ' + raw.slice(0, 300) };
  }

  if (!res.ok) {
    const errMsg =
      data?.error?.message ||
      data?.error ||
      data?.errmsg ||
      data?.message ||
      raw.slice(0, 400);
    return { error: 'Jimeng AI API ' + res.status + ': ' + (typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg)) };
  }

  const videoUrl = data?.data?.[0]?.url || data?.data?.[0]?.video_url;
  if (videoUrl) {
    log.info('[JimengAI] 得到视频地址', { video_gen_id, video_url_head: String(videoUrl).slice(0, 96) });
    return { video_url: String(videoUrl) };
  }

  return { error: 'Jimeng AI API 未返回 data[0].url: ' + JSON.stringify(data).slice(0, 400) };
}

module.exports = {
  callJimengAiApiVideo,
};
