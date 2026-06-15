/**
 * videoProviders/kling.js
 * 标准 Kling 视频 API（Text2Video / Image2Video / Motion-Control）
 */
const fs = require('fs');
const path = require('path');
const { normalizeAspectRatioForApi } = require('./shared');

/**
 * 调用可灵（Kling AI）视频生成 API（异步任务，返回 task_id）
 * 支持模型：kling-video / kling-omni-video / kling-motion-control
 * 接口：
 *   T2V  → POST /v1/videos/text2video      （无参考图）
 *   I2V  → POST /v1/videos/image2video     （有参考图/首帧）
 *   MC   → POST /v1/videos/motion-control  （kling-motion-control 模型，需首帧图）
 * task_id 编码格式：`t2v:xxx` / `i2v:xxx` / `mc:xxx` 用于轮询时还原正确的查询端点
 * 认证：Authorization: Bearer {api_key}
 */
async function callKlingVideoApi(config, log, opts) {
  const {
    prompt, model, duration, aspect_ratio, image_url,
    files_base_url, storage_local_path, video_gen_id,
  } = opts;

  const base = (config.base_url || 'https://api.klingai.com').replace(/\/$/, '');
  const apiKey = config.api_key || '';
  const headers = {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + apiKey,
  };

  const m = model || 'kling-video';
  const isMotionControl = m === 'kling-motion-control';

  // 处理图片 URL（本地路径 → base64 转换）
  let imageInput = null;
  const rawImgUrl = (image_url || '').trim();
  if (rawImgUrl) {
    if (rawImgUrl.startsWith('asset://')) {
      imageInput = rawImgUrl;
    } else if (rawImgUrl.startsWith('data:')) {
      imageInput = rawImgUrl;
    } else if (/localhost|127\.0\.0\.1/i.test(rawImgUrl) && storage_local_path) {
      const baseUrl = (files_base_url || '').replace(/\/$/, '');
      const afterStatic = rawImgUrl.split('/static/')[1] || (baseUrl ? rawImgUrl.replace(baseUrl + '/', '').replace(baseUrl, '') : null);
      const relPath = afterStatic ? afterStatic.replace(/^\//, '') : null;
      if (relPath) {
        const filePath = path.join(storage_local_path, relPath);
        try {
          if (fs.existsSync(filePath)) {
            const buf = fs.readFileSync(filePath);
            const ext = path.extname(filePath).toLowerCase();
            const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }[ext] || 'image/jpeg';
            imageInput = 'data:' + mime + ';base64,' + buf.toString('base64');
            log.info('[Kling视频] 本地图片 → base64', { file: filePath, size_kb: Math.round(buf.length / 1024), video_gen_id });
          }
        } catch (e) {
          log.warn('[Kling视频] 读取本地图片失败', { error: e.message, video_gen_id });
          imageInput = rawImgUrl;
        }
      }
    } else {
      imageInput = rawImgUrl;
    }
  }

  const hasImage = !!imageInput;
  const dur = duration ? Number(duration) : 5;
  const klingDuration = dur <= 5 ? '5' : '10';
  const ratio = normalizeAspectRatioForApi(aspect_ratio) || '16:9';

  // 根据模型类型 & 是否有图片确定端点
  let createEp, taskType;
  if (isMotionControl) {
    createEp = '/v1/videos/motion-control';
    taskType = 'mc';
  } else if (hasImage) {
    createEp = '/v1/videos/image2video';
    taskType = 'i2v';
  } else {
    createEp = '/v1/videos/text2video';
    taskType = 't2v';
  }

  // 允许用户通过 config.endpoint 覆盖默认端点
  if (config.endpoint) {
    createEp = config.endpoint.startsWith('/') ? config.endpoint : '/' + config.endpoint;
  }
  const createUrl = base + createEp;

  let body;
  if (taskType === 'i2v' || taskType === 'mc') {
    body = {
      model: m,
      prompt: prompt || '',
      image: { type: 'url', url: imageInput },
      duration: klingDuration,
      aspect_ratio: ratio,
      cfg_scale: 0.5,
      callback_url: '',
    };
  } else {
    body = {
      model: m,
      prompt: prompt || '',
      aspect_ratio: ratio,
      duration: klingDuration,
      cfg_scale: 0.5,
      mode: 'std',
      callback_url: '',
    };
  }

  const bodyForLog = {
    ...body,
    image: body.image ? { ...body.image, url: body.image.url?.startsWith('data:') ? '(base64)' : body.image.url } : undefined,
  };
  log.info('[Kling视频] 发送请求', {
    url: createUrl, model: m, task_type: taskType,
    has_image: hasImage, duration: klingDuration, ratio,
    video_gen_id, body_preview: JSON.stringify(bodyForLog).slice(0, 400),
  });

  const res = await fetch(createUrl, { method: 'POST', headers, body: JSON.stringify(body) });
  const raw = await res.text();
  log.info('[Kling视频] 原始响应', { video_gen_id, status: res.status, raw: raw.slice(0, 500) });

  if (!res.ok) {
    let errMsg = '可灵视频生成请求失败: ' + res.status;
    try {
      const errJson = JSON.parse(raw);
      const msg = errJson.message || errJson.msg || errJson.error?.message || errJson.error;
      if (msg) errMsg += ' - ' + String(msg).slice(0, 200);
    } catch (_) {
      if (raw) errMsg += ' - ' + raw.slice(0, 200);
    }
    return { error: errMsg };
  }

  let data;
  try { data = JSON.parse(raw); } catch (e) {
    return { error: '可灵视频响应格式异常: ' + raw.slice(0, 200) };
  }

  if (data.code !== undefined && data.code !== 0) {
    return { error: `可灵错误(${data.code}): ${data.message || '未知错误'}` };
  }

  // 同步返回视频 URL（极少见，兜底）
  const directUrl = data?.data?.task_result?.videos?.[0]?.url;
  if (directUrl) {
    log.info('[Kling视频] 同步返回视频', { video_gen_id });
    return { video_url: directUrl };
  }

  const taskId = data?.data?.task_id;
  if (!taskId) {
    return { error: '可灵未返回 task_id: ' + raw.slice(0, 200) };
  }

  // 在 task_id 中编码任务类型，轮询时用于还原正确的查询端点
  const encodedTaskId = taskType + ':' + taskId;
  log.info('[Kling视频] 任务已提交', { video_gen_id, task_id: taskId, task_type: taskType, encoded_id: encodedTaskId });
  return { task_id: encodedTaskId, status: 'submitted' };
}

module.exports = {
  callKlingVideoApi,
};
