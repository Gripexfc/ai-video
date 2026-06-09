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
      if (profile.credits !== undefined) {
        credits.value = profile.credits
      }
    } catch (err) {
      // 只在认证失败时 logout，网络错误静默处理
      if (err.message === '未登录或登录已过期') {
        logout()
      }
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
