/**
 * usePollTask — 轮询计时器追踪与取消
 *
 * 仅负责追踪 pollTask / pollTaskWithPause 中的 setTimeout ID，
 * 并在组件卸载时一次性清除所有未执行的轮询。
 */

const activeTimers = new Set()

/**
 * 追踪一个 setTimeout 返回的 timerId。
 * 调用方式：const id = setTimeout(...); trackPollTimer(id)
 */
export function trackPollTimer(timerId) {
  activeTimers.add(timerId)
  return timerId
}

/**
 * 从追踪集合中移除已执行完毕的 timerId。
 * 可在 clearTimeout 之后调用，但非必须——cancelAllPolls 也会清理整个 Set。
 */
export function untrackPollTimer(timerId) {
  activeTimers.delete(timerId)
}

/**
 * 取消所有正在轮询的定时器。在 onBeforeUnmount 中调用。
 */
export function cancelAllPolls() {
  for (const id of activeTimers) {
    clearTimeout(id)
  }
  activeTimers.clear()
}
