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
  url.value = decodeURIComponent(query.url || '')
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
