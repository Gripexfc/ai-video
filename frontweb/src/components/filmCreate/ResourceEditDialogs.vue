<template>
  <!-- ========== 添加道具弹窗 ========== -->
  <el-dialog
    :model-value="showAddProp"
    title="添加道具"
    width="600px"
    @close="emit('cancel:add-prop')"
  >
    <el-form label-width="90px">
      <el-form-item label="参考图">
        <div class="ref-image-zone">
          <div
            class="ref-image-box"
            @click="addPropAddRefFileInput?.click()"
            @drop.prevent="onAddPropDrop"
            @dragover.prevent
          >
            <img v-if="addPropRefImage" :src="addPropRefImage" class="ref-preview-img" />
            <div v-else class="ref-upload-hint"><span class="ref-upload-icon">🖼</span><span>点击或拖入参考图</span></div>
          </div>
          <div v-if="addPropRefImage" class="ref-actions">
            <el-button type="primary" size="small" :loading="addPropRefImageExtracting" @click="emit('extract:prop-add-desc')">提取特征描述</el-button>
            <el-button size="small" @click="emit('clear:prop-add-ref')">移除</el-button>
          </div>
        </div>
      </el-form-item>
      <el-form-item label="名称" required>
        <el-input v-model="addPropForm.name" placeholder="道具名称" />
      </el-form-item>
      <el-form-item label="类型">
        <el-input v-model="addPropForm.type" placeholder="如：物品、建筑" />
      </el-form-item>
      <el-form-item label="描述">
        <el-input v-model="addPropForm.description" type="textarea" :rows="3" placeholder="描述" />
      </el-form-item>
      <el-form-item label="图生提示词">
        <el-input v-model="addPropForm.prompt" type="textarea" :rows="2" placeholder="用于 AI 生成图片的提示词" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="emit('cancel:add-prop')">取消</el-button>
      <el-button type="primary" :loading="addPropSaving" :disabled="!addPropForm.name.trim()" @click="emit('submit:add-prop')">确定</el-button>
    </template>
  </el-dialog>

  <!-- 隐藏的文件输入框 -->
  <input ref="addCharRefFileInput" type="file" accept="image/*" style="display:none" @change="onCharRefFileChange" />
  <input ref="addSceneRefFileInput" type="file" accept="image/*" style="display:none" @change="onSceneRefFileChange" />
  <input ref="addPropRefFileInput" type="file" accept="image/*" style="display:none" @change="onPropRefFileChange" />
  <input ref="addPropAddRefFileInput" type="file" accept="image/*" style="display:none" @change="onPropAddRefFileChange" />

  <!-- ========== 添加/编辑角色弹窗 ========== -->
  <el-dialog
    :model-value="showEditCharacter"
    :title="editCharacterForm?.id ? '编辑角色' : '添加角色'"
    width="75%"
    @close="emit('cancel:edit-character')"
  >
    <el-form v-if="editCharacterForm" label-width="90px">
      <!-- 参考图上传区 -->
      <el-form-item label="参考图">
        <div class="ref-image-zone">
          <div
            class="ref-image-box"
            @click="addCharRefFileInput?.click()"
            @drop.prevent="onCharDrop"
            @dragover.prevent
          >
            <img v-if="addCharRefImage" :src="addCharRefImage" class="ref-preview-img" />
            <img
              v-else-if="editCharacterForm.ref_image"
              :src="editCharacterForm.ref_image.startsWith('http') ? editCharacterForm.ref_image : '/static/' + editCharacterForm.ref_image"
              class="ref-preview-img"
            />
            <img
              v-else-if="editCharacterForm.id && (editCharacterForm.image_url || editCharacterForm.local_path)"
              :src="assetImageUrl(editCharacterForm)"
              class="ref-preview-img"
              style="opacity:0.5"
            />
            <div v-else class="ref-upload-hint"><span class="ref-upload-icon">🖼</span><span>点击或拖入参考图</span></div>
          </div>
          <div v-if="addCharRefImage" class="ref-actions">
            <el-button type="primary" size="small" :loading="extractingCharAppearance" @click="emit('extract:char-appearance')">提取特征描述</el-button>
            <el-button size="small" @click="emit('clear:char-ref-image')">移除</el-button>
          </div>
          <div v-else-if="editCharacterForm.ref_image" class="ref-actions">
            <el-button type="primary" size="small" :loading="extractingCharAppearance" @click="emit('extract:char-appearance')">从参考图提取描述</el-button>
            <el-button size="small" @click="emit('clear:char-ref-image')">移除参考图</el-button>
          </div>
          <div v-else-if="editCharacterForm.id && (editCharacterForm.image_url || editCharacterForm.local_path) && !editCharacterForm.appearance" class="ref-actions">
            <el-button size="small" :loading="extractingCharAppearance" @click="emit('extract:char-appearance')">从主图提取描述</el-button>
          </div>
        </div>
      </el-form-item>
      <el-form-item label="名称" required>
        <el-input v-model="editCharacterForm.name" placeholder="角色名称" />
      </el-form-item>
      <el-form-item label="身份/定位">
        <el-select v-model="editCharacterForm.role" placeholder="请选择角色类型" style="width:200px">
          <el-option value="main" label="主角" />
          <el-option value="supporting" label="配角" />
          <el-option value="minor" label="次要角色" />
        </el-select>
      </el-form-item>
      <el-form-item label="外貌描述">
        <el-input v-model="editCharacterForm.appearance" type="textarea" :autosize="{ minRows: 4, maxRows: 10 }" placeholder="用于 AI 生成图像的外貌描述，尽量详细" />
      </el-form-item>
      <el-form-item label="简介">
        <el-input v-model="editCharacterForm.description" type="textarea" :autosize="{ minRows: 3, maxRows: 8 }" placeholder="角色背景简介，供剧本生成参考" />
      </el-form-item>
      <el-form-item v-if="editCharacterForm.id">
        <template #label>
          <span style="font-size:12px;line-height:1.4;white-space:normal;word-break:break-all;display:inline-block;width:90px">图生提示词</span>
        </template>
        <div style="width:100%">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <span style="font-size:12px;color:#909399">AI 润色后的最终提示词，生成四视图图片时直接使用；可手动修改</span>
            <el-button
              size="small"
              :loading="editCharacterPromptGenerating"
              @click="emit('generate:character-prompt')"
            >重新生成提示词</el-button>
          </div>
          <el-input
            v-model="editCharacterForm.polished_prompt"
            type="textarea"
            :autosize="{ minRows: 5, maxRows: 16 }"
            :placeholder="editCharacterPromptGenerating ? 'AI 正在生成提示词，请稍候…' : '点击「重新生成提示词」由 AI 自动生成，或直接在此输入'"
            :disabled="editCharacterPromptGenerating"
            style="font-size:12px"
          />
        </div>
      </el-form-item>
      <!-- 视觉锚点 -->
      <el-form-item v-if="editCharacterForm.id" label="视觉锚点">
        <div style="width:100%">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <span style="font-size:12px;color:#909399">AI 从外貌描述提炼的6层视觉特征，用于保持生成图片角色一致性</span>
            <el-button
              size="small"
              :loading="extractingAnchors"
              :disabled="!editCharacterForm.appearance"
              @click="emit('extract:char-anchors')"
            >提炼视觉锚点</el-button>
          </div>
          <el-input
            v-if="editCharacterForm.identity_anchors"
            :value="typeof editCharacterForm.identity_anchors === 'string'
              ? editCharacterForm.identity_anchors
              : JSON.stringify(editCharacterForm.identity_anchors, null, 2)"
            type="textarea"
            :rows="4"
            readonly
            style="font-size:11px;font-family:monospace"
            placeholder="点击「提炼视觉锚点」生成"
          />
          <div v-else style="font-size:12px;color:#c0c4cc;padding:4px 0">暂无锚点，点击「提炼视觉锚点」自动提炼</div>
        </div>
      </el-form-item>
      <!-- 多阶段造型 -->
      <el-form-item v-if="editCharacterForm.id" label="多阶段造型">
        <div style="width:100%">
          <div style="font-size:12px;color:#909399;margin-bottom:6px">
            不同集次的角色造型变化，格式：JSON 数组 [{"episode_range":[1,3],"appearance":"..."}]
          </div>
          <el-input
            v-model="editCharacterForm.stages"
            type="textarea"
            :rows="4"
            placeholder='例：[{"episode_range":[1,5],"appearance":"白衣少年"},{"episode_range":[6,10],"appearance":"黑衣武者"}]'
            style="font-size:12px;font-family:monospace"
          />
        </div>
      </el-form-item>
      <el-form-item label="负面提示词">
        <el-input
          v-model="editCharacterForm.negative_prompt"
          type="textarea"
          :autosize="{ minRows: 2, maxRows: 6 }"
          placeholder="选填；与本集配置中的「资产生图模型 id」同时填写且此处非空时，随图生请求传入"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="emit('cancel:edit-character')">取消</el-button>
      <el-button type="primary" :loading="editCharacterSaving" :disabled="!editCharacterForm?.name?.trim()" @click="emit('submit:edit-character')">{{ editCharacterForm?.id ? '保存' : '添加' }}</el-button>
    </template>
  </el-dialog>

  <!-- ========== SD2 素材认证信息弹窗 ========== -->
  <el-dialog
    :model-value="showCharSd2Cert"
    title="SD2 素材认证信息（即梦素材库）"
    width="520px"
    destroy-on-close
    @close="emit('close:sd2-cert')"
  >
    <template v-if="charSd2CertPayload">
      <el-descriptions :column="1" border size="small">
        <el-descriptions-item label="素材 ID">{{ charSd2CertPayload.hub_asset_id || '—' }}</el-descriptions-item>
        <el-descriptions-item label="asset_url（视频生成引用）">
          <code class="sd2-mono">{{ charSd2CertPayload.asset_url || '—' }}</code>
        </el-descriptions-item>
        <el-descriptions-item label="状态">{{ charSd2CertPayload.status || '—' }}</el-descriptions-item>
        <el-descriptions-item label="注册时图片 URL">
          <span class="sd2-break">{{ charSd2CertPayload.source_image_url || '—' }}</span>
        </el-descriptions-item>
        <el-descriptions-item v-if="charSd2CertPayload.character_display" label="备案角色信息">
          <div class="sd2-break">名称：{{ charSd2CertPayload.character_display.name || '—' }}</div>
          <div v-if="charSd2CertPayload.character_display.appearance" class="sd2-break muted">外貌摘要：{{ charSd2CertPayload.character_display.appearance }}</div>
        </el-descriptions-item>
      </el-descriptions>
      <p class="sd2-doc-tip">
        接口与字段说明见
        <a href="https://83zi.com/sd2realperson.html" target="_blank" rel="noopener noreferrer">即梦/Seedance 素材管理 API（文档示例）</a>
        ；请在「AI 配置」中新增「即梦2角色认证」，填写网关 URL 与 Token。生成视频时在内容中传入 <code>image_url.url = asset_url</code> 即可引用。
      </p>
    </template>
    <template #footer>
      <el-button @click="emit('close:sd2-cert')">关闭</el-button>
    </template>
  </el-dialog>

  <!-- ========== 编辑道具弹窗 ========== -->
  <el-dialog
    :model-value="showEditProp"
    :title="editPropForm?.id ? '编辑道具' : '添加道具'"
    width="75%"
    @close="emit('cancel:edit-prop')"
  >
    <el-form v-if="editPropForm" label-width="90px">
      <el-form-item label="参考图">
        <div class="ref-image-zone">
          <div
            class="ref-image-box"
            @click="addPropRefFileInput?.click()"
            @drop.prevent="onPropDrop"
            @dragover.prevent
          >
            <img v-if="addPropRefImage" :src="addPropRefImage" class="ref-preview-img" />
            <img
              v-else-if="editPropForm.ref_image"
              :src="editPropForm.ref_image.startsWith('http') ? editPropForm.ref_image : '/static/' + editPropForm.ref_image"
              class="ref-preview-img"
            />
            <img
              v-else-if="editPropForm.id && (editPropForm.image_url || editPropForm.local_path)"
              :src="assetImageUrl(editPropForm)"
              class="ref-preview-img"
              style="opacity:0.5"
            />
            <div v-else class="ref-upload-hint"><span class="ref-upload-icon">🖼</span><span>点击或拖入参考图</span></div>
          </div>
          <div v-if="addPropRefImage" class="ref-actions">
            <el-button type="primary" size="small" :loading="false" @click="emit('extract:prop-ref')">提取特征描述</el-button>
            <el-button size="small" @click="emit('clear:prop-ref')">移除</el-button>
          </div>
          <div v-else-if="editPropForm.ref_image" class="ref-actions">
            <el-button type="primary" size="small" :loading="false" @click="emit('extract:prop-ref')">从参考图提取描述</el-button>
            <el-button size="small" @click="emit('clear:prop-ref')">移除参考图</el-button>
          </div>
          <div v-else-if="editPropForm.id && (editPropForm.image_url || editPropForm.local_path) && !editPropForm.description" class="ref-actions">
            <el-button size="small" :loading="false" @click="emit('extract:prop-ref')">从主图提取描述</el-button>
          </div>
        </div>
      </el-form-item>
      <el-form-item label="名称" required>
        <el-input v-model="editPropForm.name" placeholder="道具名称" />
      </el-form-item>
      <el-form-item label="类型">
        <el-input v-model="editPropForm.type" placeholder="如：物品、建筑" />
      </el-form-item>
      <el-form-item label="描述">
        <el-input v-model="editPropForm.description" type="textarea" :autosize="{ minRows: 3, maxRows: 8 }" placeholder="道具描述" />
      </el-form-item>
      <el-form-item label="图生提示词">
        <div style="width:100%">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <span style="font-size:12px;color:#909399">AI 润色后的图片提示词，生成图片时直接使用；可手动修改</span>
            <el-button size="small" :loading="editPropPromptGenerating" @click="emit('generate:prop-prompt')">重新生成提示词</el-button>
          </div>
          <el-input
            v-model="editPropForm.prompt"
            type="textarea"
            :autosize="{ minRows: 5, maxRows: 16 }"
            :placeholder="editPropPromptGenerating ? 'AI 正在生成提示词，请稍候…' : '点击「重新生成提示词」由 AI 自动生成，或直接在此输入'"
            :disabled="editPropPromptGenerating"
          />
        </div>
      </el-form-item>
      <el-form-item label="负面提示词">
        <el-input
          v-model="editPropForm.negative_prompt"
          type="textarea"
          :autosize="{ minRows: 2, maxRows: 6 }"
          placeholder="选填；与本集配置中的「资产生图模型 id」同时填写且此处非空时，随图生请求传入"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="emit('cancel:edit-prop')">取消</el-button>
      <el-button type="primary" :loading="editPropSaving" :disabled="!editPropForm?.name?.trim()" @click="emit('submit:edit-prop')">保存</el-button>
    </template>
  </el-dialog>

  <!-- ========== 添加/编辑场景弹窗 ========== -->
  <el-dialog
    :model-value="showEditScene"
    :title="editSceneForm?.id ? '编辑场景' : '添加场景'"
    width="75%"
    @close="emit('cancel:edit-scene')"
  >
    <el-form v-if="editSceneForm" label-width="90px">
      <el-form-item label="参考图">
        <div class="ref-image-zone">
          <div
            class="ref-image-box"
            @click="addSceneRefFileInput?.click()"
            @drop.prevent="onSceneDrop"
            @dragover.prevent
          >
            <img v-if="addSceneRefImage" :src="addSceneRefImage" class="ref-preview-img" />
            <img
              v-else-if="editSceneForm.ref_image"
              :src="editSceneForm.ref_image.startsWith('http') ? editSceneForm.ref_image : '/static/' + editSceneForm.ref_image"
              class="ref-preview-img"
            />
            <img
              v-else-if="editSceneForm.id && (editSceneForm.image_url || editSceneForm.local_path)"
              :src="assetImageUrl(editSceneForm)"
              class="ref-preview-img"
              style="opacity:0.5"
            />
            <div v-else class="ref-upload-hint"><span class="ref-upload-icon">🖼</span><span>点击或拖入参考图</span></div>
          </div>
          <div v-if="addSceneRefImage" class="ref-actions">
            <el-button type="primary" size="small" :loading="false" @click="emit('extract:scene-ref')">提取特征描述</el-button>
            <el-button size="small" @click="emit('clear:scene-ref')">移除</el-button>
          </div>
          <div v-else-if="editSceneForm.ref_image" class="ref-actions">
            <el-button type="primary" size="small" :loading="false" @click="emit('extract:scene-ref')">从参考图提取描述</el-button>
            <el-button size="small" @click="emit('clear:scene-ref')">移除参考图</el-button>
          </div>
          <div v-else-if="editSceneForm.id && (editSceneForm.image_url || editSceneForm.local_path) && !editSceneForm.prompt" class="ref-actions">
            <el-button size="small" :loading="false" @click="emit('extract:scene-ref')">从主图提取描述</el-button>
          </div>
        </div>
      </el-form-item>
      <el-form-item label="地点" required>
        <el-input v-model="editSceneForm.location" placeholder="如：森林、教室" />
      </el-form-item>
      <el-form-item label="时间">
        <el-input v-model="editSceneForm.time" placeholder="如：白天、傍晚" />
      </el-form-item>
      <el-form-item label="场景描述">
        <el-input v-model="editSceneForm.prompt" type="textarea" :autosize="{ minRows: 3, maxRows: 8 }" placeholder="场景的简要描述，供 AI 生成四视图时参考" />
      </el-form-item>
      <el-form-item v-if="editSceneForm.id">
        <template #label>
          <span style="font-size:12px;line-height:1.4;white-space:normal;word-break:break-all;display:inline-block;width:90px">四视图提示词</span>
        </template>
        <div style="width:100%">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <span style="font-size:12px;color:#909399">AI 生成的完整四视图图片提示词，生图时直接使用；可手动修改</span>
            <el-button size="small" :loading="editScenePromptGenerating" @click="emit('generate:scene-prompt')">重新生成提示词</el-button>
          </div>
          <el-input
            v-model="editSceneForm.polished_prompt"
            type="textarea"
            :autosize="{ minRows: 5, maxRows: 16 }"
            :placeholder="editScenePromptGenerating ? 'AI 正在生成四视图提示词，请稍候…' : '点击「重新生成提示词」由 AI 自动生成，或直接在此输入'"
            :disabled="editScenePromptGenerating"
            style="font-size:12px"
          />
        </div>
      </el-form-item>
      <el-form-item label="负面提示词">
        <el-input
          v-model="editSceneForm.negative_prompt"
          type="textarea"
          :autosize="{ minRows: 2, maxRows: 6 }"
          placeholder="选填；与本集配置中的「资产生图模型 id」同时填写且此处非空时，随图生请求传入"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="emit('cancel:edit-scene')">取消</el-button>
      <el-button type="primary" :loading="editSceneSaving" :disabled="!editSceneForm?.location?.trim()" @click="emit('submit:edit-scene')">{{ editSceneForm?.id ? '保存' : '添加' }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref } from 'vue'
import { assetImageUrl } from '@/utils/assetImageUrl'

const props = defineProps({
  // Add Prop dialog
  showAddProp: { type: Boolean, default: false },
  addPropForm: { type: Object, default: () => ({ name: '', type: '', description: '', prompt: '' }) },
  addPropSaving: { type: Boolean, default: false },
  addPropRefImage: { type: String, default: '' },
  addPropRefImageExtracting: { type: Boolean, default: false },

  // Edit Character dialog
  showEditCharacter: { type: Boolean, default: false },
  editCharacterForm: { type: Object, default: null },
  editCharacterSaving: { type: Boolean, default: false },
  editCharacterPromptGenerating: { type: Boolean, default: false },
  extractingCharAppearance: { type: Boolean, default: false },
  extractingAnchors: { type: Boolean, default: false },
  addCharRefImage: { type: String, default: '' },

  // SD2 Cert dialog
  showCharSd2Cert: { type: Boolean, default: false },
  charSd2CertPayload: { type: Object, default: null },

  // Edit Prop dialog
  showEditProp: { type: Boolean, default: false },
  editPropForm: { type: Object, default: null },
  editPropSaving: { type: Boolean, default: false },
  editPropPromptGenerating: { type: Boolean, default: false },

  // Edit Scene dialog
  showEditScene: { type: Boolean, default: false },
  editSceneForm: { type: Object, default: null },
  editSceneSaving: { type: Boolean, default: false },
  editScenePromptGenerating: { type: Boolean, default: false },
})

const emit = defineEmits([
  'submit:add-prop', 'cancel:add-prop', 'extract:prop-add-desc', 'clear:prop-add-ref',
  'submit:edit-character', 'cancel:edit-character', 'generate:character-prompt',
  'extract:char-appearance', 'extract:char-anchors', 'clear:char-ref-image', 'file-change:char-ref',
  'close:sd2-cert',
  'submit:edit-prop', 'cancel:edit-prop', 'generate:prop-prompt', 'file-change:prop-ref',
  'extract:prop-ref', 'clear:prop-ref',
  'submit:edit-scene', 'cancel:edit-scene', 'generate:scene-prompt', 'file-change:scene-ref',
  'extract:scene-ref', 'clear:scene-ref',
])

// Hidden file input refs
const addCharRefFileInput = ref(null)
const addSceneRefFileInput = ref(null)
const addPropRefFileInput = ref(null)
const addPropAddRefFileInput = ref(null)

// File change handlers — forward to named events
function onCharRefFileChange(e) {
  emit('file-change:char-ref', e)
}
function onSceneRefFileChange(e) {
  emit('file-change:scene-ref', e)
}
function onPropRefFileChange(e) {
  emit('file-change:prop-ref', e)
}
function onPropAddRefFileChange(e) {
  emit('file-change:prop-add-ref', e)
}

// Drop handlers — forward file from dataTransfer
function onCharDrop(e) {
  const file = e.dataTransfer?.files?.[0]
  if (file) emit('file-change:char-ref', { target: { files: [file] } })
}
function onSceneDrop(e) {
  const file = e.dataTransfer?.files?.[0]
  if (file) emit('file-change:scene-ref', { target: { files: [file] } })
}
function onPropDrop(e) {
  const file = e.dataTransfer?.files?.[0]
  if (file) emit('file-change:prop-ref', { target: { files: [file] } })
}
function onAddPropDrop(e) {
  const file = e.dataTransfer?.files?.[0]
  if (file) emit('file-change:prop-add-ref', { target: { files: [file] } })
}
</script>

<style scoped>
/* === Reference image upload zone === */
.ref-image-zone {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.ref-image-box {
  width: 120px;
  height: 120px;
  border: 2px dashed var(--border-muted);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  overflow: hidden;
  background: var(--bg-inner);
  flex-shrink: 0;
  transition: border-color 0.2s;
}
.ref-image-box:hover {
  border-color: var(--accent);
}
.ref-preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.ref-upload-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: var(--text-muted);
  font-size: 12px;
  text-align: center;
  padding: 8px;
}
.ref-upload-icon {
  font-size: 28px;
  line-height: 1;
}
.ref-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* === SD2 cert display === */
.sd2-mono {
  font-size: 12px;
  word-break: break-all;
}
.sd2-break {
  font-size: 12px;
  word-break: break-all;
  line-height: 1.4;
}
.sd2-break.muted {
  color: var(--text-muted);
  margin-top: 4px;
}
.sd2-doc-tip {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 12px;
  line-height: 1.5;
}
.sd2-doc-tip a {
  color: var(--accent);
}
</style>
