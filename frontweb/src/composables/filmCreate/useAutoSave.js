/**
 * 自动保存 composable
 * watch 响应式内容，debounce 后调用保存函数
 */
import { ref, watch, onBeforeUnmount } from 'vue'

/**
 * @param {import('vue').Ref} content - 要监听的响应式内容
 * @param {Object} options
 * @param {Function} options.saveFn - 保存函数，接收 content value
 * @param {number} [options.debounceMs=1500] - 防抖时间（毫秒）
 * @param {Function} [options.shouldSave] - 可选判断是否需要保存
 * @returns {{ status: import('vue').Ref<string> }}
 */
export function useAutoSave(content, { saveFn, debounceMs = 1500, shouldSave } = {}) {
  const status = ref('idle') // 'idle' | 'saving' | 'saved' | 'error'
  let timer = null
  let statusTimer = null

  function clearTimers() {
    if (timer) { clearTimeout(timer); timer = null }
    if (statusTimer) { clearTimeout(statusTimer); statusTimer = null }
  }

  async function doSave(value) {
    status.value = 'saving'
    try {
      await saveFn(value)
      status.value = 'saved'
      // 2 秒后恢复 idle
      statusTimer = setTimeout(() => { status.value = 'idle' }, 2000)
    } catch (e) {
      status.value = 'error'
      console.error('[useAutoSave] save failed:', e)
      // 3 秒后恢复 idle，允许重试
      statusTimer = setTimeout(() => { status.value = 'idle' }, 3000)
    }
  }

  const stopWatch = watch(
    content,
    (value) => {
      if (shouldSave && !shouldSave(value)) return
      clearTimers()
      timer = setTimeout(() => doSave(value), debounceMs)
    },
    { flush: 'post' }
  )

  onBeforeUnmount(() => {
    clearTimers()
    stopWatch()
  })

  return { status }
}
