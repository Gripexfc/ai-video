<template>
  <view class="page-webview">
    <web-view :src="url" v-if="url"></web-view>
    <view v-else class="empty">
      <text class="empty__text">页面加载中...</text>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'

const url = ref('')

onLoad((query) => {
  const decoded = decodeURIComponent(query.url || '')
  // 校验 URL 域名白名单
  const baseUrl = import.meta.env.VITE_API_BASE_URL.replace('/api/v1', '')
  if (decoded && (decoded.startsWith('/') || decoded.startsWith(baseUrl) || decoded.startsWith('http'))) {
    url.value = decoded
  }
})
</script>

<style lang="scss" scoped>
.page-webview {
  min-height: 100vh;
  background-color: $bg-primary;
}

.empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;

  &__text {
    color: $color-text-secondary;
    font-size: 28rpx;
  }
}
</style>
