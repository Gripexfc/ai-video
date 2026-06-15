<template>
  <!-- 本剧角色库 -->
  <el-dialog :model-value="showCharLibrary" title="本剧角色库" width="720px" destroy-on-close class="library-dialog" @update:model-value="$emit('update:showCharLibrary', $event)" @open="$emit('load:char-library')">
    <div class="library-toolbar">
      <el-input :model-value="charLibraryKeyword" placeholder="搜索名称或描述" clearable style="width: 200px" @input="$emit('search:char-library', $event)" />
    </div>
    <div v-loading="charLibraryLoading" class="library-list">
      <div v-for="item in charLibraryList" :key="item.id" class="library-item">
        <div class="library-item-cover">
          <img v-if="item.image_url || item.local_path" :src="item.image_url || item.local_path" alt="" />
          <span v-else class="library-item-placeholder">暂无图</span>
        </div>
        <div class="library-item-info">
          <div class="library-item-name">{{ item.name || '未命名' }}</div>
          <div class="library-item-desc">{{ (item.description || '').slice(0, 60) }}{{ (item.description || '').length > 60 ? '…' : '' }}</div>
          <div class="library-item-actions">
            <el-button size="small" type="primary" :disabled="!currentEpisodeId" @click="$emit('add-char-from-library', item)">加入本集</el-button>
            <el-button size="small" @click="$emit('open-edit:char-library', item)">编辑</el-button>
            <el-button size="small" type="danger" plain @click="$emit('delete:char-library', item)">删除</el-button>
          </div>
        </div>
      </div>
      <div v-if="!charLibraryLoading && charLibraryList.length === 0" class="library-empty">暂无本剧角色库记录，可将本剧角色「加入本剧库」后在此查看</div>
    </div>
    <div class="library-pagination">
      <el-pagination
        :current-page="charLibraryPage"
        :page-size="charLibraryPageSize"
        :total="charLibraryTotal"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next"
        @current-change="$emit('load:char-library')"
        @size-change="$emit('load:char-library')"
      />
    </div>
    <template #footer>
      <el-button @click="$emit('update:showCharLibrary', false)">关闭</el-button>
    </template>
  </el-dialog>
  <!-- 编辑公共角色 -->
  <el-dialog :model-value="showEditCharLibrary" title="编辑公共角色" width="440px" @update:model-value="$emit('update:showEditCharLibrary', $event)" @close="$emit('cancel:edit-char-library')">
    <el-form v-if="editCharLibraryForm" label-width="80px">
      <el-form-item label="名称">
        <el-input v-model="editCharLibraryForm.name" placeholder="角色名称" />
      </el-form-item>
      <el-form-item label="分类">
        <el-input v-model="editCharLibraryForm.category" placeholder="可选" />
      </el-form-item>
      <el-form-item label="描述">
        <el-input v-model="editCharLibraryForm.description" type="textarea" :rows="3" placeholder="可选" />
      </el-form-item>
      <el-form-item label="标签">
        <el-input v-model="editCharLibraryForm.tags" placeholder="可选，逗号分隔" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="$emit('cancel:edit-char-library')">取消</el-button>
      <el-button type="primary" :loading="editCharLibrarySaving" @click="$emit('submit:edit-char-library')">保存</el-button>
    </template>
  </el-dialog>

  <!-- 本剧道具库 -->
  <el-dialog :model-value="showPropLibrary" title="本剧道具库" width="720px" destroy-on-close class="library-dialog" @update:model-value="$emit('update:showPropLibrary', $event)" @open="$emit('load:prop-library')">
    <div class="library-toolbar">
      <el-input :model-value="propLibraryKeyword" placeholder="搜索名称或描述" clearable style="width: 200px" @input="$emit('search:prop-library', $event)" />
    </div>
    <div v-loading="propLibraryLoading" class="library-list">
      <div v-for="item in propLibraryList" :key="item.id" class="library-item">
        <div class="library-item-cover">
          <img v-if="item.image_url || item.local_path" :src="item.image_url || item.local_path" alt="" />
          <span v-else class="library-item-placeholder">暂无图</span>
        </div>
        <div class="library-item-info">
          <div class="library-item-name">{{ item.name || '未命名' }}</div>
          <div class="library-item-desc">{{ (item.description || item.prompt || '').slice(0, 60) }}{{ (item.description || item.prompt || '').length > 60 ? '…' : '' }}</div>
          <div class="library-item-actions">
            <el-button size="small" type="primary" :disabled="!currentEpisodeId" @click="$emit('add-prop-from-library', item)">加入本集</el-button>
            <el-button size="small" @click="$emit('open-edit:prop-library', item)">编辑</el-button>
            <el-button size="small" type="danger" plain @click="$emit('delete:prop-library', item)">删除</el-button>
          </div>
        </div>
      </div>
      <div v-if="!propLibraryLoading && propLibraryList.length === 0" class="library-empty">暂无本剧道具库记录，可将本剧道具「加入本剧库」后在此查看</div>
    </div>
    <div class="library-pagination">
      <el-pagination
        :current-page="propLibraryPage"
        :page-size="propLibraryPageSize"
        :total="propLibraryTotal"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next"
        @current-change="$emit('load:prop-library')"
        @size-change="$emit('load:prop-library')"
      />
    </div>
    <template #footer>
      <el-button @click="$emit('update:showPropLibrary', false)">关闭</el-button>
    </template>
  </el-dialog>
  <!-- 编辑公共道具 -->
  <el-dialog :model-value="showEditPropLibrary" title="编辑公共道具" width="440px" @update:model-value="$emit('update:showEditPropLibrary', $event)" @close="$emit('cancel:edit-prop-library')">
    <el-form v-if="editPropLibraryForm" label-width="80px">
      <el-form-item label="名称">
        <el-input v-model="editPropLibraryForm.name" placeholder="道具名称" />
      </el-form-item>
      <el-form-item label="分类">
        <el-input v-model="editPropLibraryForm.category" placeholder="可选" />
      </el-form-item>
      <el-form-item label="描述">
        <el-input v-model="editPropLibraryForm.description" type="textarea" :rows="3" placeholder="可选" />
      </el-form-item>
      <el-form-item label="标签">
        <el-input v-model="editPropLibraryForm.tags" placeholder="可选，逗号分隔" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="$emit('cancel:edit-prop-library')">取消</el-button>
      <el-button type="primary" :loading="editPropLibrarySaving" @click="$emit('submit:edit-prop-library')">保存</el-button>
    </template>
  </el-dialog>

  <!-- 本剧场景库 -->
  <el-dialog :model-value="showSceneLibrary" title="本剧场景库" width="720px" destroy-on-close class="library-dialog" @update:model-value="$emit('update:showSceneLibrary', $event)" @open="$emit('load:scene-library')">
    <div class="library-toolbar">
      <el-input :model-value="sceneLibraryKeyword" placeholder="搜索地点或描述" clearable style="width: 200px" @input="$emit('search:scene-library', $event)" />
    </div>
    <div v-loading="sceneLibraryLoading" class="library-list">
      <div v-for="item in sceneLibraryList" :key="item.id" class="library-item">
        <div class="library-item-cover">
          <img v-if="item.image_url || item.local_path" :src="item.image_url || item.local_path" alt="" />
          <span v-else class="library-item-placeholder">暂无图</span>
        </div>
        <div class="library-item-info">
          <div class="library-item-name">{{ item.location || item.time || '未命名' }}</div>
          <div class="library-item-desc">{{ (item.description || item.prompt || '').slice(0, 60) }}{{ (item.description || item.prompt || '').length > 60 ? '…' : '' }}</div>
          <div class="library-item-actions">
            <el-button size="small" type="primary" :disabled="!currentEpisodeId" @click="$emit('add-scene-from-library', item)">加入本集</el-button>
            <el-button size="small" @click="$emit('open-edit:scene-library', item)">编辑</el-button>
            <el-button size="small" type="danger" plain @click="$emit('delete:scene-library', item)">删除</el-button>
          </div>
        </div>
      </div>
      <div v-if="!sceneLibraryLoading && sceneLibraryList.length === 0" class="library-empty">暂无本剧场景库记录，可将本剧场景「加入本剧库」后在此查看</div>
    </div>
    <div class="library-pagination">
      <el-pagination
        :current-page="sceneLibraryPage"
        :page-size="sceneLibraryPageSize"
        :total="sceneLibraryTotal"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next"
        @current-change="$emit('load:scene-library')"
        @size-change="$emit('load:scene-library')"
      />
    </div>
    <template #footer>
      <el-button @click="$emit('update:showSceneLibrary', false)">关闭</el-button>
    </template>
  </el-dialog>
  <!-- 编辑公共场景 -->
  <el-dialog :model-value="showEditSceneLibrary" title="编辑公共场景" width="440px" @update:model-value="$emit('update:showEditSceneLibrary', $event)" @close="$emit('cancel:edit-scene-library')">
    <el-form v-if="editSceneLibraryForm" label-width="80px">
      <el-form-item label="地点">
        <el-input v-model="editSceneLibraryForm.location" placeholder="场景地点" />
      </el-form-item>
      <el-form-item label="时间">
        <el-input v-model="editSceneLibraryForm.time" placeholder="如：浅色/夜晚" />
      </el-form-item>
      <el-form-item label="分类">
        <el-input v-model="editSceneLibraryForm.category" placeholder="可选" />
      </el-form-item>
      <el-form-item label="描述">
        <el-input v-model="editSceneLibraryForm.description" type="textarea" :rows="3" placeholder="可选" />
      </el-form-item>
      <el-form-item label="标签">
        <el-input v-model="editSceneLibraryForm.tags" placeholder="可选，逗号分隔" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="$emit('cancel:edit-scene-library')">取消</el-button>
      <el-button type="primary" :loading="editSceneLibrarySaving" @click="$emit('submit:edit-scene-library')">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
// Props
const props = defineProps({
  currentEpisodeId: { type: [String, Number], default: null },
  // Character library
  showCharLibrary: { type: Boolean, default: false },
  charLibraryList: { type: Array, default: () => [] },
  charLibraryLoading: { type: Boolean, default: false },
  charLibraryPage: { type: Number, default: 1 },
  charLibraryPageSize: { type: Number, default: 10 },
  charLibraryTotal: { type: Number, default: 0 },
  charLibraryKeyword: { type: String, default: '' },
  showEditCharLibrary: { type: Boolean, default: false },
  editCharLibraryForm: { type: Object, default: null },
  editCharLibrarySaving: { type: Boolean, default: false },
  editCharLibraryImgUploading: { type: Boolean, default: false },
  editCharLibraryImgGenerating: { type: Boolean, default: false },
  // Prop library
  showPropLibrary: { type: Boolean, default: false },
  propLibraryList: { type: Array, default: () => [] },
  propLibraryLoading: { type: Boolean, default: false },
  propLibraryPage: { type: Number, default: 1 },
  propLibraryPageSize: { type: Number, default: 10 },
  propLibraryTotal: { type: Number, default: 0 },
  propLibraryKeyword: { type: String, default: '' },
  showEditPropLibrary: { type: Boolean, default: false },
  editPropLibraryForm: { type: Object, default: null },
  editPropLibrarySaving: { type: Boolean, default: false },
  editPropLibraryImgUploading: { type: Boolean, default: false },
  editPropLibraryImgGenerating: { type: Boolean, default: false },
  // Scene library
  showSceneLibrary: { type: Boolean, default: false },
  sceneLibraryList: { type: Array, default: () => [] },
  sceneLibraryLoading: { type: Boolean, default: false },
  sceneLibraryPage: { type: Number, default: 1 },
  sceneLibraryPageSize: { type: Number, default: 10 },
  sceneLibraryTotal: { type: Number, default: 0 },
  sceneLibraryKeyword: { type: String, default: '' },
  showEditSceneLibrary: { type: Boolean, default: false },
  editSceneLibraryForm: { type: Object, default: null },
  editSceneLibrarySaving: { type: Boolean, default: false },
  editSceneLibraryImgUploading: { type: Boolean, default: false },
  editSceneLibraryImgGenerating: { type: Boolean, default: false },
})

// Emits
const emit = defineEmits([
  // Character library
  'load:char-library',
  'search:char-library',
  'open-edit:char-library',
  'delete:char-library',
  'add-char-from-library',
  'submit:edit-char-library',
  'cancel:edit-char-library',
  'upload-img:char-library',
  'generate-img:char-library',
  'file-change:char-library',
  'update:showCharLibrary',
  'update:showEditCharLibrary',
  // Prop library
  'load:prop-library',
  'search:prop-library',
  'open-edit:prop-library',
  'delete:prop-library',
  'add-prop-from-library',
  'submit:edit-prop-library',
  'cancel:edit-prop-library',
  'upload-img:prop-library',
  'generate-img:prop-library',
  'file-change:prop-library',
  'update:showPropLibrary',
  'update:showEditPropLibrary',
  // Scene library
  'load:scene-library',
  'search:scene-library',
  'open-edit:scene-library',
  'delete:scene-library',
  'add-scene-from-library',
  'submit:edit-scene-library',
  'cancel:edit-scene-library',
  'upload-img:scene-library',
  'generate-img:scene-library',
  'file-change:scene-library',
  'update:showSceneLibrary',
  'update:showEditSceneLibrary',
])
</script>

<style scoped>
.library-dialog :deep(.el-dialog__body) { padding-top: 8px; }
.library-toolbar { margin-bottom: 12px; }
.library-list {
  min-height: 200px;
  max-height: 420px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.library-item {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 10px;
  background: var(--bg-inner);
  border: 1px solid var(--glass-border);
  border-radius: 10px;
}
.library-item-cover {
  width: 72px;
  height: 72px;
  flex-shrink: 0;
  background: var(--bg-inner);
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.library-item-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.library-item-placeholder {
  font-size: 0.8rem;
  color: var(--text-subtle);
}
.library-item-info { flex: 1; min-width: 0; }
.library-item-name { font-weight: 500; margin-bottom: 4px; color: var(--text-primary); }
.library-item-desc { font-size: 0.85rem; color: var(--text-muted); margin-bottom: 8px; }
.library-item-actions { display: flex; gap: 8px; }
.library-empty {
  text-align: center;
  color: var(--text-subtle);
  padding: 40px 20px;
}
.library-pagination {
  margin-top: 12px;
  display: flex;
  justify-content: center;
}
</style>
