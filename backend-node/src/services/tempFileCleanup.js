/**
 * 临时文件定期清理：清理操作系统临时目录下的 drama-video-merge 子目录中超过 1 小时的文件。
 * 在 server 启动时自动启动，每 10 分钟扫描一次。
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // 10 分钟
const MAX_AGE_MS = 60 * 60 * 1000; // 1 小时

let timer = null;

async function cleanupTempDir(log) {
  const tempDir = path.join(os.tmpdir(), 'drama-video-merge');
  try {
    const files = await fs.promises.readdir(tempDir);
    const now = Date.now();
    let cleaned = 0;
    for (const file of files) {
      const filePath = path.join(tempDir, file);
      try {
        const stat = await fs.promises.stat(filePath);
        if (now - stat.mtimeMs > MAX_AGE_MS) {
          await fs.promises.unlink(filePath);
          cleaned++;
        }
      } catch (_) {}
    }
    if (cleaned > 0) {
      log.info('[临时文件清理] 已清理过期文件', { dir: tempDir, count: cleaned });
    }
  } catch (e) {
    // 目录不存在时静默跳过
    if (e.code !== 'ENOENT') {
      log.warn('[临时文件清理] 扫描失败', { error: e.message });
    }
  }
}

function startCleanup(log) {
  if (timer) return; // 防止重复启动
  // 启动时立即清理一次
  cleanupTempDir(log);
  timer = setInterval(() => cleanupTempDir(log), CLEANUP_INTERVAL_MS);
  // 允许进程正常退出（不阻塞 event loop）
  if (timer.unref) timer.unref();
}

function stopCleanup() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

module.exports = { startCleanup, stopCleanup };
