<template>
  <div class="media-library-page">
    <div class="page-header">
      <div class="header-left">
        <el-button text @click="$router.back()">
          <el-icon><ArrowLeft /></el-icon>
          返回
        </el-button>
        <h2 class="page-title">媒体素材库</h2>
      </div>
      <div class="header-actions">
        <el-button type="primary" plain @click="triggerUpload">
          <el-icon><Upload /></el-icon>
          上传素材
        </el-button>
        <input ref="uploadInput" type="file" accept="image/*,video/*" multiple style="display:none" @change="onUpload" />
      </div>
    </div>

    <!-- 筛选栏 -->
    <div class="filter-bar">
      <el-radio-group v-model="mediaType" class="type-filter" @change="loadMedia">
        <el-radio-button value="all">全部</el-radio-button>
        <el-radio-button value="image">图片</el-radio-button>
        <el-radio-button value="video">视频</el-radio-button>
      </el-radio-group>
      <el-input
        v-model="keyword"
        placeholder="搜索素材..."
        class="search-input"
        clearable
        @input="debouncedLoad"
      >
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>
    </div>

    <!-- 上传进度 -->
    <div v-if="uploading" class="upload-progress">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>正在上传 {{ uploadProgress.current }}/{{ uploadProgress.total }}...</span>
    </div>

    <!-- 媒体网格 -->
    <div v-loading="loading" class="media-grid">
      <div
        v-for="item in mediaItems"
        :key="item.id"
        class="media-card"
        :class="{ selected: selectedIds.has(item.id) }"
        @click="toggleSelect(item)"
      >
        <div class="media-thumb">
          <video v-if="item.type === 'video'" :src="itemUrl(item)" class="thumb-video" muted />
          <img v-else :src="itemUrl(item)" class="thumb-img" />
          <div class="media-overlay">
            <el-icon v-if="selectedIds.has(item.id)" class="check-icon"><CircleCheck /></el-icon>
            <div class="overlay-actions" @click.stop>
              <el-button
                size="small"
                plain
                class="preview-btn"
                @click.stop="openPreview(item)"
              >
                <el-icon><ZoomIn /></el-icon>
              </el-button>
              <el-button
                size="small"
                type="danger"
                plain
                @click.stop="deleteItem(item)"
              >
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
          </div>
        </div>
        <div class="media-info">
          <span class="media-name" :title="item.name">{{ item.name || '未命名' }}</span>
          <span class="media-meta">{{ formatSize(item.size) }}</span>
        </div>
      </div>

      <div v-if="!loading && mediaItems.length === 0" class="empty-media">
        <el-icon class="empty-icon"><Files /></el-icon>
        <p>暂无素材，点击上传按钮添加</p>
      </div>
    </div>

    <!-- 分页 -->
    <div v-if="total > pageSize" class="pagination">
      <el-pagination
        v-model:current-page="page"
        :page-size="pageSize"
        :total="total"
        layout="prev, pager, next"
        @current-change="loadMedia"
      />
    </div>

    <!-- 批量操作 -->
    <div v-if="selectedIds.size > 0" class="batch-bar">
      <span>已选 {{ selectedIds.size }} 项</span>
      <el-button size="small" @click="selectedIds.clear()">取消选择</el-button>
      <el-button size="small" type="danger" plain @click="batchDelete">批量删除</el-button>
    </div>

    <!-- 预览弹窗 -->
    <el-dialog v-model="showPreview" title="素材预览" width="800px" destroy-on-close>
      <div class="preview-content">
        <video
          v-if="previewItem?.type === 'video'"
          :src="itemUrl(previewItem)"
          controls
          class="preview-video"
          autoplay
        />
        <img v-else-if="previewItem" :src="itemUrl(previewItem)" class="preview-image" />
      </div>
      <div class="preview-meta">
        <div class="meta-row"><span>名称：</span>{{ previewItem?.name || '未命名' }}</div>
        <div class="meta-row"><span>大小：</span>{{ formatSize(previewItem?.size) }}</div>
        <div class="meta-row"><span>创建时间：</span>{{ previewItem?.created_at }}</div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ArrowLeft, Upload, Search, Loading, CircleCheck,
  ZoomIn, Delete, Files
} from '@element-plus/icons-vue'
import { uploadAPI } from '@/api/upload'
import request from '@/utils/request'
import { useDebouncedSearch } from '@/composables/useDebouncedSearch'

const loading = ref(false)
const uploading = ref(false)
const uploadProgress = ref({ current: 0, total: 0 })
const mediaItems = ref([])
const mediaType = ref('all')
const keyword = ref('')
const page = ref(1)
const pageSize = ref(30)
const total = ref(0)
const selectedIds = reactive(new Set())
const showPreview = ref(false)
const previewItem = ref(null)
const uploadInput = ref(null)
const { trigger: debouncedLoad } = useDebouncedSearch(() => loadMedia(), 400)

function triggerUpload() {
  uploadInput.value?.click()
}

async function onUpload(e) {
  const files = Array.from(e.target.files || [])
  if (!files.length) return
  uploading.value = true
  uploadProgress.value = { current: 0, total: files.length }
  for (const file of files) {
    try {
      await uploadAPI.uploadImage(file)
      uploadProgress.value.current++
    } catch (err) {
      ElMessage.warning(`${file.name} 上传失败: ${err.message}`)
    }
  }
  uploading.value = false
  e.target.value = ''
  ElMessage.success(`${files.length} 个素材上传完成`)
  loadMedia()
}


async function loadMedia() {
  loading.value = true
  try {
    const params = {
      page: page.value,
      page_size: pageSize.value,
    }
    if (mediaType.value !== 'all') params.type = mediaType.value
    if (keyword.value) params.keyword = keyword.value
    const res = await request.get('/assets', { params })
    mediaItems.value = (res?.items || []).map(normalizeItem)
    total.value = res?.total || 0
  } catch (err) {
    mediaItems.value = []
  } finally {
    loading.value = false
  }
}

function normalizeItem(item) {
  const url = item.url || item.image_url || item.video_url || ''
  const isVideo = url.match(/\.(mp4|webm|mov)$/i) || item.type === 'video'
  return {
    ...item,
    type: isVideo ? 'video' : 'image',
    name: item.name || item.filename || (url.split('/').pop()),
  }
}

function itemUrl(item) {
  if (!item) return ''
  const lp = item.local_path || item.image_local_path || item.video_local_path
  if (lp) return '/static/' + lp.replace(/^\//, '')
  return item.url || item.image_url || item.video_url || ''
}

function formatSize(size) {
  if (!size) return ''
  if (size > 1024 * 1024) return (size / 1024 / 1024).toFixed(1) + ' MB'
  if (size > 1024) return (size / 1024).toFixed(0) + ' KB'
  return size + ' B'
}

function toggleSelect(item) {
  if (selectedIds.has(item.id)) {
    selectedIds.delete(item.id)
  } else {
    selectedIds.add(item.id)
  }
}

function openPreview(item) {
  previewItem.value = item
  showPreview.value = true
}

async function deleteItem(item) {
  await ElMessageBox.confirm('确定删除该素材？', '删除确认', { type: 'warning' })
  try {
    await request.delete(`/assets/${item.id}`)
    ElMessage.success('已删除')
    loadMedia()
  } catch (err) {
    ElMessage.error(err.message || '删除失败')
  }
}

async function batchDelete() {
  const count = selectedIds.size
  await ElMessageBox.confirm(`确定删除选中的 ${count} 个素材？`, '批量删除', { type: 'warning' })
  let failed = 0
  for (const id of selectedIds) {
    try {
      await request.delete(`/assets/${id}`)
    } catch (_) { failed++ }
  }
  selectedIds.clear()
  if (failed > 0) ElMessage.warning(`${count - failed} 个删除成功，${failed} 个失败`)
  else ElMessage.success(`${count} 个素材已删除`)
  loadMedia()
}

onMounted(loadMedia)
</script>

<style scoped>
/* ── Media Library — Midnight Cinema ── */

.media-library-page {
  min-height: 100vh;
  background: var(--bg-page);
  padding: 28px 28px;
  position: relative;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
  animation: fadeInUp 0.5s ease both;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.page-title {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-bright);
  margin: 0;
  letter-spacing: -0.02em;
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
  flex-wrap: wrap;
  animation: fadeInUp 0.55s ease both;
  animation-delay: 0.05s;
}

.search-input {
  width: 260px;
}

.upload-progress {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  color: var(--accent);
  font-size: 14px;
  font-weight: 500;
  padding: 10px 16px;
  background: var(--accent-muted);
  border: 1px solid var(--accent-border);
  border-radius: 8px;
  animation: fadeIn 0.3s ease;
}

.media-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 16px;
  min-height: 200px;
  animation: fadeInUp 0.6s ease both;
  animation-delay: 0.1s;
}

/* ── Media Card ── */
.media-card {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  overflow: hidden;
  border: 1px solid var(--glass-border);
  cursor: pointer;
  transition: box-shadow var(--duration-normal) ease,
              border-color var(--duration-normal) ease;
  box-shadow: var(--shadow-card);
  animation: scaleIn 0.35s ease both;
}

.media-card:nth-child(1)  { animation-delay: 0.04s; }
.media-card:nth-child(2)  { animation-delay: 0.08s; }
.media-card:nth-child(3)  { animation-delay: 0.12s; }
.media-card:nth-child(4)  { animation-delay: 0.16s; }
.media-card:nth-child(5)  { animation-delay: 0.20s; }
.media-card:nth-child(6)  { animation-delay: 0.24s; }
.media-card:nth-child(7)  { animation-delay: 0.28s; }
.media-card:nth-child(8)  { animation-delay: 0.32s; }
.media-card:nth-child(9)  { animation-delay: 0.36s; }
.media-card:nth-child(10) { animation-delay: 0.40s; }
.media-card:nth-child(n+11) { animation-delay: 0.44s; }

.media-card:hover {
  box-shadow: var(--shadow-hover);
}

.media-card.selected {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}

.media-card.selected:hover {
  box-shadow: 0 0 0 1px var(--accent), var(--shadow-hover);
}

/* ── Thumbnail ── */
.media-thumb {
  aspect-ratio: 1;
  background: var(--bg-page);
  overflow: hidden;
  position: relative;
  border-radius: var(--radius-md) var(--radius-md) 0 0;
}

.thumb-img,
.thumb-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.4s ease;
}

.media-card:hover .thumb-img,
.media-card:hover .thumb-video {
  transform: scale(1.05);
}

/* ── Overlay ── */
.media-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 30%, rgba(0,0,0,0.6) 100%);
  opacity: 0;
  transition: opacity 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.media-card:hover .media-overlay {
  opacity: 1;
}

.media-card.selected .media-overlay {
  opacity: 1;
}

.check-icon {
  position: absolute;
  top: 10px;
  right: 10px;
  font-size: 22px;
  color: var(--accent);
  background: rgba(0,0,0,0.5);
  border-radius: 50%;
  padding: 4px;
}

.overlay-actions {
  display: flex;
  gap: 8px;
}

.media-info {
  padding: 10px 12px;
}

.media-name {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.media-meta {
  font-size: 11px;
  color: var(--text-subtle);
  margin-top: 2px;
}

.empty-media {
  grid-column: 1 / -1;
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
  opacity: 0.35;
  animation: float 5s ease-in-out infinite;
}

.pagination {
  margin-top: 28px;
  display: flex;
  justify-content: center;
}

/* ── Batch Bar ── */
.batch-bar {
  position: fixed;
  bottom: 28px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--bg-card);
  color: var(--text-bright);
  padding: 12px 28px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: 14px;
  font-weight: 500;
  box-shadow: var(--shadow-hover);
  border: 1px solid var(--glass-border);
  animation: fadeInUp 0.35s ease;
  z-index: 100;
}

/* ── Preview ── */
.preview-content {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 360px;
  background: var(--bg-inner);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.preview-image {
  max-width: 100%;
  max-height: 60vh;
  object-fit: contain;
}

.preview-video {
  max-width: 100%;
  max-height: 60vh;
}

.preview-meta {
  margin-top: 20px;
  padding: 14px 16px;
  background: var(--bg-inner);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
}

.meta-row {
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 6px;
  line-height: 1.5;
}

.meta-row:last-child {
  margin-bottom: 0;
}

.meta-row span {
  font-weight: 600;
  color: var(--text-primary);
}

/* ── Light Mode Overrides ── */
html.light .media-library-page {
  background: var(--bg-page);
}

html.light .media-card {
  background: var(--bg-card);
  border-color: transparent;
  box-shadow: var(--shadow-card);
}

html.light .media-card:hover {
  box-shadow: var(--shadow-hover);
  border-color: var(--accent-border);
}

html.light .media-card.selected {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}

html.light .media-thumb {
  background: var(--bg-inner);
}

html.light .media-overlay {
  background: linear-gradient(180deg, transparent 30%, rgba(255,255,255,0.5) 100%);
}

html.light .check-icon {
  color: var(--accent);
  background: rgba(255,255,255,0.8);
}

html.light .batch-bar {
  background: var(--glass-bg);
  border-color: var(--glass-border);
  box-shadow: var(--shadow-hover);
}

html.light .preview-content {
  background: var(--bg-inner);
}

html.light .preview-meta {
  background: var(--bg-inner);
  border-color: var(--glass-border);
}
</style>
