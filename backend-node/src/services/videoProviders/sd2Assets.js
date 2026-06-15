/**
 * videoProviders/sd2Assets.js
 * SD2 认证素材 URL 系统：将角色主图替换为 seedance2_asset.asset_url（asset://…）
 */

/** 支持将角色主图 URL 替换为 seedance2_asset.asset_url（asset://…）的视频协议 */
const VIDEO_PROTOCOLS_SUPPORT_SD2_ASSET_SCHEME = new Set([
  'volcengine_omni',
  'volcengine',
  'dashscope',
  'kling_omni',
  'kling',
  'xai',
  'veo3',
  'vidu',
  'openai',
]);

function parseJsonColumnForVideo(val) {
  if (val == null || val === '') return null;
  if (typeof val === 'object' && !Array.isArray(val)) return val;
  if (typeof val !== 'string') return null;
  try {
    return JSON.parse(val);
  } catch (_) {
    return null;
  }
}

/** 与 Seedance2 / 素材库约定一致：image_url.url = asset://asset-… */
function normalizeMaterialHubAssetUrlForVideo(assetUrlOrId) {
  const s = String(assetUrlOrId || '').trim();
  if (!s) return null;
  if (s.startsWith('asset://')) return s;
  if (s.startsWith('http://') || s.startsWith('https://')) return s;
  if (s.startsWith('asset-')) return `asset://${s}`;
  return `asset://${s.replace(/^\/+/, '')}`;
}

/** 与 storage local_path 对齐的相对路径（无首尾 /，无 query） */
function normalizeStorageRelativePath(p) {
  let s = String(p || '').trim().replace(/^[/\\]+/, '').split('?')[0];
  s = s.replace(/\\/g, '/').replace(/\/+$/, '');
  return s;
}

/**
 * pathname 片段常为百分号编码（中文目录），DB 里 local_path 多为解码后的明文，需对齐后再做 Map 查找。
 */
function decodeUriPathForSd2Match(pathRaw) {
  const raw = String(pathRaw || '').trim();
  if (!raw) return '';
  try {
    return decodeURIComponent(raw);
  } catch (_) {
    try {
      return raw
        .split('/')
        .map((seg) => {
          if (!seg) return seg;
          try {
            return decodeURIComponent(seg);
          } catch {
            return seg;
          }
        })
        .join('/');
    } catch {
      return raw;
    }
  }
}

/**
 * 从公网/本机静态 URL 抽出与 characters.local_path 一致的相对路径。
 * 约定：pathname 中含 `/static/` 时取其后的片段（忽略 host/port，解决 base_url 与 reference_urls 端口不一致）。
 */
function storageRelativeFromPublicUrl(urlStr) {
  const s = String(urlStr || '').trim();
  if (!/^https?:\/\//i.test(s)) return '';
  try {
    const u = new URL(s);
    let p = u.pathname || '';
    const lower = p.toLowerCase();
    const marker = '/static/';
    const idx = lower.indexOf(marker);
    if (idx >= 0) p = p.slice(idx + marker.length);
    else p = p.replace(/^\/+/, '');
    p = decodeUriPathForSd2Match(p);
    return normalizeStorageRelativePath(p);
  } catch (_) {
    return '';
  }
}

function emptySd2Lookup() {
  return { urlToAsset: new Map(), relPathToAsset: new Map() };
}

function sd2LookupIsEmpty(lookup) {
  if (!lookup || !lookup.urlToAsset) return true;
  return (lookup.urlToAsset.size || 0) === 0 && (lookup.relPathToAsset?.size || 0) === 0;
}

function sd2CandidateUrlKeysForCharacter(row, filesBaseUrl) {
  const keys = new Set();
  const base = (filesBaseUrl || '').toString().trim().replace(/\/$/, '');
  const pushKey = (u) => {
    const s = String(u || '').trim();
    if (!s || s.startsWith('data:')) return;
    keys.add(s);
    keys.add(s.split('?')[0]);
    keys.add(s.replace(/\/+$/, ''));
    keys.add(s.split('?')[0].replace(/\/+$/, ''));
  };
  const img = (row.image_url || '').trim();
  const lp = (row.local_path || '').trim().replace(/^\/+/, '');
  if (img) pushKey(img);
  if (img && img.startsWith('/') && base) pushKey(`${base}${img}`);
  if (lp && base) pushKey(`${base}/${lp}`);
  return keys;
}

/**
 * 限制 SD2 素材替换仅作用于「本分镜/本集」相关角色，避免参考图 URL 偶然命中剧中其他已认证角色仍被改成 asset://。
 * - 优先 storyboards.characters（非空数组则只用其中 id）
 * - 若未配置或解析失败：用该分镜所属集的 episode_characters
 * - 若仍无法得到列表：返回 null，表示不限制（兼容旧数据）
 * - characters 存合法 JSON 空数组 []：返回 []，表示本分镜不关联任何剧内角色，不做任何 asset 替换
 */
function resolveSd2RestrictCharacterIds(db, storyboardId) {
  if (!db || !storyboardId) return null;
  let sb;
  try {
    sb = db
      .prepare('SELECT characters, episode_id FROM storyboards WHERE id = ? AND deleted_at IS NULL')
      .get(Number(storyboardId));
  } catch (_) {
    return null;
  }
  if (!sb) return null;
  const raw = sb.characters;
  if (raw != null && String(raw).trim() !== '') {
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed)) {
        const ids = [];
        for (const item of parsed) {
          const cid = typeof item === 'object' && item != null ? item.id : item;
          const n = Number(cid);
          if (Number.isFinite(n) && n > 0) ids.push(n);
        }
        if (ids.length > 0) return [...new Set(ids)];
        if (parsed.length === 0) return [];
      }
    } catch (_) {
      /* fall through to episode */
    }
  }
  if (sb.episode_id != null) {
    try {
      const rows = db.prepare('SELECT character_id FROM episode_characters WHERE episode_id = ?').all(Number(sb.episode_id));
      const ids = [...new Set((rows || []).map((r) => Number(r.character_id)).filter((n) => Number.isFinite(n) && n > 0))];
      if (ids.length > 0) return ids;
    } catch (_) {
      return null;
    }
  }
  return null;
}

function buildSd2ActiveAssetUrlLookup(db, dramaId, filesBaseUrl, restrictCharacterIds) {
  const urlToAsset = new Map();
  const relPathToAsset = new Map();
  if (!db || !dramaId) return { urlToAsset, relPathToAsset };
  if (Array.isArray(restrictCharacterIds) && restrictCharacterIds.length === 0) {
    return { urlToAsset, relPathToAsset };
  }
  let rows;
  try {
    let sql =
      'SELECT image_url, local_path, seedance2_asset FROM characters WHERE drama_id = ? AND deleted_at IS NULL';
    const params = [Number(dramaId)];
    if (Array.isArray(restrictCharacterIds) && restrictCharacterIds.length > 0) {
      const uniq = [...new Set(restrictCharacterIds.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0))];
      if (uniq.length === 0) return { urlToAsset, relPathToAsset };
      sql += ` AND id IN (${uniq.map(() => '?').join(',')})`;
      params.push(...uniq);
    }
    rows = db.prepare(sql).all(...params);
  } catch (_) {
    return { urlToAsset, relPathToAsset };
  }
  for (const row of rows || []) {
    const asset = parseJsonColumnForVideo(row.seedance2_asset);
    if (!asset || String(asset.status || '').toLowerCase() !== 'active') continue;
    const uri = normalizeMaterialHubAssetUrlForVideo(asset.asset_url || asset.hub_asset_id);
    if (!uri) continue;
    const certLpRaw = (asset.certified_local_path != null && String(asset.certified_local_path).trim())
      ? String(asset.certified_local_path).trim()
      : '';
    const certLp = certLpRaw ? normalizeStorageRelativePath(certLpRaw) : '';
    const certImg = (asset.certified_image_url != null && String(asset.certified_image_url).trim())
      ? String(asset.certified_image_url).trim()
      : '';
    if (certLp || certImg) {
      const certRow = { image_url: certImg, local_path: certLp };
      for (const k of sd2CandidateUrlKeysForCharacter(certRow, filesBaseUrl)) {
        urlToAsset.set(k, uri);
      }
      if (certLp) relPathToAsset.set(certLp, uri);
      if (certImg && /^https?:\/\//i.test(certImg)) {
        const relFromCertImg = storageRelativeFromPublicUrl(certImg);
        if (relFromCertImg) relPathToAsset.set(relFromCertImg, uri);
      }
      continue;
    }
    for (const k of sd2CandidateUrlKeysForCharacter(row, filesBaseUrl)) {
      urlToAsset.set(k, uri);
    }
    const lp = (row.local_path || '').trim().replace(/^\/+/, '');
    if (lp) {
      const nr = normalizeStorageRelativePath(lp);
      if (nr) relPathToAsset.set(nr, uri);
    }
    const img = (row.image_url || '').trim();
    if (img && /^https?:\/\//i.test(img)) {
      const relFromImg = storageRelativeFromPublicUrl(img);
      if (relFromImg) relPathToAsset.set(relFromImg, uri);
    }
  }
  return { urlToAsset, relPathToAsset };
}

function rewriteOneImageUrlForSd2(original, lookup) {
  const s = String(original || '').trim();
  if (!s || s.startsWith('asset://') || s.startsWith('data:')) return { next: s, changed: false, via: null };
  const urlMap = lookup.urlToAsset;
  const relMap = lookup.relPathToAsset;
  const tries = [s, s.split('?')[0], s.replace(/\/+$/, ''), s.split('?')[0].replace(/\/+$/, '')];
  for (const t of tries) {
    if (urlMap && urlMap.has(t)) return { next: urlMap.get(t), changed: true, via: 'url_exact' };
  }
  if (relMap && relMap.size) {
    const rel = storageRelativeFromPublicUrl(s);
    if (rel) {
      const variants = [rel, rel.replace(/\/+$/, '')];
      for (const rv of variants) {
        if (rv && relMap.has(rv)) return { next: relMap.get(rv), changed: true, via: 'storage_rel_path' };
      }
    }
  }
  return { next: s, changed: false, via: null };
}

function applySeedance2CertifiedAssetUrlsToVideoOpts(db, log, opts) {
  const out = { ...opts };
  const restrictCharIds = resolveSd2RestrictCharacterIds(db, opts.storyboard_id);
  const lookup = buildSd2ActiveAssetUrlLookup(db, opts.drama_id, opts.files_base_url, restrictCharIds);
  if (sd2LookupIsEmpty(lookup)) {
    if (log?.info) {
      log.info('[视频][SD2认证图] 本剧无 active 角色素材或未配置映射，跳过', {
        video_gen_id: opts.video_gen_id,
        drama_id: opts.drama_id,
        storyboard_id: opts.storyboard_id || null,
        restrict_character_ids: restrictCharIds === null ? '(未限制)' : restrictCharIds,
      });
    }
    return out;
  }
  if (log?.info) {
    log.info('[视频][SD2认证图] 映射表已构建', {
      video_gen_id: opts.video_gen_id,
      drama_id: opts.drama_id,
      storyboard_id: opts.storyboard_id || null,
      restrict_character_ids: restrictCharIds === null ? '(未限制)' : restrictCharIds,
      files_base_url: String(opts.files_base_url || '').slice(0, 200),
      url_key_count: lookup.urlToAsset.size,
      rel_key_count: lookup.relPathToAsset.size,
      url_key_samples: [...lookup.urlToAsset.keys()].slice(0, 5).map((k) => String(k).slice(0, 140)),
      rel_key_samples: [...lookup.relPathToAsset.keys()].slice(0, 8).map((k) => String(k).slice(0, 100)),
    });
  }
  const changes = [];
  const patch = (field, val) => {
    if (val == null || val === '') return val;
    const { next, changed, via } = rewriteOneImageUrlForSd2(val, lookup);
    if (changed) {
      changes.push({
        field,
        via: via || 'unknown',
        from: String(val).slice(0, 200),
        to: String(next).slice(0, 160),
      });
    }
    return next;
  };
  if (opts.image_url != null) out.image_url = patch('image_url', opts.image_url);
  if (opts.first_frame_url != null) out.first_frame_url = patch('first_frame_url', opts.first_frame_url);
  if (opts.last_frame_url != null) out.last_frame_url = patch('last_frame_url', opts.last_frame_url);
  if (Array.isArray(opts.reference_urls)) {
    out.reference_urls = opts.reference_urls.map((u, i) => {
      const { next, changed, via } = rewriteOneImageUrlForSd2(u, lookup);
      if (changed) {
        changes.push({
          field: `reference_urls[${i}]`,
          via: via || 'unknown',
          from: String(u).slice(0, 200),
          to: String(next).slice(0, 160),
        });
      }
      return next;
    });
  }
  if (changes.length && log?.info) {
    log.info('[视频][SD2认证图] 已替换为素材库 asset 引用', {
      video_gen_id: opts.video_gen_id,
      drama_id: opts.drama_id,
      url_key_count: lookup.urlToAsset.size,
      rel_key_count: lookup.relPathToAsset.size,
      repl_count: changes.length,
      repl_detail: changes,
    });
  } else if (log?.info) {
    const refUrls = Array.isArray(opts.reference_urls) ? opts.reference_urls : [];
    const ref_diag = refUrls.map((u, i) => {
      const head = String(u || '').slice(0, 140);
      const extracted = storageRelativeFromPublicUrl(u);
      const relHit = !!(extracted && lookup.relPathToAsset && lookup.relPathToAsset.has(extracted));
      return { i, url_head: head, extracted_rel: extracted || null, rel_map_hit: relHit };
    });
    log.info('[视频][SD2认证图] 有 active 素材但与请求中 URL 未命中', {
      video_gen_id: opts.video_gen_id,
      drama_id: opts.drama_id,
      url_key_count: lookup.urlToAsset.size,
      rel_key_count: lookup.relPathToAsset.size,
      ref_count: refUrls.length,
      has_image_url: !!(opts.image_url && String(opts.image_url).trim()),
      image_url_extracted_rel: opts.image_url ? storageRelativeFromPublicUrl(opts.image_url) : null,
      reference_url_diag: ref_diag,
      hint:
        '若 extracted_rel 与 rel_key_samples 中任一条一致但仍未替换，请提 issue；常见未命中是 reference 为场景图非角色主图、或 pathname 不含 /static/ 且与 local_path 不一致。',
    });
  }
  return out;
}

module.exports = {
  applySeedance2CertifiedAssetUrlsToVideoOpts,
  VIDEO_PROTOCOLS_SUPPORT_SD2_ASSET_SCHEME,
};
