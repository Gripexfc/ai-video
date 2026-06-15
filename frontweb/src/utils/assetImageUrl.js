/**
 * 资源图片 URL 工具函数
 * 提取自 FilmCreate.vue / FilmList.vue / DramaDetail.vue 中重复出现的图片 URL 处理逻辑
 */

/**
 * 将 local_path 转换为可访问的 URL
 * @param {string} path
 * @returns {string}
 */
export function localPathToUrl(path) {
  if (!path) return ''
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return '/static/' + path.replace(/^\/+/, '')
}

/**
 * 获取资源的图片 URL（优先使用 local_path，其次 image_url）
 * @param {{ image_url?: string, local_path?: string }} item
 * @returns {string}
 */
export function assetImageUrl(item) {
  if (!item) return ''
  if (item.local_path) return localPathToUrl(item.local_path)
  if (item.image_url) {
    if (item.image_url.startsWith('http://') || item.image_url.startsWith('https://')) return item.image_url
    return localPathToUrl(item.image_url)
  }
  return ''
}

/**
 * 判断资源是否有可用图片
 * @param {{ image_url?: string, local_path?: string }} item
 * @returns {boolean}
 */
export function hasAssetImage(item) {
  return !!(item?.image_url || item?.local_path)
}
