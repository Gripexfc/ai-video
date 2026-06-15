import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useDebouncedSearch } from '@/composables/useDebouncedSearch'
import { createLibraryMembershipState, hasAssetInLibrary, loadLibraryMembership, markAssetInLibrary } from './libraryMembership'

/**
 * 通用 Library 管理 composable 工厂
 *
 * @param {object} opts
 * @param {string} opts.assetType - 资产类型名称（如 'character'/'scene'/'prop'），用于消息提示
 * @param {Function} opts.dramaId - ref getter
 * @param {Function} opts.loadDrama - 刷新数据
 * @param {Function} opts.hasAssetImage - 检查资产是否有图
 * @param {object} opts.api - library API 对象（list/update/delete）
 * @param {object} opts.assetApi - 资产 API 对象（addToLibrary/addToMaterialLibrary）
 * @param {object} opts.store - Pinia store
 * @param {Function} opts.getAssets - 获取当前资产列表 () => asset[]
 * @param {Function} opts.getAssetName - 获取资产名称 (asset) => string
 * @param {Function} opts.addAssetFromLibrary - 将库中资产添加到本集 (item) => Promise
 */
export function useLibraryManagement({
  assetType,
  dramaId,
  loadDrama,
  hasAssetImage,
  api,
  assetApi,
  store,
  getAssets,
  getAssetName,
  addAssetFromLibrary,
}) {
  // ── 库列表状态 ──
  const showLibrary = ref(false)
  const libraryList = ref([])
  const libraryLoading = ref(false)
  const libraryPage = ref(1)
  const libraryPageSize = ref(20)
  const libraryTotal = ref(0)
  const libraryKeyword = ref('')

  // ── 编辑库条目弹窗 ──
  const showEditLibrary = ref(false)
  const editLibraryForm = ref(null)
  const editLibrarySaving = ref(false)

  // ── 操作中状态 ──
  const addingToLibraryId = ref(null)
  const addingToMaterialId = ref(null)
  const addingFromLibraryId = ref(null)

  // ── 库成员关系 ──
  const membership = createLibraryMembershipState()
  const { trigger: debouncedLoadLibrary } = useDebouncedSearch(() => {
    libraryPage.value = 1
    loadLibraryList()
  }, 300)

  // ── 函数 ──
  async function loadLibraryList() {
    libraryLoading.value = true
    try {
      const res = await api.list({
        drama_id: dramaId.value,
        page: libraryPage.value,
        page_size: libraryPageSize.value,
        keyword: libraryKeyword.value || undefined,
      })
      libraryList.value = res?.items ?? []
      const pagination = res?.pagination ?? {}
      libraryTotal.value = pagination.total ?? 0
      if (pagination.page != null) libraryPage.value = pagination.page
      if (pagination.page_size != null) libraryPageSize.value = pagination.page_size
    } catch (e) {
      libraryList.value = []
    } finally {
      libraryLoading.value = false
    }
  }

  function openEditLibrary(item, formFields) {
    editLibraryForm.value = { id: item.id, ...formFields }
    showEditLibrary.value = true
  }

  async function submitEditLibrary(formFields) {
    if (!editLibraryForm.value?.id) return
    editLibrarySaving.value = true
    try {
      const updateData = {}
      for (const key of formFields) {
        updateData[key] = editLibraryForm.value[key] || null
      }
      await api.update(editLibraryForm.value.id, updateData)
      ElMessage.success('已保存')
      showEditLibrary.value = false
      loadLibraryList()
    } catch (e) {
      ElMessage.error(e.message || '保存失败')
    } finally {
      editLibrarySaving.value = false
    }
  }

  async function onDeleteLibrary(item) {
    const name = getAssetName(item)
    try {
      await ElMessageBox.confirm(
        `确定删除公共${assetType}「${name}」吗？`,
        '删除确认',
        { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
      )
      await api.delete(item.id)
      ElMessage.success('已删除')
      loadLibraryList()
    } catch (e) {
      if (e === 'cancel') return
      ElMessage.error(e.message || '删除失败')
    }
  }

  async function onAddToLibrary(asset) {
    if (!hasAssetImage(asset)) {
      ElMessage.warning('请先为该' + assetType + '生成或上传图片')
      return
    }
    addingToLibraryId.value = asset.id
    try {
      await assetApi.addToLibrary(asset.id, {})
      markAssetInLibrary(membership.dramaSourceIds, asset)
      ElMessage.success('已加入本剧' + assetType + '库')
      if (showLibrary.value) loadLibraryList()
    } catch (e) {
      ElMessage.error(e.message || '加入失败')
    } finally {
      addingToLibraryId.value = null
    }
  }

  async function onAddToMaterialLibrary(asset) {
    if (!hasAssetImage(asset)) {
      ElMessage.warning('请先为该' + assetType + '生成或上传图片')
      return
    }
    addingToMaterialId.value = asset.id
    try {
      await assetApi.addToMaterialLibrary(asset.id)
      markAssetInLibrary(membership.materialSourceIds, asset)
      ElMessage.success('已加入全局素材库')
    } catch (e) {
      ElMessage.error(e.message || '加入失败')
    } finally {
      addingToMaterialId.value = null
    }
  }

  async function loadMembership() {
    await loadLibraryMembership({
      api,
      sourceType: assetType,
      assets: getAssets(),
      dramaId: dramaId.value,
      dramaSourceIds: membership.dramaSourceIds,
      materialSourceIds: membership.materialSourceIds,
    })
  }

  function isInLibrary(asset) {
    return hasAssetInLibrary(membership.dramaSourceIds, asset)
  }

  function isInMaterialLibrary(asset) {
    return hasAssetInLibrary(membership.materialSourceIds, asset)
  }

  async function onAddFromLibrary(item) {
    addingFromLibraryId.value = item.id
    try {
      await addAssetFromLibrary(item)
    } catch (e) {
      ElMessage.error(e.message || '加入失败')
    } finally {
      addingFromLibraryId.value = null
    }
  }

  return {
    // 状态
    showLibrary,
    libraryList,
    libraryLoading,
    libraryPage,
    libraryPageSize,
    libraryTotal,
    libraryKeyword,
    showEditLibrary,
    editLibraryForm,
    editLibrarySaving,
    addingToLibraryId,
    addingToMaterialId,
    addingFromLibraryId,
    // 函数
    loadLibraryList,
    debouncedLoadLibrary,
    openEditLibrary,
    submitEditLibrary,
    onDeleteLibrary,
    onAddToLibrary,
    onAddToMaterialLibrary,
    loadMembership,
    isInLibrary,
    isInMaterialLibrary,
    onAddFromLibrary,
  }
}
