/**
 * imageProviders/openai.js
 * OpenAI-compatible / 火山引擎 volcengine / Doubao-Seedream 图片生成
 * 默认 fallback：/images/generations 风格接口
 * 支持 volcengine doubao-seedream 原生规范（image 数组、watermark、negative_prompt）
 */
const { postJSONWithTimeout } = require('../aiClient');
const {
  IMAGE_HTTP_TIMEOUT_MS,
  ANTI_SPLIT_NEGATIVE_PROMPT,
  buildImageUrl,
  resolveImageRef,
} = require('./shared');

// 火山引擎 Doubao-Seedream-4.5 最低像素要求 3,686,400 (1920*1920)
const SEEDREAM_MIN_PIXELS = 3686400;

function fixSeedreamSize(size) {
  if (!size || typeof size !== 'string') return '1920x1920';
  const s = size.trim().toLowerCase().replace(/\*/g, 'x');
  const match = s.match(/^(\d+)\s*x\s*(\d+)$/);
  if (!match) return '1920x1920';

  let w = parseInt(match[1], 10);
  let h = parseInt(match[2], 10);
  if (!w || !h) return '1920x1920';

  const pixels = w * h;
  if (pixels >= SEEDREAM_MIN_PIXELS) return `${w}x${h}`;

  const scale = Math.sqrt(SEEDREAM_MIN_PIXELS / pixels);
  w = Math.ceil((w * scale) / 64) * 64;
  h = Math.ceil((h * scale) / 64) * 64;

  if (w * h < SEEDREAM_MIN_PIXELS) {
    w += 64;
    h += 64;
  }

  return `${w}x${h}`;
}

/**
 * OpenAI-compatible 图片生成（含 volcengine / doubao-seedream 扩展字段）
 */
async function callOpenAiImageApi(config, log, opts) {
  const {
    prompt,
    model,
    size,
    quality,
    image_gen_id,
    reference_image_urls,
    files_base_url,
    storage_local_path,
    is_volcengine: isVolc,
    is_seedream: isSeedream,
    merged_negative_prompt,
  } = opts;

  const url = buildImageUrl(config);
  // 解析参考图
  const rawRefs = Array.isArray(reference_image_urls) ? reference_image_urls.filter(Boolean) : [];
  const resolvedRefs = rawRefs.map((r) => resolveImageRef(r, files_base_url, storage_local_path)).filter(Boolean);
  if (resolvedRefs.length > 0) {
    log.info('Image API request with reference images', {
      url: url.slice(0, 60), model, image_gen_id,
      ref_count: resolvedRefs.length,
      ref_types: resolvedRefs.map((r) => (r.startsWith('data:') ? 'base64' : 'url')),
    });
  }

  // doubao-seedream-4-5+ 要求最低 3686400 像素，不足时等比放大
  const effectiveSize = (isSeedream && size) ? fixSeedreamSize(size) : size;

  const body = {
    model,
    prompt,
    // doubao-seedream API 不使用 n，其他 OpenAI 兼容接口保留
    ...(!isSeedream ? { n: 1 } : {}),
    ...(effectiveSize ? { size: effectiveSize } : {}),
    ...(quality ? { quality } : {}),
    // volcengine 原生或 doubao-seedream 模型均需关闭水印
    ...((isVolc || isSeedream) ? { watermark: false } : {}),
    // 多张参考图时加 negative_prompt
    ...(merged_negative_prompt ? { negative_prompt: merged_negative_prompt } : {}),
    // 参考图字段：volcengine doubao-seedream API 规范使用 image（数组）
    ...(resolvedRefs.length > 0 ? { image: resolvedRefs } : {}),
  };
  log.info('Image API request', { url: url.slice(0, 60), model, image_gen_id, has_ref_images: resolvedRefs.length > 0, size: effectiveSize, original_size: size !== effectiveSize ? size : undefined });
  const openaiCompatHeaders = {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + (config.api_key || ''),
  };
  let raw;
  let httpStatus;
  try {
    const out = await postJSONWithTimeout(url, openaiCompatHeaders, body, IMAGE_HTTP_TIMEOUT_MS);
    httpStatus = out.statusCode;
    raw = out.raw;
  } catch (e) {
    log.error('Image API network error', { image_gen_id, error: e.message, url: url.slice(0, 80) });
    return { error: e.message && e.message.includes('timeout')
      ? e.message
      : ('图片生成网络请求失败: ' + e.message) };
  }
  if (httpStatus < 200 || httpStatus >= 300) {
    log.error('Image API failed', { status: httpStatus, body: raw.slice(0, 300) });
    let errMsg = '图片生成请求失败: ' + httpStatus;
    try {
      const errJson = JSON.parse(raw);
      const msg = errJson.error?.message || errJson.message || errJson.error;
      if (msg) errMsg += ' - ' + (typeof msg === 'string' ? msg : JSON.stringify(msg).slice(0, 200));
    } catch (_) {
      if (raw && raw.length) errMsg += ' - ' + raw.slice(0, 200);
    }
    return { error: errMsg };
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    log.warn('Image API response parse error', { image_gen_id, raw_preview: raw.slice(0, 200) });
    return { error: '图片生成返回格式异常' };
  }
  // 兼容多种返回格式：OpenAI 风格 data[].url / b64_json，部分厂商 data[].image_url 或 data.output 等
  // Stable Diffusion WebUI（/sdapi/v1/txt2img|img2img）：顶层 images 为 PNG base64 字符串数组，无 data 数组
  const item = data.data && data.data[0];
  let imageUrl = item && (item.url || item.image_url);
  if (!imageUrl && item?.b64_json) {
    imageUrl = `data:image/png;base64,${String(item.b64_json).replace(/\s/g, '')}`;
  }
  if (!imageUrl && Array.isArray(data.images) && data.images.length > 0) {
    const first = data.images[0];
    if (typeof first === 'string' && first.length > 0) {
      imageUrl = first.startsWith('data:') ? first : `data:image/png;base64,${first.replace(/\s/g, '')}`;
    }
  }
  if (!imageUrl) {
    log.warn('Image API no image URL in response', {
      image_gen_id,
      model,
      response_keys: data ? Object.keys(data) : [],
      data_preview: data ? JSON.stringify(data).slice(0, 500) : '',
      has_data_array: !!(data.data && Array.isArray(data.data)),
      first_item_keys: (data.data && data.data[0]) ? Object.keys(data.data[0]) : [],
    });
    return { error: '未返回图片地址' };
  }
  return { image_url: imageUrl };
}

module.exports = { callOpenAiImageApi };
