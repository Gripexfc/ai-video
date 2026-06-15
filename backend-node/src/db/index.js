const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let db = null;

function getDb(config) {
  if (db) return db;
  const dbPath = config.path;
  const dir = path.dirname(dbPath);
  // recursive: true 在目录已存在时静默成功，无需先 existsSync
  try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
  db = new Database(dbPath, {
    verbose: config.type === 'sqlite' && process.env.DEBUG ? console.log : undefined,
  });
  // WAL 模式：并发读性能最优，写不阻塞读
  db.pragma('journal_mode = WAL');
  // 忙等待超时：避免并发写入时立即报 SQLITE_BUSY
  db.pragma('busy_timeout = 5000');
  // 同步模式 NORMAL：在 WAL 下安全且比 FULL 快得多
  db.pragma('synchronous = NORMAL');
  // 缓存大小：增大到 64MB（默认约 2MB），减少磁盘 IO
  db.pragma('cache_size = -64000');
  // 临时存储放内存，避免临时表写磁盘
  db.pragma('temp_store = MEMORY');
  // 外键约束：启用数据完整性保护
  db.pragma('foreign_keys = ON');
  return db;
}

function closeDb() {
  if (db) {
    // 优化关闭：先 checkpoint WAL，再关闭，避免 WAL 文件膨胀
    try {
      db.pragma('wal_checkpoint(TRUNCATE)');
    } catch (_) {}
    db.close();
    db = null;
  }
}

module.exports = { getDb, closeDb };
