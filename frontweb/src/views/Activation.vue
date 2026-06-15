<template>
  <div class="activation-page">
    <div class="activation-card" :class="{ 'card--visible': cardVisible }">
      <img src="/logo.png" class="logo-icon" alt="logo" />
      <h1>视频miao~</h1>
      <p class="subtitle">请输入激活码以继续使用</p>

      <div class="code-input-section">
        <label>激活码</label>
        <input
          ref="codeInput"
          v-model="codeText"
          class="code-input"
          placeholder="请输入激活码"
          @keydown.enter="doActivate"
        />
      </div>

      <button
        class="activate-btn"
        :class="{ 'btn--loading': loading, 'btn--ready': codeText.trim() }"
        :disabled="!codeText.trim() || loading"
        @click="doActivate"
      >
        <span v-if="loading" class="spinner"></span>
        <span v-else>激活</span>
      </button>

      <div v-if="errorMsg" class="msg msg--error">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        {{ errorMsg }}
      </div>
      <div v-if="successMsg" class="msg msg--success">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        {{ successMsg }}
      </div>

      <p class="hint">请联系管理员获取激活码</p>

      <button class="quit-btn" @click="quitApp">退出应用</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useActivationStore } from '@/stores/activation'

const router = useRouter()
const store = useActivationStore()

const codeInput = ref(null)
const codeText = ref('')
const loading = ref(false)
const errorMsg = ref('')
const successMsg = ref('')
const cardVisible = ref(false)

onMounted(async () => {
  await store.checkStatus()
  if (store.isActivated) {
    router.replace('/')
    return
  }
  await nextTick()
  setTimeout(() => { cardVisible.value = true }, 80)
  setTimeout(() => { codeInput.value?.focus() }, 500)
})

async function doActivate() {
  const code = codeText.value.trim()
  if (!code) return
  errorMsg.value = ''
  successMsg.value = ''
  loading.value = true
  try {
    await store.activate(code)
    successMsg.value = '激活成功！'
    setTimeout(() => router.replace('/'), 1000)
  } catch (err) {
    const msg = err?.response?.data?.error?.message || err?.message || '激活失败'
    errorMsg.value = msg
  } finally {
    loading.value = false
  }
}

function quitApp() {
  window.close()
}
</script>

<style scoped>
/* ── Activation — Apple HIG ── */

.activation-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-page);
  padding: var(--space-lg);
  position: relative;
  overflow: hidden;
}

/* ── Card ── */
.activation-card {
  position: relative;
  z-index: 1;
  background: var(--bg-card-solid);
  border: 1px solid var(--border-muted);
  border-radius: var(--radius-2xl);
  padding: 52px 44px 40px;
  width: 100%;
  max-width: 420px;
  text-align: center;
  box-shadow: var(--shadow-hover);
  opacity: 0;
  transform: translateY(10px);
  transition: opacity var(--duration-slow) ease,
              transform var(--duration-slow) ease;
}

.activation-card.card--visible {
  opacity: 1;
  transform: translateY(0);
}

/* ── Logo ── */
.logo-icon {
  width: 56px;
  height: 56px;
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-lg);
  box-shadow: var(--shadow);
  transition: box-shadow var(--duration-normal) ease;
}

.activation-card:hover .logo-icon {
  box-shadow: var(--shadow-hover);
}

/* ── Typography ── */
.activation-card h1 {
  margin: 0 0 var(--space-sm);
  font-size: 28px;
  font-weight: 700;
  color: var(--text-bright);
  letter-spacing: -0.02em;
}

.subtitle {
  margin: 0 0 36px;
  font-size: 14px;
  color: var(--text-muted);
  font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif;
  letter-spacing: 0.01em;
}

/* ── Code Input Section ── */
.code-input-section {
  text-align: left;
  margin-bottom: var(--space-lg);
}

.code-input-section label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.code-input {
  width: 100%;
  height: 52px;
  font-size: 16px;
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
  letter-spacing: 1px;
  border: 1px solid var(--border-muted);
  border-radius: var(--radius-md);
  background: var(--bg-inner);
  color: var(--text-bright);
  outline: none;
  padding: 0 18px;
  box-sizing: border-box;
  transition: border-color var(--duration-normal) ease, box-shadow var(--duration-normal) ease, background var(--duration-normal) ease;
}

.code-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
  background: var(--bg-active);
}

.code-input::placeholder {
  color: var(--text-faint);
  font-size: 14px;
}

/* ── Activate Button ── */
.activate-btn {
  width: 100%;
  height: 52px;
  font-size: 16px;
  font-weight: 700;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif;
  letter-spacing: 0.02em;
  border: none;
  border-radius: var(--radius-lg);
  cursor: pointer;
  background: var(--bg-hover);
  color: var(--text-faint);
  transition: background var(--duration-normal) ease, box-shadow var(--duration-normal) ease, color var(--duration-normal) ease;
  position: relative;
  overflow: hidden;
}

.activate-btn.btn--ready {
  background: var(--accent);
  color: #1a1a1f;
  box-shadow: var(--shadow);
}

.activate-btn.btn--ready:hover {
  box-shadow: var(--shadow-hover);
}

.activate-btn.btn--ready:active {
  filter: brightness(0.96);
}

.activate-btn:disabled:not(.btn--loading) {
  cursor: not-allowed;
}

/* ── Spinner ── */
.spinner {
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 2.5px solid rgba(255,255,255,0.15);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ── Messages ── */
.msg {
  margin-top: var(--space-md);
  font-size: 13px;
  padding: var(--space-md);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  gap: 10px;
  animation: fadeIn var(--duration-normal) ease;
}

.msg--error {
  color: #f87171;
  background: rgba(239,68,68,0.08);
  border: 1px solid rgba(239,68,68,0.15);
}

.msg--success {
  color: #4ade80;
  background: rgba(34,197,94,0.08);
  border: 1px solid rgba(34,197,94,0.15);
}

/* ── Hint & Quit ── */
.hint {
  margin-top: 28px;
  font-size: 12px;
  color: var(--text-subtle);
}

.quit-btn {
  margin-top: 10px;
  padding: var(--space-sm) var(--space-md);
  font-size: 12px;
  color: var(--text-faint);
  background: transparent;
  border: 1px solid transparent;
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: background var(--duration-fast) ease, border-color var(--duration-fast) ease, color var(--duration-fast) ease;
}

.quit-btn:hover {
  color: var(--text-muted);
  background: var(--bg-hover);
  border-color: var(--border-muted);
}

/* ── Light Mode Overrides ── */
html.light .activation-page {
  background: var(--bg-page);
}

html.light .activation-card {
  background: var(--bg-card-solid);
  border-color: var(--border-muted);
  box-shadow: var(--shadow-hover);
}

html.light .logo-icon {
  box-shadow: var(--shadow);
}

html.light .activation-card h1 {
  color: var(--text-bright);
}

html.light .code-input {
  background: var(--bg-inner);
  border-color: var(--border-muted);
  color: var(--text-primary);
}

html.light .code-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
  background: var(--bg-active);
}

html.light .activate-btn.btn--ready {
  background: var(--accent);
  color: #fff;
  box-shadow: var(--shadow);
}

html.light .activate-btn.btn--ready:hover {
  box-shadow: var(--shadow-hover);
}

html.light .msg--error {
  color: #dc2626;
  background: rgba(220,38,38,0.06);
  border-color: rgba(220,38,38,0.12);
}

html.light .msg--success {
  color: #16a34a;
  background: rgba(22,163,74,0.06);
  border-color: rgba(22,163,74,0.12);
}

html.light .quit-btn:hover {
  background: var(--bg-hover);
  border-color: var(--border-muted);
}
</style>
