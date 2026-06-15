/**
 * videoProviders/veo3.js
 * Veo3 视频生成 API + resolveVeo3ImageForApi（共享图片解析，xAI 也使用）
 */
const fs = require('fs');
const path = require('path');
const { uploadLocalImageToProxy, uploadToImageProxy } = require('../uploadService');
const { pickProxyVideoUrl } = require('./shared');

/**
 * 单张参考图：公网 URL 优先（图床 / 已是图床链），失败再 data URL。Veo3 与 xAI 视频共用（与可灵 Omni 一致）。
 * @returns {Promise<{ kind: 'url'|'data', value: string }|null>}
 */
async function resolveVeo3ImageForApi(rawImgUrl, storage_local_path, log, video_gen_id) {
  const raw = (rawImgUrl || '').trim();
  if (!raw) return null;
  if (raw.startsWith('asset://')) {
    return { kind: 'url', value: raw };
  }
  const tag = `videoref_${video_gen_id || '0'}`;
  try {
    const host = new URL(raw).hostname.toLowerCase();
    if (host.includes('imageproxy.zhongzhuan.chat')) {
      return { kind: 'url', value: raw };
    }
  } catch (_) {
    /* 非绝对 URL */
  }

  if (!raw.startsWith('data:') && storage_local_path) {
    const proxyUrl = await uploadLocalImageToProxy(storage_local_path, raw, log, tag);
    if (proxyUrl) return { kind: 'url', value: proxyUrl };
  }

  if (raw.startsWith('data:')) {
    const m = raw.match(/^data:([\w/+.-]+);base64,(.+)$/is);
    if (m) {
      try {
        const buf = Buffer.from(m[2].replace(/\s/g, ''), 'base64');
        const mt = (m[1] || 'image/jpeg').toLowerCase();
        const mime = mt.includes('png') ? 'image/png' : mt.includes('webp') ? 'image/webp' : 'image/jpeg';
        const proxyUrl = await uploadToImageProxy(buf, mime, log, tag);
        if (proxyUrl) return { kind: 'url', value: proxyUrl };
        log.warn('[视频参考图] data 图床失败，回退内联 data', { video_gen_id });
      } catch (e) {
        log.warn('[视频参考图] data 解析失败', { error: e.message, video_gen_id });
      }
    }
    return { kind: 'data', value: raw };
  }

  let relAfterStatic = '';
  if (raw.includes('/static/')) {
    relAfterStatic = (raw.split('/static/')[1] || '').split(/[?#]/)[0].replace(/^\/+/, '');
  }
  if (relAfterStatic && storage_local_path) {
    try {
      let safeRel = relAfterStatic;
      try {
        safeRel = decodeURIComponent(relAfterStatic);
      } catch (_) {
        /* keep */
      }
      const localFile = path.join(storage_local_path, safeRel);
      const resolved = path.resolve(localFile);
      const baseResolved = path.resolve(storage_local_path);
      if (resolved.startsWith(baseResolved) && fs.existsSync(localFile)) {
        const buf = fs.readFileSync(localFile);
        const ext = path.extname(localFile).toLowerCase();
        const mime = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }[ext] || 'image/jpeg';
        const proxyUrl = await uploadToImageProxy(buf, mime, log, tag);
        if (proxyUrl) return { kind: 'url', value: proxyUrl };
        log.warn('[视频参考图] 本地图床失败 → base64', { video_gen_id });
        return { kind: 'data', value: `data:${mime};base64,${buf.toString('base64')}` };
      }
    } catch (e) {
      log.warn('[视频参考图] 读本地文件失败', { error: e.message, video_gen_id });
    }
  }

  if (/^https?:\/\//i.test(raw)) {
    try {
      const dlRes = await fetch(raw);
      if (dlRes.ok) {
        const buf = Buffer.from(await dlRes.arrayBuffer());
        const ct = (dlRes.headers.get('content-type') || '').split(';')[0].trim() || 'image/jpeg';
        const mime = ct.startsWith('image/') ? ct : 'image/jpeg';
        const proxyUrl = await uploadToImageProxy(buf, mime, log, tag);
        if (proxyUrl) return { kind: 'url', value: proxyUrl };
        log.warn('[视频参考图] 拉取后图床失败 → base64', { video_gen_id });
        return { kind: 'data', value: `data:${mime};base64,${buf.toString('base64')}` };
      }
      log.warn('[视频参考图] fetch 非 2xx', { status: dlRes.status, url_head: raw.slice(0, 96), video_gen_id });
    } catch (e) {
      log.warn('[视频参考图] fetch 失败', { error: e.message, url_head: raw.slice(0, 96), video_gen_id });
    }
    return { kind: 'url', value: raw };
  }

  return { kind: 'url', value: raw };
}

/**
 * Veo3 (api_protocol = 'veo3')
 * body: { model, prompt, enhance_prompt: true, images: [base64 or url] }
 * endpoint default: /v1/video/create
 */
async function callVeo3VideoApi(config, log, opts) {
  const { prompt, model, image_url, storage_local_path, video_gen_id } = opts;

  const base = (config.base_url || '').replace(/\/$/, '');
  let ep = config.endpoint || '/v1/video/create';
  if (!ep.startsWith('/')) ep = '/' + ep;
  const url = base + ep;

  const body = {
    model: model || '',
    prompt: prompt || '',
    enhance_prompt: true,
  };

  const rawImgUrl = (image_url || '').trim();
  if (rawImgUrl) {
    const resolved = await resolveVeo3ImageForApi(rawImgUrl, storage_local_path, log, video_gen_id);
    if (resolved && resolved.value) {
      body.images = [resolved.value];
      log.info('[视频参考图] Veo3 已解析', {
        transport: resolved.kind,
        value_head: String(resolved.value).slice(0, 80),
        video_gen_id,
      });
    }
  }

  log.info('[Veo3] Video API request', {
    url, model,
    has_image: !!body.images,
    prompt_len: (prompt || '').length,
    prompt_head: (prompt || '').slice(0, 200),
    video_gen_id,
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + (config.api_key || ''),
    },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  log.info('[Veo3] raw response', { status: res.status, raw: raw.slice(0, 1000), video_gen_id });

  if (!res.ok) {
    let errMsg = 'Veo3 request failed: ' + res.status;
    try {
      const errJson = JSON.parse(raw);
      const msg = errJson.error?.message || errJson.message || errJson.error;
      if (msg) errMsg += ' - ' + (typeof msg === 'string' ? msg : JSON.stringify(msg).slice(0, 200));
    } catch (_) {
      if (raw) errMsg += ' - ' + raw.slice(0, 200);
    }
    return { error: errMsg };
  }

  let data;
  try { data = JSON.parse(raw); } catch (e) {
    return { error: 'Veo3 bad response: ' + e.message + ' | raw: ' + raw.slice(0, 200) };
  }

  const directUrl = pickProxyVideoUrl(data);
  if (directUrl) {
    log.info('[Veo3] direct video URL', { video_url: directUrl, video_gen_id });
    return { video_url: directUrl };
  }

  const taskId = data.task_id || data.id || data.request_id || data.data?.task_id || data.data?.id;
  if (taskId) {
    log.info('[Veo3] task ID returned', { task_id: taskId, status: data.status, video_gen_id });
    return { task_id: String(taskId), status: data.status || 'processing' };
  }

  log.error('[Veo3] cannot parse task_id or video_url', { data: JSON.stringify(data).slice(0, 500), video_gen_id });
  return { error: 'Veo3 no task_id or video_url: ' + JSON.stringify(data).slice(0, 300) };
}

module.exports = {
  callVeo3VideoApi,
  resolveVeo3ImageForApi,
};
