<template>
  <view class="storyboard-item" @click="onToggle">
    <!-- 折叠态：缩略图 + 标题/描述 -->
    <view class="storyboard-item__header">
      <!-- 缩略图 -->
      <view class="storyboard-item__thumb">
        <image
          v-if="storyboard.composed_image"
          class="storyboard-item__thumb-img"
          :src="storyboard.composed_image"
          mode="aspectFill"
        />
        <view v-else class="storyboard-item__thumb-placeholder">
          <text class="storyboard-item__thumb-number">{{ storyboard.storyboard_number }}</text>
        </view>
      </view>

      <!-- 标题 + 描述摘要 -->
      <view class="storyboard-item__info">
        <text class="storyboard-item__title">
          镜头 {{ storyboard.storyboard_number }}：{{ storyboard.title || '未命名' }}
        </text>
        <text class="storyboard-item__desc">{{ truncatedDesc }}</text>
      </view>

      <!-- 展开/折叠箭头 -->
      <text class="storyboard-item__arrow">{{ expanded ? '▲' : '▼' }}</text>
    </view>

    <!-- 展开态 -->
    <view v-if="expanded" class="storyboard-item__body" @click.stop>
      <!-- 图像提示词 -->
      <view class="storyboard-item__field">
        <text class="storyboard-item__label">图像提示词</text>
        <textarea
          class="storyboard-item__textarea"
          v-model="localImagePrompt"
          placeholder="请输入图像提示词"
          :maxlength="-1"
          auto-height
        />
      </view>

      <!-- 视频提示词 -->
      <view class="storyboard-item__field">
        <text class="storyboard-item__label">视频提示词</text>
        <textarea
          class="storyboard-item__textarea"
          v-model="localVideoPrompt"
          placeholder="请输入视频提示词"
          :maxlength="-1"
          auto-height
        />
      </view>

      <!-- 操作按钮 -->
      <view class="storyboard-item__actions">
        <view class="storyboard-item__btn storyboard-item__btn--save" @click.stop="onSave">
          <text class="storyboard-item__btn-text">保存</text>
        </view>
        <view class="storyboard-item__btn storyboard-item__btn--image" @click.stop="onGenerateImage">
          <text class="storyboard-item__btn-text">生图</text>
        </view>
        <view class="storyboard-item__btn storyboard-item__btn--video" @click.stop="onGenerateVideo">
          <text class="storyboard-item__btn-text">生视频</text>
        </view>
      </view>

      <!-- 已有视频标签 -->
      <view v-if="storyboard.video_url" class="storyboard-item__badge">
        <text class="storyboard-item__badge-text">&#10003; 已有视频</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  storyboard: {
    type: Object,
    default: () => ({}),
  },
  expanded: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['toggle', 'save', 'generateImage', 'generateVideo'])

const localImagePrompt = ref(props.storyboard.image_prompt || '')
const localVideoPrompt = ref(props.storyboard.video_prompt || '')

// 同步外部数据变化
watch(
  () => props.storyboard.image_prompt,
  (val) => {
    localImagePrompt.value = val || ''
  }
)
watch(
  () => props.storyboard.video_prompt,
  (val) => {
    localVideoPrompt.value = val || ''
  }
)

const truncatedDesc = computed(() => {
  const desc = props.storyboard.description || ''
  return desc.length > 40 ? desc.substring(0, 40) + '...' : desc
})

function onToggle() {
  emit('toggle', props.storyboard)
}

function onSave() {
  emit('save', {
    ...props.storyboard,
    image_prompt: localImagePrompt.value,
    video_prompt: localVideoPrompt.value,
  })
}

function onGenerateImage() {
  emit('generateImage', {
    ...props.storyboard,
    image_prompt: localImagePrompt.value,
    video_prompt: localVideoPrompt.value,
  })
}

function onGenerateVideo() {
  emit('generateVideo', {
    ...props.storyboard,
    image_prompt: localImagePrompt.value,
    video_prompt: localVideoPrompt.value,
  })
}
</script>

<style lang="scss" scoped>
.storyboard-item {
  background-color: $bg-card;
  border-radius: $border-radius-lg;
  overflow: hidden;

  &__header {
    display: flex;
    align-items: center;
    padding: $spacing-md;
  }

  &__thumb {
    width: 120rpx;
    height: 90rpx;
    flex-shrink: 0;
    border-radius: $border-radius-sm;
    overflow: hidden;
  }

  &__thumb-img {
    width: 120rpx;
    height: 90rpx;
  }

  &__thumb-placeholder {
    width: 120rpx;
    height: 90rpx;
    background-color: $bg-primary;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__thumb-number {
    font-size: 28rpx;
    color: $color-text-muted;
    font-weight: bold;
  }

  &__info {
    flex: 1;
    margin-left: $spacing-md;
    overflow: hidden;
  }

  &__title {
    font-size: 28rpx;
    color: $color-text;
    font-weight: 500;
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__desc {
    font-size: 24rpx;
    color: $color-text-muted;
    margin-top: 6rpx;
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__arrow {
    flex-shrink: 0;
    font-size: 20rpx;
    color: $color-text-muted;
    margin-left: $spacing-sm;
  }

  &__body {
    padding: 0 $spacing-md $spacing-md;
    border-top: 1rpx solid rgba(255, 255, 255, 0.06);
  }

  &__field {
    margin-top: $spacing-md;
  }

  &__label {
    font-size: 24rpx;
    color: $color-text-secondary;
    margin-bottom: 8rpx;
    display: block;
  }

  &__textarea {
    width: 100%;
    min-height: 120rpx;
    background-color: $bg-primary;
    border-radius: $border-radius-sm;
    padding: $spacing-sm;
    font-size: 26rpx;
    color: $color-text;
    box-sizing: border-box;
  }

  &__actions {
    display: flex;
    gap: $spacing-sm;
    margin-top: $spacing-md;
  }

  &__btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 72rpx;
    border-radius: $border-radius-sm;

    &:active {
      opacity: 0.85;
    }

    &--save {
      background-color: $bg-primary;
      border: 1rpx solid rgba(255, 255, 255, 0.12);
    }

    &--image {
      background-color: rgba($color-primary, 0.15);
    }

    &--video {
      background-color: rgba($color-primary, 0.15);
    }
  }

  &__btn-text {
    font-size: 26rpx;
    color: $color-text;
  }

  &__badge {
    margin-top: $spacing-sm;
    padding: 6rpx 16rpx;
    background-color: rgba(76, 175, 80, 0.15);
    border-radius: 8rpx;
    align-self: flex-start;
    display: inline-flex;
  }

  &__badge-text {
    font-size: 22rpx;
    color: #4caf50;
  }
}
</style>
