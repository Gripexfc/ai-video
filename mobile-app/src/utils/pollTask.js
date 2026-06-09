import { getTaskStatus } from '../api/task'

/**
 * 异步任务轮询封装
 * @param {string} taskId - 任务 ID
 * @param {number} interval - 轮询间隔（毫秒），默认 2000
 * @param {number} maxAttempts - 最大轮询次数，默认 300
 * @returns {Promise} 任务完成时 resolve(result)，失败/超时时 reject
 */
export function pollTask(taskId, interval = 2000, maxAttempts = 300) {
  return new Promise((resolve, reject) => {
    let attempts = 0

    const timer = setInterval(async () => {
      attempts++

      try {
        const result = await getTaskStatus(taskId)

        if (result.status === 'completed') {
          clearInterval(timer)
          resolve(result)
          return
        }

        if (result.status === 'failed') {
          clearInterval(timer)
          reject(new Error(result.error || result.message || '任务失败'))
          return
        }

        // 超时检查
        if (attempts >= maxAttempts) {
          clearInterval(timer)
          reject(new Error('任务轮询超时'))
          return
        }
      } catch (err) {
        clearInterval(timer)
        reject(err)
      }
    }, interval)
  })
}
