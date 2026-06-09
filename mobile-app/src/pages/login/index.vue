<template>
  <view class="login-page">
    <!-- Logo & Title -->
    <view class="header">
      <view class="logo-wrap">
        <text class="logo-text">M</text>
      </view>
      <text class="app-name">视频miao~</text>
      <text class="app-subtitle">AI 短剧创作平台</text>
    </view>

    <!-- Tab Bar -->
    <view class="tab-bar">
      <view
        class="tab-item"
        :class="{ 'tab-active': activeTab === 'login' }"
        @tap="activeTab = 'login'"
      >
        <text class="tab-text">登录</text>
      </view>
      <view
        class="tab-item"
        :class="{ 'tab-active': activeTab === 'register' }"
        @tap="activeTab = 'register'"
      >
        <text class="tab-text">注册</text>
      </view>
    </view>

    <!-- Form -->
    <view class="form">
      <view class="input-group">
        <input
          v-model="form.username"
          class="input"
          type="text"
          placeholder="用户名"
          placeholder-class="input-placeholder"
        />
      </view>

      <view class="input-group">
        <input
          v-model="form.password"
          class="input"
          type="safe-password"
          placeholder="密码"
          placeholder-class="input-placeholder"
        />
      </view>

      <view v-if="activeTab === 'register'" class="input-group">
        <input
          v-model="form.confirmPassword"
          class="input"
          type="safe-password"
          placeholder="确认密码"
          placeholder-class="input-placeholder"
        />
      </view>

      <button class="btn-primary" :loading="loading" :disabled="loading" @tap="handleSubmit">
        {{ activeTab === 'login' ? '登 录' : '注 册' }}
      </button>
    </view>
  </view>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { login, register } from '@/api/auth'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()

const activeTab = ref('login')
const loading = ref(false)

const form = reactive({
  username: '',
  password: '',
  confirmPassword: '',
})

function validate() {
  if (!form.username.trim()) {
    uni.showToast({ title: '请输入用户名', icon: 'none' })
    return false
  }
  if (!form.password) {
    uni.showToast({ title: '请输入密码', icon: 'none' })
    return false
  }
  if (form.password.length < 6) {
    uni.showToast({ title: '密码至少6位', icon: 'none' })
    return false
  }
  if (activeTab.value === 'register') {
    if (!form.confirmPassword) {
      uni.showToast({ title: '请确认密码', icon: 'none' })
      return false
    }
    if (form.password !== form.confirmPassword) {
      uni.showToast({ title: '两次密码不一致', icon: 'none' })
      return false
    }
  }
  return true
}

async function handleSubmit() {
  if (!validate()) return

  loading.value = true
  try {
    const payload = {
      username: form.username.trim(),
      password: form.password,
    }

    if (activeTab.value === 'login') {
      const res = await login(payload)
      userStore.setToken(res.token)
      userStore.setUser(res)
      // 登录后同步积分
      userStore.fetchProfile()
      uni.showToast({ title: '登录成功', icon: 'success' })
      setTimeout(() => {
        uni.switchTab({ url: '/pages/home/index' })
      }, 500)
    } else {
      await register(payload)
      uni.showToast({ title: '注册成功，请登录', icon: 'success' })
      activeTab.value = 'login'
      form.password = ''
      form.confirmPassword = ''
    }
  } catch (err) {
    const msg = err?.message || err?.msg || (activeTab.value === 'login' ? '登录失败' : '注册失败')
    uni.showToast({ title: msg, icon: 'none' })
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss" scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0 48rpx;
  background: linear-gradient(180deg, #1a1a2e 0%, #0d0d1a 100%);
}

/* Header */
.header {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 64rpx;
}

.logo-wrap {
  width: 120rpx;
  height: 120rpx;
  border-radius: 24rpx;
  background: linear-gradient(135deg, #7c5cfc 0%, #5a3cd4 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24rpx;
}

.logo-text {
  font-size: 56rpx;
  font-weight: bold;
  color: #ffffff;
}

.app-name {
  font-size: 48rpx;
  font-weight: bold;
  color: $color-primary;
  margin-bottom: 12rpx;
}

.app-subtitle {
  font-size: 28rpx;
  color: $color-text-secondary;
}

/* Tab Bar */
.tab-bar {
  width: 100%;
  display: flex;
  border-bottom: 1rpx solid #333333;
  margin-bottom: 48rpx;
}

.tab-item {
  flex: 1;
  display: flex;
  justify-content: center;
  padding-bottom: 20rpx;
  position: relative;
}

.tab-item.tab-active {
  .tab-text {
    color: $color-primary;
    font-weight: bold;
  }

  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 60rpx;
    height: 4rpx;
    background-color: $color-primary;
    border-radius: 2rpx;
  }
}

.tab-text {
  font-size: 32rpx;
  color: $color-text-secondary;
}

/* Form */
.form {
  width: 100%;
}

.input-group {
  margin-bottom: 24rpx;
}

.input {
  width: 100%;
  height: 88rpx;
  background: #1a1a2e;
  border: 1rpx solid $color-border;
  border-radius: 16rpx;
  padding: 0 24rpx;
  font-size: 30rpx;
  color: #ffffff;
  box-sizing: border-box;
}

.input-placeholder {
  color: $color-text-muted;
}

.btn-primary {
  width: 100%;
  height: 88rpx;
  background: $color-primary;
  color: #ffffff;
  border-radius: 16rpx;
  font-size: 32rpx;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 40rpx;
  border: none;

  &::after {
    border: none;
  }

  &[disabled] {
    opacity: 0.6;
  }
}
</style>
