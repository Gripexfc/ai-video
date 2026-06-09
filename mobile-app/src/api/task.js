import { get } from './request'

export function getTaskStatus(taskId) {
  return get(`/tasks/${taskId}`)
}
