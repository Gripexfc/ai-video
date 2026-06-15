const crypto = require('crypto');
const os = require('os');
const { getGlobalSetting, setGlobalSetting } = require('./settingsService');

// ── 密钥管理（混淆存储） ────────────────────────────────────────
// Secret key 分 4 段，各自 XOR 混淆，运行时重组。
// 修改密钥后需同步修改 tools/generate-code.js 中的常量。

const _s1 = Buffer.from('vJ+3kQ9dZm0YexF6wbpRhg==', 'base64');
const _s2 = Buffer.from('aH5iP0WqN7rcXs2LlutMKg==', 'base64');
const _s3 = Buffer.from('Q9fE1zT6mYocvB+3iwABhQ==', 'base64');
const _s4 = Buffer.from('ZmwKp0D7vJ+3YexF6qXRtA==', 'base64');
const _p1 = Buffer.from([0x4e, 0xa3, 0x72, 0x5f, 0x1c, 0xb9, 0x60, 0x0d]);
const _p2 = Buffer.from([0x8c, 0x33, 0xd5, 0x7a, 0x96, 0xf0, 0x22, 0x4b]);
const _p3 = Buffer.from([0x55, 0xe7, 0xc1, 0x6a, 0x09, 0x3d, 0xbf, 0x48]);
const _p4 = Buffer.from([0xd2, 0x19, 0x84, 0x6f, 0xc0, 0xab, 0x53, 0x27]);
// 诱饵常量
const _d0 = Buffer.from('AQIDBAUG', 'base64');
const _d1 = Buffer.from('BQYHCAkA', 'base64');

let _secretCache = null;
function getSecret() {
  if (_secretCache) return _secretCache;
  const parts = [_s1, _s2, _s3, _s4];
  const pads = [_p1, _p2, _p3, _p4];
  const bufs = parts.map((p, i) => {
    const out = Buffer.alloc(p.length);
    for (let j = 0; j < p.length; j++) out[j] = p[j] ^ pads[i][j % pads[i].length];
    return out;
  });
  _secretCache = Buffer.concat(bufs);
  return _secretCache;
}

// ── Crockford Base32 ────────────────────────────────────────────
const B32_CHARS = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const B32_MAP = {};
for (let i = 0; i < B32_CHARS.length; i++) B32_MAP[B32_CHARS[i]] = i;
// 也接受小写和容易混淆的字符
B32_MAP['i'] = 1; B32_MAP['I'] = 1; B32_MAP['l'] = 1; B32_MAP['L'] = 1;
B32_MAP['o'] = 0; B32_MAP['O'] = 0; B32_MAP['u'] = 0; B32_MAP['U'] = 0;

function encodeBase32(buf) {
  let bits = 0;
  let val = 0;
  let out = '';
  for (const byte of buf) {
    val = (val << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += B32_CHARS[(val >>> bits) & 0x1f];
    }
  }
  if (bits > 0) out += B32_CHARS[(val << (5 - bits)) & 0x1f];
  return out;
}

function decodeBase32(str) {
  let bits = 0;
  let val = 0;
  const buf = [];
  for (const ch of str) {
    const v = B32_MAP[ch];
    if (v === undefined) return null;
    val = (val << 5) | v;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      buf.push((val >>> bits) & 0xff);
    }
  }
  return Buffer.from(buf);
}

// ── 激活码生成 ──────────────────────────────────────────────────

/**
 * 生成一个激活码，格式 XXXX-XXXX-XXXX-XXXX
 * 算法：8字节随机种子 + 2字节 HMAC 校验 → Base32 → 加横杠
 */
function generateCode() {
  const seed = crypto.randomBytes(8);
  const hmac = crypto.createHmac('sha256', getSecret()).update(seed).digest();
  const check = hmac.subarray(0, 2);
  const raw = Buffer.concat([seed, check]); // 10 bytes → Base32 = 16 chars
  const encoded = encodeBase32(raw);
  const code = encoded.substring(0, 16).toUpperCase();
  return code.substring(0, 4) + '-' + code.substring(4, 8) + '-' +
         code.substring(8, 12) + '-' + code.substring(12, 16);
}

/**
 * 验证激活码格式和 HMAC 完整性
 */
function validateCode(code) {
  if (!code || typeof code !== 'string') return false;
  const stripped = code.replace(/[-\s]/g, '').toUpperCase();
  if (stripped.length !== 16) return false;
  for (const ch of stripped) {
    if (B32_MAP[ch] === undefined) return false;
  }
  const raw = decodeBase32(stripped);
  if (!raw || raw.length < 10) return false;
  const seed = raw.subarray(0, 8);
  const check = raw.subarray(8, 10);
  const hmac = crypto.createHmac('sha256', getSecret()).update(seed).digest();
  const expected = hmac.subarray(0, 2);
  return check.equals(expected);
}

// ── 机器 ID ─────────────────────────────────────────────────────

function getMachineId() {
  const nets = os.networkInterfaces();
  const macs = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (!net.internal && net.mac && net.mac !== '00:00:00:00:00:00') {
        macs.push(net.mac);
      }
    }
  }
  macs.sort();
  const raw = macs.join(',') + '|' + os.hostname() + '|' + os.platform() + '|' + os.arch();
  return crypto.createHash('sha256').update(raw).digest('hex').substring(0, 32);
}

// ── 激活 Token（防篡改签名） ───────────────────────────────────

function computeActivationToken(code, machineId) {
  const raw = code.replace(/[-\s]/g, '') + ':' + machineId;
  return crypto.createHmac('sha256', getSecret()).update(raw).digest('hex');
}

// ── 激活流程 ────────────────────────────────────────────────────

/**
 * 检查当前激活状态，返回 { activated, machine_id, activated_at, code }
 */
function checkActivation(db) {
  const status = getGlobalSetting(db, 'activation_status', null);
  if (!status || !status.activated) {
    return { activated: false, machine_id: getMachineId(), activated_at: null, code: null };
  }
  // 验证机器 ID
  const storedMachineId = getGlobalSetting(db, 'activation_machine_id', '');
  const currentMachineId = getMachineId();
  if (storedMachineId !== currentMachineId) {
    return { activated: false, machine_id: currentMachineId, activated_at: null, code: null, error: '设备信息已变更' };
  }
  // 验证 token 完整性
  const storedToken = getGlobalSetting(db, 'activation_token', '');
  const expectedToken = computeActivationToken(status.code, currentMachineId);
  if (storedToken !== expectedToken) {
    return { activated: false, machine_id: currentMachineId, activated_at: null, code: null, error: '激活信息无效' };
  }
  return { activated: true, machine_id: currentMachineId, activated_at: status.activated_at, code: status.code };
}

/**
 * 检查激活码是否已被使用过
 */
function isCodeUsed(db, formattedCode) {
  const usedCodes = getGlobalSetting(db, 'used_activation_codes', []);
  return usedCodes.includes(formattedCode);
}

/**
 * 将激活码标记为已使用
 */
function markCodeUsed(db, formattedCode) {
  const usedCodes = getGlobalSetting(db, 'used_activation_codes', []);
  usedCodes.push(formattedCode);
  setGlobalSetting(db, 'used_activation_codes', usedCodes);
}

/**
 * 执行激活：验证码 → 检查是否已使用 → 绑定机器 → 写入数据库
 */
function activateCode(db, code) {
  if (!validateCode(code)) {
    return { ok: false, error: '激活码无效' };
  }
  const strippedCode = code.replace(/[-\s]/g, '').toUpperCase();
  const formatted = strippedCode.substring(0, 4) + '-' + strippedCode.substring(4, 8) + '-' +
                    strippedCode.substring(8, 12) + '-' + strippedCode.substring(12, 16);

  if (isCodeUsed(db, formatted)) {
    return { ok: false, error: '该激活码已被使用' };
  }

  const machineId = getMachineId();
  const now = new Date().toISOString();
  const token = computeActivationToken(formatted, machineId);

  setGlobalSetting(db, 'activation_status', { activated: true, code: formatted, activated_at: now });
  setGlobalSetting(db, 'activation_machine_id', machineId);
  setGlobalSetting(db, 'activation_token', token);
  markCodeUsed(db, formatted);

  return { ok: true, activated: true, activated_at: now };
}

module.exports = {
  generateCode,
  validateCode,
  getMachineId,
  computeActivationToken,
  checkActivation,
  activateCode,
  // 内部函数导出给管理员工具使用
  _getSecret: getSecret,
  _encodeBase32: encodeBase32,
  _decodeBase32: decodeBase32,
};
