/**
 * 用户认证 API
 */
import request from '@/utils/request.js'

export function register(data) {
  return request.post('/auth/register', data)
}
export function login(data) {
  return request.post('/auth/login', data)
}
export function getProfile() {
  return request.get('/auth/profile')
}
export function changePassword(data) {
  return request.put('/auth/password', data)
}
export function getBalance() {
  return request.get('/credits/balance')
}
export function getTransactions(params) {
  return request.get('/credits/transactions', { params })
}
export function getCreditProducts() {
  return request.get('/credits/products')
}
export function createTopup(data) {
  return request.post('/credits/topup', data)
}
export function getOrderStatus(orderNo) {
  return request.get(`/credits/order/${orderNo}`)
}
export function getActiveAnnouncements() {
  return request.get('/announcements')
}
