/**
 * 后台管理专用 axios 实例（自动带 admin_token）
 */
import axios from 'axios'
import { ElMessage } from 'element-plus'

const adminRequest = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
})

adminRequest.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

adminRequest.interceptors.response.use(
  (response) => {
    const res = response.data
    if (res.success !== false) {
      return res.data !== undefined ? res.data : res
    }
    return Promise.reject(new Error(res.error || '请求失败'))
  },
  (error) => {
    const msg = error.response?.data?.error || error.message || '网络错误'
    if (error.response?.status === 401) {
      localStorage.removeItem('admin_token')
      ElMessage.error('登录已过期')
      location.href = '/admin/login'
      return Promise.reject(error)
    }
    ElMessage.error(msg)
    error.message = msg
    return Promise.reject(error)
  }
)

export default adminRequest
