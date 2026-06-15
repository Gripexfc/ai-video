const fs = require('fs');
const path = require('path');

// 日志级别优先级
const LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, SILENT: 4 };
const currentLevel = LOG_LEVELS[String(process.env.LOG_LEVEL || 'DEBUG').toUpperCase()] ?? 0;

// 日志文件大小上限（默认 20MB），超过后自动截断
const LOG_FILE_MAX_BYTES = parseInt(process.env.LOG_FILE_MAX_BYTES, 10) || 20 * 1024 * 1024;

// 使用异步 IO 的写入计数器，每 N 次触发一次截断检查
let writeCount = 0;

function truncateLogFileIfNeeded(logFile) {
  fs.stat(logFile, (err, stat) => {
    if (err || !stat || stat.size <= LOG_FILE_MAX_BYTES) return;
    // 保留后半部分内容（新日志更重要）
    const keepBytes = Math.floor(LOG_FILE_MAX_BYTES / 2);
    const chunks = [];
    let totalRead = 0;
    const stream = fs.createReadStream(logFile, {
      start: stat.size - keepBytes,
      end: stat.size - 1,
    });
    stream.on('data', (chunk) => {
      chunks.push(chunk);
      totalRead += chunk.length;
    });
    stream.on('end', () => {
      const buf = Buffer.concat(chunks, totalRead);
      fs.writeFile(logFile, buf, (writeErr) => {
        if (writeErr) { /* 静默失败，不影响主流程 */ }
      });
    });
    stream.on('error', () => {});
  });
}

// 简单 logger，和 Go 端行为接近；若设置 LOG_FILE 则同时追加到该文件（便于打包 exe 双击时查日志）
function log(level, msg, ...args) {
  // 级别过滤
  if ((LOG_LEVELS[level] ?? 0) < currentLevel) return;

  const time = new Date().toISOString();
  let rest = '';
  if (args.length && typeof args[0] === 'object' && args[0] !== null && !Array.isArray(args[0])) {
    rest = ' ' + JSON.stringify(args[0]);
  } else if (args.length) {
    rest = ' ' + args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
  }
  const line = `${time} [${level}] ${msg}${rest}\n`;
  try {
    if (level === 'ERROR') {
      console.error(line.trimEnd());
    } else if (level === 'WARN') {
      console.warn(line.trimEnd());
    } else {
      console.log(line.trimEnd());
    }
  } catch (_) {}
  const logFile = process.env.LOG_FILE;
  if (logFile) {
    try {
      const dir = path.dirname(logFile);
      // mkdirSync 仅在启动时可能触发（首次写入），保留同步以保证目录存在
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.appendFile(logFile, line, (err) => {
        if (err) { /* 静默失败 */ return; }
        writeCount++;
        // 定期检查日志文件大小（每 100 次写入检查一次）
        if (writeCount % 100 === 0) truncateLogFileIfNeeded(logFile);
      });
    } catch (_) {}
  }
}

module.exports = {
  info(msg, ...args) {
    log('INFO', msg, ...args);
  },
  infow(msg, ...args) {
    log('INFO', msg, ...args);
  },
  warn(msg, ...args) {
    log('WARN', msg, ...args);
  },
  warnw(msg, ...args) {
    log('WARN', msg, ...args);
  },
  error(msg, ...args) {
    log('ERROR', msg, ...args);
  },
  errorw(msg, ...args) {
    log('ERROR', msg, ...args);
  },
};
