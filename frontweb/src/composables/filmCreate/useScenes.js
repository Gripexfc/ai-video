import { ref, reactive } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { sceneAPI } from '@/api/scenes'
import { sceneLibraryAPI } from '@/api/sceneLibrary'
import { uploadAPI } from '@/api/upload'
import { dataUrlToFile } from '@/utils/dataUrlToFile'
import { useLibraryManagement } from './useLibraryManagement'

/**
 * 场景管理 Composable
 * @param {object} deps - 共享依赖
 * @param {object} deps.store - Pinia store
 * @param {import('vue').ComputedRef} deps.dramaId
 * @param {import('vue').ComputedRef} deps.currentEpisodeId
 * @param {Function} deps.getSelectedStyle
 * @param {Function} deps.scriptLanguage - ref
 * @param {Function} deps.loadDrama
 * @param {Function} deps.pollTask
 * @param {Function} deps.pollUntilResourceHasImage
 * @param {Function} deps.hasAssetImage
 * @param {Function} [deps.getAssetImageModel]
 * @param {object} deps.dramaAPI
 */
export function useScenes(deps) {
  const { store, dramaId, currentEpisodeId, getSelectedStyle, getAssetImageModel, scriptLanguage, loadDrama, pollTask, pollUntilResourceHasImage, hasAssetImage, dramaAPI } = deps


  // ── 场景弹窗状态 ──────────────────────────────────────
  const showEditScene = ref(false)
  const editSceneForm = ref(null)
  const editSceneSaving = ref(false)
  const editScenePromptGenerating = ref(false)
  const extractingSceneDesc = ref(false)
  const addSceneRefImage = ref(null)   // { dataUrl, filename }
  const addSceneRefFileInput = ref(null)
  let editScenePollTimer = null

  // ── 场景生成状态 ──────────────────────────────────────
  const scenesExtracting = ref(false)
  const generatingSceneIds = reactive(new Set())

  // ── 场景库（通过 useLibraryManagement 工厂） ────────────
  const lib = useLibraryManagement({
    assetType: '场景',
    dramaId,
    loadDrama,
    hasAssetImage,
    api: sceneLibraryAPI,
    assetApi: sceneAPI,
    store,
    getAssets: () => store.scenes || [],
    getAssetName: (item) => (item.location || item.time || '未命名').slice(0, 20),
    addAssetFromLibrary: async (item) => {
      if (!store.dramaId || !currentEpisodeId.value) return
      const existingScene = (store.scenes || []).find(s => s.location === item.location)
      if (existingScene) {
        await sceneAPI.update(existingScene.id, {
          location: item.location || existingScene.location,
          time: item.time || existingScene.time,
          prompt: existingScene.prompt || item.prompt || '',
          image_url: item.image_url || existingScene.image_url || undefined,
          local_path: item.local_path || existingScene.local_path || undefined,
        })
        ElMessage.success(`「${item.location || '场景'}」已更新到本集`)
      } else {
        await sceneAPI.create({
          drama_id: store.dramaId,
          episode_id: currentEpisodeId.value,
          location: item.location || '',
          time: item.time || '',
          prompt: item.prompt || '',
          image_url: item.image_url || undefined,
          local_path: item.local_path || undefined,
        })
        ElMessage.success(`「${item.location || '场景'}」已加入本集`)
      }
      await loadDrama()
    },
  })
  const showSceneLibrary = lib.showLibrary
  const sceneLibraryList = lib.libraryList
  const sceneLibraryLoading = lib.libraryLoading
  const sceneLibraryPage = lib.libraryPage
  const sceneLibraryPageSize = lib.libraryPageSize
  const sceneLibraryTotal = lib.libraryTotal
  const sceneLibraryKeyword = lib.libraryKeyword
  const showEditSceneLibrary = lib.showEditLibrary
  const editSceneLibraryForm = lib.editLibraryForm
  const editSceneLibrarySaving = lib.editLibrarySaving
  const addingSceneToLibraryId = lib.addingToLibraryId
  const addingSceneToMaterialId = lib.addingToMaterialId
  const addingSceneFromLibraryId = lib.addingFromLibraryId
  const loadSceneLibraryList = lib.loadLibraryList
  const debouncedLoadSceneLibrary = lib.debouncedLoadLibrary
  const onAddSceneToLibrary = lib.onAddToLibrary
  const onAddSceneToMaterialLibrary = lib.onAddToMaterialLibrary
  const loadSceneLibraryMembership = lib.loadMembership
  const isSceneInLibrary = lib.isInLibrary
  const isSceneInMaterialLibrary = lib.isInMaterialLibrary
  const onAddSceneFromLibrary = lib.onAddFromLibrary
  const onDeleteSceneLibrary = lib.onDeleteLibrary

  // ── 函数 ──────────────────────────────────────────────
  async function onExtractScenes() {
    if (!currentEpisodeId.value) return
    scenesExtracting.value = true
    try {
      const res = await dramaAPI.extractBackgrounds(currentEpisodeId.value, {
        model: undefined,
        style: getSelectedStyle(),
        language: scriptLanguage.value
      })
      const taskId = res?.task_id
      if (taskId) {
        const pollRes = await pollTask(taskId, () => loadDrama())
        if (pollRes?.status !== 'failed') {
          ElMessage.success('场景提取完成')
        }
      } else {
        await loadDrama()
        ElMessage.success('场景提取任务已提交')
      }
    } catch (e) {
      ElMessage.error(e.message || '提取失败')
    } finally {
      scenesExtracting.value = false
    }
  }

  function openAddScene() {
    editSceneForm.value = { location: '', time: '', prompt: '', negative_prompt: '' }
    showEditScene.value = true
  }

  function stopScenePromptPoll() {
    if (editScenePollTimer) { clearInterval(editScenePollTimer); editScenePollTimer = null }
  }

  function editScene(scene) {
    stopScenePromptPoll()
    editSceneForm.value = {
      id: scene.id,
      location: scene.location || '',
      time: scene.time || '',
      prompt: scene.prompt || '',
      polished_prompt: scene.polished_prompt || '',
      image_url: scene.image_url || '',
      local_path: scene.local_path || '',
      ref_image: scene.ref_image || '',
      negative_prompt: scene.negative_prompt || '',
    }
    showEditScene.value = true
    if (!scene.polished_prompt && scene.id && (scene.location || scene.time)) {
      editScenePromptGenerating.value = true
      let elapsed = 0
      editScenePollTimer = setInterval(async () => {
        elapsed += 3
        try {
          const res = await sceneAPI.get(scene.id)
          const p = res?.scene?.polished_prompt
          if (p) {
            if (editSceneForm.value?.id === scene.id) editSceneForm.value.polished_prompt = p
            stopScenePromptPoll()
            editScenePromptGenerating.value = false
          } else if (elapsed >= 60) {
            stopScenePromptPoll()
            editScenePromptGenerating.value = false
          }
        } catch (_) {
          stopScenePromptPoll()
          editScenePromptGenerating.value = false
        }
      }, 3000)
    }
  }

  async function doGenerateScenePrompt() {
    const form = editSceneForm.value
    if (!form?.id) return
    editScenePromptGenerating.value = true
    try {
      const res = await sceneAPI.generatePrompt(form.id)
      if (res?.polished_prompt) {
        form.polished_prompt = res.polished_prompt
        ElMessage.success('提示词已生成')
        await loadDrama()
      }
    } catch (e) {
      ElMessage.error(e.message || '生成提示词失败')
    } finally {
      editScenePromptGenerating.value = false
    }
  }

  async function saveSceneRefImageIfAny(sceneId) {
    const refImg = addSceneRefImage.value
    if (!refImg || !sceneId) return
    try {
      const file = dataUrlToFile(refImg.dataUrl, refImg.filename || 'reference.png')
      const uploadRes = await uploadAPI.uploadImage(file, { dramaId: dramaId.value })
      const refPath = uploadRes.local_path || uploadRes.url || ''
      await sceneAPI.putRefImage(sceneId, refPath)
    } catch (e) {
      console.warn('[saveSceneRefImage] 保存参考图失败:', e.message)
    }
  }

  async function clearSceneRefImage() {
    const form = editSceneForm.value
    if (!form?.id) return
    try {
      await sceneAPI.putRefImage(form.id, null)
      form.ref_image = ''
      ElMessage.success('参考图已移除')
    } catch (e) {
      ElMessage.error('移除失败')
    }
  }

  async function doExtractSceneFromImage() {
    const form = editSceneForm.value
    if (!form?.id) return
    extractingSceneDesc.value = true
    try {
      const res = await sceneAPI.extractFromImage(form.id)
      if (res?.prompt) {
        form.prompt = res.prompt
        ElMessage.success('已从图片提取场景描述')
      }
    } catch (e) {
      ElMessage.error(e.message || '提取失败，请检查场景是否已上传参考图片')
    } finally {
      extractingSceneDesc.value = false
    }
  }

  async function submitEditScene() {
    const form = editSceneForm.value
    if (!form?.location?.trim() || !store.dramaId) return
    editSceneSaving.value = true
    try {
      if (form.id) {
        await sceneAPI.update(form.id, {
          location: form.location.trim(),
          time: form.time || undefined,
          prompt: form.prompt || undefined,
          polished_prompt: form.polished_prompt || undefined,
          negative_prompt: (form.negative_prompt || '').trim() || null,
        })
        await saveSceneRefImageIfAny(form.id)
        ElMessage.success('场景已保存')
      } else {
        await sceneAPI.create({
          drama_id: store.dramaId,
          episode_id: currentEpisodeId.value || undefined,
          location: form.location.trim(),
          time: form.time || undefined,
          prompt: form.prompt || undefined,
          negative_prompt: (form.negative_prompt || '').trim() || null,
        })
        await loadDrama()
        if (addSceneRefImage.value) {
          const newScene = (store.drama?.scenes || []).find(
            s => s.location === form.location.trim() && (s.time || '') === (form.time || '')
          )
          if (newScene?.id) await saveSceneRefImageIfAny(newScene.id)
        }
        ElMessage.success('场景已添加')
      }
      await loadDrama()
      showEditScene.value = false
    } catch (e) {
      ElMessage.error(e.message || (form.id ? '保存失败' : '添加失败'))
    } finally {
      editSceneSaving.value = false
    }
  }

  function onCloseSceneDialog() {
    showEditScene.value = false
    stopScenePromptPoll()
    editScenePromptGenerating.value = false
    addSceneRefImage.value = null
  }

  async function onDeleteScene(scene) {
    try {
      await ElMessageBox.confirm(
        `确定要删除场景「${(scene.location || scene.time || '未命名').slice(0, 20)}」吗？此操作不可恢复。`,
        '删除确认',
        { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
      )
      await sceneAPI.delete(scene.id)
      await loadDrama()
      ElMessage.success('场景已删除')
    } catch (e) {
      if (e === 'cancel') return
      ElMessage.error(e.message || '删除失败')
    }
  }

  async function onGenerateSceneImage(scene) {
    scene.errorMsg = ''
    scene.error_msg = ''
    generatingSceneIds.add(scene.id)
    try {
      const res = await sceneAPI.generateImage({
        scene_id: scene.id,
        model: getAssetImageModel?.(),
        style: getSelectedStyle()
      })
      const taskId = res?.image_generation?.task_id ?? res?.task_id
      if (taskId) {
        const pollRes = await pollTask(taskId, () => loadDrama())
        if (pollRes?.status === 'failed') {
          scene.errorMsg = pollRes.error || '生成失败'
        } else {
          ElMessage.success('场景图片已生成')
        }
      } else {
        await loadDrama()
        await pollUntilResourceHasImage(() => {
          const list = store.drama?.scenes ?? store.currentEpisode?.scenes ?? []
          const s = list.find((x) => Number(x.id) === Number(scene.id))
          return !!(s && (s.image_url || s.local_path))
        })
        ElMessage.success('场景图片已生成')
      }
    } catch (e) {
      console.error(e)
      scene.errorMsg = e.message || '生成失败'
      ElMessage.error(e.message || '提交失败')
    } finally {
      generatingSceneIds.delete(scene.id)
    }
  }

  // ── 场景库函数（由 useLibraryManagement 工厂提供，仅保留适配器）──

  function openEditSceneLibrary(item) {
    lib.openEditLibrary(item, {
      location: item.location ?? '',
      time: item.time ?? '',
      category: item.category ?? '',
      description: item.description ?? '',
      tags: item.tags ?? '',
    })
  }

  async function submitEditSceneLibrary() {
    await lib.submitEditLibrary(['location', 'time', 'category', 'description', 'tags'])
  }

  /**
   * 清理所有计时器和轮询，组件卸载时调用
   */
  function cleanup() {
    if (editScenePollTimer) { clearInterval(editScenePollTimer); editScenePollTimer = null }
  }

  return {
    // 弹窗状态
    showEditScene,
    editSceneForm,
    editSceneSaving,
    editScenePromptGenerating,
    extractingSceneDesc,
    addSceneRefImage,
    addSceneRefFileInput,
    // 生成状态
    scenesExtracting,
    generatingSceneIds,
    // 库状态
    showSceneLibrary,
    sceneLibraryList,
    sceneLibraryLoading,
    sceneLibraryPage,
    sceneLibraryPageSize,
    sceneLibraryTotal,
    sceneLibraryKeyword,
    showEditSceneLibrary,
    editSceneLibraryForm,
    editSceneLibrarySaving,
    addingSceneToLibraryId,
    addingSceneToMaterialId,
    addingSceneFromLibraryId,
    // 函数
    onExtractScenes,
    openAddScene,
    stopScenePromptPoll,
    editScene,
    doGenerateScenePrompt,
    saveSceneRefImageIfAny,
    clearSceneRefImage,
    doExtractSceneFromImage,
    submitEditScene,
    onCloseSceneDialog,
    onDeleteScene,
    onGenerateSceneImage,
    loadSceneLibraryMembership,
    isSceneInLibrary,
    isSceneInMaterialLibrary,
    loadSceneLibraryList,
    debouncedLoadSceneLibrary,
    openEditSceneLibrary,
    submitEditSceneLibrary,
    onDeleteSceneLibrary,
    onAddSceneToLibrary,
    onAddSceneToMaterialLibrary,
    onAddSceneFromLibrary,
    cleanup,
  }
}
