<template>
  <view class="progress-bar">
    <view
      v-for="i in steps"
      :key="i"
      class="progress-bar__step"
      :class="{ 'progress-bar__step--completed': i <= completed }"
    />
  </view>
</template>

<script setup>
defineProps({
  steps: {
    type: Number,
    default: 4,
  },
  completed: {
    type: Number,
    default: 0,
  },
})
</script>

<style lang="scss" scoped>
.progress-bar {
  display: flex;
  gap: 8rpx;
  width: 100%;

  &__step {
    flex: 1;
    height: 6rpx;
    border-radius: 3rpx;
    background-color: #333;

    &--completed {
      background-color: #7c5cfc;
    }
  }
}
</style>
