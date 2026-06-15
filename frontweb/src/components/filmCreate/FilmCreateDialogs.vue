<template>
  <!-- 分镜提示词编辑弹窗 -->
  <el-dialog
    :model-value="showSbPromptDialog"
    :title="`分镜 ${sbPromptTarget?.storyboard_number ?? ''} · 编辑提示词`"
    width="700px"
    @update:model-value="emit('update:showSbPromptDialog', $event)"
    @close="emit('cancel:sb-prompt')"
  >
    <el-form v-if="sbPromptTarget" label-width="0" class="sb-prompt-dialog-form">
      <!-- 图片区 -->
      <div class="sb-prompt-section-title">🖼 图片提示词</div>
      <el-form-item label="">
        <div style="width:100%">
          <div style="font-size:12px; color:#6b7280; margin-bottom:4px;">原始提示词（分镜生成时写入，仅供参考）</div>
          <el-input
            :model-value="sbPromptImageText"
            type="textarea"
            :rows="4"
            placeholder="分镜生成时由 AI 写入的原始描述"
            @update:model-value="emit('update:sbPromptImageText', $event)"
          />
        </div>
      </el-form-item>
      <el-form-item label="">
        <div style="width:100%">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
            <span style="font-size:12px; color:#6b7280;">优化提示词（AI 润色后的英文 prompt，生图时优先使用）</span>
            <el-button
              size="small"
              type="warning"
              plain
              :loading="sbPromptPolishing"
              @click="emit('polish:sb-prompt')"
            >{{ sbPromptPolishedText ? '重新生成' : '立即生成' }}</el-button>
          </div>
          <el-input
            :model-value="sbPromptPolishedText"
            type="textarea"
            :rows="5"
            placeholder="点击「立即生成」让 AI 润色，或手动填写英文 prompt"
            @update:model-value="emit('update:sbPromptPolishedText', $event)"
          />
        </div>
      </el-form-item>
      <!-- 视频区 -->
      <div class="sb-prompt-section-title sb-prompt-video-title-row" style="margin-top:12px;">
        <span>🎬 经典视频提示词</span>
        <el-button
          v-if="!sbPromptTargetUniversal"
          size="small"
          type="success"
          plain
          :loading="sbPromptClassicPolishing"
          @click="emit('polish-classic-video', sbPromptTarget)"
        >润色分镜视频提示词</el-button>
      </div>
      <el-form-item label="">
        <el-input
          :model-value="sbPromptVideoText"
          type="textarea"
          :rows="5"
          placeholder="视频生成提示词（可选，留空则由系统自动生成）"
          @update:model-value="emit('update:sbPromptVideoText', $event)"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="emit('cancel:sb-prompt')">取消</el-button>
      <el-button type="primary" :loading="sbPromptSaving" @click="emit('save:sb-prompt')">保存</el-button>
    </template>
  </el-dialog>

  <!-- 分镜视频参数编辑弹窗 -->
  <el-dialog
    :model-value="showVideoParamsDialog"
    :title="`分镜 ${videoParamsTarget?.storyboard_number ?? ''} · 视频参数`"
    width="680px"
    destroy-on-close
    @update:model-value="emit('update:showVideoParamsDialog', $event)"
    @close="emit('cancel:video-params')"
  >
    <el-form v-if="videoParamsTarget" label-width="70px" size="small" class="vp-dialog-form">
      <el-form-item label="创作模式">
        <el-radio-group
          :model-value="form.creationMode === 'universal' ? 'universal' : 'classic'"
          size="small"
          @change="(v) => updateFormField('creationMode', v)"
        >
          <el-radio-button value="classic">经典分镜</el-radio-button>
          <el-radio-button value="universal">全能模式</el-radio-button>
        </el-radio-group>
        <div class="vp-mode-hint">全能模式：中间为片段描述；生视频时使用 <strong>AI 配置里当前启用的视频</strong>（接口规范 <code>kling_omni</code> 或 <code>volcengine_omni</code>，模型如 <code>kling-video-o1</code>、<code>doubao-seedance-2-0-260128</code> 等）并合并场景/角色/道具等参考图（不含经典分镜主图）。经典字段保留，可随时切回。</div>
      </el-form-item>
      <el-row :gutter="12">
        <el-col :span="12">
          <el-form-item label="标题">
            <el-input :model-value="form.title" placeholder="镜头标题" @update:model-value="updateFormField('title', $event)" />
          </el-form-item>
        </el-col>
        <el-col :span="6">
          <el-form-item label="地点">
            <el-input :model-value="form.location" placeholder="场景地点" @update:model-value="updateFormField('location', $event)" />
          </el-form-item>
        </el-col>
        <el-col :span="6">
          <el-form-item label="时间">
            <el-input :model-value="form.time" placeholder="清晨/午后" @update:model-value="updateFormField('time', $event)" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="12">
        <el-col :span="6">
          <el-form-item label="时长(秒)">
            <el-input-number :model-value="form.duration" :min="1" :max="60" style="width:100%" @update:model-value="updateFormField('duration', $event)" />
          </el-form-item>
        </el-col>
        <el-col :span="6">
          <el-form-item label="景别">
            <el-select :model-value="form.shotType" placeholder="景别" style="width:100%" @update:model-value="updateFormField('shotType', $event)">
              <el-option label="大远景" value="大远景" />
              <el-option label="远景" value="远景" />
              <el-option label="中景" value="中景" />
              <el-option label="近景" value="近景" />
              <el-option label="特写" value="特写" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="6">
          <el-form-item label="运镜">
            <el-select :model-value="form.movement" placeholder="运镜" style="width:100%" clearable @update:model-value="updateFormField('movement', $event)">
              <el-option label="固定" value="static" />
              <el-option label="推镜" value="push" />
              <el-option label="拉镜" value="pull" />
              <el-option label="横摇" value="pan" />
              <el-option label="纵摇" value="tilt" />
              <el-option label="跟镜" value="tracking" />
              <el-option label="升镜" value="crane_up" />
              <el-option label="降镜" value="crane_dn" />
              <el-option label="环绕" value="orbit" />
              <el-option label="手持" value="handheld" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="6">
          <el-form-item label="氛围">
            <el-input :model-value="form.atmosphere" placeholder="氛围/情绪" @update:model-value="updateFormField('atmosphere', $event)" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="12">
        <el-col :span="8">
          <el-form-item label="镜头视角">
            <div style="display:flex;gap:4px;flex-wrap:wrap">
              <el-select :model-value="form.angleS" placeholder="景别" style="width:76px" @update:model-value="updateFormField('angleS', $event)">
                <el-option label="特写" value="close_up" />
                <el-option label="中景" value="medium" />
                <el-option label="远景" value="wide" />
              </el-select>
              <el-select :model-value="form.angleV" placeholder="俯仰" style="width:86px" @update:model-value="updateFormField('angleV', $event)">
                <el-option label="平视" value="eye_level" />
                <el-option label="低角仰拍" value="low" />
                <el-option label="高角俯拍" value="high" />
                <el-option label="虫眼仰视" value="worm" />
              </el-select>
              <el-select :model-value="form.angleH" placeholder="方向" style="width:80px" @update:model-value="updateFormField('angleH', $event)">
                <el-option label="正面" value="front" />
                <el-option label="前左45°" value="front_left" />
                <el-option label="左侧" value="left" />
                <el-option label="后左135°" value="back_left" />
                <el-option label="背面" value="back" />
                <el-option label="后右135°" value="back_right" />
                <el-option label="右侧" value="right" />
                <el-option label="前右45°" value="front_right" />
              </el-select>
              <span v-if="form.angleS && form.angleV && form.angleH"
                    style="font-size:11px;color:#6b7280;background:#f3f4f6;padding:2px 6px;border-radius:4px;white-space:nowrap">
                {{ angleToPromptFragment(form.angleH, form.angleV, form.angleS).label }}
              </span>
            </div>
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="灯光">
            <el-select :model-value="form.lighting" placeholder="灯光风格" style="width:100%" clearable @update:model-value="updateFormField('lighting', $event)">
              <el-option label="自然光" value="natural" />
              <el-option label="顺光" value="front" />
              <el-option label="侧光" value="side" />
              <el-option label="逆光" value="backlit" />
              <el-option label="顶光" value="top" />
              <el-option label="底光" value="under" />
              <el-option label="柔光" value="soft" />
              <el-option label="戏剧光" value="dramatic" />
              <el-option label="黄金时段" value="golden_hour" />
              <el-option label="蓝调时刻" value="blue_hour" />
              <el-option label="夜景" value="night" />
              <el-option label="霓虹" value="neon" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="景深">
            <el-select :model-value="form.dof" placeholder="景深" style="width:100%" clearable @update:model-value="updateFormField('dof', $event)">
              <el-option label="极浅景深" value="extreme_shallow" />
              <el-option label="浅景深" value="shallow" />
              <el-option label="中景深" value="medium" />
              <el-option label="深景深（全焦）" value="deep" />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="动作">
        <el-input :model-value="form.action" type="textarea" :rows="2" placeholder="动作描述" @update:model-value="updateFormField('action', $event)" />
      </el-form-item>
      <el-form-item label="对白">
        <el-input :model-value="form.dialogue" type="textarea" :rows="2" placeholder="角色对白" @update:model-value="updateFormField('dialogue', $event)" />
      </el-form-item>
      <el-form-item label="解说旁白">
        <el-input :model-value="form.narration" type="textarea" :rows="2" class="sb-narration-input" placeholder="画外解说 / 纪录片式旁白（与对白分开）" @update:model-value="updateFormField('narration', $event)" />
      </el-form-item>
      <el-form-item label="画面结果">
        <el-input :model-value="form.result" type="textarea" :rows="2" placeholder="动作完成后的画面结果" @update:model-value="updateFormField('result', $event)" />
      </el-form-item>
      <el-form-item label="视频提示词">
        <el-input
          :model-value="videoPromptPreview"
          type="textarea"
          :rows="3"
          readonly
          placeholder="保存后自动生成"
          style="color:#6b7280"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="emit('cancel:video-params')">取消</el-button>
      <el-button type="primary" :loading="videoParamsSaving" @click="emit('save:video-params')">保存并更新</el-button>
    </template>
  </el-dialog>

  <!-- P1-2: 导入小说弹窗 -->
  <el-dialog :model-value="showNovelImport" title="导入小说/长文" width="600px" @update:model-value="emit('update:showNovelImport', $event)" @close="emit('cancel:novel-import')">
    <div class="novel-import-dialog">
      <p style="color:#6b7280;font-size:13px;margin-bottom:12px">支持粘贴小说文本或上传 txt 文件，AI 自动识别章节并转换为剧本集数</p>
      <el-tabs :model-value="novelImportMode" @update:model-value="emit('update:novelImportMode', $event)">
        <el-tab-pane label="粘贴文本" name="text">
          <el-input
            :model-value="novelText"
            type="textarea"
            :rows="10"
            placeholder="粘贴小说正文，AI 会自动识别章节..."
            @update:model-value="emit('update:novelText', $event)"
          />
        </el-tab-pane>
        <el-tab-pane label="上传文件" name="file">
          <el-upload
            drag
            :auto-upload="false"
            :on-change="(file) => emit('update:novelFile', file)"
            accept=".txt,.md"
            :show-file-list="false"
          >
            <el-icon class="el-icon--upload"><DocumentAdd /></el-icon>
            <div class="el-upload__text">拖拽 .txt / .md 文件到此处，或<em>点击上传</em></div>
          </el-upload>
          <div v-if="novelFileName" style="margin-top:8px;font-size:13px;color:#409eff">已选择：{{ novelFileName }}</div>
        </el-tab-pane>
      </el-tabs>
      <div class="novel-import-options" style="margin-top:12px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:6px;font-size:13px">
          <span>最多导入集数：</span>
          <el-input-number :model-value="novelMaxChapters" :min="1" :max="20" size="small" style="width:100px" @update:model-value="emit('update:novelMaxChapters', $event)" />
        </div>
        <el-checkbox :model-value="novelAiSummarize" size="small" @update:model-value="emit('update:novelAiSummarize', $event)">AI 转换为剧本格式（会消耗 Token）</el-checkbox>
      </div>
    </div>
    <template #footer>
      <el-button @click="emit('cancel:novel-import')">取消</el-button>
      <el-button type="primary" :loading="novelImporting" @click="emit('submit:novel-import')">开始导入</el-button>
    </template>
  </el-dialog>

  <!-- 已有剧本时：覆盖或追加新集 -->
  <el-dialog :model-value="showGenerateStoryModeDialog" title="已有剧本" width="480px" destroy-on-close @update:model-value="emit('update:showGenerateStoryModeDialog', $event)">
    <p style="margin: 0 0 14px; font-size: 14px; color: var(--el-text-color-regular); line-height: 1.5">
      本剧已有剧集剧本，请选择本次生成结果的保存方式：
    </p>
    <el-radio-group :model-value="generateStorySaveMode" class="generate-story-mode-radios" @update:model-value="emit('update:generateStorySaveMode', $event)">
      <!-- Element Plus 2.6+：选项值用 value，勿仅用 label -->
      <el-radio value="overwrite" class="generate-story-mode-radio">
        覆盖：丢弃原有剧集，仅保留本次 AI 生成的集数
      </el-radio>
      <el-radio value="append" class="generate-story-mode-radio">
        新增：保留原有剧集，在末尾追加本次生成的新集
      </el-radio>
    </el-radio-group>
    <template #footer>
      <el-button @click="emit('cancel:generate-story-mode')">取消</el-button>
      <el-button type="primary" :loading="storyGenerating" @click="emit('submit:generate-story-mode')">确定</el-button>
    </template>
  </el-dialog>

  <!-- AI 配置弹窗（不跳转，避免本页内容丢失） -->
  <el-dialog :model-value="showAiConfigDialog" title="AI 配置" width="90%" destroy-on-close class="ai-config-dialog" @update:model-value="emit('update:showAiConfigDialog', $event)" @close="emit('update:showAiConfigDialog', false)">
    <AIConfigContent v-if="showAiConfigDialog" />
  </el-dialog>

  <!-- 图片放大预览：点击遮罩或图片关闭 -->
  <Teleport to="body">
    <div
      v-if="previewImageUrl"
      class="image-preview-overlay"
      @click="emit('close:preview')"
    >
      <img :src="previewImageUrl" alt="" class="image-preview-img" @click.stop="emit('close:preview')" />
    </div>
  </Teleport>
</template>

<script setup>
import { computed, defineAsyncComponent } from 'vue'
import { DocumentAdd } from '@element-plus/icons-vue'

const AIConfigContent = defineAsyncComponent(() => import('@/components/AIConfigContent.vue'))

const props = defineProps({
  // Storyboard Prompt Edit
  showSbPromptDialog: Boolean,
  sbPromptTarget: Object,
  sbPromptImageText: String,
  sbPromptPolishedText: String,
  sbPromptVideoText: String,
  sbPromptSaving: Boolean,
  sbPromptPolishing: Boolean,
  sbPromptTargetUniversal: Boolean,
  sbPromptClassicPolishing: Boolean,

  // Video Params
  showVideoParamsDialog: Boolean,
  videoParamsTarget: Object,
  videoParamsSaving: Boolean,
  inferringParams: Boolean,
  videoParamsForm: Object,
  videoPromptPreview: String,

  // Novel Import
  showNovelImport: Boolean,
  novelImportMode: String,
  novelText: String,
  novelFileName: String,
  novelFileContent: String,
  novelMaxChapters: Number,
  novelAiSummarize: Boolean,
  novelImporting: Boolean,

  // Generate Story Mode
  showGenerateStoryModeDialog: Boolean,
  generateStorySaveMode: String,
  storyGenerating: Boolean,

  // AI Config
  showAiConfigDialog: Boolean,

  // Image Preview
  previewImageUrl: String,
})

const emit = defineEmits([
  // Storyboard prompt
  'save:sb-prompt',
  'cancel:sb-prompt',
  'polish:sb-prompt',
  'polish-classic-video',
  'update:sbPromptImageText',
  'update:sbPromptPolishedText',
  'update:sbPromptVideoText',
  'update:showSbPromptDialog',

  // Video params
  'save:video-params',
  'cancel:video-params',
  'infer:video-params',
  'update:videoParamsForm',
  'update:showVideoParamsDialog',

  // Novel import
  'submit:novel-import',
  'cancel:novel-import',
  'update:novelText',
  'update:novelFile',
  'update:novelImportMode',
  'update:novelMaxChapters',
  'update:novelAiSummarize',
  'update:showNovelImport',

  // Generate story mode
  'submit:generate-story-mode',
  'cancel:generate-story-mode',
  'update:generateStorySaveMode',
  'update:showGenerateStoryModeDialog',

  // AI config
  'update:showAiConfigDialog',

  // Image preview
  'close:preview',
])

// Computed alias for the video params form fields
const form = computed(() => props.videoParamsForm ?? {})

function updateFormField(field, value) {
  emit('update:videoParamsForm', { ...props.videoParamsForm, [field]: value })
}

function angleToPromptFragment(h, v, s) {
  const hMap = {
    front: '正面', front_left: '左前45度', left: '左侧', back_left: '左后135度',
    back: '背面', back_right: '右后135度', right: '右侧', front_right: '右前45度'
  }
  const vMap = {
    eye_level: '平视', low: '低角仰拍', high: '高角俯拍', worm: '虫眼仰视'
  }
  const sMap = { close_up: '特写', medium: '中景', wide: '远景' }
  const parts = [hMap[h] || h, vMap[v] || v, sMap[s] || s].filter(Boolean)
  return { label: parts.join(' '), fragment: parts.join(' ') }
}
</script>

<style scoped>
/* Storyboard Prompt Edit */
.sb-prompt-section-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}
.sb-prompt-video-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}
.sb-prompt-dialog-form .el-form-item {
  margin-bottom: 10px;
}

/* Video Params */
.vp-dialog-form .el-form-item {
  margin-bottom: 12px;
}
.vp-mode-hint {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.45;
  margin-top: 8px;
  max-width: 520px;
}

/* Generate Story Mode */
.generate-story-mode-radios {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  width: 100%;
}
.generate-story-mode-radios :deep(.generate-story-mode-radio) {
  margin-right: 0;
  height: auto;
  align-items: flex-start;
  white-space: normal;
}
.generate-story-mode-radios :deep(.generate-story-mode-radio .el-radio__label) {
  white-space: normal;
  line-height: 1.45;
}

/* Image Preview */
.image-preview-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.image-preview-img {
  max-width: 90vw;
  max-height: 90vh;
  object-fit: contain;
  cursor: pointer;
  pointer-events: auto;
}

/* AI Config */
.ai-config-dialog :deep(.el-dialog__body) {
  max-height: 70vh;
  overflow-y: auto;
}
</style>
