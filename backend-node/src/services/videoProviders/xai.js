/**
 * videoProviders/xai.js
 * xAI / Grok 视频生成 API
 */
const { normalizeAspectRatioForApi, pickProxyVideoUrl } = require('./shared');
const { resolveVeo3ImageForApi } = require('./veo3');

function resolveXaiVideoResolution(resolution) {
  const s = String(resolution || '').toLowerCase();
  if (s.includes('480')) return '480p';
  if (s.includes('720')) return '720p';
  return '720p';
}

/** grok-video-3 等官方示例：size 为 "720P" / "480P"（大写 P） */
function formatGrokVideo3Size(resolution) {
  const s = resolveXaiVideoResolution(resolution);
  if (String(s).includes('480')) return '480P';
  return '720P';
}

/** 与官方 / 中转 grok-video-3 示例一致：images[] + size，而非旧版 image.url */
function isGrokVideoCreateStyleModel(modelName) {
  return /grok-video/i.test(String(modelName || ''));
}

function clampXaiDuration(d) {
  const n = Math.round(Number(d));
  if (!Number.isFinite(n) || n < 1) return 8;
  return Math.min(15, Math.max(1, n));
}

/**
 * xAI 视频：
 * - grok-video-3 等：与官方一致 body 含 images[]、size（720P），见中转文档示例。
 * - grok-imagine 旧形态：image.url、resolution、duration、reference_images。
 */
async function callXaiVideoApi(config, log, opts) {
  const {
    prompt,
    model,
    duration,
    aspect_ratio,
    resolution,
    image_url,
    reference_urls,
    files_base_url,
    storage_local_path,
    video_gen_id,
  } = opts;

  const base = (config.base_url || 'https://api.x.ai').replace(/\/$/, '');
  let ep = config.endpoint || '/v1/videos/generations';
  if (!ep.startsWith('/')) ep = '/' + ep;
  const url = base + ep;

  const ratio = normalizeAspectRatioForApi(aspect_ratio) || '16:9';
  const dur = clampXaiDuration(duration != null ? duration : 8);
  const reso = resolveXaiVideoResolution(resolution);
  const modelName = model || 'grok-imagine-video';
  const useGrokVideoCreate = isGrokVideoCreateStyleModel(modelName);

  let imageUrlForApi = '';
  const rawMain = (image_url || '').trim();
  if (rawMain) {
    const resolved = await resolveVeo3ImageForApi(rawMain, storage_local_path, log, String(video_gen_id || ''));
    if (resolved?.value) {
      imageUrlForApi = resolved.value;
      log.info('[xAI视频] 参考图已解析', {
        transport: resolved.kind,
        value_head: String(resolved.value).slice(0, 88),
        video_gen_id,
      });
    }
  }

  const resolvedRefStrings = [];
  if (Array.isArray(reference_urls) && reference_urls.length > 0) {
    for (let i = 0; i < reference_urls.length; i++) {
      const u = reference_urls[i] && String(reference_urls[i]).trim();
      if (!u) continue;
      const r = await resolveVeo3ImageForApi(u, storage_local_path, log, `${video_gen_id || 0}_r${i}`);
      if (r?.value) resolvedRefStrings.push(r.value);
    }
  }

  let body;
  let mainTransport = 'none';
  let logExtra = {};

  if (useGrokVideoCreate) {
    const images = [];
    if (imageUrlForApi) images.push(imageUrlForApi);
    for (const s of resolvedRefStrings) {
      if (s && !images.includes(s)) images.push(s);
    }
    body = {
      model: modelName,
      prompt: prompt || '',
      aspect_ratio: ratio,
      size: formatGrokVideo3Size(resolution),
      duration: dur,
    };
    if (images.length) body.images = images.slice(0, 10);
    const first = images[0] || '';
    mainTransport =
      first && String(first).startsWith('data:') ? 'data_url' : first ? 'http_url' : 'none';
    logExtra = {
      body_shape: 'grok-video',
      images_count: body.images?.length || 0,
      size: body.size,
      image_transport: mainTransport,
    };
  } else {
    const hasImage = !!imageUrlForApi;
    body = {
      model: modelName,
      prompt: prompt || '',
      duration: dur,
      aspect_ratio: ratio,
      resolution: reso,
    };
    if (hasImage && imageUrlForApi) {
      body.image = { url: imageUrlForApi };
    } else if (resolvedRefStrings.length > 0) {
      body.reference_images = resolvedRefStrings.map((u) => ({ url: u }));
    }
    mainTransport =
      body.image?.url && String(body.image.url).startsWith('data:') ? 'data_url' : body.image?.url ? 'http_url' : 'none';
    logExtra = {
      body_shape: 'grok-imagine',
      has_image: !!body.image,
      image_transport: mainTransport,
      ref_count: body.reference_images?.length || 0,
    };
  }

  log.info('[xAI视频] 提交', {
    video_gen_id,
    url,
    model: body.model,
    aspect_ratio: ratio,
    duration: body.duration != null ? body.duration : dur,
    resolution: body.resolution != null ? body.resolution : undefined,
    ...logExtra,
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
  log.info('[xAI视频] 响应', { video_gen_id, status: res.status, head: raw.slice(0, 500) });

  if (!res.ok) {
    let errMsg = 'xAI 视频请求失败: ' + res.status;
    try {
      const errJson = JSON.parse(raw);
      const msg = errJson.error?.message || errJson.message || errJson.error;
      if (msg) errMsg += ' - ' + String(msg).slice(0, 220);
    } catch (_) {
      if (raw) errMsg += ' - ' + raw.slice(0, 200);
    }
    return { error: errMsg };
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    return { error: 'xAI 响应非 JSON: ' + raw.slice(0, 200) };
  }

  const direct = pickProxyVideoUrl(data);
  if (direct) {
    log.info('[xAI视频] 同步返回地址', { video_gen_id });
    return { video_url: direct };
  }

  const reqId = data.request_id || data.task_id || data.id;
  if (reqId) {
    log.info('[xAI视频] 异步任务', { video_gen_id, request_id: reqId });
    return { task_id: String(reqId), status: 'submitted' };
  }

  return { error: 'xAI 未返回 request_id 或视频地址: ' + JSON.stringify(data).slice(0, 300) };
}

module.exports = {
  callXaiVideoApi,
};
