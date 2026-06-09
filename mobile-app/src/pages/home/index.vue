<template>
  <view class="page-home">
    <!-- 自定义导航栏 -->
    <view class="nav-bar" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-bar__content">
        <text class="nav-bar__title">视频喵</text>
        <view class="nav-bar__right" @click="goRecharge">
          <text class="nav-bar__credits">{{ userStore.credits }} 积分</text>
        </view>
      </view>
    </view>

    <!-- 搜索栏 -->
    <view class="search-bar">
      <view class="search-bar__inner">
        <text class="search-bar__icon">&#x1F50D;</text>
        <input
          class="search-bar__input"
          type="text"
          placeholder="搜索项目"
          placeholder-class="search-bar__placeholder"
          :value="keyword"
          @confirm="onSearch"
          @input="onInput"
        />
      </view>
    </view>

    <!-- 项目列表 -->
    <scroll-view
      class="project-list"
      scroll-y
      refresher-enabled
      :refresher-triggered="refreshing"
      @refresherrefresh="onRefresh"
      @scrolltolower="onLoadMore"
    >
      <view v-if="dramas.length > 0" class="project-list__inner">
        <ProjectCard
          v-for="item in dramas"
          :key="item.id"
          :drama="item"
          @click="onCardClick"
          @longpress="onCardLongpress"
        />
      </view>

      <!-- 空状态 -->
      <view v-else-if="!loading" class="empty-state">
        <text class="empty-state__icon">&#x1F4DA;</text>
        <text class="empty-state__text">暂无项目</text>
        <text class="empty-state__hint">点击右下角 + 开始创作</text>
      </view>

      <!-- 加载状态 -->
      <view v-if="loading" class="loading-state">
        <text class="loading-state__text">加载中...</text>
      </view>

      <!-- 没有更多 -->
      <view v-if="!loading && dramas.length > 0 && noMore" class="no-more">
        <text class="no-more__text">没有更多了</text>
      </view>
    </scroll-view>

    <!-- FAB 按钮 -->
    <view class="fab" @click="onFabClick">
      <text class="fab__icon">+</text>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useUserStore } from '@/stores/user'
import { listDramas, deleteDrama } from '@/api/drama'
import ProjectCard from '@/components/ProjectCard.vue'

const userStore = useUserStore()

const dramas = ref([])
const loading = ref(false)
const refreshing = ref(false)
const keyword = ref('')
const page = ref(1)
const pageSize = 20
const total = ref(0)
const noMore = ref(false)
const statusBarHeight = ref(0)

onMounted(async () => {
  // 获取状态栏高度
  const sysInfo = uni.getSystemInfoSync()
  statusBarHeight.value = sysInfo.statusBarHeight || 0

  // 加载数据
  await fetchList()

  // 拉取最新积分
  userStore.fetchProfile()
})

async function fetchList(isRefresh = false) {
  if (loading.value) return

  if (isRefresh) {
    page.value = 1
    noMore.value = false
  }

  loading.value = true
  try {
    const params = {
      page: page.value,
      page_size: pageSize,
    }
    if (keyword.value) {
      params.keyword = keyword.value
    }
    const res = await listDramas(params)
    const items = res.items || []

    if (isRefresh || page.value === 1) {
      dramas.value = items
    } else {
      dramas.value = [...dramas.value, ...items]
    }

    total.value = res.pagination?.total || 0
    if (dramas.value.length >= total.value) {
      noMore.value = true
    }
  } catch (e) {
    console.error('加载项目列表失败', e)
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

function onRefresh() {
  refreshing.value = true
  fetchList(true)
}

function onLoadMore() {
  if (loading.value || noMore.value) return
  page.value++
  fetchList()
}

function onInput(e) {
  keyword.value = e.detail.value
}

function onSearch() {
  fetchList(true)
}

function onCardClick(drama) {
  uni.navigateTo({
    url: `/pages/create/index?id=${drama.id}`,
  })
}

function onCardLongpress(drama) {
  uni.showModal({
    title: '删除项目',
    content: `确定要删除「${drama.title || '未命名项目'}」吗？删除后不可恢复。`,
    confirmColor: '#f44336',
    success: async (res) => {
      if (res.confirm) {
        try {
          await deleteDrama(drama.id)
          dramas.value = dramas.value.filter(d => d.id !== drama.id)
          uni.showToast({ title: '已删除', icon: 'success' })
        } catch (e) {
          uni.showToast({ title: '删除失败', icon: 'none' })
        }
      }
    },
  })
}

function onFabClick() {
  uni.navigateTo({
    url: '/pages/create/index',
  })
}

function goRecharge() {
  uni.switchTab({
    url: '/pages/mine/index',
  })
}
</script>

<style lang="scss" scoped>
.page-home {
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

/* 搜索栏 */
.search-bar {
  padding: 0 $spacing-lg $spacing-sm;

  &__inner {
    display: flex;
    align-items: center;
    background-color: $bg-card;
    border-radius: $border-radius-xl;
    padding: 0 $spacing-md;
    height: 72rpx;
  }

  &__icon {
    font-size: 28rpx;
    margin-right: $spacing-sm;
  }

  &__input {
    flex: 1;
    font-size: 28rpx;
    color: $color-text;
    height: 72rpx;
  }

  &__placeholder {
    color: $color-text-muted;
  }
}

/* 项目列表 */
.project-list {
  flex: 1;
  height: 0; // 让 scroll-view 占满剩余空间

  &__inner {
    display: flex;
    flex-direction: column;
    gap: $spacing-md;
    padding: $spacing-sm $spacing-lg $spacing-xl;
    padding-bottom: 180rpx; // 给 FAB 留空间
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

/* 没有更多 */
.no-more {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: $spacing-md 0 $spacing-xl;

  &__text {
    font-size: 22rpx;
    color: $color-text-muted;
  }
}

/* FAB 按钮 */
.fab {
  position: fixed;
  right: 40rpx;
  bottom: 180rpx;
  width: 100rpx;
  height: 100rpx;
  border-radius: 50%;
  background-color: $color-primary;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 24rpx rgba($color-primary, 0.4);

  &:active {
    opacity: 0.85;
    transform: scale(0.95);
  }

  &__icon {
    font-size: 48rpx;
    color: #fff;
    line-height: 1;
    margin-top: -4rpx;
  }
}
</style>
