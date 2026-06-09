<template>
  <view
    class="project-card"
    @click="$emit('click', drama)"
    @longpress="$emit('longpress', drama)"
  >
    <!-- 顶部：标题 + 类型标签 -->
    <view class="project-card__header">
      <text class="project-card__title">{{ drama.title || '未命名项目' }}</text>
      <view v-if="genreLabel" class="project-card__genre-tag">
        <text class="project-card__genre-text">{{ genreLabel }}</text>
      </view>
    </view>

    <!-- 中间：集数 · 分镜数 · 比例 -->
    <view class="project-card__info">
      <text class="project-card__info-text">{{ infoText }}</text>
    </view>

    <!-- 底部：进度条 + 进度文字 -->
    <view class="project-card__footer">
      <ProgressBar :steps="4" :completed="progressStep" />
      <text class="project-card__progress-label">{{ progressLabel }}</text>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue'
import ProgressBar from './ProgressBar.vue'

const props = defineProps({
  drama: {
    type: Object,
    default: () => ({}),
  },
})

defineEmits(['click', 'longpress'])

const genreLabel = computed(() => {
  return props.drama.genre || props.drama.style || ''
})

const infoText = computed(() => {
  const d = props.drama
  const episodes = d.total_episodes || 0
  const storyboards = totalStoryboardCount.value
  const ratio = d.metadata?.aspect_ratio || '16:9'
  return `${episodes}集 · ${storyboards}分镜 · ${ratio}`
})

const totalStoryboardCount = computed(() => {
  const d = props.drama
  if (d.episodes && Array.isArray(d.episodes)) {
    return d.episodes.reduce((sum, ep) => {
      return sum + (ep.storyboards ? ep.storyboards.length : 0)
    }, 0)
  }
  return 0
})

/**
 * 进度计算逻辑（四步：剧本 → 分镜 → 图片 → 视频）
 * 0: 未开始
 * 1: 剧本完成（有 episodes 数据）
 * 2: 分镜完成（所有 episode 都有 storyboards）
 * 3: 图片生成中/完成（部分或全部 storyboard 有 image_url）
 * 4: 视频生成中/完成（部分或全部 storyboard 有 video_url）
 */
const progressStep = computed(() => {
  const d = props.drama
  // 如果后端直接提供了 progress 字段，优先使用
  if (typeof d.progress === 'number' && d.progress > 0) {
    return Math.min(4, d.progress)
  }

  const episodes = d.episodes
  if (!episodes || !Array.isArray(episodes) || episodes.length === 0) {
    return 0
  }

  // 步骤1：有剧本数据
  const allStoryboards = episodes.flatMap(ep => ep.storyboards || [])
  if (allStoryboards.length === 0) {
    return 1
  }

  // 步骤2：有分镜数据
  const hasImages = allStoryboards.some(sb => sb.image_url)
  if (!hasImages) {
    return 2
  }

  // 步骤3：有图片
  const hasVideos = allStoryboards.some(sb => sb.video_url)
  if (!hasVideos) {
    return 3
  }

  // 步骤4：有视频
  return 4
})

const PROGRESS_LABELS = ['未开始', '剧本完成', '分镜完成', '生成中', '已完成']

const progressLabel = computed(() => {
  return PROGRESS_LABELS[progressStep.value] || '未开始'
})
</script>

<style lang="scss" scoped>
.project-card {
  background-color: $bg-card;
  border-radius: 20rpx;
  padding: $spacing-md $spacing-lg;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: $spacing-sm;
  }

  &__title {
    font-size: 30rpx;
    font-weight: bold;
    color: $color-text;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__genre-tag {
    flex-shrink: 0;
    background-color: rgba($color-primary, 0.2);
    border-radius: 20rpx;
    padding: 4rpx 16rpx;
    margin-left: $spacing-sm;
  }

  &__genre-text {
    font-size: 22rpx;
    color: $color-primary;
  }

  &__info {
    margin-bottom: $spacing-sm;
  }

  &__info-text {
    font-size: 24rpx;
    color: #888;
  }

  &__footer {
    display: flex;
    flex-direction: column;
    gap: 8rpx;
  }

  &__progress-label {
    font-size: 20rpx;
    color: $color-text-muted;
  }
}
</style>
