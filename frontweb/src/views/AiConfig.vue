<template>
  <div class="ai-config">
    <header class="header">
      <div class="header-inner">
        <h1 class="logo" @click="goList">
          <img src="/logo.png" class="logo-icon" alt="logo" />
          <span class="logo-main">视频miao~</span>
        </h1>
        <span class="page-title">AI 配置</span>
        <el-button class="btn-back" @click="goList">
          <el-icon><ArrowLeft /></el-icon>
          返回
        </el-button>
      </div>
    </header>

    <main class="main">
      <AIConfigContent />
    </main>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { ArrowLeft } from '@element-plus/icons-vue'
import AIConfigContent from '@/components/AIConfigContent.vue'

const router = useRouter()

function goList() {
  router.push({ name: 'list' })
}
</script>

<style scoped>
.ai-config {
  min-height: 100vh;
  background: var(--bg-page);
}
html.light .ai-config {
  background: var(--bg-page);
}
.header {
  background: var(--bg-card-solid);
  border-bottom: 1px solid var(--border-color);
  box-shadow: var(--shadow);
  position: sticky;
  top: 0;
  z-index: 100;
}
html.light .header {
  background: var(--bg-card-solid);
  border-bottom-color: var(--border-color);
  box-shadow: var(--shadow);
}
.header-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 12px 24px;
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
  transition: filter var(--duration-normal) ease;
}
.logo:hover {
  filter: brightness(1.05);
}
.logo-icon {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  object-fit: cover;
  margin-right: 6px;
}
.logo-main {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--accent);
}
.logo-sub {
  font-size: 0.68rem;
  font-weight: 400;
  letter-spacing: 0.02em;
  color: var(--text-muted);
  -webkit-text-fill-color: var(--text-muted);
}
html.light .logo-main {
  color: var(--accent);
}
html.light .logo-sub {
  color: #9ca3af;
  -webkit-text-fill-color: #9ca3af;
}
.page-title {
  flex: 1;
  font-size: 16px;
  color: var(--text-muted);
}
html.light .page-title { color: #6b7280; }
.main {
  max-width: 1200px;
  margin: 24px auto;
  background: var(--bg-card-solid);
  border-radius: var(--radius-xl);
  padding: 20px 24px;
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-card);
}
html.light .main {
  background: var(--bg-card-solid);
  border-color: var(--border-color);
  box-shadow: var(--shadow-card);
}
</style>
