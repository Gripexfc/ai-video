/**
 * imageProviders/gemini.js
 * Google Gemini 图片生成 API（generateContent 接口，返回 base64 inlineData）
 * 支持模型：gemini-2.5-flash-image / gemini-2.5-flash-image-preview /
 *          gemini-3.1-flash-image-preview / gemini-3-pro-image-preview 等
 * 参考图先查本地缓存表，未命中则上传到中转图床并缓存，再通过 fileData.fileUri 传给 Gemini。
 * 避免 inlineData base64 大 payload 触发 503 memory overload。
 */
const { postJSONWithTimeout } = require('../aiClient');
const { uploadToImageProxy } = require('../uploadService');
const {
  IMAGE_HTTP_TIMEOUT_MS,
  compressImageBuffer,
  resolveImageRef,
  getProxyCache,
  setProxyCache,
  buildCacheKey,
} = require('./shared');

// Gemini 支持的宽高比标签 → 数值 w/h（与 API 一致）
const GEMINI_ASPECT_NUMERIC = [
  ['21:9', 21 / 9],
  ['16:9', 16 / 9],
  ['3:2', 3 / 2],
  ['4:3', 4 / 3],
  ['5:4', 5 / 4],
  ['1:1', 1],
  ['4:5', 4 / 5],
  ['3:4', 3 / 4],
  ['2:3', 2 / 3],
  ['9:16', 9 / 16],
];

/** 按像素尺寸选最接近的 Gemini aspectRatio（对数距离，避免 1440×2560 被误判为 4:5） */
function closestGeminiAspectRatioFromPixels(w, h) {
  if (!w || !h) return '1:1';
  const r = w / h;
  let best = '1:1';
  let bestD = Infinity;
  for (const [label, tr] of GEMINI_ASPECT_NUMERIC) {
    const d = Math.abs(Math.log(r) - Math.log(tr));
    if (d < bestD) {
      bestD = d;
      best = label;
    }
  }
  return best;
}

// Gemini 图片生成支持的比例
function geminiAspectRatio(size) {
  if (!size || typeof size !== 'string') return '16:9';
  const s = String(size).trim().toLowerCase().replace(/\s/g, '');
  const ratioSet = new Set(['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '5:4', '4:5', '21:9']);
  if (ratioSet.has(s)) return s;
  const match = s.match(/^(\d+)[x*](\d+)$/);
  if (!match) return '1:1';
  const w = parseInt(match[1], 10);
  const h = parseInt(match[2], 10);
  return closestGeminiAspectRatioFromPixels(w, h);
}

function parseSizeWxHForGemini(size) {
  const match = String(size || '').trim().toLowerCase().replace(/\s/g, '').match(/^(\d+)[x*](\d+)$/);
  if (!match) return null;
  const w = parseInt(match[1], 10);
  const h = parseInt(match[2], 10);
  if (!w || !h) return null;
  return { w, h };
}

/**
 * Google 官方 REST：宽高比在 generationConfig.imageConfig.aspectRatio（不是顶层 aspectRatio）。
 * imageSize（1K/2K/4K）见官方文档，仅 gemini-3.x 图生模型支持；2.5 不传。
 */
function buildGeminiImageConfig(aspectRatio, modelName, size) {
  const imageConfig = { aspectRatio };
  const m = String(modelName || '').toLowerCase();
  const supportsImageSize =
    m.includes('gemini-3') || m.includes('3.1-flash-image') || m.includes('3-pro-image');
  if (supportsImageSize) {
    const px = parseSizeWxHForGemini(size);
    const longEdge = px ? Math.max(px.w, px.h) : 0;
    imageConfig.imageSize = longEdge >= 1200 ? '2K' : '1K';
  }
  return imageConfig;
}

async function callGeminiImageApi(db, config, log, opts) {
  const { prompt, model, size, image_gen_id, reference_image_urls, files_base_url, storage_local_path, system_prompt } = opts;
  const apiKey = config.api_key || '';
  const base = (config.base_url || 'https://generativelanguage.googleapis.com').replace(/\/$/, '');
  const modelName = model || 'gemini-2.5-flash-image';
  const aspectRatio = geminiAspectRatio(size);
  const geminiImageConfig = buildGeminiImageConfig(aspectRatio, modelName, size);
  const tStart = Date.now();
  const elapsed = () => `${Date.now() - tStart}ms`;

  log.info('[Gemini图生] ▶ 开始', {
    image_gen_id,
    model: modelName,
    imageConfig: geminiImageConfig,
    base_url: base.slice(0, 60),
    prompt_len: (prompt || '').length,
    raw_ref_count: Array.isArray(reference_image_urls) ? reference_image_urls.length : 0,
  });

  // 读取全局配置，判断参考图传输方式
  const globalCfg = (() => { try { return require('../../config').loadConfig(); } catch (_) { return {}; } })();
  const useImageProxy = !!(globalCfg?.image_proxy?.use_for_gemini);
  log.info('[Gemini图生] 参考图传输方式', { image_gen_id, use_image_proxy: useImageProxy });

  const rawRefs = Array.isArray(reference_image_urls) ? reference_image_urls.filter(Boolean) : [];
  const MAX_GEMINI_REF_IMAGES = 4;

  // 解析 system_prompt 中的每张参考图标签
  const refLabelMap = {};
  if (system_prompt) {
    system_prompt.split('\n').forEach(line => {
      const m = line.match(/^Image\s+(\d+):\s*(.+)/i);
      if (m) refLabelMap[parseInt(m[1], 10) - 1] = m[2].trim();
    });
  }

  // 读取所有参考图（buffer + mimeType）
  const refImageParts = [];
  const TOTAL_REF_LIMIT_BYTES = 10 * 1024 * 1024;
  let totalRefSizeBytes = 0;
  for (let i = 0; i < rawRefs.slice(0, MAX_GEMINI_REF_IMAGES).length; i++) {
    const ref = rawRefs[i];
    log.info('[Gemini图生] 参考图 读取中', { image_gen_id, ref_index: i, ref: String(ref).slice(0, 80), elapsed: elapsed() });
    const tRead = Date.now();

    const resolved = resolveImageRef(ref, files_base_url, storage_local_path);
    if (!resolved) {
      log.warn('[Gemini图生] 参考图 无法解析，跳过', { image_gen_id, ref_index: i, ref: String(ref).slice(0, 80) });
      continue;
    }

    let imageBuffer, mimeType;
    if (resolved.startsWith('data:')) {
      const m = resolved.match(/^data:([\w/]+);base64,(.+)$/);
      if (!m) { log.warn('[Gemini图生] 参考图 data URL 格式异常，跳过', { image_gen_id, ref_index: i }); continue; }
      mimeType = m[1];
      imageBuffer = Buffer.from(m[2], 'base64');
    } else {
      try {
        const imgRes = await fetch(resolved, { method: 'GET' });
        if (!imgRes.ok) {
          log.warn('[Gemini图生] 参考图 HTTP 读取失败，跳过', { image_gen_id, ref_index: i, status: imgRes.status, url: resolved.slice(0, 80) });
          continue;
        }
        imageBuffer = Buffer.from(await imgRes.arrayBuffer());
        mimeType = (imgRes.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
      } catch (fetchErr) {
        log.warn('[Gemini图生] 参考图 读取异常，跳过', { image_gen_id, ref_index: i, err: fetchErr.message });
        continue;
      }
    }

    log.info('[Gemini图生] 参考图 读取完成', {
      image_gen_id, ref_index: i, mime: mimeType,
      size_kb: Math.round(imageBuffer.length / 1024),
      read_ms: Date.now() - tRead, elapsed: elapsed(),
    });

    if (imageBuffer.length > 10 * 1024 * 1024) {
      log.warn('[Gemini图生] 参考图 超过10MB，跳过', { image_gen_id, ref_index: i, size_mb: (imageBuffer.length / 1024 / 1024).toFixed(1) });
      continue;
    }

    if (imageBuffer.length > 2 * 1024 * 1024) {
      const compressed = await compressImageBuffer(imageBuffer, mimeType, 2048, log);
      imageBuffer = compressed.buffer;
      mimeType = compressed.mimeType;
    }

    if (!useImageProxy) {
      const remaining = TOTAL_REF_LIMIT_BYTES - totalRefSizeBytes;
      if (imageBuffer.length > remaining) {
        const targetKB = Math.max(200, Math.floor(remaining / 1024));
        log.info('[Gemini图生] 参考图 总大小超预算，追加压缩', {
          image_gen_id, ref_index: i,
          current_kb: Math.round(imageBuffer.length / 1024),
          budget_kb: Math.round(remaining / 1024),
          target_kb: targetKB,
        });
        const compressed2 = await compressImageBuffer(imageBuffer, mimeType, targetKB, log);
        imageBuffer = compressed2.buffer;
        mimeType = compressed2.mimeType;
        if (imageBuffer.length > remaining) {
          log.warn('[Gemini图生] 参考图 追加压缩后仍超总预算，跳过', { image_gen_id, ref_index: i });
          continue;
        }
      }
      totalRefSizeBytes += imageBuffer.length;
    }

    let imagePart;
    if (useImageProxy) {
      const cacheKey = buildCacheKey(ref, imageBuffer);
      let fileUri = getProxyCache(db, cacheKey);
      if (fileUri) {
        log.info('[Gemini图生] 参考图 缓存命中（图床）', { image_gen_id, ref_index: i });
      } else {
        log.info('[Gemini图生] 参考图 缓存未命中，上传图床 →', { image_gen_id, ref_index: i, elapsed: elapsed() });
        fileUri = await uploadToImageProxy(imageBuffer, mimeType, log, image_gen_id);
        if (fileUri) {
          setProxyCache(db, cacheKey, fileUri);
        } else {
          log.warn('[Gemini图生] 参考图 上传图床失败，该参考图将跳过', { image_gen_id, ref_index: i, elapsed: elapsed() });
          continue;
        }
      }
      imagePart = { fileData: { fileUri, mimeType } };
    } else {
      imagePart = { inlineData: { mimeType, data: imageBuffer.toString('base64') } };
    }

    refImageParts.push({ label: refLabelMap[i] || null, imagePart });
    log.info('[Gemini图生] 参考图 已处理', { image_gen_id, ref_index: i, has_label: !!refLabelMap[i] });
  }

  // 构建 parts：正确的 Gemini 多模态输入顺序
  const parts = [];
  if (refImageParts.length > 0) {
    parts.push({ text: 'The following are visual reference images. Use them ONLY to maintain character appearance and scene environment consistency. Do NOT reproduce their layout or format.' });
    for (let i = 0; i < refImageParts.length; i++) {
      const { label, imagePart } = refImageParts[i];
      parts.push({ text: label ? `Reference ${i + 1}: ${label}` : `Reference ${i + 1}:` });
      parts.push(imagePart);
    }
    parts.push({ text: `Generate ONE single cinematic storyboard frame (do NOT create a grid or multi-panel layout):\n\n${prompt || ''}` });
  } else {
    parts.push({ text: prompt || '' });
  }

  log.info('[Gemini图生] 参考图处理完毕，准备请求 Gemini API', {
    image_gen_id, parts_count: parts.length, ref_parts: refImageParts.length, elapsed: elapsed(),
  });

  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseModalities: ['IMAGE', 'TEXT'],
      numberOfImages: 1,
      imageConfig: geminiImageConfig,
    },
  };

  const url = `${base}/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  log.info('[Gemini图生] → 发送请求', { image_gen_id, model: modelName, url: url.replace(/key=[^&]+/, 'key=***').slice(0, 120), elapsed: elapsed() });

  const tReq = Date.now();
  let geminiStatus;
  let raw;
  try {
    const out = await postJSONWithTimeout(
      url,
      { 'Content-Type': 'application/json' },
      body,
      IMAGE_HTTP_TIMEOUT_MS,
    );
    geminiStatus = out.statusCode;
    raw = out.raw;
  } catch (e) {
    log.error('[Gemini图生] ✗ 网络错误', { image_gen_id, error: e.message, total_elapsed: elapsed() });
    return { error: 'Gemini 图片生成网络请求失败: ' + e.message };
  }
  log.info('[Gemini图生] ← 收到响应', { image_gen_id, status: geminiStatus, req_ms: Date.now() - tReq, elapsed: elapsed() });

  if (geminiStatus < 200 || geminiStatus >= 300) {
    let errMsg = 'Gemini 图片生成请求失败: ' + geminiStatus;
    try {
      const errJson = JSON.parse(raw);
      const msg = errJson.error?.message || errJson.message;
      if (msg) errMsg += ' - ' + String(msg).slice(0, 200);
    } catch (_) {
      if (raw) errMsg += ' - ' + raw.slice(0, 200);
    }
    log.error('[Gemini图生] ✗ API错误', { image_gen_id, status: geminiStatus, body: raw.slice(0, 400), total_elapsed: elapsed() });
    return { error: errMsg };
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    log.error('[Gemini图生] ✗ 响应 JSON 解析失败', { image_gen_id, raw_preview: raw.slice(0, 300), total_elapsed: elapsed() });
    return { error: 'Gemini 图片生成返回格式异常' };
  }

  // 从 candidates → content → parts 中找 inlineData（图片）
  const candidates = data?.candidates || [];
  for (const candidate of candidates) {
    for (const part of candidate?.content?.parts || []) {
      if (part.inlineData?.data) {
        const mimeType = part.inlineData.mimeType || 'image/png';
        const dataUrl = `data:${mimeType};base64,${part.inlineData.data}`;
        log.info('[Gemini图生] ✓ 成功', { image_gen_id, model: modelName, mime: mimeType, total_elapsed: elapsed() });
        return { image_url: dataUrl };
      }
    }
  }

  log.warn('[Gemini图生] ✗ 响应中无图片内容', { image_gen_id, candidates_count: candidates.length, raw_preview: raw.slice(0, 500), total_elapsed: elapsed() });
  return { error: 'Gemini 未返回图片内容，请检查模型名称或 API Key 权限' };
}

module.exports = { callGeminiImageApi };
