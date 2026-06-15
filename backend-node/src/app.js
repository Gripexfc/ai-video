const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const fs = require('fs');
const { getDb } = require('./db/index.js');
const { loadConfig } = require('./config/index.js');
const logger = require('./logger.js');
const { setupRouter } = require('./routes/index.js');

function createApp() {
  const config = loadConfig();
  const db = getDb(config.database);
  const { runMigrationsAndEnsure } = require('./db/migrate.js');
  runMigrationsAndEnsure(db);

  // 判断运行模式：desktop（桌面端）或 server（服务端）
  const isDesktop = (config.app?.mode || '').toLowerCase() === 'desktop';

  // 初始化默认管理员（首次启动时创建 admin/admin123）— 仅服务端
  if (!isDesktop) {
    try {
      const { createDefaultAdmin } = require('./services/userService.js');
      createDefaultAdmin(db);
    } catch (e) {
      console.warn('Failed to create default admin:', e.message);
    }
  }

  // 厂商锁定模式：在迁移完成后同步 vendor_lock 配置
  const { applyVendorLock } = require('./services/aiConfigService');
  applyVendorLock(db, logger, config);
  const log = logger;

  const app = express();

  // 响应压缩：对所有 JSON/文本/静态资源启用 gzip，减少网络传输量
  app.use(compression());

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  app.use(
    cors({
      origin: config.server.cors_origins && config.server.cors_origins.length
        ? config.server.cors_origins
        : '*',
    })
  );

  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const ms = Date.now() - start;
      // 记录慢请求（超过 2 秒的 API 调用）
      if (ms > 2000 && req.path.startsWith('/api')) {
        log.warn('Slow request', { method: req.method, path: req.path, status: res.statusCode, ms });
      }
    });
    next();
  });

  // 静态资源目录：统一转为绝对路径（打包 exe 下相对路径可能解析异常）
  const storageRoot = config.storage?.local_path
    ? (path.isAbsolute(config.storage.local_path)
        ? config.storage.local_path
        : path.join(process.cwd(), config.storage.local_path))
    : path.join(process.cwd(), 'data', 'storage');
  try {
    if (!fs.existsSync(storageRoot)) fs.mkdirSync(storageRoot, { recursive: true });
    // 静态资源缓存：图片/视频等大文件设较长 max-age，减少重复请求
    app.use('/static', express.static(storageRoot, {
      maxAge: '7d',
      immutable: false,
      etag: true,
      lastModified: true,
    }));
  } catch (e) {
    console.warn('Static storage mount skipped:', e.message);
  }

  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      app: config.app.name,
      version: config.app.version,
    });
  });

  // 桌面端：激活码路由（不经过激活中间件）
  if (isDesktop) {
    const activationRoutes = require('./routes/activation');
    app.use('/api/v1/activation', activationRoutes(config, db, log));

    // 激活拦截中间件：未激活时所有 /api/v1/* 返回 403
    const { requireActivation } = require('./middleware/requireActivation');
    app.use('/api/v1', requireActivation(db));
  }

  app.use('/api/v1', setupRouter(config, db, log));

  // 前端静态资源（sxy：web/dist）；Electron 打包时可设 WEB_DIST_PATH
  const webDist = process.env.WEB_DIST_PATH || path.join(process.cwd(), '..', 'frontweb', 'dist');
  if (fs.existsSync(webDist)) {
    // 前端 assets 目录包含带 hash 的文件，可设长期缓存
    app.use('/assets', express.static(path.join(webDist, 'assets'), {
      maxAge: '365d',
      immutable: true,
      etag: true,
      lastModified: true,
    }));
    // 服务 dist 根目录的静态文件（如 favicon.ico 等）
    app.use(express.static(webDist, { index: false }));
    app.get('/favicon.ico', (req, res) => {
      const fav = path.join(webDist, 'favicon.ico');
      if (fs.existsSync(fav)) res.sendFile(fav);
      else res.status(404).end();
    });
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      const indexHtml = path.join(webDist, 'index.html');
      if (fs.existsSync(indexHtml)) res.sendFile(indexHtml);
      else next();
    });
  } else {
    app.get('/', (req, res) => {
      res.send(
        '<!DOCTYPE html><html><head><meta charset="utf-8"><title>视频miao~</title></head><body>' +
          '<h1>视频miao~ API</h1><p>后端已启动。请先构建前端：</p>' +
          '<pre>cd web &amp;&amp; pnpm install &amp;&amp; pnpm build</pre>' +
          '<p>然后将 <code>web/dist</code> 放到与 backend-node 同级的 <code>web/dist</code>，或访问 <a href="/health">/health</a> 检查接口。</p></body></html>'
      );
    });
  }

  app.use((req, res) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.status(404).send('Not Found');
  });

  app.use((err, req, res, next) => {
    log.errorw('Unhandled error', { error: err.message, path: req.path });
    if (!res.headersSent) {
      const isFileTooLarge = err.code === 'LIMIT_FILE_SIZE' || (err.message && err.message.includes('File too large'));
      const status = isFileTooLarge ? 413 : 500;
      const message = isFileTooLarge ? '图片大小不能超过 16MB，请压缩后重试' : '服务器错误';
      res.status(status).json({ success: false, error: { code: isFileTooLarge ? 'FILE_TOO_LARGE' : 'INTERNAL_ERROR', message }, timestamp: new Date().toISOString() });
    }
  });

  return { app, config, db };
}

module.exports = { createApp };
