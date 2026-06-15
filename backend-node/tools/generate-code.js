#!/usr/bin/env node
/**
 * 激活码生成与验证工具
 *
 * 用法：
 *   node tools/generate-code.js --count 10    生成 10 个激活码
 *   node tools/generate-code.js --validate XXXX-XXXX-XXXX-XXXX  验证一个码
 */
const path = require('path');
const { generateCode, validateCode } = require(path.join(__dirname, '..', 'src', 'services', 'activationService'));

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('用法:');
  console.log('  node tools/generate-code.js --count <数量>    生成激活码');
  console.log('  node tools/generate-code.js --validate <码>   验证激活码');
  process.exit(0);
}

if (args[0] === '--count') {
  const count = parseInt(args[1], 10) || 5;
  console.log(`生成 ${count} 个激活码：\n`);
  for (let i = 0; i < count; i++) {
    console.log(generateCode());
  }
} else if (args[0] === '--validate') {
  const code = args[1];
  if (!code) {
    console.error('请提供激活码');
    process.exit(1);
  }
  const valid = validateCode(code);
  if (valid) {
    console.log('✓ 激活码有效');
  } else {
    console.log('✗ 激活码无效');
    process.exit(1);
  }
} else {
  console.error('未知参数:', args[0]);
  process.exit(1);
}
