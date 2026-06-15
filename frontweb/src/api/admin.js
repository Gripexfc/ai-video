/**
 * 后台管理 API
 */
import request from './adminRequest.js'

// ── 管理员登录 ──
export function adminLogin(data) {
  return request.post('/admin/login', data)
}

// ── 仪表盘 ──
export function getDashboard() {
  return request.get('/admin/dashboard')
}

// ── 用户管理 ──
export function getUsers(params) {
  return request.get('/admin/users', { params })
}
export function banUser(id) {
  return request.post(`/admin/users/${id}/ban`)
}
export function unbanUser(id) {
  return request.post(`/admin/users/${id}/unban`)
}
export function addUserCredits(id, data) {
  return request.post(`/admin/users/${id}/add-credits`, data)
}
export function resetUserPassword(id, data) {
  return request.post(`/admin/users/${id}/reset-password`, data)
}
export function getUserTransactions(id, params) {
  return request.get(`/admin/users/${id}/transactions`, { params })
}

// ── 中转站配置 ──
export function getRelayConfig() {
  return request.get('/admin/relay-config')
}
export function updateRelayConfig(data) {
  return request.put('/admin/relay-config', data)
}
export function testRelay(data) {
  return request.post('/admin/relay-test', data)
}

// ── 积分价格 ──
export function getCreditPrices() {
  return request.get('/admin/credit-prices')
}
export function updateCreditPrices(data) {
  return request.put('/admin/credit-prices', data)
}

// ── 充值商品 ──
export function getProducts() {
  return request.get('/admin/products')
}
export function createProduct(data) {
  return request.post('/admin/products', data)
}
export function updateProduct(id, data) {
  return request.put(`/admin/products/${id}`, data)
}
export function deleteProduct(id) {
  return request.delete(`/admin/products/${id}`)
}

// ── 订单管理 ──
export function getOrders(params) {
  return request.get('/admin/orders', { params })
}
export function confirmOrder(orderNo) {
  return request.post(`/admin/orders/${orderNo}/confirm`)
}

// ── 系统设置 ──
export function getSettings() {
  return request.get('/admin/settings')
}
export function updateSettings(data) {
  return request.put('/admin/settings', data)
}

// ── 公告管理 ──
export function getAnnouncements() {
  return request.get('/admin/announcements')
}
export function createAnnouncement(data) {
  return request.post('/admin/announcements', data)
}
export function updateAnnouncement(id, data) {
  return request.put(`/admin/announcements/${id}`, data)
}
export function deleteAnnouncement(id) {
  return request.delete(`/admin/announcements/${id}`)
}
