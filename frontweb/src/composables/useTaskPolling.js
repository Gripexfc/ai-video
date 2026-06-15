/**
 * 通用任务轮询 composable
 * 替代项目中 5 处重复的 for(i<300; sleep 1500ms) 轮询循环
 */
import { trackPollTimer } from '@/composables/filmCreate/usePollTask'
import { taskAPI } from '@/api/task'

/**
 * 轮询异步任务直到完成
 * @param {string} taskId - 任务 ID
 * @param {Object} [options]
 * @param {number} [options.maxAttempts=300] - 最大轮询次数
 * @param {number} [options.intervalMs=1500] - 轮询间隔（毫秒）
 * @returns {Promise<Object>} 返回完成的任务对象
 * @throws {Error} 任务失败或超时时抛出
 */
export async function pollTaskResult(taskId, { maxAttempts = 300, intervalMs = 1500 } = {}) {
  if (!taskId) throw new Error('缺少任务 ID')

  let task = null
  for (let i = 0; i < maxAttempts; i++) {
    const timerId = setTimeout(() => {}, intervalMs)
    trackPollTimer(timerId)
    await new Promise(r => setTimeout(r, intervalMs))

    const tr = await taskAPI.get(taskId)
    task = tr?.data ?? tr

    if (task.status === 'completed') return task
    if (task.status === 'failed') {
      throw new Error(task.error || '任务失败')
    }
  }
  throw new Error('生成超时')
}
