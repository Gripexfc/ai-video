import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

const STORAGE_KEY = 'film-store-persist'

function loadPersistedState() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function persistState(state) {
  try {
    const data = {
      storyInput: state.storyInput,
      scriptContent: state.scriptContent,
      videoResolution: state.videoResolution,
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch { /* ignore quota errors */ }
}

function clearPersistedState() {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch { /* ignore */ }
}

export const useFilmStore = defineStore('film', () => {
  const saved = loadPersistedState()
  const drama = ref(null)
  const currentEpisode = ref(null)
  const storyInput = ref(saved?.storyInput ?? '')
  const scriptContent = ref(saved?.scriptContent ?? '')
  const videoResolution = ref(saved?.videoResolution ?? '720p')
  const videoProgress = ref(0)
  const videoStatus = ref('idle') // idle | generating | done | error

  const dramaId = computed(() => drama.value?.id ?? null)
  // 角色/道具/场景默认只显示本集资源（随「选择第几集」变化）
  const characters = computed(() => currentEpisode.value?.characters ?? [])
  const scenes = computed(() => currentEpisode.value?.scenes ?? [])
  const props = computed(() => currentEpisode.value?.props ?? [])
  const storyboards = computed(() => currentEpisode.value?.storyboards ?? [])

  function setDrama(d) {
    drama.value = d
  }

  function setCurrentEpisode(ep) {
    currentEpisode.value = ep
  }

  function setStoryInput(text) {
    storyInput.value = text
  }

  function setScriptContent(text) {
    scriptContent.value = text
  }

  function setVideoProgress(p) {
    videoProgress.value = p
  }

  function setVideoStatus(s) {
    videoStatus.value = s
  }

  function reset() {
    drama.value = null
    currentEpisode.value = null
    storyInput.value = ''
    scriptContent.value = ''
    videoProgress.value = 0
    videoStatus.value = 'idle'
    clearPersistedState()
  }

  // 自动持久化关键字段
  watch([storyInput, scriptContent, videoResolution], () => {
    persistState({ storyInput: storyInput.value, scriptContent: scriptContent.value, videoResolution: videoResolution.value })
  })

  return {
    drama,
    currentEpisode,
    storyInput,
    scriptContent,
    videoResolution,
    videoProgress,
    videoStatus,
    dramaId,
    characters,
    scenes,
    props,
    storyboards,
    setDrama,
    setCurrentEpisode,
    setStoryInput,
    setScriptContent,
    setVideoProgress,
    setVideoStatus,
    reset
  }
})
