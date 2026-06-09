<template>
  <view class="page-storyboard">
    <!-- 自定义导航栏 -->
    <view class="nav-bar" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-bar__content">
        <view class="nav-bar__back" @click="goBack">
          <text class="nav-bar__back-icon">&lt;</text>
        </view>
        <text class="nav-bar__title">分镜</text>
        <view class="nav-bar__right" />
      </view>
    </view>

    <!-- 统计栏 -->
    <view class="stats-bar">
      <text class="stats-bar__text">
        分镜 ({{ completedCount }}/{{ totalCount }})
      </text>
    </view>

    <!-- 分镜列表 -->
    <scroll-view class="storyboard-list" scroll-y>
      <view class="storyboard-list__inner">
        <StoryboardItem
          v-for="item in storyboards"
          :key="item.id"
          :storyboard="item"
          :expanded="expandedId === item.id"
          @toggle="onToggle"
          @save="onSave"
          @generate-image="onGenerateImage"
          @generate-video="onGenerateVideo"
        />
      </view>

      <!-- 空状态 -->
      <view v-if="!loading && storyboards.length === 0" class="empty-state">
        <text class="empty-state__text">暂无分镜数据</text>
      </view>

      <!-- 加载状态 -->
      <view v-if="loading" class="loading-state">
        <text class="loading-state__text">加载中...</text>
      </view>
    </scroll-view>

    <!-- 批量进度提示 -->
    <view v-if="batchActive" class="batch-progress">
      <text class="batch-progress__text">{{ batchProgressText }}</text>
    </view>

    <!-- 底部固定操作栏 -->
    <view class="bottom-bar" :style="{ paddingBottom: safeAreaBottom + 'px' }">
      <view
        class="bottom-bar__btn bottom-bar__btn--image"
        :class="{ 'bottom-bar__btn--disabled': batchImageCount === 0 || batchActive }"
        @click="onBatchImage"
      >
        <text class="bottom-bar__btn-text">批量生图 ({{ batchImageCount }})</text>
      </view>
      <view
        class="bottom-bar__btn bottom-bar__btn--video"
        :class="{ 'bottom-bar__btn--disabled': batchVideoCount === 0 || batchActive }"
        @click="onBatchVideo"
      >
        <text class="bottom-bar__btn-text">批量生视频 ({{ batchVideoCount }})</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getEpisodeStoryboards, updateStoryboard } from '@/api/storyboard'
import { createImage } from '@/api/image'
import { createVideo } from '@/api/video'
import { pollTask } from '@/utils/pollTask'
import StoryboardItem from '@/components/StoryboardItem.vue'

const storyboards = ref([])
const loading = ref(false)
const expandedId = ref(null)
const statusBarHeight = ref(0)
const safeAreaBottom = ref(0)

// 批量操作状态
const batchActive = ref(false)
const batchLabel = ref('')
const batchCurrent = ref(0)
const batchTotal = ref(0)

// 路由参数
let episodeId = ''
let dramaId = ''

onMounted(() => {
  const sysInfo = uni.getSystemInfoSync()
  statusBarHeight.value = sysInfo.statusBarHeight || 0
  safeAreaBottom.value = sysInfo.safeArea?.bottom
    ? sysInfo.safeArea.bottom - sysInfo.windowHeight + sysInfo.screenHeight
    : 0
})

onLoad((query) => {
  episodeId = query.episodeId || ''
  dramaId = query.dramaId || ''
  if (episodeId) {
    fetchStoryboards()
  }
})

// 统计
const totalCount = computed(() => storyboards.value.length)

const completedCount = computed(() =>
  storyboards.value.filter((s) => s.video_url).length
)

// 需要生图的分镜数（无 composed_image）
const batchImageCount = computed(() =>
  storyboards.value.filter((s) => !s.composed_image).length
)

// 需要生视频的分镜数（有 composed_image，无 video_url）
const batchVideoCount = computed(() =>
  storyboards.value.filter((s) => s.composed_image && !s.video_url).length
)

// 批量进度文案
const batchProgressText = computed(() => {
  return `${batchLabel.value} ${batchCurrent.value}/${batchTotal.value}...`
})

async function fetchStoryboards() {
  loading.value = true
  try {
    const res = await getEpisodeStoryboards(episodeId)
    storyboards.value = res.storyboards || []
  } catch (e) {
    console.error('加载分镜失败', e)
    uni.showToast({ title: '加载分镜失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function goBack() {
  uni.navigateBack()
}

function onToggle(storyboard) {
  expandedId.value = expandedId.value === storyboard.id ? null : storyboard.id
}

// 单个保存
async function onSave(storyboard) {
  try {
    await updateStoryboard(storyboard.id, {
      image_prompt: storyboard.image_prompt,
      video_prompt: storyboard.video_prompt,
    })
    uni.showToast({ title: '已保存', icon: 'success' })
  } catch (e) {
    console.error('保存失败', e)
    uni.showToast({ title: '保存失败', icon: 'none' })
  }
}

// 单个生图
async function onGenerateImage(storyboard) {
  try {
    uni.showLoading({ title: '生图中...' })
    const res = await createImage({
      drama_id: dramaId,
      storyboard_id: storyboard.id,
      prompt: storyboard.image_prompt,
    })
    const taskResult = await pollTask(res.task_id)
    uni.hideLoading()
    uni.showToast({ title: '生图完成', icon: 'success' })
    await fetchStoryboards()
  } catch (e) {
    uni.hideLoading()
    console.error('生图失败', e)
    uni.showToast({ title: e.message || '生图失败', icon: 'none' })
  }
}

// 单个生视频
async function onGenerateVideo(storyboard) {
  try {
    uni.showLoading({ title: '生视频中...' })
    const res = await createVideo({
      drama_id: dramaId,
      storyboard_id: storyboard.id,
      prompt: storyboard.video_prompt,
      image_url: storyboard.composed_image,
    })
    const taskResult = await pollTask(res.task_id)
    uni.hideLoading()
    uni.showToast({ title: '生视频完成', icon: 'success' })
    await fetchStoryboards()
  } catch (e) {
    uni.hideLoading()
    console.error('生视频失败', e)
    uni.showToast({ title: e.message || '生视频失败', icon: 'none' })
  }
}

// 批量生图
async function onBatchImage() {
  if (batchActive.value || batchImageCount.value === 0) return

  const targets = storyboards.value.filter((s) => !s.composed_image)
  await runBatch('生图中', targets, async (item) => {
    const res = await createImage({
      drama_id: dramaId,
      storyboard_id: item.id,
      prompt: item.image_prompt,
    })
    await pollTask(res.task_id)
  })
}

// 批量生视频
async function onBatchVideo() {
  if (batchActive.value || batchVideoCount.value === 0) return

  const targets = storyboards.value.filter(
    (s) => s.composed_image && !s.video_url
  )
  await runBatch('生视频中', targets, async (item) => {
    const res = await createVideo({
      drama_id: dramaId,
      storyboard_id: item.id,
      prompt: item.video_prompt,
      image_url: item.composed_image,
    })
    await pollTask(res.task_id)
  })
}

// 通用批量执行器
async function runBatch(label, targets, actionFn) {
  batchActive.value = true
  batchLabel.value = label
  batchTotal.value = targets.length
  batchCurrent.value = 0

  for (const item of targets) {
    batchCurrent.value++
    try {
      await actionFn(item)
    } catch (e) {
      console.error(`${label} 分镜 ${item.storyboard_number} 失败:`, e)
      // 继续处理下一个，不中断
    }
  }

  batchActive.value = false
  uni.showToast({ title: '批量操作完成', icon: 'success' })
  await fetchStoryboards()
}
</script>

<style lang="scss" scoped>
.page-storyboard {
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
    justify-content: space-between;
    height: 88rpx;
    padding: 0 $spacing-lg;
  }

  &__back {
    width: 60rpx;
    height: 60rpx;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__back-icon {
    font-size: 32rpx;
    color: $color-text;
  }

  &__title {
    font-size: 34rpx;
    font-weight: bold;
    color: $color-text;
  }

  &__right {
    width: 60rpx;
  }
}

/* 统计栏 */
.stats-bar {
  padding: $spacing-sm $spacing-lg;
  margin-bottom: $spacing-xs;

  &__text {
    font-size: 28rpx;
    color: $color-text-secondary;
  }
}

/* 分镜列表 */
.storyboard-list {
  flex: 1;
  height: 0;

  &__inner {
    display: flex;
    flex-direction: column;
    gap: $spacing-md;
    padding: 0 $spacing-lg $spacing-xl;
    padding-bottom: 280rpx; // 给底部栏留空间
  }
}

/* 空状态 */
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 200rpx 0;

  &__text {
    font-size: 28rpx;
    color: $color-text-muted;
  }
}

/* 加载状态 */
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: $spacing-lg 0;

  &__text {
    font-size: 24rpx;
    color: $color-text-muted;
  }
}

/* 批量进度 */
.batch-progress {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: rgba(0, 0, 0, 0.75);
  border-radius: $border-radius-lg;
  padding: $spacing-md $spacing-xl;
  z-index: 999;

  &__text {
    font-size: 28rpx;
    color: #fff;
  }
}

/* 底部固定栏 */
.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  gap: $spacing-md;
  padding: $spacing-md $spacing-lg;
  background-color: $bg-card;
  box-shadow: 0 -4rpx 16rpx rgba(0, 0, 0, 0.15);
  z-index: 100;

  &__btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 88rpx;
    border-radius: $border-radius-lg;
    background-color: $color-primary;

    &:active {
      opacity: 0.85;
    }

    &--image {
      background-color: $color-primary;
    }

    &--video {
      background-color: $color-primary;
    }

    &--disabled {
      opacity: 0.4;
      pointer-events: none;
    }
  }

  &__btn-text {
    font-size: 28rpx;
    color: #fff;
    font-weight: 500;
  }
}
</style>
