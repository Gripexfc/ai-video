<template>
  <div class="lib-img-editor">
    <div class="lib-img-thumb" @click="$emit('preview')">
      <img v-if="imageUrl" :src="imageUrl" class="lib-img-preview" />
      <div v-else class="lib-img-placeholder">暂无图片</div>
    </div>
    <div class="lib-img-actions">
      <input
        ref="fileInput"
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        style="display: none"
        @change="onFileChange"
      />
      <el-button size="small" :loading="uploading" @click="fileInput?.click()">
        <el-icon v-if="!uploading"><Upload /></el-icon>
        上传
      </el-button>
      <el-button size="small" :loading="generating" :disabled="!imageUrl" @click="$emit('generate')">
        <el-icon v-if="!generating"><MagicStick /></el-icon>
        AI 生成
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { Upload, MagicStick } from '@element-plus/icons-vue'

defineProps({
  imageUrl: { type: String, default: '' },
  uploading: { type: Boolean, default: false },
  generating: { type: Boolean, default: false },
})

const emit = defineEmits(['upload', 'generate', 'preview'])

const fileInput = ref(null)

function onFileChange(event) {
  const file = event.target?.files?.[0]
  if (event.target) event.target.value = ''
  if (file) emit('upload', file)
}
</script>

<style scoped>
.lib-img-editor { display: flex; gap: 12px; align-items: flex-start; }
.lib-img-thumb {
  width: 80px; height: 80px; border-radius: var(--radius-md);
  background: var(--bg-inner); border: 1px dashed var(--border-color);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; overflow: hidden; flex-shrink: 0;
}
.lib-img-preview { width: 100%; height: 100%; object-fit: cover; }
.lib-img-placeholder { font-size: 12px; color: var(--text-muted); }
.lib-img-actions { display: flex; flex-direction: column; gap: 6px; }
</style>
