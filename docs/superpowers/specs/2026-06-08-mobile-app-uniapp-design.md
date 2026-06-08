# 手机端 UniApp 设计文档

## 概述

为"视频miao~"平台开发手机端应用，采用 UniApp + Vue 3 框架，编译目标为 H5 网页、微信小程序、Android、iOS 四端。核心定位为**快速创作**——用户输入故事梗概，AI 一键生成剧本，编辑后生成分镜，支持提示词编辑，批量生成图片和视频。

后端完全复用现有 `backend-node`，零修改。充值功能跳转 Web 页完成，不在 App 端内实现。

## 功能范围

### 保留功能

| 模块 | 功能 | 说明 |
|------|------|------|
| 用户系统 | 注册/登录 | 用户名 + 密码 |
| 用户系统 | 积分余额查看 | 顶部/我的页面显示 |
| 用户系统 | 修改密码 | |
| 用户系统 | 充值 | 跳转 Web 充值页，不在 App 内实现 |
| 项目管理 | 项目列表 | 卡片式，显示进度条 |
| 项目管理 | 创建/删除项目 | |
| 创作流程 | 输入梗概 → AI 生成剧本 | 支持风格/类型/集数选择 |
| 创作流程 | 剧本文本编辑 | 集数切换 + 可编辑文本 |
| 创作流程 | 一键生成分镜 | AI 自动提取角色/场景/拆分镜 |
| 创作流程 | 提示词编辑 | 逐镜编辑图像提示词和视频提示词 |
| 创作流程 | 批量生成图片 | 一键批量，显示进度 |
| 创作流程 | 批量生成视频 | 一键批量，显示进度 |
| 预览 | 图片/视频播放 | 内嵌播放器 |
| 搜索 | 项目关键词搜索 | |

### 不做的功能（PC 端保留）

- 角色/场景/道具独立管理面板
- 素材库（角色库/场景库/道具库）
- 分镜精细编辑（角色关联/道具关联）
- AI 提示词润色（流式）
- 四视图生成
- SD2 角色认证
- 视频合成（TTS/字幕/水印/混音）
- AI 配置管理
- 项目导入导出/小说导入
- 后台管理（仍通过 Web 端 /admin 访问）

## 页面结构

### TabBar（底部导航 4 个 Tab）

| Tab | 图标 | 页面 | 路径 |
|-----|------|------|------|
| 首页 | 🏠 | 项目列表 | /pages/home/index |
| 创作 | ➕ | 创作页（梗概+剧本） | /pages/create/index |
| 作品 | 🎥 | 作品预览 | /pages/preview/index |
| 我的 | 👤 | 个人中心 | /pages/mine/index |

### 页面详情

#### 1. 登录/注册页 (`/pages/login/index`)

- 公开页，无 TabBar
- 登录/注册模式切换
- 用户名 + 密码表单
- 登录成功后存 token 到 `uni.setStorageSync('user_token')`，跳转首页

#### 2. 首页 (`/pages/home/index`)

- 顶部：积分余额显示
- 搜索栏
- 项目卡片列表（标题、风格标签、集数/分镜数、四步进度条）
- FAB 按钮：新建项目
- 下拉刷新 + 上拉加载
- 长按删除项目
- 点击卡片 → 进入创作页（编辑已有项目）

#### 3. 创作页 (`/pages/create/index`)

两种状态：

**新建模式**（无项目 ID）：
- 项目名称输入
- 画面比例选择（16:9 / 9:16 / 3:4 / 1:1）
- 风格选择（现代/古风/奇幻/日常）
- 类型选择（剧情/喜剧/冒险）
- 集数设置（1-6）
- 故事梗概文本框
- "AI 生成剧本"按钮（调用 POST /generation/story，扣积分）

**编辑模式**（有项目 ID）：
- 集数切换 Tab（第1集/第2集/...）
- 剧本文本编辑区（可滚动 textarea）
- 自动保存（输入停止 1 秒后自动 PUT /dramas/:id/episodes）
- "重新生成"按钮
- "生成分镜"按钮（调用 POST /episodes/:id/storyboards，扣积分）
- 生成分镜后跳转分镜页

#### 4. 分镜列表页 (`/pages/storyboard/index`)

- 顶部：分镜数量统计 + 批量操作按钮
- 分镜列表：每条显示缩略图（或占位符）+ 镜头描述 + 提示词摘要
- 点击分镜展开：
  - 图像提示词 textarea（可编辑）
  - 视频提示词 textarea（可编辑）
  - "保存"按钮（PUT /storyboards/:id）
  - "生成图片"按钮（POST /images，扣积分）
  - "生成视频"按钮（POST /videos，扣积分，需已有图片）
- 底部固定栏：
  - "批量生图"按钮（遍历未生图的分镜，逐个调用 POST /images）
  - "批量生视频"按钮（遍历已生图未生视频的分镜，逐个调用 POST /videos）
- 任务轮询：生成后自动轮询 GET /tasks/:id，更新缩略图/状态

#### 5. 作品预览页 (`/pages/preview/index`)

- 选择项目 → 显示该项目所有分镜的图片/视频
- 图片：点击全屏预览（uni.previewImage）
- 视频：内嵌 video 组件播放
- 滑动切换分镜

#### 6. 我的页 (`/pages/mine/index`)

- 用户名显示
- 积分余额
- "充值"按钮 → 跳转 Web 充值页
  - H5/App：`window.open(充值URL)`
  - 小程序：`<web-view :src="充值URL">`
- 修改密码
- 退出登录

## 技术架构

### 技术栈

| 类别 | 选型 | 说明 |
|------|------|------|
| 框架 | UniApp + Vue 3 (Composition API) | 多端编译 |
| 状态管理 | Pinia | 与 PC 端 frontweb 一致 |
| UI 组件 | uni-ui + uv-ui | 跨端兼容 |
| 网络请求 | uni.request | 不依赖 axios |
| 构建 | Vite | HBuilderX 或 CLI |

### 项目目录结构

```
mobile-app/
├── src/
│   ├── pages/
│   │   ├── login/index.vue
│   │   ├── home/index.vue
│   │   ├── create/index.vue
│   │   ├── storyboard/index.vue
│   │   ├── preview/index.vue
│   │   └── mine/index.vue
│   ├── api/
│   │   ├── request.js        // uni.request 封装 + token + 401 拦截
│   │   ├── auth.js           // 登录/注册/积分
│   │   ├── drama.js          // 项目 CRUD + 剧本保存
│   │   ├── storyboard.js     // 分镜 CRUD + 提示词编辑
│   │   ├── image.js          // 图片生成
│   │   ├── video.js          // 视频生成
│   │   └── task.js           // 任务状态轮询
│   ├── stores/
│   │   └── user.js           // Pinia: token/user/credits
│   ├── components/
│   │   ├── ProjectCard.vue   // 项目卡片
│   │   ├── StoryboardItem.vue // 分镜条目（可展开编辑）
│   │   └── ProgressBar.vue   // 创作进度条
│   ├── utils/
│   │   └── pollTask.js       // 异步任务轮询封装
│   ├── App.vue
│   ├── main.js
│   ├── manifest.json
│   ├── pages.json
│   └── uni.scss
├── package.json
└── vite.config.js
```

### API 接口映射

所有接口直接复用现有 `backend-node` 路由，baseURL 通过环境变量配置。

| 功能 | 接口 | 积分 |
|------|------|------|
| 登录 | POST /auth/login | - |
| 注册 | POST /auth/register | - |
| 用户信息 | GET /auth/profile | - |
| 修改密码 | PUT /auth/password | - |
| 积分余额 | GET /credits/balance | - |
| 项目列表 | GET /dramas | - |
| 创建项目 | POST /dramas | - |
| 删除项目 | DELETE /dramas/:id | - |
| 保存剧本 | PUT /dramas/:id/episodes | - |
| 保存进度 | PUT /dramas/:id/progress | - |
| 生成分镜 | POST /episodes/:id/storyboards | 扣积分 |
| 获取分镜 | GET /episodes/:id/storyboards | - |
| 编辑分镜 | PUT /storyboards/:id | - |
| 生成图片 | POST /images | 扣积分 |
| 生成视频 | POST /videos | 扣积分 |
| 任务状态 | GET /tasks/:id | - |

### 多端差异处理

使用 UniApp 条件编译 `#ifdef` 处理平台差异：

**充值跳转**：
- H5 / App：`window.open(webRechargeUrl)`
- 小程序：导航到 `<web-view>` 页面

**视频播放**：
- H5：HTML5 `<video>` 标签
- 小程序 / App：`<video>` 组件

**图片预览**：
- H5：自定义全屏预览组件
- 小程序 / App：`uni.previewImage()`

**本地存储**：
- 统一使用 `uni.setStorageSync` / `uni.getStorageSync`

### 认证与积分

- 登录成功后 JWT token 存入 `uni.setStorageSync('user_token')`
- `api/request.js` 拦截器自动在 header 带 `Authorization: Bearer {token}`
- 401 响应自动清除 token 并跳转登录页
- 积分不足（402）时弹出提示，引导充值
- 积分余额在首页顶部和"我的"页显示

### 任务轮询机制

AI 生图/生视频是异步任务，返回 `task_id`：

```javascript
// utils/pollTask.js
export function pollTask(taskId, interval = 2000, maxAttempts = 300) {
  return new Promise((resolve, reject) => {
    let attempts = 0
    const timer = setInterval(async () => {
      attempts++
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
    }, interval)
  })
}
```

### 环境配置

```javascript
// 不同环境的 baseURL
const envConfig = {
  development: 'http://localhost:5679/api/v1',
  production: 'https://your-domain.com/api/v1',
}
```

通过 `manifest.json` 或 `.env` 文件配置，编译时注入。

## 不在第一版范围内

以下功能可考虑后续版本迭代：

1. 自由创作（不绑定项目的图文生成）
2. 项目导出/下载
3. 消息推送（任务完成通知）
4. 离线缓存
5. 视频合成（TTS/字幕）
6. 角色/场景/道具独立管理
7. 微信登录 / 手机号登录
