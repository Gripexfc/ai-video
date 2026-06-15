/**
 * 通用防抖搜索 composable
 * 替代项目中 8 处重复的 clearTimeout + setTimeout(300) 模式
 */
import { onBeforeUnmount } from 'vue'

/**
 * @param {Function} fn - 防抖后要执行的函数
 * @param {number} [delay=300] - 防抖延迟（毫秒）
 * @returns {{ trigger: Function, cancel: Function }}
 */
export function useDebouncedSearch(fn, delay = 300) {
  let timer = null

  function trigger(...args) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      fn(...args)
    }, delay)
  }

  function cancel() {
    if (timer) { clearTimeout(timer); timer = null }
  }

  onBeforeUnmount(cancel)

  return { trigger, cancel }
}
