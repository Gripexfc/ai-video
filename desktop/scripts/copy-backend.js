const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const repoRoot = path.join(__dirname, '..', '..');
const src = path.join(repoRoot, 'backend-node');
const dest = path.join(__dirname, '..', 'backend-app');

const dirsToCopy = ['src', 'configs', 'scripts', 'migrations'];

if (!fs.existsSync(src)) {
  console.error('backend-node not found at', src);
  process.exit(1);
}

/**
 * 递归收集目录下所有文件的相对路径
 */
function collectFiles(dir, base) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.join(base, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(full, rel));
    } else {
      results.push(rel);
    }
  }
  return results;
}

/**
 * 检测 backend-node 和 backend-app 的文件差异（复制前）
 */
function checkDrift() {
  if (!fs.existsSync(dest)) return;
  const srcFiles = new Set();
  const destFiles = new Set();
  for (const dir of dirsToCopy) {
    collectFiles(path.join(src, dir), dir).forEach(f => srcFiles.add(f));
    collectFiles(path.join(dest, dir), dir).forEach(f => destFiles.add(f));
  }
  // 检查新增文件
  const added = [...srcFiles].filter(f => !destFiles.has(f));
  if (added.length > 0) {
    console.warn(`[DRIFT] ${added.length} new file(s) in backend-node not in backend-app:`, added.slice(0, 5).join(', '), added.length > 5 ? '...' : '');
  }
  // 检查内容差异
  let modified = 0;
  for (const f of [...srcFiles].filter(f => destFiles.has(f))) {
    try {
      const srcHash = crypto.createHash('md5').update(fs.readFileSync(path.join(src, f))).digest('hex');
      const destHash = crypto.createHash('md5').update(fs.readFileSync(path.join(dest, f))).digest('hex');
      if (srcHash !== destHash) modified++;
    } catch (_) {}
  }
  if (modified > 0) {
    console.log(`[SYNC] ${modified} file(s) changed in backend-node, will overwrite backend-app`);
  }
}

checkDrift();

if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true });
fs.mkdirSync(dest, { recursive: true });

for (const dir of dirsToCopy) {
  const from = path.join(src, dir);
  const to = path.join(dest, dir);
  if (fs.existsSync(from)) {
    fs.cpSync(from, to, { recursive: true });
  }
}

// 合并 desktop 自带的初始迁移（保证 01_init、02_add_default_model 等存在）
const migrationsDest = path.join(dest, 'migrations');
const initialMigrations = path.join(__dirname, 'initial-migrations');
if (!fs.existsSync(migrationsDest)) fs.mkdirSync(migrationsDest, { recursive: true });
if (fs.existsSync(initialMigrations)) {
  for (const f of fs.readdirSync(initialMigrations)) {
    if (f.endsWith('.sql')) {
      fs.copyFileSync(path.join(initialMigrations, f), path.join(migrationsDest, f));
    }
  }
  console.log('Merged initial-migrations -> desktop/backend-app/migrations');
}

console.log('Copied backend-node (src, configs, scripts, migrations) -> desktop/backend-app');
