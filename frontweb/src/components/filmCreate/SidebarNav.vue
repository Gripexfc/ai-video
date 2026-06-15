<template>
  <nav class="quick-nav" :class="{ collapsed: navCollapsed }" aria-label="快捷导航">
    <div class="nav-sidebar-header">
      <span v-if="!navCollapsed" class="nav-sidebar-title">导航</span>
      <div class="nav-toggle" :title="navCollapsed ? '展开导航' : '收起导航'" @click="$emit('toggleNav')">
        <el-icon><Expand v-if="navCollapsed" /><Fold v-else /></el-icon>
      </div>
    </div>

    <!-- 步骤列表 -->
    <div class="nav-steps">
      <div
        v-for="(step, idx) in navSteps"
        :key="step.key"
        class="nav-step"
        :class="['status-' + step.status]"
        @click="$emit('scrollToAnchor', step.anchor)"
      >
        <!-- 左侧连接线 -->
        <div class="step-connector-wrap">
          <div v-if="idx > 0" class="step-line step-line-top" :class="{ filled: navSteps[idx - 1].status === 'done' }" />
          <div
            class="step-dot"
            :class="['dot-' + step.status]"
          >
            <el-icon v-if="step.status === 'done'" class="dot-icon"><Check /></el-icon>
            <el-icon v-else-if="step.status === 'generating'" class="dot-icon spin"><Loading /></el-icon>
            <span v-else class="dot-num">{{ idx + 1 }}</span>
          </div>
          <div v-if="idx < navSteps.length - 1" class="step-line step-line-bottom" :class="{ filled: step.status === 'done' }" />
        </div>

        <!-- 右侧文字 + 状态徽章 -->
        <div class="step-body">
          <span class="step-label">{{ step.label }}</span>
          <span v-if="step.count > 0 && step.status !== 'done'" class="step-count">{{ step.count }}</span>
          <span v-if="step.status === 'partial'" class="step-badge partial-badge" title="部分完成">
            <el-icon><WarningFilled /></el-icon>
          </span>
          <span v-else-if="step.status === 'generating'" class="step-badge gen-badge" title="生成中">
            <el-icon class="spin"><Loading /></el-icon>
          </span>
        </div>
      </div>
    </div>

    <!-- 分镜子列表 -->
    <div v-if="!navCollapsed && storyboards.length > 0" class="nav-group">
      <div class="nav-sub-toggle" @click="$emit('toggleStoryboardMenu')">
        <el-icon><Minus v-if="storyboardMenuExpanded" /><Plus v-else /></el-icon>
        <span>分镜列表</span>
      </div>
      <div v-show="storyboardMenuExpanded" class="nav-sub-list">
        <template v-for="(sb, i) in storyboards" :key="sb.id">
          <!-- 段落标题行 -->
          <div
            v-if="sb.segment_title && (i === 0 || sb.segment_index !== storyboards[i - 1].segment_index)"
            class="nav-segment-label"
          >
            <span class="nav-segment-dot" />
            {{ sb.segment_title }}
          </div>
          <div
            class="nav-sub-item"
            :title="sb.title || '分镜 ' + (i + 1)"
            @click="$emit('scrollToAnchor', 'sb-' + sb.id)"
          >
            {{ i + 1 }}. {{ sb.title || '分镜' }}
          </div>
        </template>
      </div>
    </div>

    <!-- 当前任务面板 -->
    <div v-if="allActiveTasks.length > 0" class="atp-panel">
      <!-- 折叠态：只显示旋转点和数量 -->
      <div v-if="navCollapsed" class="atp-collapsed-badge" :title="allActiveTasks.join('\n')">
        <span class="atp-spin-dot" />
        <span class="atp-collapsed-count">{{ allActiveTasks.length }}</span>
      </div>
      <!-- 展开态：标题 + 任务列表 -->
      <template v-else>
        <div class="atp-header">
          <span class="atp-spin-dot" />
          <span class="atp-title">进行中</span>
          <span class="atp-count-badge">{{ allActiveTasks.length }}</span>
        </div>
        <div class="atp-list">
          <div v-for="(label, i) in allActiveTasks.slice(0, 8)" :key="i" class="atp-item">
            <span class="atp-item-dot" />
            <span class="atp-item-label">{{ label }}</span>
          </div>
          <div v-if="allActiveTasks.length > 8" class="atp-more">
            还有 {{ allActiveTasks.length - 8 }} 个任务...
          </div>
        </div>
      </template>
    </div>
  </nav>
</template>

<script setup>
import { Expand, Fold, Check, Loading, WarningFilled, Minus, Plus } from '@element-plus/icons-vue'

defineProps({
  navCollapsed: { type: Boolean, default: false },
  storyboardMenuExpanded: { type: Boolean, default: false },
  navSteps: { type: Array, default: () => [] },
  storyboards: { type: Array, default: () => [] },
  allActiveTasks: { type: Array, default: () => [] },
  pipelineRunning: { type: Boolean, default: false },
  dramaId: { type: [String, Number], default: '' },
  currentEpisodeId: { type: [String, Number], default: '' },
  scrollToAnchor: { type: Function, default: null }
})

defineEmits(['toggleNav', 'scrollToAnchor', 'scrollToTop', 'toggleStoryboardMenu'])
</script>

<style scoped>
/* === Quick Nav Sidebar — Glass === */
.quick-nav {
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  z-index: 210;
  display: flex;
  flex-direction: column;
  padding: 14px 0 10px;
  background: var(--bg-card);
  border-right: 1px solid var(--glass-border);
  box-shadow: var(--shadow-card);
  width: 180px;
  overflow-y: auto;
  overflow-x: hidden;
  transition: width var(--duration-fast) ease, padding var(--duration-fast) ease;
}
html.light .quick-nav {
  background: var(--bg-card);
  border-right: 1px solid var(--glass-border);
  box-shadow: var(--shadow-card);
}
.quick-nav::-webkit-scrollbar { width: 4px; }
.quick-nav::-webkit-scrollbar-thumb { background: var(--accent-border); border-radius: 4px; }
.quick-nav::-webkit-scrollbar-track { background: transparent; }
.quick-nav.collapsed {
  width: 48px;
  padding: 12px 0;
}
.quick-nav.collapsed .nav-steps,
.quick-nav.collapsed .nav-group {
  display: none;
}
@media (max-width: 768px) {
  .quick-nav { width: 48px; padding: 12px 0; }
  .quick-nav .nav-steps, .quick-nav .nav-group { display: none; }
  .quick-nav .nav-sidebar-title { display: none; }
  .quick-nav .nav-sidebar-header { justify-content: center; padding: 0 4px 8px; }
}

/* === Active Task Panel === */
.atp-panel {
  margin-top: 6px;
  border-top: 1px solid var(--accent-border);
  padding: 6px 0 4px;
}
.atp-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px 4px;
}
.atp-title {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--accent);
  letter-spacing: 0.03em;
  flex: 1;
}
.atp-count-badge {
  font-size: 0.68rem;
  background: var(--accent-soft);
  color: var(--accent);
  border-radius: 8px;
  padding: 1px 5px;
  min-width: 16px;
  text-align: center;
}
.atp-spin-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent);
  flex-shrink: 0;
  animation: atp-pulse 1.2s ease-in-out infinite;
}
@keyframes atp-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.85; transform: scale(0.95); }
}
.atp-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.atp-item {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 6px;
  transition: background 0.15s;
}
.atp-item:hover { background: var(--bg-hover); }
.atp-item-dot {
  display: inline-block;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--accent);
  flex-shrink: 0;
  animation: atp-pulse 1.6s ease-in-out infinite;
}
.atp-item-label {
  font-size: 0.72rem;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 118px;
}
.atp-more {
  font-size: 0.68rem;
  color: var(--text-subtle);
  padding: 2px 10px 2px 19px;
}
.atp-collapsed-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 4px 0;
  cursor: default;
}
.atp-collapsed-count {
  font-size: 0.65rem;
  color: var(--accent);
  font-weight: 700;
  line-height: 1;
}
html.light .atp-title { color: var(--accent); }
html.light .atp-count-badge { background: var(--accent-soft); color: var(--accent); }
html.light .atp-spin-dot { background: var(--accent); }
html.light .atp-item-dot { background: var(--accent); }
html.light .atp-item-label { color: var(--text-primary); }
html.light .atp-item:hover { background: var(--bg-hover); }
html.light .atp-panel { border-top-color: var(--accent-border); }

/* === Nav Sidebar Header === */
.nav-sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px 8px;
  border-bottom: 1px solid var(--accent-border);
  margin-bottom: 8px;
  flex-shrink: 0;
}
html.light .nav-sidebar-header { border-bottom-color: var(--accent-border); }
.quick-nav.collapsed .nav-sidebar-header {
  justify-content: center;
  padding: 0 4px 8px;
}
.nav-sidebar-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--accent);
  letter-spacing: 0.03em;
  white-space: nowrap;
  overflow: hidden;
}
html.light .nav-sidebar-title { color: var(--accent); }
.nav-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  cursor: pointer;
  color: var(--text-subtle);
  transition: color 0.15s, background 0.15s;
  border-radius: 6px;
  flex-shrink: 0;
  font-size: 16px;
}
.nav-toggle:hover { color: var(--text-primary); background: var(--bg-hover); }
html.light .nav-toggle { color: var(--text-faint); }
html.light .nav-toggle:hover { color: var(--text-primary); background: var(--bg-hover); }

/* === Steps === */
.nav-steps {
  display: flex;
  flex-direction: column;
  padding: 0 10px 0 10px;
}
.nav-step {
  display: flex;
  align-items: stretch;
  gap: 8px;
  cursor: pointer;
  border-radius: 6px;
  padding: 3px 6px 3px 0;
  transition: background 0.2s ease;
  user-select: none;
}
.nav-step:hover { background: var(--bg-hover); }
html.light .nav-step:hover { background: var(--bg-hover); }

.step-connector-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 20px;
  flex-shrink: 0;
}
.step-line {
  width: 2px;
  flex: 1;
  min-height: 6px;
  background: var(--border-muted);
  border-radius: 1px;
  transition: background 0.3s;
}
html.light .step-line { background: var(--border-muted); }
.step-line.filled { background: rgba(34, 197, 94, 0.5); }

/* Step dots — status colors */
.step-dot {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 700;
  transition: background var(--duration-fast) ease, box-shadow var(--duration-fast) ease;
  border: 2px solid transparent;
}
.dot-pending {
  background: var(--bg-hover);
  border-color: var(--border-muted);
  color: var(--text-faint);
}
html.light .dot-pending {
  background: var(--bg-hover);
  border-color: var(--border-muted);
  color: var(--text-faint);
}
.dot-partial {
  background: var(--accent-soft);
  border-color: var(--accent-border);
  color: var(--accent);
}
.dot-generating {
  background: var(--accent-soft);
  border-color: var(--accent-border);
  color: var(--accent);
}
.dot-done {
  background: rgba(34, 197, 94, 0.12);
  border-color: rgba(34, 197, 94, 0.5);
  color: #22c55e;
}
.dot-icon { font-size: 13px; }
.dot-num { font-size: 11px; line-height: 1; }

.step-body {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  padding: 3px 0;
  min-width: 0;
}
.step-label {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-subtle);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.2s ease;
}
html.light .step-label { color: var(--text-muted); }
.nav-step:hover .step-label { color: var(--text-primary); }
html.light .nav-step:hover .step-label { color: var(--text-primary); }
.status-done .step-label { color: #6ee7b7; }
html.light .status-done .step-label { color: #059669; }
.status-generating .step-label { color: var(--accent); }
html.light .status-generating .step-label { color: var(--accent); }
.status-partial .step-label { color: var(--accent-dim); }
html.light .status-partial .step-label { color: var(--accent-dim); }

.step-count {
  font-size: 10px;
  color: var(--text-faint);
  background: var(--bg-inner);
  border-radius: 10px;
  padding: 1px 5px;
  flex-shrink: 0;
  font-weight: 500;
}
html.light .step-count { background: var(--bg-inner); color: var(--text-faint); }

.step-badge {
  display: flex;
  align-items: center;
  font-size: 11px;
  flex-shrink: 0;
}
.partial-badge { color: var(--accent-dim); }
.gen-badge { color: var(--accent); }

@keyframes navSpin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.spin { animation: navSpin 1s linear infinite; display: inline-flex; }

/* Nav sub groups */
.nav-group { margin-top: 4px; }
.nav-sub-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  font-size: 12px;
  color: var(--text-subtle);
  cursor: pointer;
  transition: color 0.15s;
  border-top: 1px solid var(--glass-border);
}
html.light .nav-sub-toggle { border-top-color: var(--glass-border); color: var(--text-faint); }
.nav-sub-toggle:hover { color: var(--text-primary); }
html.light .nav-sub-toggle:hover { color: var(--text-primary); }
.nav-sub-list {
  background: var(--bg-inner);
  padding: 4px 0;
  border-radius: 0 0 6px 6px;
}
html.light .nav-sub-list { background: var(--bg-inner); }
.nav-sub-item {
  padding: 4px 10px 4px 26px;
  font-size: 11.5px;
  color: var(--text-faint);
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.15s, background 0.15s;
  border-radius: 4px;
  margin: 0 4px;
}
html.light .nav-sub-item { color: var(--text-faint); }
.nav-sub-item:hover { color: var(--text-primary); background: var(--bg-hover); }
html.light .nav-sub-item:hover { color: var(--text-primary); background: var(--bg-hover); }
</style>
