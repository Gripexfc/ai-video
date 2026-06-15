/**
 * videoProviders/vidu.js
 * Vidu 视频生成 API（api.vidu.cn/ent/v2）
 */
const { uploadLocalImageToProxy } = require('../uploadService');

/**
 * 调用 Vidu 视频生成 API（api.vidu.cn/ent/v2）
 * 认证：Authorization: Token {api_key}（非 Bearer）
 * 创建：POST /ent/v2/tasks
 * 查询：GET /ent/v2/tasks/{id}/creations
 * 模型：viduq2 / viduq2-pro / viduq2-turbo / viduq3-pro
 */
async function callViduVideoApi(config, log, opts) {
  const { prompt, model, duration, aspect_ratio, image_url, video_gen_id, files_base_url, storage_local_path } = opts;
  const apiKey = config.api_key || '';
  const base = (config.base_url || 'https://api.vidu.cn').replace(/\/$/, '');
  const modelName = model || 'viduq2';
  const dur = Math.min(10, Math.max(1, Math.round(Number(duration) || 5)));
  const ratio = aspect_ratio || '16:9';
  const hasImage = !!(image_url && image_url.trim());

  // 官方 api.vidu.cn: Token 前缀（非 Bearer）
  const isOfficialVidu = /api\.vidu\.cn/i.test(base);
  const authHeader = (isOfficialVidu ? 'Token ' : 'Bearer ') + apiKey;

  // 根据是否有图片选 /ent/v2/img2video 或 text2video
  const defaultEp = hasImage ? '/ent/v2/img2video' : '/ent/v2/text2video';
  let ep = config.endpoint || defaultEp;
  if (!ep.startsWith('/')) ep = '/' + ep;
  const url = base + ep;

  const body = {
    model: modelName,
    prompt: prompt || '',
    duration: dur,
    resolution: '720p',
    aspect_ratio: ratio,
    movement_amplitude: 'auto',
    audio: false,
    off_peak: false,
    watermark: false,
  };

  // 处理 localhost 等内网图片 → 公网 URL
  if (hasImage) {
    const rawImgUrl = image_url.trim();
    let publicImgUrl = null;
    if (/localhost|127\.0\.0\.1/i.test(rawImgUrl)) {
      log.info('[Vidu] 参考图 localhost，尝试上传', { original: rawImgUrl, video_gen_id });
      publicImgUrl = await uploadLocalImageToProxy(storage_local_path, rawImgUrl, log, `vidu_vg${video_gen_id}`);
      if (publicImgUrl) {
        log.info('[Vidu] 上传图床成功', { proxy: publicImgUrl, video_gen_id });
      } else if (files_base_url && !/localhost|127\.0\.0\.1/i.test(files_base_url)) {
        publicImgUrl = (files_base_url || '').replace(/\/$/, '') + rawImgUrl.replace(/^https?:\/\/[^/]+/, '');
        log.warn('[Vidu] 图床失败用 files_base_url', { converted: publicImgUrl, video_gen_id });
      } else {
        log.warn('[Vidu] 图床不可用且无公网 URL，跳过图片', { video_gen_id });
      }
    } else {
      publicImgUrl = rawImgUrl;
    }
    if (publicImgUrl) body.images = [publicImgUrl];
  }

  log.info('[Vidu] Video API request', {
    url, model: modelName, auth: isOfficialVidu ? 'Token' : 'Bearer',
    dur, has_image: !!body.images, video_gen_id,
  });
  log.info('[Vidu] request body', { body: JSON.stringify({ ...body, images: body.images ? ['(url)'] : undefined }), video_gen_id });

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authHeader },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  log.info('[Vidu] raw response', { status: res.status, raw: raw.slice(0, 600), video_gen_id });

  if (!res.ok) {
    let errMsg = 'Vidu request failed: ' + res.status;
    try {
      const errJson = JSON.parse(raw);
      const msg = errJson.message || errJson.err_code || errJson.error?.message || errJson.error;
      if (msg) errMsg += ' - ' + String(msg).slice(0, 200);
    } catch (_) {
      if (raw) errMsg += ' - ' + raw.slice(0, 200);
    }
    log.error('[Vidu] Video API failed', { status: res.status, body: raw.slice(0, 300), video_gen_id });
    return { error: errMsg };
  }

  let data;
  try { data = JSON.parse(raw); } catch (_) {
    return { error: 'Vidu bad response: ' + raw.slice(0, 200) };
  }

  const taskId = data?.task_id || data?.id;
  if (!taskId) {
    log.error('[Vidu] no task_id in response', { video_gen_id, raw: raw.slice(0, 300) });
    return { error: 'Vidu no task_id returned' };
  }
  log.info('[Vidu] task created', { task_id: taskId, state: data?.state, video_gen_id });
  return { task_id: taskId, status: data?.state || 'created' };
}

module.exports = {
  callViduVideoApi,
};
