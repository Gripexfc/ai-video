/**
 * 用户状态管理
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getProfile } from '@/api/auth.js'

export const useUserStore = defineStore('user', () => {
  const token = ref(localStorage.getItem('user_token') || '')
  const user = ref(null)
  const credits = ref(0)

  const isLoggedIn = computed(() => !!token.value)

  function setToken(t) {
    token.value = t
    localStorage.setItem('user_token', t)
  }

  function setUser(u) {
    user.value = u
    credits.value = u.credits || 0
  }

  async function fetchProfile() {
    if (!token.value) return
    try {
      const profile = await getProfile()
      user.value = profile
      credits.value = profile.credits || 0
    } catch {
      // token 过期
      logout()
    }
  }

  function logout() {
    token.value = ''
    user.value = null
    credits.value = 0
    localStorage.removeItem('user_token')
  }

  return { token, user, credits, isLoggedIn, setToken, setUser, fetchProfile, logout }
})
