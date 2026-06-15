const { loadConfig } = require('./config/index.js');

const preConfig = loadConfig();
const tlsFlag = preConfig.server?.insecure_tls ?? preConfig.server?.INSECURE_TLS;
const insecureTlsOn =
  tlsFlag === true ||
  tlsFlag === 1 ||
  tlsFlag === '1' ||
  String(tlsFlag).toLowerCase() === 'true';
if (insecureTlsOn) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  console.warn('[config] server.insecure_tls 已启用：全局跳过 TLS 证书校验，仅用于测试');
}

const { createApp } = require('./app.js');
const { closeDb } = require('./db/index.js');
const logger = require('./logger.js');
const { startCleanup, stopCleanup } = require('./services/tempFileCleanup');

const { app, config, db } = createApp();
const port = Number(process.env.PORT) || config.server?.port || 5679;
const host = config.server?.host || '0.0.0.0';

const server = app.listen(port, host, () => {
  logger.info('Server starting', { port, host });
  logger.info('Frontend:  http://localhost:' + port);
  logger.info('API:       http://localhost:' + port + '/api/v1');
  logger.info('Health:    http://localhost:' + port + '/health');

  // 启动临时文件定期清理
  startCleanup(logger);

  // Clean up stale tasks from previous sessions
  try {
    const result = db.prepare("UPDATE async_tasks SET status = 'failed', error = 'Server restarted, task aborted' WHERE status IN ('pending', 'processing')").run();
    if (result.changes > 0) {
      logger.info(`Cleaned up ${result.changes} stale tasks from previous session`);
    }
  } catch (e) {
    logger.warn('Failed to clean up stale tasks', { error: e.message });
  }

  // 清理 30 天前的已完成/失败任务（减少数据库膨胀）
  try {
    const old = db.prepare(
      "DELETE FROM async_tasks WHERE status IN ('completed', 'failed') AND created_at < datetime('now', '-30 days')"
    ).run();
    if (old.changes > 0) {
      logger.info(`Cleaned up ${old.changes} old tasks (>30 days)`);
    }
  } catch (e) {
    logger.warn('Failed to clean up old tasks', { error: e.message });
  }

  // 清理 7 天前的图片代理缓存
  try {
    const cacheOld = db.prepare(
      "DELETE FROM image_proxy_cache WHERE created_at < datetime('now', '-7 days')"
    ).run();
    if (cacheOld.changes > 0) {
      logger.info(`Cleaned up ${cacheOld.changes} old image proxy cache entries (>7 days)`);
    }
  } catch (e) {
    logger.warn('Failed to clean up image proxy cache', { error: e.message });
  }

  logger.info('Server is ready!');
});

// 跟踪活跃连接，优雅关闭时可以强制断开
let connections = new Set();
server.on('connection', (socket) => {
  connections.add(socket);
  socket.on('close', () => {
    connections.delete(socket);
  });
});

let isShuttingDown = false;

function shutdown() {
  // 防止重复调用
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info('Shutting down server...');
  stopCleanup();

  // 停止接受新连接
  server.close(() => {
    closeDb();
    logger.info('Server exited');
    process.exit(0);
  });

  // 给现有连接 5 秒时间完成正在处理的请求
  setTimeout(() => {
    logger.warn('Forcing shutdown: destroying remaining connections');
    for (const socket of connections) {
      try { socket.destroy(); } catch (_) {}
    }
    connections.clear();
    closeDb();
    process.exit(1);
  }, 5000);

  // 二次 SIGINT/SIGTERM：立即退出
  const forceExitTimeout = setTimeout(() => {
    logger.error('Force exit after timeout');
    process.exit(2);
  }, 10000);
  if (forceExitTimeout.unref) forceExitTimeout.unref();
}

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { error: String(reason) });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception, shutting down', { error: err.message, stack: err.stack });
  shutdown();
});

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
