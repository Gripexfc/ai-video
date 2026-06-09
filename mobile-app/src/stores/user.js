import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getProfile } from '../api/auth'

export const useUserStore = defineStore('user', () => {
  const token = ref(uni.getStorageSync('user_token') || '')
  const user = ref(null)
  const credits = ref(0)

  const isLoggedIn = computed(() => !!token.value)

  function setToken(t) {
    token.value = t
    uni.setStorageSync('user_token', t)
  }

  function setUser(u) {
    user.value = u
  }

  async function fetchProfile() {
    try {
      const profile = await getProfile()
      setUser(profile)
    } catch {
      logout()
    }
  }

  function logout() {
    token.value = ''
    user.value = null
    credits.value = 0
    uni.removeStorageSync('user_token')
    uni.reLaunch({ url: '/pages/login/index' })
  }

  return {
    token,
    user,
    credits,
    isLoggedIn,
    setToken,
    setUser,
    fetchProfile,
    logout,
  }
})
