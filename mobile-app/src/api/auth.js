import { get, post, put } from './request'

export function login(data) {
  return post('/auth/login', data)
}

export function register(data) {
  return post('/auth/register', data)
}

export function getProfile() {
  return get('/auth/profile')
}

export function changePassword(data) {
  return put('/auth/password', data)
}

export function getBalance() {
  return get('/credits/balance')
}
