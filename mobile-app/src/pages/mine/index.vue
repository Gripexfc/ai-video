<template>
  <view class="page-mine">
    <!-- 自定义导航栏 -->
    <view class="nav-bar" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-bar__content">
        <text class="nav-bar__title">我的</text>
      </view>
    </view>

    <!-- 用户信息卡片 -->
    <view class="user-card">
      <view class="user-card__avatar">
        <text class="user-card__avatar-text">{{ avatarLetter }}</text>
      </view>
      <view class="user-card__info">
        <text class="user-card__name">{{ userStore.user?.username || '未登录' }}</text>
        <text class="user-card__id" v-if="userStore.user">ID: {{ userStore.user.id }}</text>
      </view>
    </view>

    <!-- 积分卡片 -->
    <view class="credits-card">
      <text class="credits-card__label">积分余额</text>
      <text class="credits-card__value">{{ userStore.credits }}</text>
      <button class="credits-card__btn" @tap="handleRecharge">充值</button>
    </view>

    <!-- 菜单列表 -->
    <view class="menu-list">
      <view class="menu-item" @tap="handleChangePassword">
        <text class="menu-item__icon">&#x1F512;</text>
        <text class="menu-item__text">修改密码</text>
        <text class="menu-item__arrow">></text>
      </view>
      <view class="menu-item menu-item--danger" @tap="handleLogout">
        <text class="menu-item__icon">&#x1F6AA;</text>
        <text class="menu-item__text">退出登录</text>
        <text class="menu-item__arrow">></text>
      </view>
    </view>

    <!-- 修改密码弹窗 -->
    <view v-if="showPasswordModal" class="modal-mask" @tap="showPasswordModal = false">
      <view class="modal-content" @tap.stop>
        <text class="modal-title">修改密码</text>

        <view class="modal-field">
          <text class="modal-field__label">旧密码</text>
          <input
            v-model="passwordForm.oldPassword"
            class="modal-field__input"
            type="safe-password"
            placeholder="请输入旧密码"
            placeholder-class="input-placeholder"
          />
        </view>

        <view class="modal-field">
          <text class="modal-field__label">新密码</text>
          <input
            v-model="passwordForm.newPassword"
            class="modal-field__input"
            type="safe-password"
            placeholder="请输入新密码（至少6位）"
            placeholder-class="input-placeholder"
          />
        </view>

        <view class="modal-actions">
          <button class="modal-btn modal-btn--cancel" @tap="showPasswordModal = false">取消</button>
          <button class="modal-btn modal-btn--confirm" :loading="passwordLoading" @tap="submitPassword">确认</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useUserStore } from '@/stores/user'
import { getBalance, changePassword } from '@/api/auth'

const userStore = useUserStore()

const statusBarHeight = ref(0)
const showPasswordModal = ref(false)
const passwordLoading = ref(false)

const passwordForm = reactive({
  oldPassword: '',
  newPassword: '',
})

const avatarLetter = computed(() => {
  const name = userStore.user?.username || ''
  return name.charAt(0).toUpperCase() || '?'
})

// 初始化状态栏高度
const sysInfo = uni.getSystemInfoSync()
statusBarHeight.value = sysInfo.statusBarHeight || 0

// 每次页面显示时刷新积分
onShow(async () => {
  if (!userStore.isLoggedIn) return
  try {
    const res = await getBalance()
    userStore.credits = res.balance ?? res ?? 0
  } catch {
    // 静默失败，保留旧值
  }
})

// 获取充值 URL
function getRechargeUrl() {
  // #ifdef H5
  return window.location.origin + '/credits'
  // #endif
  // #ifndef H5
  return 'https://' + (window?.location?.host || '') + '/credits'
  // #endif
}

// 充值按钮
function handleRecharge() {
  // #ifdef H5
  window.open(getRechargeUrl(), '_blank')
  // #endif

  // #ifdef MP
  uni.navigateTo({
    url: '/pages/webview/index?url=' + encodeURIComponent(getRechargeUrl()),
  })
  // #endif

  // #ifdef APP-PLUS
  plus.runtime.openURL(getRechargeUrl())
  // #endif
}

// 修改密码
function handleChangePassword() {
  passwordForm.oldPassword = ''
  passwordForm.newPassword = ''
  showPasswordModal.value = true
}

async function submitPassword() {
  if (!passwordForm.oldPassword) {
    uni.showToast({ title: '请输入旧密码', icon: 'none' })
    return
  }
  if (!passwordForm.newPassword || passwordForm.newPassword.length < 6) {
    uni.showToast({ title: '新密码至少6位', icon: 'none' })
    return
  }
  if (passwordForm.oldPassword === passwordForm.newPassword) {
    uni.showToast({ title: '新旧密码不能相同', icon: 'none' })
    return
  }

  passwordLoading.value = true
  try {
    await changePassword({
      oldPassword: passwordForm.oldPassword,
      newPassword: passwordForm.newPassword,
    })
    uni.showToast({ title: '密码修改成功', icon: 'success' })
    showPasswordModal.value = false
  } catch (err) {
    const msg = err?.message || err?.msg || '修改失败'
    uni.showToast({ title: msg, icon: 'none' })
  } finally {
    passwordLoading.value = false
  }
}

// 退出登录
function handleLogout() {
  uni.showModal({
    title: '提示',
    content: '确定要退出登录吗？',
    confirmColor: '#f44336',
    success: (res) => {
      if (res.confirm) {
        userStore.logout()
      }
    },
  })
}
</script>

<style lang="scss" scoped>
.page-mine {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: $bg-primary;
}

/* 导航栏 */
.nav-bar {
  background-color: $bg-primary;

  &__content {
    display: flex;
    align-items: center;
    height: 88rpx;
    padding: 0 $spacing-lg;
  }

  &__title {
    font-size: 36rpx;
    font-weight: bold;
    color: $color-text;
  }
}

/* 用户信息卡片 */
.user-card {
  display: flex;
  align-items: center;
  margin: $spacing-lg $spacing-lg $spacing-md;
  padding: $spacing-lg;
  background-color: $bg-card;
  border-radius: $border-radius-lg;

  &__avatar {
    width: 96rpx;
    height: 96rpx;
    border-radius: 50%;
    background: linear-gradient(135deg, $color-primary 0%, $color-primary-dark 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: $spacing-md;
  }

  &__avatar-text {
    font-size: 40rpx;
    font-weight: bold;
    color: #ffffff;
  }

  &__info {
    display: flex;
    flex-direction: column;
  }

  &__name {
    font-size: 34rpx;
    font-weight: bold;
    color: $color-text;
    margin-bottom: 4rpx;
  }

  &__id {
    font-size: 24rpx;
    color: $color-text-muted;
  }
}

/* 积分卡片 */
.credits-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 0 $spacing-lg $spacing-lg;
  padding: $spacing-xl $spacing-lg;
  background: linear-gradient(135deg, $bg-card 0%, $bg-card-light 100%);
  border-radius: $border-radius-lg;
  border: 1rpx solid $color-border;

  &__label {
    font-size: 26rpx;
    color: $color-text-secondary;
    margin-bottom: $spacing-sm;
  }

  &__value {
    font-size: 72rpx;
    font-weight: bold;
    color: $color-primary-light;
    margin-bottom: $spacing-lg;
    line-height: 1.1;
  }

  &__btn {
    width: 280rpx;
    height: 72rpx;
    background: $color-primary;
    color: #ffffff;
    border-radius: 36rpx;
    font-size: 30rpx;
    font-weight: bold;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;

    &::after {
      border: none;
    }

    &:active {
      opacity: 0.85;
    }
  }
}

/* 菜单列表 */
.menu-list {
  margin: 0 $spacing-lg;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: $spacing-md $spacing-md;
  background-color: $bg-card;
  border-radius: $border-radius-md;
  margin-bottom: $spacing-sm;

  &:active {
    background-color: $bg-card-light;
  }

  &__icon {
    font-size: 36rpx;
    margin-right: $spacing-md;
  }

  &__text {
    flex: 1;
    font-size: 30rpx;
    color: $color-text;
  }

  &__arrow {
    font-size: 28rpx;
    color: $color-text-muted;
  }

  &--danger {
    .menu-item__text {
      color: $color-error;
    }
  }
}

/* 弹窗 */
.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.modal-content {
  width: 600rpx;
  background-color: $bg-card;
  border-radius: $border-radius-lg;
  padding: $spacing-xl $spacing-lg;
}

.modal-title {
  font-size: 34rpx;
  font-weight: bold;
  color: $color-text;
  text-align: center;
  margin-bottom: $spacing-lg;
  display: block;
}

.modal-field {
  margin-bottom: $spacing-md;

  &__label {
    font-size: 26rpx;
    color: $color-text-secondary;
    margin-bottom: 8rpx;
    display: block;
  }

  &__input {
    width: 100%;
    height: 80rpx;
    background: $bg-primary;
    border: 1rpx solid $color-border;
    border-radius: $border-radius-md;
    padding: 0 $spacing-md;
    font-size: 28rpx;
    color: #ffffff;
    box-sizing: border-box;
  }
}

.input-placeholder {
  color: $color-text-muted;
}

.modal-actions {
  display: flex;
  gap: $spacing-md;
  margin-top: $spacing-lg;
}

.modal-btn {
  flex: 1;
  height: 80rpx;
  border-radius: $border-radius-md;
  font-size: 30rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;

  &::after {
    border: none;
  }

  &--cancel {
    background-color: $bg-card-light;
    color: $color-text-secondary;
  }

  &--confirm {
    background-color: $color-primary;
    color: #ffffff;
    font-weight: bold;
  }
}
</style>
