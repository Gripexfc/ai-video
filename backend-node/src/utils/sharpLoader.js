/**
 * Sharp 懒加载单例
 * sharp 是可选的原生依赖，打包/部署时可能缺失，统一在此处理加载
 */
let _sharp = null;

function getSharp() {
  if (_sharp === null) {
    try { _sharp = require('sharp'); } catch (_) { /* benign: sharp optional */ }
  }
  return _sharp;
}

module.exports = { getSharp };
