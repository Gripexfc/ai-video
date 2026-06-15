import axios from 'axios'
import { ElMessage } from 'element-plus'

const request = axios.create({
  baseURL: '/api/v1',
  timeout: 600000,
  headers: { 'Content-Type': 'application/json' }
})

// ---------- GET 请求自动取消机制 ----------
const pendingRequests = new Map()

/** 在路由切换时调用，取消所有未完成的 GET 请求 */
export function cancelPendingRequests() {
  for (const [key, controller] of pendingRequests) {
    controller.abort()
    pendingRequests.delete(key)
  }
}

request.interceptors.request.use(
  (config) => {
    // 自动带用户 token
    const token = localStorage.getItem('user_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
    // 仅为 GET 请求添加 AbortController
    if (config.method === 'get') {
      const key = config.url + '?' + JSON.stringify(config.params || {})
      // 如果存在相同请求则取消前一个
      if (pendingRequests.has(key)) {
        pendingRequests.get(key).abort()
      }
      const controller = new AbortController()
      config.signal = controller.signal
      pendingRequests.set(key, controller)
      config._pendingKey = key
    }
    return config
  },
  (error) => Promise.reject(error)
)

request.interceptors.response.use(
  (response) => {
    // 清理已完成的 GET 请求
    if (response.config?._pendingKey) {
      pendingRequests.delete(response.config._pendingKey)
    }
    // blob 类型直接返回原始数据，不做 JSON 解包
    if (response.config?.responseType === 'blob') {
      return response.data
    }
    const res = response.data
    if (res.success !== false) {
      return res.data !== undefined ? res.data : res
    }
    return Promise.reject(new Error(res.error?.message || '请求失败'))
  },
  (error) => {
    // 清理已结束（含被取消）的 GET 请求
    if (error.config?._pendingKey) {
      pendingRequests.delete(error.config._pendingKey)
    }
    // 被主动取消的请求不弹提示
    if (axios.isCancel(error)) {
      return Promise.reject(error)
    }
    // 支持 _silent 选项：轮询等场景跳过错误提示，避免 toast 刷屏
    const isSilent = error.config?._silent
    if (!isSilent) {
      // 提取后端实际错误信息（优先 API 返回的 message，而非 axios 通用 "status code 500"）
      const backendMsg = error.response?.data?.error?.message
      const msg = backendMsg || error.message || '网络错误'
      ElMessage.error(msg)
      // 将真实错误信息写回 message，使组件 catch 块可直接用 e.message 获取可读内容
      if (backendMsg) error.message = backendMsg
    }
    // 积分模式下 401 自动跳转登录页并清除 token
    if (error.response?.status === 401 && localStorage.getItem('user_token')) {
      localStorage.removeItem('user_token')
      window.location.href = '/login'
      return Promise.reject(error)
    }
    return Promise.reject(error)
  }
)

export default request
