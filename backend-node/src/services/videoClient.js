/**
 * videoClient.js — 薄门面（facade）
 *
 * 仅保留路由逻辑（callVideoApi / pollVideoTask），具体 provider 实现在 videoProviders/ 目录。
 * 对外导出签名不变：getDefaultVideoConfig, callVideoApi, pollVideoTask, normalizeAspectRatioForApi
 */
const fs = require('fs');
const path = require('path');

// ── shared ──
const {
  resolveVideoProtocol,
  getDefaultVideoConfig,
  buildVideoUrl,
  buildQueryUrl,
  getModelFromConfig,
  pickProxyVideoUrl,
  videoUrlFromRecord,
  normalizeAspectRatioForApi,
} = require('./videoProviders/shared');

// ── providers ──
const { callKlingOmniVideoApi, applyKlingOmniEnvOverrides, resolveKlingOmniBaseUrl, resolveKlingOmniBearerToken, resolveKlingOmniQueryPathTemplate, parseKlingOmniPollVideoUrl } = require('./videoProviders/klingOmni');
const { callKlingVideoApi } = require('./videoProviders/kling');
const { callVolcengineOmniVideoApi, normalizeVolcModel } = require('./videoProviders/volcengineOmni');
const { callDashScopeVideoApi, parseDashScopeVideoUrl } = require('./videoProviders/dashscope');
const { callGeminiVideoApi } = require('./videoProviders/gemini');
const { callViduVideoApi } = require('./videoProviders/vidu');
const { callVeo3VideoApi } = require('./videoProviders/veo3');
const { callSoraVideoApi } = require('./videoProviders/sora');
const { callJimengAiApiVideo } = require('./videoProviders/jimeng');
const { callXaiVideoApi } = require('./videoProviders/xai');
const { applySeedance2CertifiedAssetUrlsToVideoOpts, VIDEO_PROTOCOLS_SUPPORT_SD2_ASSET_SCHEME } = require('./videoProviders/sd2Assets');

/**
 * 调用视频生成 API（ChatFire/即梦 等 各种后端）
 * @returns {Promise<{ task_id?: string, video_url?: string, error?: string }>}
 */
async function callVideoApi(db, log, opts) {
  const { prompt, model: preferredModel, duration, aspect_ratio, resolution, seed, camera_fixed, watermark, image_url, video_gen_id } = opts;
  const config = getDefaultVideoConfig(db, preferredModel);
  if (!config) {
    throw new Error('未找到可用的AI 配置（请确保 video 类型已激活）');
  }
  const model = getModelFromConfig(config, preferredModel);
  const provider = (config.provider || '').toLowerCase();
  const protocol = resolveVideoProtocol(config, preferredModel);

  if (db && opts.drama_id && VIDEO_PROTOCOLS_SUPPORT_SD2_ASSET_SCHEME.has(protocol)) {
    opts = applySeedance2CertifiedAssetUrlsToVideoOpts(db, log, opts);
  } else if (db && opts.drama_id && log?.info) {
    log.info('[视频][SD2认证图] 当前协议不替换为 asset://（避免与 multipart 等不兼容）', {
      video_gen_id: opts.video_gen_id,
      protocol,
    });
  }

  log.info('[视频] 路由协议', {
    video_gen_id,
    provider,
    api_protocol_raw: config.api_protocol || '(empty→auto)',
    protocol_used: protocol,
    model,
    endpoint: config.endpoint || '(auto)',
  });

  log.info('[视频] 参考图 URL 摘要（脱敏/截断）', {
    video_gen_id: opts.video_gen_id,
    drama_id: opts.drama_id || null,
    image_url_head: opts.image_url ? String(opts.image_url).slice(0, 120) : null,
    first_frame_head: opts.first_frame_url ? String(opts.first_frame_url).slice(0, 120) : null,
    last_frame_head: opts.last_frame_url ? String(opts.last_frame_url).slice(0, 120) : null,
    reference_preview: Array.isArray(opts.reference_urls)
      ? opts.reference_urls.map((u) => String(u || '').slice(0, 100))
      : null,
  });

  if (protocol === 'jimeng_ai_api') {
    return callJimengAiApiVideo(config, log, {
      prompt,
      model: preferredModel,
      duration: opts.duration,
      aspect_ratio,
      resolution: opts.resolution,
      image_url: opts.image_url,
      first_frame_url: opts.first_frame_url,
      last_frame_url: opts.last_frame_url,
      reference_urls: opts.reference_urls,
      files_base_url: opts.files_base_url,
      storage_local_path: opts.storage_local_path,
      video_gen_id: opts.video_gen_id,
    });
  }

  if (protocol === 'xai') {
    return callXaiVideoApi(config, log, {
      prompt,
      model,
      duration: opts.duration,
      aspect_ratio,
      resolution: opts.resolution,
      image_url: opts.image_url,
      reference_urls: opts.reference_urls,
      files_base_url: opts.files_base_url,
      storage_local_path: opts.storage_local_path,
      video_gen_id: opts.video_gen_id,
    });
  }

  if (protocol === 'dashscope') {
    return callDashScopeVideoApi(config, log, {
      prompt,
      model,
      image_url: opts.image_url,
      first_frame_url: opts.first_frame_url,
      last_frame_url: opts.last_frame_url,
      reference_urls: opts.reference_urls,
      duration: opts.duration,
      files_base_url: opts.files_base_url,
      storage_local_path: opts.storage_local_path,
      video_gen_id: opts.video_gen_id,
    });
  }

  if (protocol === 'gemini') {
    return callGeminiVideoApi(config, log, {
      prompt, model,
      duration: opts.duration,
      aspect_ratio,
      image_url: opts.image_url,
      video_gen_id: opts.video_gen_id,
      files_base_url: opts.files_base_url,
      storage_local_path: opts.storage_local_path,
    });
  }

  if (protocol === 'vidu') {
    return callViduVideoApi(config, log, {
      prompt, model,
      duration: opts.duration,
      aspect_ratio,
      image_url: opts.image_url,
      video_gen_id: opts.video_gen_id,
      files_base_url: opts.files_base_url,
      storage_local_path: opts.storage_local_path,
    });
  }

  if (protocol === 'kling') {
    return callKlingVideoApi(config, log, {
      prompt, model,
      duration: opts.duration,
      aspect_ratio,
      image_url: opts.image_url,
      files_base_url: opts.files_base_url,
      storage_local_path: opts.storage_local_path,
      video_gen_id: opts.video_gen_id,
    });
  }

  if (protocol === 'kling_omni') {
    return callKlingOmniVideoApi(applyKlingOmniEnvOverrides(config), log, {
      prompt,
      model,
      duration: opts.duration,
      aspect_ratio,
      image_url: opts.image_url,
      reference_urls: opts.reference_urls,
      files_base_url: opts.files_base_url,
      storage_local_path: opts.storage_local_path,
      video_gen_id: opts.video_gen_id,
    });
  }

  if (protocol === 'volcengine_omni') {
    return callVolcengineOmniVideoApi(config, log, {
      prompt,
      model,
      duration: opts.duration,
      aspect_ratio,
      resolution: opts.resolution,
      seed: opts.seed,
      camera_fixed: opts.camera_fixed,
      watermark: opts.watermark,
      image_url: opts.image_url,
      reference_urls: opts.reference_urls,
      files_base_url: opts.files_base_url,
      storage_local_path: opts.storage_local_path,
      video_gen_id: opts.video_gen_id,
    });
  }

  // Veo3 protocol (api_protocol = 'veo3')
  if (protocol === 'veo3') {
    return callVeo3VideoApi(config, log, {
      prompt, model,
      image_url: opts.image_url,
      storage_local_path: opts.storage_local_path,
      video_gen_id: opts.video_gen_id,
    });
  }

  // Sora protocol (api_protocol = 'sora')
  if (protocol === 'sora') {
    return callSoraVideoApi(config, log, {
      prompt, model,
      duration: opts.duration,
      aspect_ratio,
      image_url: opts.image_url,
      resolution: opts.resolution,
      files_base_url: opts.files_base_url,
      storage_local_path: opts.storage_local_path,
      video_gen_id: opts.video_gen_id,
    });
  }

  const url = buildVideoUrl(config);
  const dur = duration ? Number(duration) : 5;
  const ratio = aspect_ratio || '16:9';

  const isVolc = protocol === 'volcengine';
  // 方舟模型名：需要映射为 API 可用的 ID
  const finalModel = isVolc ? normalizeVolcModel(model) : model;
  const hasImage = !!(image_url && image_url.trim());
  // 方舟 doubao-seedance-1-5-pro 等 r2v 模式需要指定 task_type 为 i2v 而非 reference_image（r2v）
  const volcTaskType = isVolc ? (hasImage ? 'i2v' : 't2v') : null;

  // 针对火山引擎 (Doubao) 修正 duration：只支持 5 或 10 秒
  // 若传入非标准值（如 3, 4, 8 等），自动吸附到最近的有效值
  let effectiveDuration = dur;
  if (isVolc) {
    if (effectiveDuration <= 7) effectiveDuration = 5;
    else effectiveDuration = 10;
    if (effectiveDuration !== dur) {
      log.info('Adjusted duration for Volcengine', { original: dur, adjusted: effectiveDuration, video_gen_id });
    }
  }

  // 处理 localhost URL → 转 base64（DashScope 等需要）
  let imageUrlForApi = image_url && image_url.trim();
  if (
    hasImage &&
    imageUrlForApi &&
    !String(imageUrlForApi).startsWith('asset://') &&
    (opts.files_base_url || '').match(/localhost|127\.0\.0\.1/i) &&
    opts.storage_local_path
  ) {
    const baseUrl = (opts.files_base_url || '').replace(/\/$/, '');
    const afterStatic = imageUrlForApi.split('/static/')[1] || (baseUrl ? imageUrlForApi.replace(baseUrl + '/', '').replace(baseUrl, '') : null);
    const relPath = afterStatic ? afterStatic.replace(/^\//, '') : null;
    if (relPath) {
      const filePath = path.join(opts.storage_local_path, relPath);
      try {
        if (fs.existsSync(filePath)) {
          const buf = fs.readFileSync(filePath);
          const ext = path.extname(filePath).toLowerCase();
          const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.bmp': 'image/bmp' }[ext] || 'image/png';
          imageUrlForApi = 'data:' + mime + ';base64,' + buf.toString('base64');
        }
      } catch (e) { log.warn('File operation failed', { error: e.message }) }
    }
  }

  // ratio/duration 等字段名视中转/ChatFire 协议而定
  const body = {
    model: finalModel,
    content: [{ type: 'text', text: prompt || '' }],
    ratio,
    duration: effectiveDuration,
    watermark: (watermark != null) ? Boolean(watermark) : false,
  };
  if (resolution) body.resolution = resolution;
  if (seed != null) body.seed = Number(seed);
  if (camera_fixed != null) body.camera_fixed = Boolean(camera_fixed);
  if (volcTaskType) body.task_type = volcTaskType;
  if (hasImage && imageUrlForApi) {
    const imagePart = { type: 'image_url', image_url: { url: imageUrlForApi } };
    imagePart.role = volcTaskType === 'i2v' ? 'first_frame' : 'reference_image';
    body.content.push(imagePart);
  }

  log.info('Video API request', {
    url,
    model,
    video_gen_id,
    task_type: body.task_type,
    request_body: JSON.stringify({ ...body, content: body.content?.map(c => c.type === 'image_url' ? { ...c, image_url: { url: '(omitted)' } } : c) }),
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
  log.info('Video API raw response', { video_gen_id, status: res.status, raw: raw.slice(0, 1000) });
  if (!res.ok) {
    log.error('Video API failed', { status: res.status, body: raw.slice(0, 500) });
    let errMsg = '视频生成失败: ' + res.status;
    try {
      const errJson = JSON.parse(raw);
      const msg = errJson.error?.message || errJson.message || errJson.error;
      if (msg) errMsg += ' - ' + (typeof msg === 'string' ? msg : JSON.stringify(msg).slice(0, 200));
    } catch (_) { // JSON.parse — 静默回退
      if (raw && raw.length) errMsg += ' - ' + raw.slice(0, 200);
    }
    return { error: errMsg };
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    log.error('Video API response JSON parse failed', { video_gen_id, raw: raw.slice(0, 1000), parse_error: e.message });
    return { error: '视频响应格式错误: ' + e.message + ' | raw: ' + raw.slice(0, 200) };
  }
  log.info('Video API parsed response', { video_gen_id, data: JSON.stringify(data).slice(0, 500) });
  const taskId = data.id || data.task_id || (data.data && data.data.id);
  const status = data.status || (data.data && data.data.status);
  const videoUrl = pickProxyVideoUrl(data);
  if (videoUrl) {
    log.info('Video API returned video_url directly', { video_gen_id, video_url: videoUrl });
    return { video_url: videoUrl };
  }
  if (taskId) {
    log.info('Video API returned task_id', { video_gen_id, task_id: taskId, status });
    return { task_id: taskId, status: status || 'processing' };
  }
  log.error('Video API: no task_id or video_url in response', { video_gen_id, data: JSON.stringify(data).slice(0, 500) });
  return { error: '无 task_id 或 video_url（原始响应）: ' + JSON.stringify(data).slice(0, 300) };
}

/**
 * 轮询异步视频任务（即梦 / ChatFire / 方舟 / DashScope 等）。
 * 默认约 30 分钟（每 10 秒一轮）；可由调用方传入 maxAttempts、intervalMs 覆盖。
 */
async function pollVideoTask(db, log, videoGenId, taskId, config, maxAttempts = 180, intervalMs = 10000) {
  const provider = (config.provider || '').toLowerCase();
  const protocol = resolveVideoProtocol(config);
  const isDashScope = protocol === 'dashscope';
  const isGemini = protocol === 'gemini';
  const isVidu = protocol === 'vidu';
  const isSora = protocol === 'sora';
  const isKling = protocol === 'kling';
  const isKlingOmni = protocol === 'kling_omni' || (typeof taskId === 'string' && taskId.startsWith('omni:'));
  const isVeo3 = protocol === 'veo3';
  /** 轮询日志里响应体最大字符数（即梦/方舟等 JSON 可能较长）；0 表示不截断（慎用） */
  const pollLogBodyMax = (() => {
    const v = String(process.env.VIDEO_POLL_LOG_MAX || '16384').trim();
    if (v === '0' || v.toLowerCase() === 'full') return Infinity;
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? Math.min(n, 512 * 1024) : 16384;
  })();
  const isVolcPoll =
    provider === 'volces' ||
    provider === 'volcengine' ||
    provider === 'volc' ||
    protocol === 'volcengine' ||
    protocol === 'volcengine_omni';
  if (protocol === 'jimeng_ai_api') {
    log.warn('[poll] Jimeng AI API 不应进入轮询', { video_gen_id: videoGenId, task_id: taskId });
    return { error: 'Jimeng AI API 为同步返回视频地址，不应进入轮询' };
  }
  const queryUrl = () => buildQueryUrl(config, taskId);
  log.info('[poll] 开始轮询', { video_gen_id: videoGenId, task_id: taskId, protocol, poll_url: queryUrl() });
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((r) => setTimeout(r, intervalMs));
    try {
      let url, headers;
      if (isKling) {
        // task_id 编码格式：`t2v:xxx` / `i2v:xxx` / `mc:xxx`
        const klingBase = (config.base_url || 'https://api.klingai.com').replace(/\/$/, '');
        let actualTaskId = taskId;
        let videoType = 'text2video';
        if (taskId.startsWith('i2v:')) { actualTaskId = taskId.slice(4); videoType = 'image2video'; }
        else if (taskId.startsWith('t2v:')) { actualTaskId = taskId.slice(4); videoType = 'text2video'; }
        else if (taskId.startsWith('mc:'))  { actualTaskId = taskId.slice(3); videoType = 'motion-control'; }
        // 若用户配置了 query_endpoint，优先使用
        let qep = config.query_endpoint || `/v1/videos/${videoType}/{taskId}`;
        qep = String(qep).replace(/\{taskId\}/gi, encodeURIComponent(actualTaskId)).replace(/\{task_id\}/gi, encodeURIComponent(actualTaskId)).replace(/\{id\}/gi, encodeURIComponent(actualTaskId));
        if (!qep.startsWith('/')) qep = '/' + qep;
        url = klingBase + qep;
        headers = { Authorization: 'Bearer ' + (config.api_key || '') };
      } else if (isKlingOmni) {
        const cfgOmni = applyKlingOmniEnvOverrides(config);
        const omniBase = resolveKlingOmniBaseUrl(cfgOmni);
        let actualId = String(taskId);
        if (actualId.startsWith('omni:')) actualId = actualId.slice(5);
        let qep = resolveKlingOmniQueryPathTemplate(cfgOmni, omniBase);
        qep = String(qep)
          .replace(/\{taskId\}/gi, encodeURIComponent(actualId))
          .replace(/\{task_id\}/gi, encodeURIComponent(actualId))
          .replace(/\{id\}/gi, encodeURIComponent(actualId));
        if (!qep.startsWith('/')) qep = '/' + qep;
        url = omniBase + qep;
        const bt = resolveKlingOmniBearerToken(cfgOmni, log);
        headers = bt
          ? { Authorization: bt.startsWith('Bearer ') ? bt : `Bearer ${bt}` }
          : {};
      } else if (isGemini) {
        const base = (config.base_url || 'https://generativelanguage.googleapis.com').replace(/\/$/, '');
        url = `${base}/v1beta/${taskId}`;
        headers = { 'x-goog-api-key': config.api_key || '' };
      } else if (isVidu) {
        const viduBase = (config.base_url || 'https://api.vidu.cn').replace(/\/$/, '');
        const isOfficialVidu = /api\.vidu\.cn/i.test(viduBase);
        const defaultQep = isOfficialVidu ? '/ent/v2/tasks/{taskId}/creations' : '/ent/v2/tasks/{taskId}/creations';
        let qep = config.query_endpoint || defaultQep;
        qep = String(qep).replace(/\{taskId\}/gi, encodeURIComponent(taskId)).replace(/\{task_id\}/gi, encodeURIComponent(taskId)).replace(/\{id\}/gi, encodeURIComponent(taskId));
        if (!qep.startsWith('/')) qep = '/' + qep;
        url = viduBase + qep;
        headers = { Authorization: (isOfficialVidu ? 'Token ' : 'Bearer ') + (config.api_key || '') };
      } else {
        url = queryUrl();
        headers = { Authorization: 'Bearer ' + (config.api_key || '') };
      }
      const pollRound = attempt + 1;
      log.info('[poll] 发起查询', { video_gen_id: videoGenId, round: pollRound, url });
      const res = await fetch(url, { method: 'GET', headers });
      const raw = await res.text();
      const bodyLogged =
        pollLogBodyMax === Infinity
          ? raw
          : raw.length <= pollLogBodyMax
            ? raw
            : raw.slice(0, pollLogBodyMax) + `\n... [poll 响应已截断 前${pollLogBodyMax}字符 / 共${raw.length}字符，可设环境变量 VIDEO_POLL_LOG_MAX=0 输出全文]`;
      log.info('[poll] 查询 HTTP 结果', {
        video_gen_id: videoGenId,
        round: pollRound,
        http_status: res.status,
        bytes: raw.length,
        body: bodyLogged,
      });
      if (!res.ok) {
        log.warn('[poll] 查询非 2xx', {
          video_gen_id: videoGenId,
          round: pollRound,
          http_status: res.status,
          body: bodyLogged.slice(0, 4000),
        });
        continue;
      }
      let data;
      try {
        data = JSON.parse(raw);
      } catch (parseErr) {
        log.warn('[poll] 响应非 JSON', {
          video_gen_id: videoGenId,
          round: pollRound,
          error: parseErr.message,
          body_head: raw.slice(0, 800),
        });
        continue;
      }

      if (isKling) {
        if (data.code !== undefined && data.code !== 0) {
          const msg = data.message || `可灵错误码: ${data.code}`;
          log.warn('[Kling poll] API 错误', { video_gen_id: videoGenId, code: data.code, msg });
          return { error: msg };
        }
        const status = (data?.data?.task_status || '').toLowerCase();
        log.info('[Kling poll] 状态', { video_gen_id: videoGenId, attempt, status, task_id: taskId });
        if (status === 'succeed') {
          const videoUrl = data?.data?.task_result?.videos?.[0]?.url;
          if (videoUrl) {
            log.info('[Kling poll] 视频生成完成', { video_gen_id: videoGenId, video_url: videoUrl });
            return { video_url: videoUrl };
          }
          return { error: '可灵任务完成但未返回视频地址' };
        }
        if (status === 'failed') {
          const errMsg = data?.data?.task_status_msg || '任务失败';
          log.warn('[Kling poll] 任务失败', { video_gen_id: videoGenId, error: errMsg });
          return { error: '可灵视频生成失败: ' + errMsg };
        }
        // submitted / processing → 继续轮询
        continue;
      }

      if (isKlingOmni) {
        if (data.code !== undefined && Number(data.code) !== 0) {
          const msg = data.message || data.msg || `Kling Omni 错误码 ${data.code}`;
          log.warn('[KlingOmni poll] API 错误', { video_gen_id: videoGenId, code: data.code, msg });
          return { error: msg };
        }
        const st = (data?.data?.task_status || data?.task_status || data?.status || '').toLowerCase();
        const videoUrlOmni = parseKlingOmniPollVideoUrl(data);
        log.info('[KlingOmni poll] 状态', { video_gen_id: videoGenId, attempt, status: st, has_url: !!videoUrlOmni });
        if (videoUrlOmni) {
          log.info('[KlingOmni poll] 完成', { video_gen_id: videoGenId });
          return { video_url: videoUrlOmni };
        }
        if (st === 'succeed' || st === 'success' || st === 'completed' || st === 'succeeded' || st === 'done') {
          return { error: 'Kling Omni 标记完成但未解析到视频地址' };
        }
        if (st === 'failed' || st === 'error') {
          const errMsg = data?.data?.task_status_msg || data?.task_status_msg || data?.message || '任务失败';
          return { error: 'Kling Omni: ' + String(errMsg).slice(0, 400) };
        }
        continue;
      }

      if (isVeo3) {
        const status = (data.status || data.data?.status || data.task_status || '').toLowerCase();
        log.info('[Veo3 poll] task status', { video_gen_id: videoGenId, attempt, status, id: data.task_id || data.id });
        if (status === 'failed' || status === 'error') {
          const msg = data.error?.message || data.error || data.message || data.data?.error || 'Veo3 task failed';
          log.warn('[Veo3 poll] task failed', { video_gen_id: videoGenId, msg });
          return { error: String(msg) };
        }
        const videoUrl = pickProxyVideoUrl(data);
        if (videoUrl) {
          log.info('[Veo3 poll] video completed', { video_gen_id: videoGenId, video_url: videoUrl });
          return { video_url: videoUrl };
        }
        if (status === 'succeeded' || status === 'completed' || status === 'done') {
          log.warn('[Veo3 poll] completed but no video_url', { data: JSON.stringify(data).slice(0, 500) });
          return { error: 'Veo3 completed but no video URL: ' + JSON.stringify(data).slice(0, 300) };
        }
        continue;
      }

      if (isSora) {
        const status = (data.status || '').toLowerCase();
        log.info('[Sora poll] 轮询状态', { video_gen_id: videoGenId, attempt, status, progress: data.progress, id: data.id });
        if (status === 'failed' || status === 'error') {
          const msg = data.error?.message || data.error || data.message || 'Sora 任务失败';
          log.warn('[Sora poll] 任务失败', { video_gen_id: videoGenId, msg, data: JSON.stringify(data).slice(0, 300) });
          return { error: String(msg) };
        }
        // succeeded / completed / done → 尝试解析视频 URL
        const videoUrl = pickProxyVideoUrl(data);
        if (videoUrl) {
          log.info('[Sora poll] 视频完成', { video_gen_id: videoGenId, video_url: videoUrl });
          return { video_url: videoUrl };
        }
        if (status === 'succeeded' || status === 'completed' || status === 'done') {
          log.warn('[Sora poll] 标记完成但无 video_url', { video_gen_id: videoGenId, data: JSON.stringify(data).slice(0, 500) });
          return { error: 'Sora 标记完成但未解析到视频地址（原始响应）: ' + JSON.stringify(data).slice(0, 300) };
        }
        // queued / processing / running → 继续轮询
        continue;
      }

      if (isVidu) {
        const state = (data?.state || data?.status || data?.data?.status || '').toLowerCase();
        log.info('[Vidu poll] 轮询状态', { video_gen_id: videoGenId, attempt, state, id: taskId });
        if (state === 'failed' || state === 'error') {
          const msg = data?.err_code || data?.message || data?.error?.message || data?.error || 'Vidu 任务失败';
          log.warn('[Vidu poll] 任务失败', { video_gen_id: videoGenId, msg });
          return { error: String(msg) };
        }
        // Vidu ent/v2 查询：成功时 creations[0].url
        // 兼容各种可能字段：succeeded/completed/done → video_url/url 等
        const videoUrl =
          data?.creations?.[0]?.url ||
          videoUrlFromRecord(data?.creations?.[0]) ||
          pickProxyVideoUrl(data);
        if (videoUrl) {
          log.info('[Vidu poll] 视频完成', { video_gen_id: videoGenId, video_url: videoUrl });
          return { video_url: videoUrl };
        }
        if (state === 'success' || state === 'succeeded' || state === 'completed' || state === 'done') {
          log.warn('[Vidu poll] 标记成功但无 video_url', { data: JSON.stringify(data).slice(0, 500) });
          return { error: 'Vidu 标记成功但无视频地址' };
        }
        continue;
      }

      if (isGemini) {
        if (data.error) {
          return { error: data.error.message || 'Gemini 操作出错' };
        }
        if (data.done === true) {
          const videoUri = data.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
          if (videoUri) return { video_url: videoUri };
          return { error: 'Gemini 完成但无视频内容' };
        }
        continue;
      }

      if (isDashScope) {
        const taskStatus = data?.output?.task_status;
        const videoUrl = parseDashScopeVideoUrl(data);
        if (videoUrl) return { video_url: videoUrl };
        if (taskStatus === 'FAILED' || taskStatus === 'CANCELED') {
          const msg = data?.message || data?.output?.message || taskStatus;
          log.warn('DashScope 任务失败（可能是 download image failed，检查 URL 是否指向 localhost）', {
            video_gen_id: videoGenId,
            task_id: taskId,
            task_status: taskStatus,
            message: msg,
            output: data?.output,
          });
          return { error: msg || '视频生成失败' };
        }
        continue;
      }
      const inner = data.data && typeof data.data === 'object' && !Array.isArray(data.data) ? data.data : null;
      const innerTask =
        inner && inner.data && typeof inner.data === 'object' && !Array.isArray(inner.data) ? inner.data : null;
      const statusRaw = data.status || inner?.status || innerTask?.status || '';
      const statusNorm = String(statusRaw || '').toLowerCase();
      const videoUrl = pickProxyVideoUrl(data);
      const errMsg =
        (data.error && (typeof data.error === 'string' ? data.error : data.error.message)) ||
        (inner && inner.fail_reason && String(inner.fail_reason).trim()) ||
        (innerTask?.error &&
          (typeof innerTask.error === 'string' ? innerTask.error : innerTask.error.message)) ||
        null;
      const isTerminalFailure =
        statusNorm === 'failed' ||
        statusNorm === 'failure' ||
        statusNorm === 'error' ||
        statusNorm === 'cancelled' ||
        statusNorm === 'canceled';
      if (isVolcPoll) {
        const summaryJson = JSON.stringify(data);
        const sum =
          pollLogBodyMax === Infinity
            ? summaryJson
            : summaryJson.length <= pollLogBodyMax
              ? summaryJson
              : summaryJson.slice(0, pollLogBodyMax) + `... [共${summaryJson.length}字符]`;
        log.info('[poll] 方舟/火山 解析摘要', {
          video_gen_id: videoGenId,
          round: pollRound,
          top_level_status: statusRaw,
          has_video_url: !!videoUrl,
          error_hint: errMsg || data?.error?.code || data?.message || innerTask?.error?.code || null,
          parsed_json: sum,
        });
      }
      if (isTerminalFailure) {
        return { error: errMsg || String(statusRaw || '') || '任务失败' };
      }
      if (videoUrl) return { video_url: videoUrl };
    } catch (e) {
      log.warn('Video poll request failed', { attempt, error: e.message });
    }
  }
  return { error: '视频生成轮询超时' };
}

module.exports = {
  getDefaultVideoConfig,
  callVideoApi,
  pollVideoTask,
  normalizeAspectRatioForApi,
};
