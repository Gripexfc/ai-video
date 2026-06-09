<template>
  <view class="page-create">
    <!-- 自定义导航栏 -->
    <view class="nav-bar" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-bar__content">
        <view class="nav-bar__back" @tap="onBack">
          <text class="nav-bar__back-icon">&lt;</text>
        </view>
        <text class="nav-bar__title">{{ isEditMode ? '编辑剧本' : '新建创作' }}</text>
        <view class="nav-bar__placeholder" />
      </view>
    </view>

    <!-- ==================== 新建模式 ==================== -->
    <scroll-view v-if="!isEditMode" class="create-body" scroll-y>
      <view class="form-section">
        <!-- 项目名称 -->
        <view class="form-group">
          <text class="form-label">项目名称</text>
          <input
            v-model="form.title"
            class="input"
            type="text"
            placeholder="给你的短剧起个名字"
            placeholder-class="input-placeholder"
          />
        </view>

        <!-- 画面比例 -->
        <view class="form-group">
          <text class="form-label">画面比例</text>
          <view class="chip-row">
            <view
              v-for="item in ratioOptions"
              :key="item"
              class="chip"
              :class="{ 'chip--active': form.ratio === item }"
              @tap="form.ratio = item"
            >
              <text class="chip__text">{{ item }}</text>
            </view>
          </view>
        </view>

        <!-- 风格 -->
        <view class="form-group">
          <text class="form-label">风格</text>
          <view class="chip-row">
            <view
              v-for="item in styleOptions"
              :key="item"
              class="chip"
              :class="{ 'chip--active': form.style === item }"
              @tap="form.style = item"
            >
              <text class="chip__text">{{ item }}</text>
            </view>
          </view>
        </view>

        <!-- 类型 -->
        <view class="form-group">
          <text class="form-label">类型</text>
          <view class="chip-row">
            <view
              v-for="item in genreOptions"
              :key="item"
              class="chip"
              :class="{ 'chip--active': form.genre === item }"
              @tap="form.genre = item"
            >
              <text class="chip__text">{{ item }}</text>
            </view>
          </view>
        </view>

        <!-- 集数 -->
        <view class="form-group">
          <text class="form-label">集数</text>
          <view class="number-control">
            <view class="number-control__btn" @tap="changeEpisodes(-1)">
              <text class="number-control__btn-text">-</text>
            </view>
            <text class="number-control__value">{{ form.num_episodes }}</text>
            <view class="number-control__btn" @tap="changeEpisodes(1)">
              <text class="number-control__btn-text">+</text>
            </view>
          </view>
        </view>

        <!-- 故事梗概 -->
        <view class="form-group">
          <text class="form-label">故事梗概</text>
          <textarea
            v-model="form.synopsis"
            class="textarea textarea--create"
            placeholder="描述你想要的故事情节..."
            placeholder-class="input-placeholder"
            :maxlength="-1"
          />
        </view>
      </view>

      <!-- 生成按钮 -->
      <view class="form-footer">
        <button
          class="btn-primary"
          :loading="generating"
          :disabled="generating"
          @tap="onGenerate"
        >
          AI 生成剧本 ✨ ({{ storyCredits }} 积分)
        </button>
      </view>
    </scroll-view>

    <!-- ==================== 编辑模式 ==================== -->
    <view v-else class="edit-body">
      <!-- 集数 Tabs -->
      <scroll-view class="episode-tabs" scroll-x :scroll-into-view="tabScrollTarget">
        <view class="episode-tabs__inner">
          <view
            v-for="(ep, idx) in episodes"
            :key="ep.id"
            :id="'tab-' + idx"
            class="episode-tab"
            :class="{ 'episode-tab--active': activeEpisodeIdx === idx }"
            @tap="switchEpisode(idx)"
          >
            <text class="episode-tab__text">第 {{ idx + 1 }} 集</text>
          </view>
        </view>
      </scroll-view>

      <!-- 剧本编辑区 -->
      <view class="script-area">
        <textarea
          v-if="currentEpisode"
          v-model="currentEpisode.content"
          class="textarea textarea--edit"
          placeholder="剧本文本..."
          placeholder-class="input-placeholder"
          :maxlength="-1"
          @input="onScriptInput"
        />
      </view>

      <!-- 底部操作栏 -->
      <view class="edit-footer">
        <button
          class="btn-secondary"
          :disabled="generating"
          @tap="onRegenerate"
        >
          重新生成
        </button>
        <button
          class="btn-primary btn-primary--small"
          :loading="generatingStoryboard"
          :disabled="generatingStoryboard"
          @tap="onGenerateStoryboard"
        >
          生成分镜 →
        </button>
      </view>
    </view>

    <!-- Loading 遮罩 -->
    <view v-if="generating" class="loading-mask">
      <view class="loading-box">
        <view class="loading-spinner" />
        <text class="loading-text">AI 正在生成剧本，请稍候...</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { createDrama, getDrama, saveEpisodes } from '@/api/drama'
import { post } from '@/api/request'
import { pollTask } from '@/utils/pollTask'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()

// ---------- 页面状态 ----------
const statusBarHeight = ref(0)
const dramaId = ref('')
const isEditMode = ref(false)
const generating = ref(false)
const generatingStoryboard = ref(false)
const storyCredits = ref(10)

// ---------- 新建表单 ----------
const ratioOptions = ['16:9', '9:16', '3:4', '1:1']
const styleOptions = ['现代', '古风', '奇幻', '日常']
const genreOptions = ['剧情', '喜剧', '冒险']

const form = reactive({
  title: '',
  ratio: '9:16',
  style: '现代',
  genre: '剧情',
  num_episodes: 3,
  synopsis: '',
})

// ---------- 编辑模式数据 ----------
const episodes = ref([])
const activeEpisodeIdx = ref(0)
const tabScrollTarget = ref('')

// 当前正在编辑的剧集
const currentEpisode = computed(() => {
  return episodes.value[activeEpisodeIdx.value] || null
})

// 自动保存计时器
let autoSaveTimer = null

// ---------- 生命周期 ----------
onLoad(async (query) => {
  const sysInfo = uni.getSystemInfoSync()
  statusBarHeight.value = sysInfo.statusBarHeight || 0

  if (query?.id) {
    dramaId.value = query.id
    isEditMode.value = true
    await loadDrama(query.id)
  }

  // 拉取最新积分
  userStore.fetchProfile()
})

// ---------- 新建模式方法 ----------
function changeEpisodes(delta) {
  const next = form.num_episodes + delta
  if (next >= 1 && next <= 6) {
    form.num_episodes = next
  }
}

async function onGenerate() {
  // 表单校验
  if (!form.title.trim()) {
    uni.showToast({ title: '请输入项目名称', icon: 'none' })
    return
  }
  if (!form.synopsis.trim()) {
    uni.showToast({ title: '请输入故事梗概', icon: 'none' })
    return
  }

  generating.value = true
  try {
    // 1. 创建项目
    const drama = await createDrama({
      title: form.title.trim(),
      ratio: form.ratio,
    })
    dramaId.value = drama.id

    // 2. 发起 AI 生成
    const taskRes = await post('/generation/story', {
      drama_id: drama.id,
      synopsis: form.synopsis.trim(),
      style: form.style,
      genre: form.genre,
      num_episodes: form.num_episodes,
    })

    // 3. 轮询等待完成
    uni.showLoading({ title: '生成中...', mask: true })
    await pollTask(taskRes.task_id, 3000, 200)
    uni.hideLoading()

    // 4. 加载生成的剧本，切换到编辑模式
    await loadDrama(drama.id)
    isEditMode.value = true

    uni.showToast({ title: '剧本生成完成', icon: 'success' })
  } catch (err) {
    uni.hideLoading()
    const msg = err?.message || '生成失败，请重试'
    uni.showToast({ title: msg, icon: 'none' })
  } finally {
    generating.value = false
  }
}

// ---------- 编辑模式方法 ----------
async function loadDrama(id) {
  try {
    const drama = await getDrama(id)
    if (drama.episodes && drama.episodes.length > 0) {
      episodes.value = drama.episodes.map(ep => ({
        id: ep.id,
        script: ep.script || '',
        content: ep.content || ep.script || '',
        storyboards: ep.storyboards || [],
      }))
      activeEpisodeIdx.value = 0
      updateTabScroll()
    }
  } catch (err) {
    uni.showToast({ title: '加载项目失败', icon: 'none' })
  }
}

function switchEpisode(idx) {
  // 切换前触发一次保存
  flushAutoSave()
  activeEpisodeIdx.value = idx
  updateTabScroll()
}

function updateTabScroll() {
  tabScrollTarget.value = 'tab-' + activeEpisodeIdx.value
}

function onScriptInput() {
  // 防抖自动保存：停止输入 1 秒后保存
  if (autoSaveTimer) clearTimeout(autoSaveTimer)
  autoSaveTimer = setTimeout(() => {
    doAutoSave()
  }, 1000)
}

async function doAutoSave() {
  if (!dramaId.value || episodes.value.length === 0) return
  try {
    await saveEpisodes(dramaId.value, {
      episodes: episodes.value.map(ep => ({
        id: ep.id,
        content: ep.content,
      })),
    })
  } catch (err) {
    console.error('自动保存失败', err)
  }
}

function flushAutoSave() {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer)
    autoSaveTimer = null
    doAutoSave()
  }
}

async function onRegenerate() {
  uni.showModal({
    title: '重新生成',
    content: '确定要重新生成剧本吗？将消耗积分且覆盖当前内容。',
    success: async (res) => {
      if (!res.confirm) return

      generating.value = true
      try {
        const taskRes = await post('/generation/story', {
          drama_id: dramaId.value,
          synopsis: form.synopsis || '',
          style: form.style || '现代',
          genre: form.genre || '剧情',
          num_episodes: episodes.value.length || form.num_episodes || 3,
        })

        uni.showLoading({ title: '重新生成中...', mask: true })
        await pollTask(taskRes.task_id, 3000, 200)
        uni.hideLoading()

        await loadDrama(dramaId.value)
        uni.showToast({ title: '重新生成完成', icon: 'success' })
      } catch (err) {
        uni.hideLoading()
        uni.showToast({ title: err?.message || '重新生成失败', icon: 'none' })
      } finally {
        generating.value = false
      }
    },
  })
}

async function onGenerateStoryboard() {
  const ep = currentEpisode.value
  if (!ep) {
    uni.showToast({ title: '请选择一集', icon: 'none' })
    return
  }

  generatingStoryboard.value = true
  try {
    const taskRes = await post(`/episodes/${ep.id}/storyboards`)

    uni.showLoading({ title: '生成分镜中...', mask: true })
    await pollTask(taskRes.task_id, 3000, 200)
    uni.hideLoading()

    uni.showToast({ title: '分镜生成完成', icon: 'success' })

    // 跳转到分镜页
    setTimeout(() => {
      uni.navigateTo({
        url: `/pages/storyboard/index?episodeId=${ep.id}&dramaId=${dramaId.value}`,
      })
    }, 500)
  } catch (err) {
    uni.hideLoading()
    uni.showToast({ title: err?.message || '生成分镜失败', icon: 'none' })
  } finally {
    generatingStoryboard.value = false
  }
}

// ---------- 导航 ----------
function onBack() {
  flushAutoSave()
  uni.navigateBack()
}
</script>

<style lang="scss" scoped>
.page-create {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: $bg-primary;
}

/* ==================== 导航栏 ==================== */
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
    font-size: 36rpx;
    color: $color-text;
  }

  &__title {
    font-size: 34rpx;
    font-weight: bold;
    color: $color-text;
  }

  &__placeholder {
    width: 60rpx;
  }
}

/* ==================== 新建模式 ==================== */
.create-body {
  flex: 1;
  height: 0;
}

.form-section {
  padding: $spacing-md $spacing-lg;
}

.form-group {
  margin-bottom: $spacing-lg;
}

.form-label {
  display: block;
  font-size: 28rpx;
  color: $color-text-secondary;
  margin-bottom: $spacing-sm;
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

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-sm;
}

.chip {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 64rpx;
  padding: 0 32rpx;
  background: #1a1a2e;
  border: 1rpx solid $color-border;
  border-radius: 32rpx;

  &--active {
    background: $color-primary;
    border-color: $color-primary;

    .chip__text {
      color: #ffffff;
    }
  }

  &__text {
    font-size: 26rpx;
    color: $color-text-secondary;
  }
}

.number-control {
  display: flex;
  align-items: center;

  &__btn {
    width: 72rpx;
    height: 72rpx;
    background: #1a1a2e;
    border: 1rpx solid $color-border;
    border-radius: 16rpx;
    display: flex;
    align-items: center;
    justify-content: center;

    &:active {
      background: $bg-card-light;
    }
  }

  &__btn-text {
    font-size: 36rpx;
    color: $color-text;
  }

  &__value {
    flex: 1;
    text-align: center;
    font-size: 36rpx;
    font-weight: bold;
    color: $color-text;
  }
}

.textarea {
  width: 100%;
  background: #1a1a2e;
  border: 1rpx solid $color-border;
  border-radius: 16rpx;
  padding: 24rpx;
  font-size: 28rpx;
  color: #ffffff;
  box-sizing: border-box;

  &--create {
    height: 300rpx;
  }

  &--edit {
    flex: 1;
    height: 100%;
    min-height: 600rpx;
  }
}

.form-footer {
  padding: $spacing-md $spacing-lg $spacing-xl;
}

/* ==================== 编辑模式 ==================== */
.edit-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 0;
}

.episode-tabs {
  white-space: nowrap;
  background-color: $bg-primary;
  border-bottom: 1rpx solid $color-border;

  &__inner {
    display: inline-flex;
    padding: $spacing-sm $spacing-lg;
    gap: $spacing-sm;
  }
}

.episode-tab {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 64rpx;
  padding: 0 32rpx;
  background: #1a1a2e;
  border-radius: 32rpx;
  flex-shrink: 0;

  &--active {
    background: $color-primary;

    .episode-tab__text {
      color: #ffffff;
      font-weight: bold;
    }
  }

  &__text {
    font-size: 26rpx;
    color: $color-text-secondary;
    white-space: nowrap;
  }
}

.script-area {
  flex: 1;
  padding: $spacing-md $spacing-lg;
  display: flex;
  flex-direction: column;
}

.edit-footer {
  display: flex;
  gap: $spacing-md;
  padding: $spacing-md $spacing-lg;
  padding-bottom: calc(#{$spacing-lg} + env(safe-area-inset-bottom));
  background-color: $bg-primary;
  border-top: 1rpx solid $color-border;
}

/* ==================== 按钮 ==================== */
.btn-primary {
  width: 100%;
  height: 88rpx;
  background: #7c5cfc;
  color: #ffffff;
  border-radius: 16rpx;
  font-size: 32rpx;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;

  &::after {
    border: none;
  }

  &[disabled] {
    opacity: 0.6;
  }

  &--small {
    width: auto;
    flex: 1;
    height: 80rpx;
  }
}

.btn-secondary {
  flex: 1;
  height: 80rpx;
  background: #2a2a4a;
  color: $color-text-secondary;
  border-radius: 16rpx;
  font-size: 28rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;

  &::after {
    border: none;
  }

  &[disabled] {
    opacity: 0.6;
  }
}

/* ==================== Loading 遮罩 ==================== */
.loading-mask {
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

.loading-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-md;
}

.loading-spinner {
  width: 60rpx;
  height: 60rpx;
  border: 4rpx solid rgba(255, 255, 255, 0.2);
  border-top-color: #7c5cfc;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-text {
  font-size: 28rpx;
  color: #ffffff;
}
</style>
