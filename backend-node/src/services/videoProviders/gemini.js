/**
 * videoProviders/gemini.js
 * Google Gemini Veo 视频生成 API（predictLongRunning 异步）
 */
const fs = require('fs');
const path = require('path');

/**
 * 调用 Google Gemini Veo 视频生成 API（predictLongRunning 异步）
 * 支持：veo-3.1-generate-preview / veo-3.0-generate-preview / veo-3.0-fast-generate-preview
 * 同时 t2v（纯文字）和 i2v（带参考图）模式
 */
async function callGeminiVideoApi(config, log, opts) {
  const { prompt, duration, aspect_ratio, image_url, video_gen_id, files_base_url, storage_local_path, model } = opts;
  const apiKey = config.api_key || '';
  const base = (config.base_url || 'https://generativelanguage.googleapis.com').replace(/\/$/, '');
  const modelName = model || 'veo-3.0-generate-preview';

  // durationSeconds 只支持 5-8 秒
  const durationSec = Math.min(8, Math.max(5, Math.round(Number(duration) || 8)));
  const ratio = aspect_ratio || '16:9';

  const instance = { prompt: prompt || '' };

  // i2v：图片转 base64（Gemini 不接受 localhost URL，需要 fetch 远程 URL）
  if (image_url && image_url.trim()) {
    let imageB64 = null;
    let mimeType = 'image/jpeg';
    const imgUrl = image_url.trim();
    if (imgUrl.startsWith('asset://')) {
      log.warn('[Gemini视频] Veo 不支持 asset:// 素材引用，跳过参考图', { video_gen_id });
    } else if (imgUrl.startsWith('data:')) {
      const m = imgUrl.match(/^data:([\w/]+);base64,(.+)$/);
      if (m) { imageB64 = m[2]; mimeType = m[1]; }
    } else if ((files_base_url || '').match(/localhost|127\.0\.0\.1/i) && storage_local_path) {
      const baseUrl = (files_base_url || '').replace(/\/$/, '');
      const afterStatic = imgUrl.split('/static/')[1] || imgUrl.replace(baseUrl + '/', '').replace(baseUrl, '');
      const relPath = afterStatic ? afterStatic.replace(/^\//, '') : null;
      if (relPath) {
        const filePath = path.join(storage_local_path, relPath);
        try {
          if (fs.existsSync(filePath)) {
            const buf = fs.readFileSync(filePath);
            const ext = path.extname(filePath).toLowerCase();
            mimeType = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }[ext] || 'image/jpeg';
            imageB64 = buf.toString('base64');
          }
        } catch (_) {}
      }
    } else {
      try {
        const imgRes = await fetch(imgUrl, { method: 'GET' });
        if (imgRes.ok) {
          const buf = Buffer.from(await imgRes.arrayBuffer());
          const ct = imgRes.headers.get('content-type') || 'image/jpeg';
          mimeType = ct.split(';')[0].trim();
          imageB64 = buf.toString('base64');
        }
      } catch (_) {}
    }
    if (imageB64) {
      instance.image = { bytesBase64Encoded: imageB64, mimeType };
    }
  }

  const body = {
    instances: [instance],
    parameters: {
      aspectRatio: ratio,
      durationSeconds: durationSec,
      sampleCount: 1,
    },
  };

  const url = `${base}/v1beta/models/${encodeURIComponent(modelName)}:predictLongRunning`;
  log.info('Gemini Video API request', { model: modelName, ratio, durationSec, video_gen_id, has_image: !!instance.image });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  if (!res.ok) {
    let errMsg = 'Gemini 视频生成请求失败: ' + res.status;
    try {
      const errJson = JSON.parse(raw);
      const msg = errJson.error?.message || errJson.message;
      if (msg) errMsg += ' - ' + String(msg).slice(0, 200);
    } catch (_) {
      if (raw) errMsg += ' - ' + raw.slice(0, 200);
    }
    log.error('Gemini Video API failed', { status: res.status, body: raw.slice(0, 300), video_gen_id });
    return { error: errMsg };
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    return { error: 'Gemini 响应格式解析错误' };
  }

  // 返回 operation name 作为 task_id，供 pollVideoTask 轮询
  const operationName = data.name;
  if (operationName) {
    log.info('Gemini Video task created', { operation: operationName, video_gen_id });
    return { task_id: operationName, status: 'processing' };
  }
  return { error: 'Gemini 未返回 operation name（请检查 API Key 是否有效）' };
}

module.exports = {
  callGeminiVideoApi,
};
