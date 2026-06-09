<template>
  <view class="page-preview">
    <!-- 自定义导航栏 -->
    <view class="nav-bar" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-bar__content">
        <text class="nav-bar__title">作品</text>
        <view class="nav-bar__right">
          <text class="nav-bar__credits">{{ userStore.credits }} 积分</text>
        </view>
      </view>
    </view>

    <!-- 项目选择器 -->
    <view class="picker-bar">
      <view class="picker-bar__inner" @click="showDramaPicker = true">
        <text class="picker-bar__label">
          {{ selectedDrama ? selectedDrama.title : '请选择项目' }}
        </text>
        <text class="picker-bar__arrow">&#9662;</text>
      </view>
    </view>

    <!-- 分镜网格 -->
    <scroll-view
      class="grid-scroll"
      scroll-y
      refresher-enabled
      :refresher-triggered="refreshing"
      @refresherrefresh="onRefresh"
    >
      <view v-if="storyboards.length > 0" class="grid">
        <view
          v-for="item in storyboards"
          :key="item.id"
          class="grid-item"
          @click="onItemClick(item)"
        >
          <!-- 有合成图 -->
          <image
            v-if="item.composed_image"
            class="grid-item__thumb"
            :src="item.composed_image"
            mode="aspectFill"
          />

          <!-- 有视频覆盖层 -->
          <view v-if="item.video_url" class="grid-item__play">
            <view class="grid-item__play-icon">
              <text class="grid-item__play-triangle">&#9654;</text>
            </view>
          </view>

          <!-- 无内容占位 -->
          <view v-if="!item.composed_image" class="grid-item__placeholder">
            <text class="grid-item__placeholder-text">{{ item.storyboard_number || '' }}</text>
          </view>

          <!-- 序号标签 -->
          <view class="grid-item__badge">
            <text class="grid-item__badge-text">{{ item.storyboard_number }}</text>
          </view>
        </view>
      </view>

      <!-- 空状态：未选择项目 -->
      <view v-else-if="!selectedDrama && !loading" class="empty-state">
        <text class="empty-state__icon">&#x1F3AC;</text>
        <text class="empty-state__text">选择一个项目查看作品</text>
        <text class="empty-state__hint">点击上方选择项目</text>
      </view>

      <!-- 空状态：项目无分镜 -->
      <view v-else-if="selectedDrama && !loading && storyboards.length === 0" class="empty-state">
        <text class="empty-state__icon">&#x1F4DD;</text>
        <text class="empty-state__text">该项目暂无分镜作品</text>
        <text class="empty-state__hint">前往创作页生成分镜</text>
      </view>

      <!-- 加载状态 -->
      <view v-if="loading" class="loading-state">
        <text class="loading-state__text">加载中...</text>
      </view>

      <!-- 底部安全区 -->
      <view class="bottom-spacer" />
    </scroll-view>

    <!-- 项目选择弹窗 -->
    <view v-if="showDramaPicker" class="picker-mask" @click="showDramaPicker = false">
      <view class="picker-panel" @click.stop>
        <view class="picker-panel__header">
          <text class="picker-panel__title">选择项目</text>
          <view class="picker-panel__close" @click="showDramaPicker = false">
            <text class="picker-panel__close-icon">&#10005;</text>
          </view>
        </view>
        <scroll-view class="picker-panel__list" scroll-y>
          <view
            v-for="drama in dramas"
            :key="drama.id"
            class="picker-panel__item"
            :class="{ 'picker-panel__item--active': selectedDrama?.id === drama.id }"
            @click="onSelectDrama(drama)"
          >
            <text class="picker-panel__item-text">{{ drama.title || '未命名项目' }}</text>
            <text v-if="selectedDrama?.id === drama.id" class="picker-panel__item-check">&#10003;</text>
          </view>
          <view v-if="dramas.length === 0 && !loadingDramas" class="picker-panel__empty">
            <text class="picker-panel__empty-text">暂无项目</text>
          </view>
        </scroll-view>
      </view>
    </view>

    <!-- 视频播放弹窗 -->
    <view v-if="showVideoPlayer" class="video-mask" @click="closeVideoPlayer">
      <view class="video-panel" @click.stop>
        <view class="video-panel__close" @click="closeVideoPlayer">
          <text class="video-panel__close-icon">&#10005;</text>
        </view>
        <video
          v-if="currentVideoUrl"
          class="video-panel__player"
          :src="currentVideoUrl"
          controls
          autoplay
          :show-fullscreen-btn="true"
          :show-play-btn="true"
          object-fit="contain"
        />
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useUserStore } from '@/stores/user'
import { listDramas, getDrama } from '@/api/drama'
import { getEpisodeStoryboards } from '@/api/storyboard'

const userStore = useUserStore()

// 状态栏高度
const statusBarHeight = ref(0)
const sysInfo = uni.getSystemInfoSync()
statusBarHeight.value = sysInfo.statusBarHeight || 0

// 项目列表与选择
const dramas = ref([])
const selectedDrama = ref(null)
const showDramaPicker = ref(false)
const loadingDramas = ref(false)

// 分镜数据
const storyboards = ref([])
const loading = ref(false)
const refreshing = ref(false)

// 视频播放
const showVideoPlayer = ref(false)
const currentVideoUrl = ref('')

onShow(() => {
  userStore.fetchProfile()
  fetchDramas()
})

async function fetchDramas() {
  loadingDramas.value = true
  try {
    const res = await listDramas({ page: 1, page_size: 100 })
    dramas.value = res.items || []
    // 自动选中第一个项目（如果尚未选择）
    if (!selectedDrama.value && dramas.value.length > 0) {
      selectedDrama.value = dramas.value[0]
      await fetchStoryboards()
    } else if (selectedDrama.value) {
      // 已选过项目，刷新分镜
      await fetchStoryboards()
    }
  } catch (e) {
    console.error('加载项目列表失败', e)
  } finally {
    loadingDramas.value = false
  }
}

async function fetchStoryboards() {
  if (!selectedDrama.value) return

  loading.value = true
  try {
    // 获取项目详情，拿到第一集 ID
    const drama = await getDrama(selectedDrama.value.id)
    const episodes = drama.episodes || []
    if (episodes.length === 0) {
      storyboards.value = []
      return
    }
    // 取第一集
    const firstEpisode = episodes[0]
    const res = await getEpisodeStoryboards(firstEpisode.id)
    storyboards.value = res.storyboards || []
  } catch (e) {
    console.error('加载分镜失败', e)
    storyboards.value = []
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

function onRefresh() {
  refreshing.value = true
  fetchStoryboards()
}

function onSelectDrama(drama) {
  selectedDrama.value = drama
  showDramaPicker.value = false
  fetchStoryboards()
}

function onItemClick(item) {
  // 优先播放视频
  if (item.video_url) {
    currentVideoUrl.value = item.video_url
    showVideoPlayer.value = true
    return
  }
  // 有图片则全屏预览
  if (item.composed_image) {
    // 收集所有有图片的分镜用于滑动预览
    const urls = storyboards.value
      .filter((s) => s.composed_image)
      .map((s) => s.composed_image)
    const current = item.composed_image
    uni.previewImage({
      urls,
      current,
    })
  }
}

function closeVideoPlayer() {
  showVideoPlayer.value = false
  currentVideoUrl.value = ''
}
</script>

<style lang="scss" scoped>
.page-preview {
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

  &__title {
    font-size: 36rpx;
    font-weight: bold;
    color: $color-text;
  }

  &__right {
    padding: 8rpx 20rpx;
    background-color: rgba($color-primary, 0.15);
    border-radius: 24rpx;
  }

  &__credits {
    font-size: 24rpx;
    color: $color-primary;
  }
}

/* 项目选择器 */
.picker-bar {
  padding: $spacing-sm $spacing-lg $spacing-md;

  &__inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background-color: $bg-card;
    border-radius: $border-radius-md;
    padding: 0 $spacing-md;
    height: 80rpx;
  }

  &__label {
    font-size: 28rpx;
    color: $color-text;
  }

  &__arrow {
    font-size: 24rpx;
    color: $color-text-secondary;
  }
}

/* 分镜网格滚动区 */
.grid-scroll {
  flex: 1;
  height: 0;
}

/* 网格 */
.grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  padding: 0 $spacing-lg;
}

/* 网格项 */
.grid-item {
  position: relative;
  width: calc((100% - 12rpx) / 2);
  aspect-ratio: 16 / 10;
  border-radius: 12rpx;
  overflow: hidden;
  background-color: $bg-card;

  &__thumb {
    width: 100%;
    height: 100%;
  }

  &__play {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(0, 0, 0, 0.25);
  }

  &__play-icon {
    width: 64rpx;
    height: 64rpx;
    border-radius: 50%;
    background-color: rgba(255, 255, 255, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__play-triangle {
    font-size: 24rpx;
    color: $color-primary;
    margin-left: 4rpx;
  }

  &__placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: $bg-card-light;
  }

  &__placeholder-text {
    font-size: 28rpx;
    color: $color-text-muted;
  }

  &__badge {
    position: absolute;
    top: 8rpx;
    left: 8rpx;
    background-color: rgba(0, 0, 0, 0.55);
    border-radius: 8rpx;
    padding: 2rpx 10rpx;
  }

  &__badge-text {
    font-size: 20rpx;
    color: #fff;
  }
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-top: 200rpx;

  &__icon {
    font-size: 80rpx;
    margin-bottom: $spacing-md;
  }

  &__text {
    font-size: 32rpx;
    color: $color-text-secondary;
    margin-bottom: $spacing-xs;
  }

  &__hint {
    font-size: 24rpx;
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

/* 底部安全区占位 */
.bottom-spacer {
  height: 180rpx;
}

/* 项目选择弹窗 */
.picker-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.55);
  z-index: 500;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.picker-panel {
  width: 100%;
  max-height: 70vh;
  background-color: $bg-card;
  border-radius: $border-radius-xl $border-radius-xl 0 0;
  display: flex;
  flex-direction: column;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: $spacing-md $spacing-lg;
    border-bottom: 1px solid $color-border;
  }

  &__title {
    font-size: 32rpx;
    font-weight: bold;
    color: $color-text;
  }

  &__close {
    width: 56rpx;
    height: 56rpx;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__close-icon {
    font-size: 28rpx;
    color: $color-text-secondary;
  }

  &__list {
    max-height: 60vh;
  }

  &__item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: $spacing-md $spacing-lg;
    border-bottom: 1px solid $color-border;

    &:active {
      background-color: $bg-card-light;
    }

    &--active {
      background-color: rgba($color-primary, 0.1);
    }
  }

  &__item-text {
    font-size: 28rpx;
    color: $color-text;
  }

  &__item-check {
    font-size: 28rpx;
    color: $color-primary;
  }

  &__empty {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: $spacing-xl 0;
  }

  &__empty-text {
    font-size: 28rpx;
    color: $color-text-muted;
  }
}

/* 视频播放弹窗 */
.video-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.85);
  z-index: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

.video-panel {
  position: relative;
  width: 100%;
  display: flex;
  flex-direction: column;

  &__close {
    position: absolute;
    top: 20rpx;
    right: 20rpx;
    width: 64rpx;
    height: 64rpx;
    border-radius: 50%;
    background-color: rgba(255, 255, 255, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
  }

  &__close-icon {
    font-size: 28rpx;
    color: #fff;
  }

  &__player {
    width: 100%;
    height: 420rpx;
  }
}
</style>
