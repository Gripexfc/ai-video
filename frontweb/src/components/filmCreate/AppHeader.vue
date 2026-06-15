<template>
  <!-- 顶部 -->
  <header class="header">
    <div class="header-inner">
      <h1 class="logo" @click="$emit('goList')">
        <img src="/logo.png" class="logo-icon" alt="logo" />
        <span class="logo-main">视频miao~</span>
      </h1>
      <span class="breadcrumb-sep">›</span>
      <span class="page-title">{{ dramaId ? (dramaTitle || '项目') : '新建故事' }}</span>
      <el-button v-if="dramaId" class="btn-back-drama" @click="$emit('goBackDrama')">
        <el-icon><ArrowLeft /></el-icon>
        返回剧集
      </el-button>
      <div class="header-actions">
        <el-button class="btn-theme" :title="isDark ? '切换到浅色模式' : '切换到暗色模式'" @click="$emit('toggleTheme')">
          <el-icon><Sunny v-if="isDark" /><Moon v-else /></el-icon>
          {{ isDark ? '浅色' : '暗色' }}
        </el-button>
        <!-- AI配置：积分模式下由管理员统一配置，普通用户不显示 -->
        <!-- <el-button class="btn-ai-config" @click="$emit('openAiConfig')">
          <el-icon><Setting /></el-icon>
          AI配置
        </el-button> -->
      </div>
    </div>
  </header>
</template>

<script setup>
import { ArrowLeft, Sunny, Moon, Setting } from '@element-plus/icons-vue'

defineProps({
  dramaId: { type: [String, Number], default: '' },
  dramaTitle: { type: String, default: '' },
  isDark: { type: Boolean, default: false },
})

defineEmits(['goList', 'goBackDrama', 'toggleTheme', 'openAiConfig'])
</script>

<style scoped>
/* === Header — Float Glass === */
.header {
  background: var(--bg-card);
  border-bottom: 1px solid var(--glass-border);
  padding: 10px 28px;
  position: sticky;
  top: 0;
  z-index: 200;
  box-shadow: var(--shadow-card);
  margin-left: 180px;
  transition: margin-left var(--duration-fast) ease;
}
.sidebar-collapsed .header {
  margin-left: 48px;
}
html.light .header {
  background: var(--bg-card);
  border-bottom: 1px solid var(--glass-border);
  box-shadow: var(--shadow-card);
}
.header-inner {
  display: flex;
  align-items: center;
  gap: 16px;
}
.logo {
  margin: 0;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 1px;
  line-height: 1;
  transition: filter 0.3s;
}
.logo:hover { filter: brightness(1.05); }
.logo-icon {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  object-fit: cover;
  margin-right: 6px;
}
.logo-main {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--accent);
  letter-spacing: -0.01em;
}
html.light .logo-main {
  color: var(--accent);
}
.breadcrumb-sep {
  color: var(--border-color);
  font-size: 0.9rem;
  font-weight: 300;
  flex-shrink: 0;
  user-select: none;
}
html.light .breadcrumb-sep { color: var(--border-muted); }
.page-title {
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--text-subtle);
  background: var(--bg-inner);
  border: 1px solid var(--glass-border);
  border-radius: 6px;
  padding: 4px 12px;
  max-width: 220px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
html.light .page-title {
  color: var(--text-muted);
  background: var(--bg-inner);
  border-color: var(--glass-border);
}
.btn-back-drama {
  flex-shrink: 0;
}
.header-actions {
  margin-left: auto;
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
.btn-theme {
  --el-button-bg-color: rgba(255, 255, 255, 0.04);
  --el-button-border-color: var(--glass-border);
  --el-button-text-color: var(--text-subtle);
  --el-button-hover-bg-color: var(--bg-hover);
  --el-button-hover-border-color: var(--accent-border);
  --el-button-hover-text-color: var(--accent);
  transition: background var(--duration-fast) ease, box-shadow var(--duration-fast) ease;
}
html.light .btn-theme {
  --el-button-bg-color: var(--accent-muted);
  --el-button-border-color: var(--accent-border);
  --el-button-text-color: var(--text-muted);
  --el-button-hover-bg-color: var(--accent-soft);
  --el-button-hover-border-color: var(--accent-border);
  --el-button-hover-text-color: var(--accent);
}
</style>
