/**
 * videoProviders/dashscope.js
 * DashScope 视频生成 API（阿里通义万相）
 */
const fs = require('fs');
const path = require('path');
const { videoUrlFromRecord, pickProxyVideoUrl } = require('./shared');

const DASHSCOPE_VIDEO_GENERATION = '/api/v1/services/aigc/video-generation/video-synthesis';
const DASHSCOPE_IMAGE2VIDEO = '/api/v1/services/aigc/image2video/video-synthesis';

// DashScope 轮询解析视频 URL
function parseDashScopeVideoUrl(data) {
  const out = data?.output;
  if (!out) return null;
  let u = videoUrlFromRecord(out);
  if (u) return u;
  if (out.output && typeof out.output === 'object') {
    u = videoUrlFromRecord(out.output);
    if (u) return u;
  }
  const results = out.results || out.result;
  if (Array.isArray(results) && results[0]) {
    const rec = results[0];
    u = videoUrlFromRecord(rec);
    if (u) return u;
    if (rec.output && typeof rec.output === 'object') {
      u = videoUrlFromRecord(rec.output);
      if (u) return u;
    }
  }
  const choices = out.choices;
  if (Array.isArray(choices) && choices[0]) {
    const c = choices[0];
    const msg = c?.message?.content || c?.content;
    if (Array.isArray(msg)) {
      for (const m of msg) {
        if (m) {
          u = videoUrlFromRecord(m);
          if (u) return u;
        }
      }
    }
  }
  return null;
}

/**
 * DashScope 视频生成（异步任务，轮询 endpoint 默认 /api/v1/tasks/{taskId}）
 * - wan2.2-kf2v-flash: image2video, first_frame_url + last_frame_url
 * - wan2.6-t2v: video-generation, 仅 prompt（纯文生视频）
 * - wan2.6-i2v-flash: video-generation, prompt + img_url（参考图视频）
 * - wanx2.1-vace-plus: video-generation, function image_reference + ref_images_url（最多 3 张）
 * - wan2.6-r2v-flash: video-generation, reference_urls（最多 5 张）
 */
async function callDashScopeVideoApi(config, log, opts) {
  const {
    prompt,
    model: modelName,
    image_url,
    first_frame_url,
    last_frame_url,
    reference_urls,
    duration,
    files_base_url,
    storage_local_path,
    video_gen_id,
  } = opts;
  const base = (config.base_url || '').replace(/\/$/, '');
  const model = modelName || 'wan2.2-kf2v-flash';
  const dur = duration ? Number(duration) : 10;
  const baseUrl = (files_base_url || '').replace(/\/$/, '');
  const isLocalhost = baseUrl && /localhost|127\.0\.0\.1/i.test(baseUrl);

  function toPublicUrl(value) {
    if (!value || !String(value).trim()) return null;
    const s = String(value).trim();
    if (s.startsWith('http://') || s.startsWith('https://')) return s;
    if (baseUrl) return baseUrl + '/' + s.replace(/^\//, '');
    return s;
  }

  /** 将本地或 localhost 的图转为 base64（DashScope 不能 download image failed） */
  function toImageInput(value) {
    if (!value || !String(value).trim()) return null;
    const s = String(value).trim();
    if (s.startsWith('asset://')) return s;
    let relPath = null;
    if (s.startsWith('http://') || s.startsWith('https://')) {
      if (!isLocalhost || !storage_local_path) return s;
      const afterStatic = s.split('/static/')[1] || (baseUrl ? s.replace(baseUrl + '/', '').replace(baseUrl, '') : null);
      if (afterStatic) relPath = afterStatic.replace(/^\//, '');
      else return s;
    } else if (storage_local_path) {
      relPath = s.replace(/^\//, '');
    }
    if (!relPath) return toPublicUrl(s);
    const filePath = path.join(storage_local_path, relPath);
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

  let url;
  let body;

  if (model === 'wan2.2-kf2v-flash') {
    url = base + DASHSCOPE_IMAGE2VIDEO;
    const firstRaw = (first_frame_url && first_frame_url.trim()) || (image_url && image_url.trim());
    const lastRaw = (last_frame_url && last_frame_url.trim()) || firstRaw;
    const firstUrl = toImageInput(firstRaw);
    const lastUrl = toImageInput(lastRaw);
    if (!firstUrl || !lastUrl) {
      return { error: 'wan2.2-kf2v-flash 需要首尾帧图片' };
    }
    body = {
      model,
      input: { prompt: prompt || '', first_frame_url: firstUrl, last_frame_url: lastUrl },
      parameters: { resolution: '480P', prompt_extend: true },
    };
  } else if (model === 'wan2.6-t2v') {
    url = base + DASHSCOPE_VIDEO_GENERATION;
    body = {
      model,
      input: { prompt: prompt || '' },
      parameters: { size: '1280*720', prompt_extend: true, duration: dur, shot_type: 'multi' },
    };
  } else if (model === 'wan2.6-i2v-flash') {
    url = base + DASHSCOPE_VIDEO_GENERATION;
    const imgRaw = (image_url && image_url.trim()) || (first_frame_url && first_frame_url.trim());
    const imgUrl = toImageInput(imgRaw);
    if (!imgUrl) return { error: 'wan2.6-i2v-flash 需要参考图' };
    body = {
      model,
      input: { prompt: prompt || '', img_url: imgUrl },
      parameters: { resolution: '720P', prompt_extend: true, duration: dur, shot_type: 'multi' },
    };
  } else if (model === 'wanx2.1-vace-plus') {
    url = base + DASHSCOPE_VIDEO_GENERATION;
    const rawRefs = Array.isArray(reference_urls) ? reference_urls.filter(Boolean).slice(0, 3) : [];
    const refs = rawRefs.map(toImageInput).filter(Boolean);
    if (refs.length === 0) return { error: 'wanx2.1-vace-plus 需要至少 3 张参考图' };
    body = {
      model,
      input: { function: 'image_reference', prompt: prompt || '', ref_images_url: refs },
      parameters: { prompt_extend: true, obj_or_bg: ['obj', 'bg'], size: '1280*720' },
    };
  } else if (model === 'wan2.6-r2v-flash') {
    url = base + DASHSCOPE_VIDEO_GENERATION;
    const rawRefs = Array.isArray(reference_urls) ? reference_urls.filter(Boolean).slice(0, 5) : [];
    const refs = rawRefs.map(toImageInput).filter(Boolean);
    if (refs.length === 0) return { error: 'wan2.6-r2v-flash 需要至少 1 张参考图（最多 5 张）' };
    body = {
      model,
      input: { prompt: prompt || '', reference_urls: refs },
      parameters: { prompt_extend: true },
    };
  } else {
    return { error: '不支持的 DashScope 模型: ' + model };
  }

  const shorten = (v) => (v && v.startsWith('data:') ? '(base64 已省)' : v);
  const imageUrlsInBody = body.input
    ? {
        first_frame_url: shorten(body.input.first_frame_url),
        last_frame_url: shorten(body.input.last_frame_url),
        img_url: shorten(body.input.img_url),
        ref_images_url: Array.isArray(body.input.ref_images_url) ? body.input.ref_images_url.map(shorten) : body.input.ref_images_url,
        reference_urls: Array.isArray(body.input.reference_urls) ? body.input.reference_urls.map(shorten) : body.input.reference_urls,
      }
    : {};
  log.info('DashScope 图片字段摘要（base64 已省 = 实际是 base64，download image failed 则说明 URL 可能指向 localhost）', {
    model,
    video_gen_id,
    files_base_url: baseUrl || '(空)',
    image_urls: imageUrlsInBody,
  });
  log.info('Video API request (DashScope)', { url: url.slice(0, 70), model, video_gen_id });
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + (config.api_key || ''),
      'X-DashScope-Async': 'enable',
    },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  if (!res.ok) {
    let errMsg = '视频生成失败: ' + res.status;
    try {
      const errJson = JSON.parse(raw);
      if (errJson.message) errMsg += ' - ' + errJson.message;
      else if (errJson.code) errMsg += ' - ' + errJson.code;
    } catch (_) {
      if (raw && raw.length) errMsg += ' - ' + raw.slice(0, 200);
    }
    log.error('DashScope video create failed', { status: res.status, body: raw.slice(0, 300), video_gen_id });
    return { error: errMsg };
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    return { error: '视频响应格式错误' };
  }
  if (data.code) {
    return { error: data.message || data.code || '视频创建失败' };
  }
  const taskId = data?.output?.task_id;
  if (taskId) return { task_id: taskId, status: 'PENDING' };
  const videoUrl = parseDashScopeVideoUrl(data);
  if (videoUrl) return { video_url: videoUrl };
  return { error: '无 task_id 或 video_url' };
}

module.exports = {
  callDashScopeVideoApi,
  parseDashScopeVideoUrl,
};
