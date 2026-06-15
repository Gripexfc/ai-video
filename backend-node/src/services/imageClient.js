/**
 * imageClient.js — 薄门面（facade）
 *
 * 仅保留路由逻辑（callImageApi）和业务流程（createAndGenerateImage），
 * 具体 provider 实现在 imageProviders/ 目录。
 * 对外导出签名不变：getDefaultImageConfig, callImageApi, createAndGenerateImage,
 *   resolveAssetUserNegativeForApi, getProxyCache, setProxyCache
 */
const path = require('path');

// ── shared ──
const {
  ANTI_SPLIT_NEGATIVE_PROMPT,
  mergeNegativePromptFragments,
  resolveAssetUserNegativeForApi,
  getDefaultImageConfig,
  getModelFromConfig,
  inferProtocol,
  getProxyCache,
  setProxyCache,
} = require('./imageProviders/shared');

// ── providers ──
const { callDashScopeImageApi } = require('./imageProviders/dashscope');
const { callNanoBananaImageApi } = require('./imageProviders/nanoBanana');
const { callKlingImageApi } = require('./imageProviders/kling');
const { callGeminiImageApi } = require('./imageProviders/gemini');
const { callOpenAiImageApi } = require('./imageProviders/openai');

// ── 业务依赖 ──
const uploadService = require('./uploadService');
const storageLayout = require('./storageLayout');
const taskService = require('./taskService');
const seedance2AssetGuards = require('../utils/seedance2AssetGuards');

/**
 * 调用提供商图片生成 API（OpenAI /images/generations 风格 或 通义万象 multimodal-generation）
 * @param {object} db - database
 * @param {object} log - logger
 * @param {object} opts - { prompt, model?, size?, quality?, drama_id, preferred_provider?, character_id?, image_type?, image_gen_id, user_negative_prompt? }
 * @returns {Promise<{ image_url?: string, error?: string }>}
 */
async function callImageApi(db, log, opts) {
  const {
    prompt,
    model: preferredModel,
    size,
    quality,
    drama_id,
    preferred_provider,
    character_id,
    image_type,
    image_gen_id,
    imageServiceType,
    reference_image_urls,
    files_base_url,
    storage_local_path,
    system_prompt,
    user_negative_prompt,
  } = opts;
  const preferredProvider = preferred_provider ?? opts.preferredProvider;
  const config = getDefaultImageConfig(db, preferredModel, preferredProvider, imageServiceType);
  if (!config) {
    throw new Error('未配置图片模型，请在「AI 配置」中添加 image 类型且已启用的配置');
  }
  const model = getModelFromConfig(config, preferredModel);
  const provider = (config.provider || '').toLowerCase();
  // api_protocol 显式指定接口规范，优先级高于 provider 推断；未设置时按 provider 自动判断
  const protocol = (config.api_protocol || '').toLowerCase() || inferProtocol(provider, model);

  // ── 参考图标签注入：为所有非 Gemini 模型将标签注入 prompt 文本 ─────────────────────────────
  // Gemini 通过 parts 结构处理（interleaved text+image），不需要文字注入。
  // 其他所有模型（Doubao/DashScope/NanoBanana/OpenAI-compat 等）通过文字告知模型各参考图用途，
  // 避免模型模仿参考图的宫格/四视图布局，同时抑制生成分割画面。
  let effectivePrompt = prompt || '';
  if (
    protocol !== 'gemini' &&
    Array.isArray(reference_image_urls) && reference_image_urls.length > 0 &&
    system_prompt
  ) {
    const refLines = String(system_prompt).split('\n').filter(l => /^Image\s+\d+:/i.test(l));
    if (refLines.length > 0) {
      const refHeader = refLines
        .map(l => `[${l} — FOR REFERENCE ONLY, DO NOT copy its layout or framing]`)
        .join('\n');
      effectivePrompt = `${refHeader}\n\n[GENERATE THIS SCENE — single continuous image, no grid, no split panels]:\n${effectivePrompt}`;
    }
  }

  log.info('[图生] callImageApi 路由', {
    image_gen_id,
    protocol,
    api_protocol_raw: config.api_protocol || '(empty→auto)',
    provider,
    model,
    size,
    imageServiceType,
    ref_count: Array.isArray(opts.reference_image_urls) ? opts.reference_image_urls.length : 0,
    ref_label_injected: effectivePrompt !== (prompt || ''),
    effectivePrompt
  });

  // 多参考图时统一生成 negative_prompt（供各子函数使用）
  const refCountForNeg = Array.isArray(opts.reference_image_urls) ? opts.reference_image_urls.filter(Boolean).length : 0;
  // Seedream/Volcengine 模型强制启用安全词负面提示，其他模型仅在多参考图时启用
  const isVolcOrSeedream = (protocol === 'volcengine' || /seedream|doubao/i.test(model));
  const autoNegativePrompt = (refCountForNeg > 1 || isVolcOrSeedream) ? ANTI_SPLIT_NEGATIVE_PROMPT : '';
  const userNegFragment = (user_negative_prompt && String(user_negative_prompt).trim()) || '';
  const mergedNegativePrompt = mergeNegativePromptFragments(autoNegativePrompt, userNegFragment);

  if (protocol === 'dashscope') {
    return callDashScopeImageApi(config, log, {
      prompt: effectivePrompt, model, size, image_gen_id,
      reference_image_urls: opts.reference_image_urls,
      files_base_url: opts.files_base_url,
      storage_local_path: opts.storage_local_path,
      negative_prompt: mergedNegativePrompt,
    });
  }

  if (protocol === 'nano_banana') {
    return callNanoBananaImageApi(config, log, {
      prompt: effectivePrompt, model, size, image_gen_id,
      reference_image_urls: opts.reference_image_urls,
      files_base_url: opts.files_base_url,
      storage_local_path: opts.storage_local_path,
    });
  }

  if (protocol === 'kling') {
    return callKlingImageApi(config, log, {
      prompt: effectivePrompt, model, size, image_gen_id,
      reference_image_urls: opts.reference_image_urls,
      files_base_url: opts.files_base_url,
      storage_local_path: opts.storage_local_path,
    });
  }

  if (protocol === 'gemini') {
    return callGeminiImageApi(db, config, log, {
      prompt, model, size, image_gen_id,          // Gemini 用原始 prompt，不注入文字标签
      reference_image_urls: opts.reference_image_urls,
      files_base_url: opts.files_base_url,
      storage_local_path: opts.storage_local_path,
      system_prompt: opts.system_prompt,
    });
  }

  // 默认：OpenAI-compatible（含 volcengine / doubao-seedream）
  const isVolc = protocol === 'volcengine';
  const isSeedream = isVolc || /seedream|doubao/i.test(model);
  return callOpenAiImageApi(config, log, {
    prompt: effectivePrompt,
    model,
    size,
    quality,
    image_gen_id,
    reference_image_urls: opts.reference_image_urls,
    files_base_url: opts.files_base_url,
    storage_local_path: opts.storage_local_path,
    is_volcengine: isVolc,
    is_seedream: isSeedream,
    merged_negative_prompt: mergedNegativePrompt,
  });
}

/**
 * 创建 image_generation 记录并异步调用 API，完成后更新记录与角色 image_url。
 * 与场景图一致：创建 task 并写入 task_id，便于前端轮询 /tasks/:task_id 获知完成或报错。
 */
function createAndGenerateImage(db, log, opts) {
  const {
    drama_id,
    character_id,
    scene_id,
    image_type,
    prompt,
    model,
    size,
    quality,
    provider,
    user_negative_prompt,
  } = opts;
  const negRow = (user_negative_prompt && String(user_negative_prompt).trim()) || null;
  const now = new Date().toISOString();
  const dramaIdNum = Number(drama_id) || 0;
  const charIdNum = character_id != null ? Number(character_id) : null;
  const sceneIdNum = scene_id != null ? Number(scene_id) : null;

  let resourceId;
  if (charIdNum != null) resourceId = `character_${charIdNum}`;
  else if (sceneIdNum != null) resourceId = `scene_${sceneIdNum}`;
  else resourceId = String(dramaIdNum);
  const task = taskService.createTask(db, log, 'image_generation', resourceId);
  const taskId = task.id;

  let imageGenId;
  try {
    const info = db.prepare(
      `INSERT INTO image_generations (drama_id, character_id, scene_id, provider, prompt, negative_prompt, model, size, quality, status, task_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`
    ).run(
      dramaIdNum,
      charIdNum,
      sceneIdNum,
      provider || 'openai',
      prompt || '',
      negRow,
      model || null,
      size || null,
      quality || null,
      taskId,
      now,
      now
    );
    imageGenId = info.lastInsertRowid;
  } catch (e) {
    if ((e.message || '').includes('scene_id') || (e.message || '').includes('character_id')) {
      const info = db.prepare(
        `INSERT INTO image_generations (drama_id, provider, prompt, model, size, quality, status, task_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`
      ).run(dramaIdNum, provider || 'openai', prompt || '', model || null, size || null, quality || null, taskId, now, now);
      imageGenId = info.lastInsertRowid;
    } else {
      throw e;
    }
  }

  setImmediate(async () => {
    try {
      db.prepare('UPDATE image_generations SET status = ? WHERE id = ?').run('processing', imageGenId);
      const result = await callImageApi(db, log, {
        prompt,
        model,
        size,
        quality,
        drama_id: drama_id,
        character_id: character_id,
        image_type,
        image_gen_id: imageGenId,
        user_negative_prompt: user_negative_prompt || undefined,
      });
      const now2 = new Date().toISOString();
      if (result.error) {
        db.prepare(
          'UPDATE image_generations SET status = ?, error_msg = ?, updated_at = ? WHERE id = ?'
        ).run('failed', result.error, now2, imageGenId);
        taskService.updateTaskError(db, taskId, result.error);
        if (charIdNum != null) {
          try {
            db.prepare('UPDATE characters SET error_msg = ?, updated_at = ? WHERE id = ?').run(result.error, now2, charIdNum);
          } catch (e) { log.warn('DB update failed', { error: e.message }) }
        }
        if (sceneIdNum != null) {
          try {
            db.prepare('UPDATE scenes SET error_msg = ?, updated_at = ? WHERE id = ?').run(result.error, now2, sceneIdNum);
          } catch (e) { log.warn('DB update failed', { error: e.message }) }
        }
        log.error('Image generation failed', { image_gen_id: imageGenId, error: result.error });
        return;
      }
      let localPath = null;
      try {
        const loadConfig = require('../config').loadConfig;
        const cfg = loadConfig();
        const storagePath = path.isAbsolute(cfg.storage?.local_path)
          ? cfg.storage.local_path
          : path.join(process.cwd(), cfg.storage?.local_path || './data/storage');
        const category = sceneIdNum != null ? 'scenes' : (charIdNum != null ? 'characters' : 'images');
        const projectSubdir = storageLayout.getProjectStorageSubdir(db, dramaIdNum);
        localPath = await uploadService.downloadImageToLocal(
          storagePath,
          result.image_url,
          category,
          log,
          'ig',
          projectSubdir
        );
      } catch (e) { log.warn('Operation failed', { error: e.message }) }
      // 兼容旧库无 completed_at：先试完整 UPDATE，失败则只更新必有列
      try {
        db.prepare(
          'UPDATE image_generations SET status = ?, image_url = ?, local_path = ?, completed_at = ?, updated_at = ? WHERE id = ?'
        ).run('completed', result.image_url, localPath, now2, now2, imageGenId);
      } catch (e) {
        if ((e.message || '').includes('completed_at')) {
          db.prepare(
            'UPDATE image_generations SET status = ?, image_url = ?, local_path = ?, updated_at = ? WHERE id = ?'
          ).run('completed', result.image_url, localPath, now2, imageGenId);
        } else {
          throw e;
        }
      }
      taskService.updateTaskResult(db, taskId, { image_generation_id: imageGenId, image_url: result.image_url, local_path: localPath, status: 'completed' });
      if (charIdNum != null) {
        try {
          // 旧图追加到 extra_images，与上传逻辑保持一致
          const oldChar = db
            .prepare('SELECT local_path, image_url, extra_images, seedance2_asset FROM characters WHERE id = ?')
            .get(charIdNum);
          const oldPath = oldChar?.local_path || oldChar?.image_url || '';
          let extras = [];
          try { extras = oldChar?.extra_images ? JSON.parse(oldChar.extra_images) : []; } catch (_) { /* JSON.parse — 静默回退 */ }
          if (!Array.isArray(extras)) extras = [];
          if (oldPath && !extras.includes(oldPath)) extras.push(oldPath);
          const extraJson = extras.length ? JSON.stringify(extras) : null;
          seedance2AssetGuards.markStaleOnCharacterMainImageDrift(db, log, { ...oldChar, id: charIdNum }, {
            image_url: result.image_url,
            local_path: localPath,
          });
          db.prepare('UPDATE characters SET image_url = ?, local_path = ?, extra_images = ?, updated_at = ? WHERE id = ?').run(
            result.image_url,
            localPath,
            extraJson,
            now2,
            charIdNum
          );
        } catch (e) {
          if ((e.message || '').includes('local_path') || (e.message || '').includes('extra_images')) {
            db.prepare('UPDATE characters SET image_url = ?, updated_at = ? WHERE id = ?').run(result.image_url, now2, charIdNum);
          } else {
            throw e;
          }
        }
        log.info('Character image updated', { character_id: charIdNum, image_url: result.image_url, local_path: localPath });
      }
      if (sceneIdNum != null) {
        try {
          // 旧图追加到 extra_images，与上传逻辑保持一致
          const oldScene = db.prepare('SELECT local_path, image_url, extra_images FROM scenes WHERE id = ?').get(sceneIdNum);
          const oldPath = oldScene?.local_path || oldScene?.image_url || '';
          let extras = [];
          try { extras = oldScene?.extra_images ? JSON.parse(oldScene.extra_images) : []; } catch (_) { /* JSON.parse — 静默回退 */ }
          if (!Array.isArray(extras)) extras = [];
          if (oldPath && !extras.includes(oldPath)) extras.push(oldPath);
          const extraJson = extras.length ? JSON.stringify(extras) : null;
          db.prepare('UPDATE scenes SET image_url = ?, local_path = ?, extra_images = ?, updated_at = ? WHERE id = ?').run(
            result.image_url,
            localPath,
            extraJson,
            now2,
            sceneIdNum
          );
        } catch (e) {
          if ((e.message || '').includes('local_path') || (e.message || '').includes('extra_images')) {
            db.prepare('UPDATE scenes SET image_url = ?, updated_at = ? WHERE id = ?').run(result.image_url, now2, sceneIdNum);
          } else {
            throw e;
          }
        }
        log.info('Scene image updated', { scene_id: sceneIdNum, image_url: result.image_url, local_path: localPath });
      }
      log.info('Image generation completed', { image_gen_id: imageGenId, local_path: localPath });
    } catch (err) {
      const now2 = new Date().toISOString();
      const errMsg = (err && err.message) ? String(err.message).slice(0, 500) : 'Unknown error';
      try {
        db.prepare(
          'UPDATE image_generations SET status = ?, error_msg = ?, updated_at = ? WHERE id = ?'
        ).run('failed', errMsg, now2, imageGenId);
      } catch (e) {
        log.error('Image generation: failed to update image_generations', { image_gen_id: imageGenId, error: e.message });
      }
      try {
        taskService.updateTaskError(db, taskId, errMsg);
      } catch (e) {
        log.error('Image generation: failed to update task status', { task_id: taskId, error: e.message });
      }
      if (charIdNum != null) {
        try {
          db.prepare('UPDATE characters SET error_msg = ?, updated_at = ? WHERE id = ?').run(errMsg, now2, charIdNum);
        } catch (e) { log.warn('DB update failed', { error: e.message }) }
      }
      if (sceneIdNum != null) {
        try {
          db.prepare('UPDATE scenes SET error_msg = ?, updated_at = ? WHERE id = ?').run(errMsg, now2, sceneIdNum);
        } catch (e) { log.warn('DB update failed', { error: e.message }) }
      }
      log.error('Image generation error', { image_gen_id: imageGenId, task_id: taskId, error: err.message });
    }
  });

  const row = db.prepare('SELECT * FROM image_generations WHERE id = ?').get(imageGenId);
  return row ? rowToItem(row) : { id: imageGenId, task_id: taskId, status: 'pending', drama_id: dramaIdNum, character_id: charIdNum, scene_id: sceneIdNum, prompt, model, size, quality, created_at: now, updated_at: now };
}

function rowToItem(r) {
  return {
    id: r.id,
    storyboard_id: r.storyboard_id,
    drama_id: r.drama_id,
    character_id: r.character_id,
    provider: r.provider,
    prompt: r.prompt,
    model: r.model,
    size: r.size,
    quality: r.quality,
    image_url: r.image_url,
    local_path: r.local_path,
    status: r.status,
    task_id: r.task_id,
    error_msg: r.error_msg,
    created_at: r.created_at,
    updated_at: r.updated_at,
    completed_at: r.completed_at,
  };
}

module.exports = {
  getDefaultImageConfig,
  callImageApi,
  createAndGenerateImage,
  resolveAssetUserNegativeForApi,
  /** 图床 URL 缓存（image_proxy_cache），供 SD2 认证等复用 */
  getProxyCache,
  setProxyCache,
};
