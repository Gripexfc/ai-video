# 手机端 UniApp 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 创建 UniApp 手机端项目，支持 H5/微信小程序/Android/iOS 四端编译，实现快速创作流程。

**Architecture:** UniApp + Vue 3 Composition API + Pinia 状态管理。所有请求通过 `uni.request` 封装层调用现有 `backend-node` API，零后端修改。项目放在仓库根目录 `mobile-app/` 下。

**Tech Stack:** UniApp (Vue 3), Pinia, uni-ui, uv-ui, uni.request, Vite

---

## File Structure

```
mobile-app/
├── src/
│   ├── pages/
│   │   ├── login/index.vue          # 登录/注册
│   │   ├── home/index.vue           # 首页-项目列表
│   │   ├── create/index.vue         # 创作页-梗概+剧本编辑
│   │   ├── storyboard/index.vue     # 分镜列表+提示词编辑
│   │   ├── preview/index.vue        # 作品预览
│   │   ├── mine/index.vue           # 我的-积分/密码/充值
│   │   └── webview/index.vue        # 充值webview(小程序用)
│   ├── api/
│   │   ├── request.js               # uni.request封装+token+401拦截
│   │   ├── auth.js                  # 登录/注册/积分/密码
│   │   ├── drama.js                 # 项目CRUD+剧本保存
│   │   ├── storyboard.js            # 分镜CRUD
│   │   ├── image.js                 # 图片生成
│   │   ├── video.js                 # 视频生成
│   │   └── task.js                  # 任务状态轮询
│   ├── stores/
│   │   └── user.js                  # Pinia: token/user/credits
│   ├── components/
│   │   ├── ProjectCard.vue          # 项目卡片
│   │   ├── StoryboardItem.vue       # 分镜条目(可展开编辑)
│   │   └── ProgressBar.vue          # 创作进度条
│   ├── utils/
│   │   └── pollTask.js              # 异步任务轮询封装
│   ├── static/
│   │   └── logo.png                 # App图标
│   ├── App.vue
│   ├── main.js
│   ├── manifest.json
│   ├── pages.json
│   └── uni.scss
├── index.html
├── package.json
└── vite.config.js
```

---

### Task 1: 项目初始化与基础配置

**Files:**
- Create: `mobile-app/package.json`
- Create: `mobile-app/vite.config.js`
- Create: `mobile-app/index.html`
- Create: `mobile-app/src/main.js`
- Create: `mobile-app/src/App.vue`
- Create: `mobile-app/src/manifest.json`
- Create: `mobile-app/src/pages.json`
- Create: `mobile-app/src/uni.scss`

- [ ] **Step 1: 用 degit 创建 UniApp + Vue 3 项目骨架**

```bash
cd /Users/edy/Desktop/视频miao~
npx degit dcloudio/uni-preset-vue#vite-ts mobile-app
```

如果 degit 失败，手动创建目录结构：

```bash
mkdir -p mobile-app/src/{pages/{login,home,create,storyboard,preview,mine,webview},api,stores,components,utils,static}
```

- [ ] **Step 2: 安装依赖**

```bash
cd /Users/edy/Desktop/视频miao~/mobile-app
npm install pinia @dcloudio/uni-ui
```

- [ ] **Step 3: 配置 pages.json（路由 + TabBar）**

```json
{
  "pages": [
    { "path": "pages/home/index", "style": { "navigationBarTitleText": "视频miao~" } },
    { "path": "pages/create/index", "style": { "navigationBarTitleText": "创作" } },
    { "path": "pages/preview/index", "style": { "navigationBarTitleText": "作品" } },
    { "path": "pages/mine/index", "style": { "navigationBarTitleText": "我的" } },
    { "path": "pages/login/index", "style": { "navigationBarTitleText": "登录" } },
    { "path": "pages/storyboard/index", "style": { "navigationBarTitleText": "分镜" } },
    { "path": "pages/webview/index", "style": { "navigationBarTitleText": "充值" } }
  ],
  "globalStyle": {
    "navigationBarTextStyle": "white",
    "navigationBarTitleText": "视频miao~",
    "navigationBarBackgroundColor": "#1a1a2e",
    "backgroundColor": "#0d0d1a"
  },
  "tabBar": {
    "color": "#888888",
    "selectedColor": "#7c5cfc",
    "backgroundColor": "#1a1a2e",
    "borderStyle": "black",
    "list": [
      { "pagePath": "pages/home/index", "text": "首页", "iconPath": "static/tab-home.png", "selectedIconPath": "static/tab-home-active.png" },
      { "pagePath": "pages/create/index", "text": "创作", "iconPath": "static/tab-create.png", "selectedIconPath": "static/tab-create-active.png" },
      { "pagePath": "pages/preview/index", "text": "作品", "iconPath": "static/tab-preview.png", "selectedIconPath": "static/tab-preview-active.png" },
      { "pagePath": "pages/mine/index", "text": "我的", "iconPath": "static/tab-mine.png", "selectedIconPath": "static/tab-mine-active.png" }
    ]
  }
}
```

- [ ] **Step 4: 配置 manifest.json**

确保 `manifest.json` 中包含基础 AppID 和 H5/小程序配置。设置 `"vueVersion": "3"`。

- [ ] **Step 5: 配置 main.js（注册 Pinia）**

```javascript
import { createSSRApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

export function createApp() {
  const app = createSSRApp(App)
  app.use(createPinia())
  return { app }
}
```

- [ ] **Step 6: 创建 App.vue（登录拦截）**

```vue
<script>
export default {
  onLaunch() {
    const token = uni.getStorageSync('user_token')
    if (!token) {
      uni.reLaunch({ url: '/pages/login/index' })
    }
  }
}
</script>

<style>
page { background-color: #0d0d1a; color: #ffffff; }
</style>
```

- [ ] **Step 7: 创建占位页面文件**

为每个页面创建最小 Vue 文件，确保项目能编译运行：

```vue
<template><view class="container"><text>首页</text></view></template>
```

对 login、home、create、storyboard、preview、mine、webview 各创建一个。

- [ ] **Step 8: 验证项目能编译运行**

```bash
cd /Users/edy/Desktop/视频miao~/mobile-app
npm run dev:h5
```

浏览器打开 `http://localhost:5173`（或终端提示的端口），确认页面能加载。

- [ ] **Step 9: 提交**

```bash
cd /Users/edy/Desktop/视频miao~
git add mobile-app/
git commit -m "init: UniApp 手机端项目骨架"
```

---

### Task 2: API 封装层（request + auth + task）

**Files:**
- Create: `mobile-app/src/api/request.js`
- Create: `mobile-app/src/api/auth.js`
- Create: `mobile-app/src/api/task.js`
- Create: `mobile-app/src/utils/pollTask.js`
- Create: `mobile-app/src/stores/user.js`

- [ ] **Step 1: 创建 api/request.js（uni.request 封装）**

```javascript
const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1'

function request({ url, method = 'GET', data, header = {} }) {
  return new Promise((resolve, reject) => {
    const token = uni.getStorageSync('user_token')
    if (token) {
      header['Authorization'] = `Bearer ${token}`
    }
    uni.request({
      url: BASE_URL + url,
      method,
      data,
      header: { 'Content-Type': 'application/json', ...header },
      success: (res) => {
        if (res.statusCode === 401) {
          uni.removeStorageSync('user_token')
          uni.reLaunch({ url: '/pages/login/index' })
          return reject(new Error('登录已过期'))
        }
        if (res.statusCode === 402) {
          uni.showModal({
            title: '积分不足',
            content: res.data?.error || '积分不足，请充值后继续',
            confirmText: '去充值',
            success: (modalRes) => {
              if (modalRes.confirm) {
                // #ifdef H5
                window.open('/credits', '_blank')
                // #endif
                // #ifdef MP-WEIXIN
                uni.navigateTo({ url: '/pages/webview/index?url=' + encodeURIComponent('/credits') })
                // #endif
              }
            }
          })
          return reject(new Error('积分不足'))
        }
        if (res.statusCode >= 400) {
          const msg = res.data?.error || res.data?.error?.message || '请求失败'
          return reject(new Error(msg))
        }
        const body = res.data
        if (body.success === false) {
          return reject(new Error(body.error?.message || body.error || '请求失败'))
        }
        resolve(body.data !== undefined ? body.data : body)
      },
      fail: (err) => reject(new Error(err.errMsg || '网络错误')),
    })
  })
}

export function get(url, params) {
  return request({ url, method: 'GET', data: params })
}
export function post(url, data) {
  return request({ url, method: 'POST', data })
}
export function put(url, data) {
  return request({ url, method: 'PUT', data })
}
export function del(url) {
  return request({ url, method: 'DELETE' })
}
export default request
```

- [ ] **Step 2: 创建 api/auth.js**

```javascript
import { get, post, put } from './request'

export function login(data) {
  return post('/auth/login', data)
}
export function register(data) {
  return post('/auth/register', data)
}
export function getProfile() {
  return get('/auth/profile')
}
export function changePassword(data) {
  return put('/auth/password', data)
}
export function getBalance() {
  return get('/credits/balance')
}
```

- [ ] **Step 3: 创建 api/task.js**

```javascript
import { get } from './request'

export function getTaskStatus(taskId) {
  return get(`/tasks/${taskId}`)
}
```

- [ ] **Step 4: 创建 utils/pollTask.js**

```javascript
import { getTaskStatus } from '@/api/task'

export function pollTask(taskId, interval = 2000, maxAttempts = 300) {
  return new Promise((resolve, reject) => {
    let attempts = 0
    const timer = setInterval(async () => {
      attempts++
      try {
        const task = await getTaskStatus(taskId)
        if (task.status === 'completed') {
          clearInterval(timer)
          resolve(task.result)
        } else if (task.status === 'failed') {
          clearInterval(timer)
          reject(new Error(task.error || '任务失败'))
        } else if (attempts >= maxAttempts) {
          clearInterval(timer)
          reject(new Error('任务超时'))
        }
      } catch (e) {
        clearInterval(timer)
        reject(e)
      }
    }, interval)
  })
}
```

- [ ] **Step 5: 创建 stores/user.js**

```javascript
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getProfile } from '@/api/auth'

export const useUserStore = defineStore('user', () => {
  const token = ref(uni.getStorageSync('user_token') || '')
  const user = ref(null)
  const credits = ref(0)
  const isLoggedIn = computed(() => !!token.value)

  function setToken(t) {
    token.value = t
    uni.setStorageSync('user_token', t)
  }

  function setUser(u) {
    user.value = u
    credits.value = u.credits || 0
  }

  async function fetchProfile() {
    if (!token.value) return
    try {
      const profile = await getProfile()
      user.value = profile
      credits.value = profile.credits || 0
    } catch {
      logout()
    }
  }

  function logout() {
    token.value = ''
    user.value = null
    credits.value = 0
    uni.removeStorageSync('user_token')
    uni.reLaunch({ url: '/pages/login/index' })
  }

  return { token, user, credits, isLoggedIn, setToken, setUser, fetchProfile, logout }
})
```

- [ ] **Step 6: 验证编译通过**

```bash
cd /Users/edy/Desktop/视频miao~/mobile-app && npm run dev:h5
```

- [ ] **Step 7: 提交**

```bash
cd /Users/edy/Desktop/视频miao~
git add mobile-app/src/api/ mobile-app/src/stores/ mobile-app/src/utils/
git commit -m "feat(mobile): API封装层 + Pinia用户状态 + 任务轮询"
```

---

### Task 3: 登录/注册页

**Files:**
- Create: `mobile-app/src/pages/login/index.vue`

- [ ] **Step 1: 创建登录/注册页**

```vue
<template>
  <view class="login-page">
    <view class="login-header">
      <image class="logo" src="/static/logo.png" mode="aspectFit" />
      <text class="app-name">视频miao~</text>
      <text class="app-desc">AI 短剧创作平台</text>
    </view>

    <view class="login-form">
      <view class="tab-bar">
        <view :class="['tab', mode === 'login' && 'tab-active']" @click="mode = 'login'">登录</view>
        <view :class="['tab', mode === 'register' && 'tab-active']" @click="mode = 'register'">注册</view>
      </view>

      <input v-model="form.username" class="input" placeholder="用户名" />
      <input v-model="form.password" class="input" type="safe-password" placeholder="密码" />
      <input v-if="mode === 'register'" v-model="form.confirmPassword" class="input" type="safe-password" placeholder="确认密码" />

      <button class="btn-primary" @click="handleSubmit" :loading="loading">
        {{ mode === 'login' ? '登 录' : '注 册' }}
      </button>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { login, register } from '@/api/auth'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()
const mode = ref('login')
const loading = ref(false)
const form = ref({ username: '', password: '', confirmPassword: '' })

async function handleSubmit() {
  const { username, password, confirmPassword } = form.value
  if (!username || !password) return uni.showToast({ title: '请填写用户名和密码', icon: 'none' })
  if (mode.value === 'register' && password !== confirmPassword) {
    return uni.showToast({ title: '两次密码不一致', icon: 'none' })
  }

  loading.value = true
  try {
    const res = mode.value === 'login'
      ? await login({ username, password })
      : await register({ username, password })
    userStore.setToken(res.token)
    userStore.setUser(res)
    uni.switchTab({ url: '/pages/home/index' })
  } catch (e) {
    uni.showToast({ title: e.message, icon: 'none' })
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 0 40rpx; background: linear-gradient(180deg, #1a1a2e 0%, #0d0d1a 100%); }
.login-header { text-align: center; margin-bottom: 80rpx; }
.logo { width: 120rpx; height: 120rpx; margin-bottom: 20rpx; }
.app-name { display: block; font-size: 48rpx; font-weight: bold; color: #7c5cfc; }
.app-desc { display: block; font-size: 28rpx; color: #888; margin-top: 8rpx; }
.login-form { width: 100%; max-width: 600rpx; }
.tab-bar { display: flex; margin-bottom: 40rpx; border-bottom: 2rpx solid #333; }
.tab { flex: 1; text-align: center; padding: 20rpx 0; font-size: 30rpx; color: #888; }
.tab-active { color: #7c5cfc; border-bottom: 4rpx solid #7c5cfc; }
.input { width: 100%; height: 88rpx; background: #1a1a2e; border-radius: 16rpx; padding: 0 24rpx; margin-bottom: 24rpx; color: #fff; font-size: 28rpx; box-sizing: border-box; }
.btn-primary { width: 100%; height: 88rpx; background: #7c5cfc; color: #fff; border-radius: 16rpx; font-size: 32rpx; font-weight: bold; margin-top: 16rpx; border: none; }
</style>
```

- [ ] **Step 2: 验证登录页渲染**

`npm run dev:h5` 后访问登录页，确认 UI 正常。

- [ ] **Step 3: 提交**

```bash
cd /Users/edy/Desktop/视频miao~
git add mobile-app/src/pages/login/
git commit -m "feat(mobile): 登录/注册页"
```

---

### Task 4: 首页（项目列表）

**Files:**
- Create: `mobile-app/src/api/drama.js`
- Create: `mobile-app/src/components/ProjectCard.vue`
- Create: `mobile-app/src/components/ProgressBar.vue`
- Modify: `mobile-app/src/pages/home/index.vue`

- [ ] **Step 1: 创建 api/drama.js**

```javascript
import { get, post, del } from './request'

export function listDramas(params) {
  return get('/dramas', params)
}
export function createDrama(data) {
  return post('/dramas', data)
}
export function getDrama(id) {
  return get(`/dramas/${id}`)
}
export function deleteDrama(id) {
  return del(`/dramas/${id}`)
}
export function saveEpisodes(id, data) {
  const { put } = require('./request')
  return require('./request').put(`/dramas/${id}/episodes`, data)
}
export function saveProgress(id, data) {
  return require('./request').put(`/dramas/${id}/progress`, data)
}
```

- [ ] **Step 2: 创建 components/ProgressBar.vue**

```vue
<template>
  <view class="progress-bar">
    <view v-for="(step, i) in steps" :key="i" :class="['step', getStepStatus(i)]" />
  </view>
</template>

<script setup>
const props = defineProps({
  steps: { type: Number, default: 4 },
  completed: { type: Number, default: 0 },
  current: { type: Number, default: -1 },
})

function getStepStatus(i) {
  if (i < props.completed) return 'done'
  if (i === props.current) return 'active'
  return 'pending'
}
</script>

<style scoped>
.progress-bar { display: flex; gap: 6rpx; }
.step { flex: 1; height: 6rpx; border-radius: 3rpx; background: #333; }
.step.done { background: #7c5cfc; }
.step.active { background: #f59e0b; }
</style>
```

- [ ] **Step 3: 创建 components/ProjectCard.vue**

```vue
<template>
  <view class="card" @click="$emit('click')" @longpress="$emit('longpress')">
    <view class="card-header">
      <text class="card-title">{{ drama.title }}</text>
      <text :class="['card-tag', `tag-${drama.style}`]">{{ drama.genre || '剧情' }}</text>
    </view>
    <text class="card-info">{{ drama.total_episodes || 0 }} 集 · {{ storyboardCount }} 分镜 · {{ drama.metadata?.aspect_ratio || '16:9' }}</text>
    <ProgressBar :completed="progressCompleted" :current="progressCurrent" />
    <text class="card-progress-label">{{ progressLabel }}</text>
  </view>
</template>

<script setup>
import { computed } from 'vue'
import ProgressBar from './ProgressBar.vue'

const props = defineProps({ drama: { type: Object, required: true } })
defineEmits(['click', 'longpress'])

const storyboardCount = computed(() => {
  const episodes = props.drama.episodes || []
  return episodes.reduce((sum, ep) => sum + (ep.storyboards?.length || 0), 0)
})

const progressCompleted = computed(() => {
  const p = props.drama.progress
  if (!p) return 0
  if (p.video_done) return 4
  if (p.image_done) return 3
  if (p.storyboard_done) return 2
  if (p.script_done) return 1
  return 0
})

const progressCurrent = computed(() => {
  const c = progressCompleted.value
  return c < 4 ? c : -1
})

const progressLabel = computed(() => {
  const c = progressCompleted.value
  const labels = ['未开始', '剧本✓', '分镜✓', '图片✓', '视频✓']
  return labels[c] || '未开始'
})
</script>

<style scoped>
.card { background: #1a1a2e; border-radius: 20rpx; padding: 24rpx; margin-bottom: 20rpx; }
.card-header { display: flex; justify-content: space-between; align-items: center; }
.card-title { font-size: 30rpx; font-weight: bold; color: #fff; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.card-tag { font-size: 22rpx; padding: 4rpx 16rpx; border-radius: 20rpx; background: rgba(124,92,252,0.15); color: #7c5cfc; margin-left: 16rpx; }
.card-info { display: block; font-size: 24rpx; color: #888; margin: 12rpx 0; }
.card-progress-label { font-size: 20rpx; color: #666; margin-top: 8rpx; }
</style>
```

- [ ] **Step 4: 创建 pages/home/index.vue**

```vue
<template>
  <view class="home-page">
    <!-- 顶部积分 -->
    <view class="top-bar">
      <text class="credits">积分: <text class="credits-num">{{ userStore.credits }}</text></text>
    </view>

    <!-- 搜索 -->
    <view class="search-wrap">
      <input class="search-input" v-model="keyword" placeholder="搜索项目..." @confirm="loadList" />
    </view>

    <!-- 列表 -->
    <scroll-view scroll-y class="list-scroll" @scrolltolower="loadMore" refresher-enabled :refresher-triggered="refreshing" @refresherrefresh="onRefresh">
      <ProjectCard v-for="item in dramas" :key="item.id" :drama="item" @click="goCreate(item)" @longpress="onDelete(item)" />
      <view v-if="dramas.length === 0 && !loading" class="empty">
        <text>暂无项目，点击 + 开始创作</text>
      </view>
      <view v-if="loading" class="loading"><text>加载中...</text></view>
    </scroll-view>

    <!-- FAB -->
    <view class="fab" @click="goNew">+</view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useUserStore } from '@/stores/user'
import { listDramas, deleteDrama } from '@/api/drama'
import ProjectCard from '@/components/ProjectCard.vue'

const userStore = useUserStore()
const dramas = ref([])
const keyword = ref('')
const loading = ref(false)
const refreshing = ref(false)
const page = ref(1)

onMounted(async () => {
  await userStore.fetchProfile()
  await loadList()
})

async function loadList() {
  loading.value = true
  try {
    const res = await listDramas({ page: 1, page_size: 20, keyword: keyword.value || undefined })
    dramas.value = res.items || res || []
    page.value = 1
  } catch (e) {
    uni.showToast({ title: e.message, icon: 'none' })
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

async function loadMore() {
  // 简化版：第一版不实现分页加载
}

function onRefresh() {
  refreshing.value = true
  loadList()
}

function goCreate(item) {
  uni.navigateTo({ url: `/pages/create/index?id=${item.id}` })
}

function goNew() {
  uni.navigateTo({ url: '/pages/create/index' })
}

function onDelete(item) {
  uni.showModal({
    title: '确认删除',
    content: `删除项目「${item.title}」？此操作不可撤销。`,
    success: async (res) => {
      if (res.confirm) {
        await deleteDrama(item.id)
        loadList()
      }
    }
  })
}
</script>

<style scoped>
.home-page { display: flex; flex-direction: column; height: 100vh; }
.top-bar { padding: 20rpx 30rpx; display: flex; justify-content: flex-end; }
.credits { font-size: 26rpx; color: #888; }
.credits-num { color: #f59e0b; font-weight: bold; }
.search-wrap { padding: 0 30rpx 20rpx; }
.search-input { height: 72rpx; background: #1a1a2e; border-radius: 36rpx; padding: 0 24rpx; font-size: 26rpx; color: #ccc; }
.list-scroll { flex: 1; padding: 0 30rpx; }
.empty { text-align: center; color: #555; padding-top: 200rpx; }
.loading { text-align: center; color: #555; padding: 20rpx; }
.fab { position: fixed; right: 40rpx; bottom: 140rpx; width: 100rpx; height: 100rpx; background: #7c5cfc; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 56rpx; color: #fff; box-shadow: 0 8rpx 24rpx rgba(124,92,252,0.4); }
</style>
```

- [ ] **Step 5: 验证首页渲染**

编译后确认项目列表卡片、搜索栏、FAB 按钮正常显示。

- [ ] **Step 6: 提交**

```bash
cd /Users/edy/Desktop/视频miao~
git add mobile-app/src/api/drama.js mobile-app/src/components/ mobile-app/src/pages/home/
git commit -m "feat(mobile): 首页项目列表 + 项目卡片组件"
```

---

### Task 5: 创作页（梗概输入 + 剧本编辑）

**Files:**
- Modify: `mobile-app/src/pages/create/index.vue`

- [ ] **Step 1: 创建完整的创作页**

```vue
<template>
  <view class="create-page">
    <!-- 新建模式 -->
    <view v-if="!dramaId" class="create-form">
      <input v-model="form.title" class="input" placeholder="项目名称" />
      <view class="option-row">
        <text class="label">画面比例</text>
        <view class="chips">
          <view v-for="r in ratios" :key="r" :class="['chip', form.aspect_ratio === r && 'chip-active']" @click="form.aspect_ratio = r">{{ r }}</view>
        </view>
      </view>
      <view class="option-row">
        <text class="label">风格</text>
        <view class="chips">
          <view v-for="s in styles" :key="s" :class="['chip', form.style === s && 'chip-active']" @click="form.style = s">{{ s }}</view>
        </view>
      </view>
      <view class="option-row">
        <text class="label">类型</text>
        <view class="chips">
          <view v-for="g in genres" :key="g" :class="['chip', form.genre === g && 'chip-active']" @click="form.genre = g">{{ g }}</view>
        </view>
      </view>
      <view class="option-row">
        <text class="label">集数</text>
        <view class="number-ctrl">
          <view class="num-btn" @click="form.episodes = Math.max(1, form.episodes - 1)">-</view>
          <text class="num-val">{{ form.episodes }}</text>
          <view class="num-btn" @click="form.episodes = Math.min(6, form.episodes + 1)">+</view>
        </view>
      </view>
      <textarea v-model="form.synopsis" class="textarea" placeholder="输入故事梗概..." :maxlength="-1" />
      <button class="btn-primary" @click="generateScript" :loading="generating">
        AI 生成剧本 ✨ ({{ scriptCredits }} 积分)
      </button>
    </view>

    <!-- 编辑模式 -->
    <view v-else class="edit-mode">
      <!-- 集数切换 -->
      <scroll-view scroll-x class="episode-tabs">
        <view v-for="(ep, i) in episodes" :key="i" :class="['ep-tab', currentEpisode === i && 'ep-tab-active']" @click="switchEpisode(i)">
          第 {{ i + 1 }} 集
        </view>
      </scroll-view>

      <!-- 剧本编辑 -->
      <textarea v-model="episodeText" class="script-textarea" :maxlength="-1" @input="onScriptInput" placeholder="剧本文本..." />
      <text class="save-hint">{{ saveHint }}</text>

      <!-- 操作按钮 -->
      <view class="action-bar">
        <button class="btn-secondary" @click="generateScript" :loading="generating">重新生成</button>
        <button class="btn-primary flex-1" @click="generateStoryboards" :loading="generatingSB">生成分镜 →</button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { createDrama, getDrama, saveEpisodes } from '@/api/drama'
import { post } from '@/api/request'
import { pollTask } from '@/utils/pollTask'

const props = defineProps({ id: { type: String, default: '' } })
const dramaId = ref(props.id)

const ratios = ['16:9', '9:16', '3:4', '1:1']
const styles = ['现代', '古风', '奇幻', '日常']
const genres = ['剧情', '喜剧', '冒险']
const scriptCredits = ref(1)

const form = ref({
  title: '',
  aspect_ratio: '16:9',
  style: '现代',
  genre: '剧情',
  episodes: 3,
  synopsis: '',
})

const episodes = ref([])
const currentEpisode = ref(0)
const episodeText = ref('')
const generating = ref(false)
const generatingSB = ref(false)
const saveHint = ref('')
let saveTimer = null

onMounted(() => {
  if (dramaId.value) loadDrama()
})

async function loadDrama() {
  try {
    const drama = await getDrama(dramaId.value)
    episodes.value = drama.episodes || []
    if (episodes.value.length > 0) {
      currentEpisode.value = 0
      episodeText.value = episodes.value[0].script || episodes.value[0].content || ''
    }
  } catch (e) {
    uni.showToast({ title: e.message, icon: 'none' })
  }
}

function switchEpisode(i) {
  currentEpisode.value = i
  episodeText.value = episodes.value[i]?.script || episodes.value[i]?.content || ''
}

function onScriptInput() {
  clearTimeout(saveTimer)
  saveHint.value = '编辑中...'
  saveTimer = setTimeout(async () => {
    try {
      const ep = episodes.value[currentEpisode.value]
      if (!ep) return
      ep.script = episodeText.value
      ep.content = episodeText.value
      await saveEpisodes(dramaId.value, { episodes: episodes.value })
      saveHint.value = '已保存'
    } catch {
      saveHint.value = '保存失败'
    }
  }, 1000)
}

async function generateScript() {
  if (!form.value.synopsis && !dramaId.value) {
    return uni.showToast({ title: '请输入故事梗概', icon: 'none' })
  }
  generating.value = true
  try {
    let did = dramaId.value
    if (!did) {
      const drama = await createDrama({
        title: form.value.title || '未命名项目',
        genre: form.value.genre,
        style: form.value.style,
        metadata: { aspect_ratio: form.value.aspect_ratio, total_episodes: form.value.episodes, synopsis: form.value.synopsis },
      })
      did = drama.id || drama
      dramaId.value = did
    }
    const res = await post('/generation/story', {
      drama_id: did,
      synopsis: form.value.synopsis,
      style: form.value.style,
      genre: form.value.genre,
      num_episodes: form.value.episodes,
    })
    if (res.task_id) {
      await pollTask(res.task_id)
    }
    await loadDrama()
  } catch (e) {
    uni.showToast({ title: e.message, icon: 'none' })
  } finally {
    generating.value = false
  }
}

async function generateStoryboards() {
  const ep = episodes.value[currentEpisode.value]
  if (!ep) return uni.showToast({ title: '无集数数据', icon: 'none' })
  generatingSB.value = true
  try {
    const res = await post(`/episodes/${ep.id}/storyboards`, {})
    if (res.task_id) {
      uni.showLoading({ title: '生成分镜中...' })
      await pollTask(res.task_id)
      uni.hideLoading()
    }
    uni.navigateTo({ url: `/pages/storyboard/index?episodeId=${ep.id}&dramaId=${dramaId.value}` })
  } catch (e) {
    uni.hideLoading()
    uni.showToast({ title: e.message, icon: 'none' })
  } finally {
    generatingSB.value = false
  }
}

onUnmounted(() => clearTimeout(saveTimer))
</script>

<style scoped>
.create-page { padding: 30rpx; min-height: 100vh; }
.create-form { display: flex; flex-direction: column; gap: 20rpx; }
.input { height: 88rpx; background: #1a1a2e; border-radius: 16rpx; padding: 0 24rpx; color: #fff; font-size: 28rpx; }
.textarea { height: 300rpx; background: #1a1a2e; border-radius: 16rpx; padding: 20rpx; color: #fff; font-size: 28rpx; width: 100%; box-sizing: border-box; }
.option-row { display: flex; align-items: center; gap: 16rpx; }
.label { font-size: 26rpx; color: #888; min-width: 100rpx; }
.chips { display: flex; gap: 12rpx; flex-wrap: wrap; }
.chip { padding: 8rpx 24rpx; border-radius: 20rpx; background: #1a1a2e; color: #888; font-size: 24rpx; }
.chip-active { background: rgba(124,92,252,0.2); color: #7c5cfc; }
.number-ctrl { display: flex; align-items: center; gap: 20rpx; }
.num-btn { width: 56rpx; height: 56rpx; background: #1a1a2e; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #7c5cfc; font-size: 32rpx; }
.num-val { font-size: 30rpx; color: #fff; min-width: 40rpx; text-align: center; }
.btn-primary { height: 88rpx; background: #7c5cfc; color: #fff; border-radius: 16rpx; font-size: 30rpx; font-weight: bold; border: none; }
.btn-secondary { height: 88rpx; background: #2a2a4a; color: #ccc; border-radius: 16rpx; font-size: 28rpx; border: none; }
.flex-1 { flex: 1; }
.edit-mode { display: flex; flex-direction: column; height: calc(100vh - 60rpx); }
.episode-tabs { white-space: nowrap; margin-bottom: 20rpx; }
.ep-tab { display: inline-block; padding: 12rpx 32rpx; border-radius: 30rpx; background: #1a1a2e; color: #888; font-size: 26rpx; margin-right: 12rpx; }
.ep-tab-active { background: #7c5cfc; color: #fff; }
.script-textarea { flex: 1; background: #1a1a2e; border-radius: 16rpx; padding: 20rpx; color: #fff; font-size: 26rpx; width: 100%; box-sizing: border-box; }
.save-hint { font-size: 22rpx; color: #10b981; margin: 8rpx 0; }
.action-bar { display: flex; gap: 16rpx; margin-top: 16rpx; }
</style>
```

注意：创作页作为 TabBar 页面不能通过 `onLoad` 接收参数。需在 `pages.json` 中将创作页改为非 TabBar 页面，或使用全局变量传参。这里暂时用 query 参数在 `onLoad` 中获取。

- [ ] **Step 2: 修改 pages.json，创作页从 TabBar 中移除，改为普通页面**

将 TabBar 中的"创作"改为点击 FAB 后跳转。更新 pages.json 中的 tabBar list 只保留 home、preview、mine 三个 tab。

- [ ] **Step 3: 验证创作流程**

编译后测试：新建项目 → 输入梗概 → 生成剧本 → 编辑剧本 → 生成分镜。

- [ ] **Step 4: 提交**

```bash
cd /Users/edy/Desktop/视频miao~
git add mobile-app/src/pages/create/
git commit -m "feat(mobile): 创作页 - 梗概输入+剧本编辑+生成分镜"
```

---

### Task 6: 分镜列表页（提示词编辑 + 批量生成）

**Files:**
- Create: `mobile-app/src/api/storyboard.js`
- Create: `mobile-app/src/api/image.js`
- Create: `mobile-app/src/api/video.js`
- Create: `mobile-app/src/components/StoryboardItem.vue`
- Create: `mobile-app/src/pages/storyboard/index.vue`

- [ ] **Step 1: 创建 api/storyboard.js**

```javascript
import { get, put } from './request'

export function getEpisodeStoryboards(episodeId) {
  return get(`/episodes/${episodeId}/storyboards`)
}
export function updateStoryboard(id, data) {
  return put(`/storyboards/${id}`, data)
}
```

- [ ] **Step 2: 创建 api/image.js**

```javascript
import { post } from './request'

export function createImage(data) {
  return post('/images', data)
}
```

- [ ] **Step 3: 创建 api/video.js**

```javascript
import { post } from './request'

export function createVideo(data) {
  return post('/videos', data)
}
```

- [ ] **Step 4: 创建 components/StoryboardItem.vue**

可展开/折叠的分镜条目组件，包含：
- 缩略图占位符（有 image_url 时显示图片）
- 镜头描述文本
- 展开后的图像提示词 textarea + 视频提示词 textarea
- 保存/生图/生视频按钮

完整代码约 120 行，包含 props: `storyboard`，emits: `save`, `generateImage`, `generateVideo`。

- [ ] **Step 5: 创建 pages/storyboard/index.vue**

接收 `episodeId` 和 `dramaId` 参数。核心逻辑：
- 加载分镜列表 `getEpisodeStoryboards(episodeId)`
- 点击分镜展开编辑提示词
- 保存提示词 `updateStoryboard(id, { image_prompt, video_prompt })`
- 单个生图 `createImage({ drama_id, storyboard_id, prompt: image_prompt })` + 轮询
- 单个生视频 `createVideo({ drama_id, storyboard_id, prompt: video_prompt, image_url })` + 轮询
- 底部固定栏：批量生图按钮（遍历无图的分镜逐个调用）、批量生视频按钮
- 轮询完成后刷新缩略图

- [ ] **Step 6: 验证分镜编辑和生成**

编译后测试：查看分镜列表 → 编辑提示词 → 保存 → 批量生图 → 批量生视频。

- [ ] **Step 7: 提交**

```bash
cd /Users/edy/Desktop/视频miao~
git add mobile-app/src/api/storyboard.js mobile-app/src/api/image.js mobile-app/src/api/video.js mobile-app/src/components/StoryboardItem.vue mobile-app/src/pages/storyboard/
git commit -m "feat(mobile): 分镜列表 + 提示词编辑 + 批量生图生视频"
```

---

### Task 7: 作品预览页

**Files:**
- Modify: `mobile-app/src/pages/preview/index.vue`

- [ ] **Step 1: 创建作品预览页**

核心功能：
- 项目选择下拉（或展示最近项目的分镜图片/视频）
- 图片点击预览 `uni.previewImage`
- 视频 `<video>` 组件播放
- 上下滑动切换分镜

- [ ] **Step 2: 验证预览页**

- [ ] **Step 3: 提交**

```bash
cd /Users/edy/Desktop/视频miao~
git add mobile-app/src/pages/preview/
git commit -m "feat(mobile): 作品预览页"
```

---

### Task 8: 我的页面 + 充值跳转

**Files:**
- Create: `mobile-app/src/pages/webview/index.vue`
- Modify: `mobile-app/src/pages/mine/index.vue`

- [ ] **Step 1: 创建 pages/mine/index.vue**

包含：用户名、积分余额、充值按钮（条件编译跳转）、修改密码（弹窗表单调用 `changePassword`）、退出登录。

充值跳转逻辑：
```javascript
function goRecharge() {
  const url = `${rechargeBaseUrl}/credits`
  // #ifdef H5
  window.open(url, '_blank')
  // #endif
  // #ifdef MP-WEIXIN
  uni.navigateTo({ url: `/pages/webview/index?url=${encodeURIComponent(url)}` })
  // #endif
  // #ifdef APP-PLUS
  plus.runtime.openURL(url)
  // #endif
}
```

- [ ] **Step 2: 创建 pages/webview/index.vue（小程序充值页）**

```vue
<template>
  <web-view :src="decodeURIComponent(url)" />
</template>
<script setup>
import { ref, onLoad } from '@dcloudio/uni-app'
const url = ref('')
onLoad((query) => { url.value = query.url || '' })
</script>
```

- [ ] **Step 3: 验证我的页面**

- [ ] **Step 4: 提交**

```bash
cd /Users/edy/Desktop/视频miao~
git add mobile-app/src/pages/mine/ mobile-app/src/pages/webview/
git commit -m "feat(mobile): 我的页面 + 充值跳转 + 密码修改"
```

---

### Task 9: 全局样式 + 暗色主题 + 多端适配验证

**Files:**
- Modify: `mobile-app/src/uni.scss`
- Modify: `mobile-app/src/App.vue`

- [ ] **Step 1: 配置全局样式变量**

在 `uni.scss` 中定义主题色：
```scss
$primary-color: #7c5cfc;
$bg-dark: #0d0d1a;
$bg-card: #1a1a2e;
$text-primary: #ffffff;
$text-subtle: #888888;
$accent-warning: #f59e0b;
$accent-success: #10b981;
```

- [ ] **Step 2: App.vue 全局样式**

```css
page { background-color: #0d0d1a; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
```

- [ ] **Step 3: 多端编译验证**

```bash
cd /Users/edy/Desktop/视频miao~/mobile-app
npm run dev:h5           # H5
npm run dev:mp-weixin    # 微信小程序
```

确认各端编译无报错，页面渲染正常。

- [ ] **Step 4: 提交**

```bash
cd /Users/edy/Desktop/视频miao~
git add mobile-app/src/uni.scss mobile-app/src/App.vue
git commit -m "style(mobile): 全局暗色主题 + 多端适配"
```

---

### Task 10: 环境配置 + TabBar 图标 + 最终联调

**Files:**
- Create: `mobile-app/.env.development`
- Create: `mobile-app/.env.production`
- Create: `mobile-app/src/static/tab-*.png`（TabBar 图标）
- Modify: `mobile-app/src/pages.json`

- [ ] **Step 1: 创建环境配置文件**

`.env.development`:
```
VITE_API_BASE_URL=http://localhost:5679/api/v1
```

`.env.production`:
```
VITE_API_BASE_URL=/api/v1
```

- [ ] **Step 2: 添加 TabBar 图标**

准备 8 个图标文件（4 tab × normal + active），放在 `src/static/` 下。可以使用简单的 SVG 转 PNG 或使用 iconfont。

- [ ] **Step 3: 最终 pages.json 调整**

确认 3 个 TabBar 页面（home、preview、mine）+ 登录/创作/分镜/webview 普通页面配置正确。

- [ ] **Step 4: 端到端联调**

启动后端 `backend-node`，然后启动 mobile-app H5 模式，走完整流程：
1. 注册 → 登录
2. 创建项目 → 输入梗概 → 生成剧本
3. 编辑剧本 → 生成分镜
4. 编辑提示词 → 批量生图 → 批量生视频
5. 预览作品
6. 查看积分 → 充值跳转

- [ ] **Step 5: 提交**

```bash
cd /Users/edy/Desktop/视频miao~
git add mobile-app/
git commit -m "feat(mobile): 环境配置 + TabBar图标 + 联调完成"
```

---

## Spec Coverage Check

| Spec Requirement | Task |
|---|---|
| 注册/登录 | Task 3 |
| 积分余额查看 | Task 4 (首页) + Task 8 (我的) |
| 修改密码 | Task 8 |
| 充值跳转 Web | Task 8 |
| 项目列表 | Task 4 |
| 创建/删除项目 | Task 4 |
| 输入梗概→AI生成剧本 | Task 5 |
| 剧本文本编辑 | Task 5 |
| 一键生成分镜 | Task 5 |
| 提示词编辑 | Task 6 |
| 批量生成图片 | Task 6 |
| 批量生成视频 | Task 6 |
| 图片/视频播放 | Task 7 |
| 项目搜索 | Task 4 |
| 多端编译 | Task 9 + Task 10 |
