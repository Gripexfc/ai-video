<template>
  <div class="free-create-page">
    <div class="page-header">
      <div class="header-left">
        <el-button text @click="$router.back()">
          <el-icon><ArrowLeft /></el-icon>
          返回
        </el-button>
        <h2 class="page-title">自由创作</h2>
      </div>
      <p class="page-desc">不绑定剧集，直接输入文字生成图片或视频</p>
    </div>

    <div class="create-layout">
      <!-- 左侧：输入面板 -->
      <div class="input-panel">
        <el-tabs v-model="mode" class="mode-tabs">
          <el-tab-pane label="🎨 生成图片" name="image" />
          <el-tab-pane label="🎬 生成视频" name="video" />
        </el-tabs>

        <div class="form-section">
          <div class="form-label">提示词 <span class="required">*</span></div>
          <el-input
            v-model="prompt"
            type="textarea"
            :rows="5"
            placeholder="描述你想要生成的画面内容..."
            class="prompt-input"
          />
        </div>

        <div v-if="mode === 'video'" class="form-section">
          <div class="form-label">参考图（可选）</div>
          <div class="ref-image-zone" @click="triggerRefImageUpload" @dragover.prevent @drop.prevent="onRefImageDrop">
            <template v-if="refImageDataUrl">
              <img :src="refImageDataUrl" class="ref-preview" />
              <div class="ref-actions">
                <el-button size="small" type="danger" plain @click.stop="clearRefImage">移除</el-button>
              </div>
            </template>
            <template v-else>
              <el-icon class="upload-icon"><Picture /></el-icon>
              <div class="upload-tip">点击或拖拽上传参考图</div>
            </template>
          </div>
          <input ref="refImageInput" type="file" accept="image/*" style="display:none" @change="onRefImageChange" />
        </div>

        <div class="form-section form-row">
          <div class="form-item">
            <div class="form-label">风格</div>
            <el-input v-model="style" placeholder="例如: cinematic, anime..." />
          </div>
          <div v-if="mode === 'image'" class="form-item">
            <div class="form-label">比例</div>
            <el-select v-model="aspectRatio">
              <el-option label="16:9" value="16:9" />
              <el-option label="9:16" value="9:16" />
              <el-option label="1:1" value="1:1" />
              <el-option label="4:3" value="4:3" />
            </el-select>
          </div>
          <div v-if="mode === 'video'" class="form-item">
            <div class="form-label">时长</div>
            <el-select v-model="duration">
              <el-option label="3秒" :value="3" />
              <el-option label="5秒" :value="5" />
              <el-option label="8秒" :value="8" />
              <el-option label="10秒" :value="10" />
            </el-select>
          </div>
        </div>

        <el-button
          type="primary"
          size="large"
          :loading="generating"
          :disabled="!prompt.trim()"
          class="generate-btn"
          @click="generate"
        >
          {{ generating ? '生成中...' : (mode === 'image' ? '生成图片' : '生成视频') }}
        </el-button>
      </div>

      <!-- 右侧：结果展示 -->
      <div class="result-panel">
        <div class="result-header">
          <span class="result-title">生成结果</span>
          <el-button v-if="results.length > 0" size="small" plain @click="clearResults">清空</el-button>
        </div>

        <div v-if="results.length === 0 && !generating" class="empty-result">
          <el-icon class="empty-icon"><MagicStick /></el-icon>
          <p>生成的内容将显示在这里</p>
        </div>

        <div v-if="generating" class="generating-tip">
          <el-icon class="is-loading"><Loading /></el-icon>
          <span>正在生成，请稍候...</span>
        </div>

        <div class="result-grid">
          <div v-for="(item, idx) in results" :key="idx" class="result-item">
            <div class="result-media">
              <video
                v-if="item.type === 'video' && item.url"
                :src="item.url"
                controls
                class="result-video"
                loop
              />
              <img
                v-else-if="item.type === 'image' && item.url"
                :src="item.url"
                class="result-image"
                @click="previewUrl = item.url"
              />
              <div v-else-if="item.status === 'pending' || item.status === 'processing'" class="media-loading">
                <el-icon class="is-loading"><Loading /></el-icon>
                <span>{{ item.status === 'processing' ? '生成中...' : '排队中...' }}</span>
              </div>
              <div v-else-if="item.status === 'failed'" class="media-error">
                <el-icon><CircleClose /></el-icon>
                <span>{{ item.error || '生成失败' }}</span>
              </div>
            </div>
            <div class="result-meta">
              <span class="result-prompt">{{ item.prompt }}</span>
              <div class="result-actions">
                <el-button v-if="item.url" size="small" plain @click="downloadItem(item)">下载</el-button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 图片预览 -->
    <div v-if="previewUrl" class="image-preview-overlay" @click="previewUrl = null">
      <img :src="previewUrl" class="preview-img" @click.stop />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Picture, MagicStick, Loading, CircleClose } from '@element-plus/icons-vue'
import { imagesAPI } from '@/api/images'
import { videosAPI } from '@/api/videos'
import { uploadAPI } from '@/api/upload'
import { generationSettingsAPI } from '@/api/prompts'

const mode = ref('image')
const prompt = ref('')
const style = ref('')
const aspectRatio = ref('16:9')
const duration = ref(5)
const generating = ref(false)
const results = ref([])
const previewUrl = ref(null)
const refImageDataUrl = ref(null)
const refImageLocalPath = ref(null)
const refImageInput = ref(null)
/** 与后端视频异步超时一致（分钟 → 毫秒） */
const videoPollMaxMs = ref(30 * 60 * 1000)

onMounted(async () => {
  try {
    const res = await generationSettingsAPI.get()
    const m = Math.max(1, Number(res?.video_generation_timeout_minutes) || 30)
    videoPollMaxMs.value = m * 60 * 1000
  } catch (_) {}
})

function triggerRefImageUpload() {
  refImageInput.value?.click()
}

function clearRefImage() {
  refImageDataUrl.value = null
  refImageLocalPath.value = null
}

async function onRefImageChange(e) {
  const file = e.target.files?.[0]
  if (!file) return
  processRefImageFile(file)
  e.target.value = ''
}

function onRefImageDrop(e) {
  const file = e.dataTransfer?.files?.[0]
  if (file && file.type.startsWith('image/')) processRefImageFile(file)
}

async function processRefImageFile(file) {
  const reader = new FileReader()
  reader.onload = async (ev) => {
    refImageDataUrl.value = ev.target.result
    try {
      const res = await uploadAPI.uploadImage(file)
      refImageLocalPath.value = res?.local_path || null
    } catch (_) {}
  }
  reader.readAsDataURL(file)
}

function clearResults() {
  results.value = []
}

function downloadItem(item) {
  if (!item.url) return
  const a = document.createElement('a')
  a.href = item.url
  a.download = `free_create_${Date.now()}.${item.type === 'video' ? 'mp4' : 'jpg'}`
  a.click()
}

async function generate() {
  if (!prompt.value.trim()) return
  generating.value = true
  const newItem = {
    type: mode.value,
    prompt: prompt.value,
    style: style.value,
    status: 'processing',
    url: null,
    error: null,
  }
  results.value.unshift(newItem)
  try {
    if (mode.value === 'image') {
      const res = await imagesAPI.create({
        prompt: prompt.value,
        style: style.value || undefined,
        aspect_ratio: aspectRatio.value,
      })
      if (res?.task_id) {
        await pollImageTask(res.task_id, newItem)
      } else if (res?.image_url || res?.local_path) {
        newItem.url = res.image_url || ('/static/' + res.local_path)
        newItem.status = 'completed'
      }
    } else {
      const body = {
        prompt: prompt.value,
        style: style.value || undefined,
        aspect_ratio: aspectRatio.value,
        duration: duration.value,
      }
      if (refImageLocalPath.value) {
        body.first_frame_url = refImageLocalPath.value
        body.image_url = '/static/' + refImageLocalPath.value
      }
      const res = await videosAPI.create(body)
      if (res?.task_id) {
        await pollVideoTask(res.task_id, newItem)
      } else {
        newItem.status = 'failed'
        newItem.error = '提交失败'
      }
    }
  } catch (e) {
    newItem.status = 'failed'
    newItem.error = e.message || '生成失败'
    ElMessage.error(newItem.error)
  } finally {
    generating.value = false
  }
}

async function pollImageTask(taskId, item, maxMs = 180000) {
  const start = Date.now()
  while (Date.now() - start < maxMs) {
    await new Promise((r) => setTimeout(r, 3000))
    try {
      const res = await imagesAPI.getTask ? imagesAPI.getTask(taskId) : null
      if (!res) break
      if (res.status === 'completed' && res.result) {
        const r = res.result
        item.url = r.image_url ? r.image_url : (r.local_path ? '/static/' + r.local_path : null)
        item.status = 'completed'
        return
      }
      if (res.status === 'failed') {
        item.status = 'failed'
        item.error = res.error || '生成失败'
        return
      }
    } catch (_) {}
  }
  item.status = 'failed'
  item.error = '超时'
}

async function pollVideoTask(taskId, item) {
  const maxMs = videoPollMaxMs.value
  const start = Date.now()
  const { taskAPI } = await import('@/api/task')
  while (Date.now() - start < maxMs) {
    await new Promise((r) => setTimeout(r, 4000))
    try {
      const res = await taskAPI.get(taskId)
      if (res?.status === 'completed' && res?.result) {
        const r = res.result
        const vgId = r.video_generation_id
        if (vgId) {
          const vRes = await videosAPI.get(vgId)
          item.url = vRes?.local_path ? '/static/' + vRes.local_path : vRes?.video_url
        }
        item.status = 'completed'
        return
      }
      if (res?.status === 'failed') {
        item.status = 'failed'
        item.error = res.error || '生成失败'
        return
      }
    } catch (_) {}
  }
  item.status = 'failed'
  item.error = '超时'
}
</script>

<style scoped>
/* ── Free Create — Midnight Cinema ── */

.free-create-page {
  min-height: 100vh;
  background: var(--bg-page);
  padding: 28px 28px;
  position: relative;
}

.page-header {
  margin-bottom: 28px;
  animation: fadeInUp 0.5s ease both;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 8px;
}

.page-title {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-bright);
  margin: 0;
  letter-spacing: -0.02em;
  position: relative;
  padding-bottom: 4px;
}

.page-title::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 32px;
  height: 2px;
  background: var(--accent);
  border-radius: var(--radius-sm);
}

.page-desc {
  color: var(--text-muted);
  font-size: 14px;
  margin: 0;
}

.create-layout {
  display: flex;
  gap: 24px;
  align-items: flex-start;
  animation: fadeInUp 0.6s ease both;
  animation-delay: 0.1s;
}

/* ── Glass Panel Shared ── */
.input-panel {
  width: 400px;
  flex-shrink: 0;
  background: var(--bg-card);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  padding: 24px;
  box-shadow: var(--shadow-card);
  position: relative;
  z-index: 1;
}

/* ── Mode Tabs ── */
.mode-tabs {
  margin-bottom: 20px;
}

.mode-tabs :deep(.el-tabs__header) {
  margin-bottom: 0;
}

.mode-tabs :deep(.el-tabs__nav-wrap::after) {
  background: var(--border-color);
}

.mode-tabs :deep(.el-tabs__active-bar) {
  background: var(--accent);
  height: 2px;
  border-radius: var(--radius-sm);
}

.mode-tabs :deep(.el-tabs__item) {
  color: var(--text-muted);
  font-weight: 500;
  font-size: 14px;
  transition: color var(--duration-fast) ease;
}

.mode-tabs :deep(.el-tabs__item.is-active) {
  color: var(--accent);
  font-weight: 600;
}

.mode-tabs :deep(.el-tabs__item:hover) {
  color: var(--text-bright);
}

/* ── Form ── */
.form-section {
  margin-bottom: 18px;
}

.form-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.required {
  color: #ef4444;
}

.prompt-input :deep(.el-textarea__inner) {
  font-size: 14px;
  line-height: 1.65;
}

.form-row {
  display: flex;
  gap: 12px;
}

.form-item {
  flex: 1;
}

.form-item .el-select {
  width: 100%;
}

/* ── Ref Image Zone ── */
.ref-image-zone {
  border: 2px dashed var(--accent-border);
  border-radius: var(--radius-md);
  padding: 24px;
  text-align: center;
  cursor: pointer;
  transition: border-color var(--duration-normal) ease, box-shadow var(--duration-normal) ease, background var(--duration-normal) ease;
  min-height: 110px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  position: relative;
  background: var(--accent-muted);
}

.ref-image-zone:hover {
  border-color: var(--accent);
  background: var(--accent-muted);
}

.ref-preview {
  max-width: 100%;
  max-height: 150px;
  border-radius: var(--radius-md);
}

.ref-actions {
  margin-top: 8px;
}

.upload-icon {
  font-size: 32px;
  color: var(--accent-border);
  transition: color var(--duration-normal) ease;
}

.ref-image-zone:hover .upload-icon {
  color: var(--accent);
}

.upload-tip {
  font-size: 12px;
  color: var(--text-subtle);
}

/* ── Generate Button ── */
.generate-btn {
  width: 100%;
  margin-top: 6px;
  height: 48px;
  font-size: 15px;
  font-weight: 700;
  background: var(--accent) !important;
  color: #1a1a1f !important;
  border: none !important;
  border-radius: var(--radius-md) !important;
  box-shadow: 0 1px 4px var(--accent-glow) !important;
  transition: box-shadow var(--duration-fast) ease !important;
  letter-spacing: 0.01em;
}

.generate-btn:hover {
  box-shadow: 0 2px 8px var(--accent-glow) !important;
}

.generate-btn:active {
  transform: scale(0.99);
}

.generate-btn:disabled {
  opacity: 0.5;
  transform: none;
  filter: none;
}

/* ── Result Panel ── */
.result-panel {
  flex: 1;
  background: var(--bg-card);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  padding: 24px;
  box-shadow: var(--shadow-card);
  min-height: 480px;
  position: relative;
  z-index: 1;
}

.result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border-color);
}

.result-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--text-bright);
  letter-spacing: -0.01em;
}

.empty-result {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 340px;
  color: var(--text-subtle);
  gap: 14px;
}

.empty-icon {
  font-size: 52px;
  opacity: 0.4;
  animation: float 4s ease-in-out infinite;
}

.generating-tip {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--accent);
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 16px;
  padding: 10px 16px;
  background: var(--accent-muted);
  border-radius: var(--radius-md);
  border: 1px solid var(--accent-border);
}

.result-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 18px;
}

/* ── Result Item ── */
.result-item {
  background: var(--bg-inner);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  overflow: hidden;
  transition: border-color var(--duration-normal) ease, box-shadow var(--duration-normal) ease;
  animation: scaleIn 0.4s ease both;
}

.result-item:hover {
  border-color: var(--accent-border);
  box-shadow: var(--shadow-hover);
}

.result-media {
  background: var(--bg-page);
  aspect-ratio: 16/9;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
}

.result-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  cursor: zoom-in;
  transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.result-item:hover .result-image {
  transform: scale(1.04);
}

.result-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.media-loading,
.media-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--text-muted);
  font-size: 12px;
}

.media-error {
  color: #ef4444;
}

.result-meta {
  padding: 10px 14px;
}

.result-prompt {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.result-actions {
  margin-top: 8px;
  display: flex;
  gap: 6px;
}

/* ── Image Preview Overlay ── */
.image-preview-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.85);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: zoom-out;
  animation: fadeIn 0.25s ease;
}

.preview-img {
  max-width: 90vw;
  max-height: 90vh;
  object-fit: contain;
  border-radius: var(--radius-xl);
  box-shadow: 0 12px 40px rgba(0,0,0,0.4);
  animation: scaleIn 0.35s ease;
}

/* ── Light Mode Overrides ── */
html.light .free-create-page {
  background: var(--bg-page);
}

html.light .input-panel,
html.light .result-panel {
  background: var(--bg-card);
  border-color: var(--glass-border);
  box-shadow: var(--shadow-card);
}

html.light .input-panel::before,
html.light .result-panel::before {
  display: none;
}

html.light .page-title {
  color: var(--text-bright);
}

html.light .page-title::after {
  background: var(--accent);
}

html.light .ref-image-zone {
  border-color: var(--accent-border);
  background: var(--accent-muted);
}

html.light .ref-image-zone:hover {
  background: var(--accent-soft);
}

html.light .generate-btn {
  background: var(--accent) !important;
  color: #fff !important;
  box-shadow: 0 1px 4px rgba(176,136,40,0.15) !important;
}

html.light .result-item {
  background: var(--bg-inner);
  border-color: var(--glass-border);
}

html.light .result-item:hover {
  border-color: var(--accent-border);
  box-shadow: var(--shadow-hover);
}

html.light .image-preview-overlay {
  background: rgba(248,246,241,0.92);
}

html.light .preview-img {
  box-shadow: 0 16px 48px rgba(0,0,0,0.1);
}

html.light .generating-tip {
  background: var(--accent-soft);
  border-color: var(--accent-border);
  color: var(--accent);
}
</style>
