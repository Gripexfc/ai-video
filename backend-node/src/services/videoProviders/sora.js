/**
 * videoProviders/sora.js
 * Sora 视频生成 API（OpenAI Sora，multipart/form-data）
 */
const fs = require('fs');
const path = require('path');
const { getSharp } = require('../../utils/sharpLoader');
const { pickProxyVideoUrl } = require('./shared');

/**
 * Sora (api_protocol = 'sora')
 * multipart/form-data: model, prompt, seconds, size, input_reference
 */
async function callSoraVideoApi(config, log, opts) {
  const { prompt, model, duration, aspect_ratio, image_url, storage_local_path, video_gen_id } = opts;

  const base = (config.base_url || '').replace(/\/$/, '');
  let ep = config.endpoint || '/v1/videos';
  if (!ep.startsWith('/')) ep = '/' + ep;
  const url = base + ep;

  // seconds 只支持 4 / 8 / 12（大致）
  const rawSec = duration ? Number(duration) : 4;
  const dur = rawSec <= 4 ? '4' : rawSec <= 8 ? '8' : '12';

  // aspect_ratio 转 size（仅 4 种：720x1280 / 1280x720 / 1024x1792 / 1792x1024）
  const sizeMap = {
    '9:16': '720x1280',  // 竖屏
    '3:4':  '1024x1792', // 竖屏
    '1:1':  '720x1280',  // 正方形不支持，用竖屏
    '16:9': '1280x720',  // 横屏
    '4:3':  '1280x720',  // 横屏
    '21:9': '1792x1024', // 超宽
  };
  const size = sizeMap[aspect_ratio || ''] || '720x1280';

  // 解析 参考图 → Buffer（需要原始二进制，而非 URL，因为 multipart 提交）
  let imageBuffer = null;
  let imageMime = 'image/jpeg';
  let imageFilename = 'reference.jpg';
  const rawImgUrl = (image_url || '').trim();

  if (rawImgUrl) {
    if (rawImgUrl.startsWith('data:')) {
      const m = rawImgUrl.match(/^data:([\w/]+);base64,(.+)$/s);
      if (m) {
        imageMime = m[1];
        imageBuffer = Buffer.from(m[2], 'base64');
        const ext = imageMime.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
        imageFilename = `reference.${ext}`;
      } else {
        log.warn('[Sora] 无效的 base64 图片格式', { video_gen_id });
      }
    } else if (/localhost|127\.0\.0\.1/i.test(rawImgUrl)) {
      // localhost URL → 尝试读取本地文件
      try {
        const afterStatic = rawImgUrl.split('/static/')[1];
        if (afterStatic && storage_local_path) {
          const localFile = path.join(storage_local_path, afterStatic.replace(/^\//, ''));
          if (fs.existsSync(localFile)) {
            imageBuffer = fs.readFileSync(localFile);
            const ext = path.extname(localFile).toLowerCase();
            const mimeMap = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
            imageMime = mimeMap[ext] || 'image/jpeg';
            imageFilename = path.basename(localFile);
            log.info('[Sora] 读取本地图片', { file: localFile, size_kb: Math.round(imageBuffer.length / 1024), video_gen_id });
          } else {
            log.warn('[Sora] 本地文件不存在', { file: localFile, video_gen_id });
          }
        }
      } catch (e) {
        log.warn('[Sora] 读本地图片失败', { error: e.message, video_gen_id });
      }
    } else {
      // 远程 URL → 拉取
      try {
        const dlRes = await fetch(rawImgUrl);
        if (dlRes.ok) {
          const ct = (dlRes.headers.get('content-type') || '').split(';')[0].trim();
          imageMime = ct || 'image/jpeg';
          imageBuffer = Buffer.from(await dlRes.arrayBuffer());
          const ext = imageMime.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
          imageFilename = `reference.${ext}`;
          log.info('[Sora] 下载远程图片', { url: rawImgUrl, size_kb: Math.round(imageBuffer.length / 1024), video_gen_id });
        } else {
          log.warn('[Sora] 下载远程图片失败', { status: dlRes.status, url: rawImgUrl, video_gen_id });
        }
      } catch (e) {
        log.warn('[Sora] 下载远程图片异常', { error: e.message, video_gen_id });
      }
    }
  }

  // 如果有图片且尺寸不匹配 → resize 到目标 size（Sora 要求精确尺寸）
  const sharp = getSharp();
  if (imageBuffer && sharp) {
    try {
      const [targetW, targetH] = size.split('x').map(Number);
      const meta = await sharp(imageBuffer).metadata();
      if (meta.width !== targetW || meta.height !== targetH) {
        log.info('[Sora] 参考图尺寸不匹配，resize', {
          from: `${meta.width}x${meta.height}`, to: size, video_gen_id,
        });
        imageBuffer = await sharp(imageBuffer)
          .resize(targetW, targetH, { fit: 'cover', position: 'centre' })
          .jpeg({ quality: 92 })
          .toBuffer();
        imageMime = 'image/jpeg';
        imageFilename = imageFilename.replace(/\.\w+$/, '.jpg');
        log.info('[Sora] 图片 resize 完成', { size, size_kb: Math.round(imageBuffer.length / 1024), video_gen_id });
      } else {
        log.info('[Sora] 参考图尺寸匹配', { size, video_gen_id });
      }
    } catch (e) {
      log.warn('[Sora] 图片 resize 失败（继续提交）', { error: e.message, video_gen_id });
    }
  }

  // 构建 multipart/form-data 请求体
  const boundary = 'soraform_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

  const textFields = [
    ['model', model || 'sora-2'],
    ['prompt', prompt || ''],
    ['seconds', dur],
    ['size', size],
    ['watermark', 'false'],
    ['private', 'false'],
    ['character_url', ''],
    ['character_timestamps', ''],
    ['metadata', ''],
    ['character_from_task', ''],
    ['character_create', ''],
  ];

  const textPart = textFields
    .map(([name, value]) => `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`)
    .join('');

  let bodyBuffer;
  if (imageBuffer) {
    const imgHeader = `--${boundary}\r\nContent-Disposition: form-data; name="input_reference"; filename="${imageFilename}"\r\nContent-Type: ${imageMime}\r\n\r\n`;
    bodyBuffer = Buffer.concat([
      Buffer.from(textPart, 'utf-8'),
      Buffer.from(imgHeader, 'utf-8'),
      imageBuffer,
      Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8'),
    ]);
  } else {
    bodyBuffer = Buffer.concat([
      Buffer.from(textPart, 'utf-8'),
      Buffer.from(`--${boundary}--\r\n`, 'utf-8'),
    ]);
  }

  log.info('[Sora] Video API request', {
    url, model, size, seconds: dur,
    has_image: !!imageBuffer, image_file: imageBuffer ? imageFilename : null,
    prompt_len: (prompt || '').length,
    prompt_head: (prompt || '').slice(0, 200),
    video_gen_id,
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      Authorization: 'Bearer ' + (config.api_key || ''),
    },
    body: bodyBuffer,
  });
  const raw = await res.text();
  log.info('[Sora] raw response', { status: res.status, raw: raw.slice(0, 1000), video_gen_id });

  if (!res.ok) {
    let errMsg = 'Sora 视频生成请求失败: ' + res.status;
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
    return { error: 'Sora 响应格式错误: ' + e.message + ' | raw: ' + raw.slice(0, 200) };
  }

  // 直接返回 URL（含中转 result_url）
  const directUrl = pickProxyVideoUrl(data);
  if (directUrl) {
    log.info('[Sora] 直接返回视频 URL', { video_url: directUrl, video_gen_id });
    return { video_url: directUrl };
  }

  // 异步任务 ID
  const taskId = data.id || data.task_id || data.request_id || data.data?.id || data.data?.task_id;
  if (taskId) {
    log.info('[Sora] 异步任务 ID', { task_id: taskId, status: data.status, video_gen_id });
    return { task_id: String(taskId), status: data.status || 'processing' };
  }

  log.error('[Sora] 无法解析 task_id 或 video_url', { data: JSON.stringify(data).slice(0, 500), video_gen_id });
  return { error: 'Sora 无法解析 task_id 或 video_url（原始响应）: ' + JSON.stringify(data).slice(0, 300) };
}

module.exports = {
  callSoraVideoApi,
};
