<template>
  <div class="film-create" :class="{ 'sidebar-collapsed': navCollapsed }">
    <!-- 顶部 -->
    <AppHeader
      :drama-id="dramaId"
      :drama-title="store.drama?.title"
      :is-dark="isDark"
      @go-list="goList"
      @go-back-drama="router.push('/drama/' + dramaId)"
      @toggle-theme="toggleTheme"
      @open-ai-config="showAiConfigDialog = true"
    />

    <!-- 左侧固定侧边栏 -->
    <SidebarNav
      :nav-collapsed="navCollapsed"
      :storyboard-menu-expanded="storyboardMenuExpanded"
      :nav-steps="navSteps"
      :storyboards="storyboards"
      :all-active-tasks="allActiveTasks"
      :pipeline-running="pipelineRunning"
      :drama-id="dramaId"
      :current-episode-id="currentEpisodeId"
      :scroll-to-anchor="scrollToAnchor"
      @toggle-nav="toggleNav()"
      @scroll-to-anchor="scrollToAnchor"
      @scroll-to-top="scrollToTop"
      @toggle-storyboard-menu="storyboardMenuExpanded = !storyboardMenuExpanded"
    />

    <main class="main">
      <!-- 角色/道具/场景上传图片用，单例放在外层避免 v-for 导致 ref 为数组 -->
      <input
        ref="resourceImageFileInput"
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        style="display: none"
        @change="onResourceImageFileChange"
      />
      <!-- 分镜图上传图片用，单例放在外层避免 v-for 导致 ref 为数组 -->
      <input
        ref="sbImageFileInput"
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        style="display: none"
        @change="onSbImageFileChange"
      />
      <!-- 1. 故事生成 -->
      <section class="section card">
        <h2 class="section-title">故事生成</h2>
        <div v-if="!scriptContent && !currentEpisodeId" class="welcome-tip">
          <p>从这里开始你的创作之旅 🎬</p>
          <p class="welcome-tip-sub">选择或新增一集，然后输入故事梗概，AI 将为你生成完整剧本</p>
        </div>
        <p class="section-desc">输入一段故事梗概，AI 帮你扩写成完整剧本，或直接导入小说章节</p>
        <el-input
          v-model="storyInput"
          type="textarea"
          :rows="4"
          placeholder="例如：一个少女在森林里遇见会说话的狐狸，一起寻找失落的宝石..."
          class="story-textarea"
        />
        <div class="row gap" style="margin-top: 10px; flex-wrap: wrap;">
          <el-select v-model="storyStyle" placeholder="故事风格" clearable style="width: 120px" @change="() => saveProjectSettings(false)">
            <el-option label="现代" value="modern" />
            <el-option label="古风" value="ancient" />
            <el-option label="奇幻" value="fantasy" />
            <el-option label="日常" value="daily" />
          </el-select>
          <el-select v-model="storyType" placeholder="剧本类型" clearable style="width: 120px" @change="() => saveProjectSettings(false)">
            <el-option label="剧情" value="drama" />
            <el-option label="喜剧" value="comedy" />
            <el-option label="冒险" value="adventure" />
          </el-select>
          <span style="font-size: 13px; color: var(--el-text-color-regular); white-space: nowrap; align-self: center;">生成集数</span>
          <el-input-number
            v-model="storyEpisodeCount"
            :min="1"
            :max="6"
            :step="1"
            :precision="0"
            controls-position="right"
            style="width: 128px"
          />
          <el-button type="primary" :loading="storyGenerating" @click="onGenerateStory">
            生成剧本
          </el-button>
          <el-button plain @click="showNovelImport = true">
            <el-icon><DocumentAdd /></el-icon>
            导入小说
          </el-button>
        </div>
      </section>

      <!-- 2. 剧本编辑 -->
      <section id="anchor-script" class="section card">
        <h2 class="section-title">剧本 <span v-if="scriptAutoSaveStatus === 'saving'" class="autosave-hint">保存中...</span><span v-else-if="scriptAutoSaveStatus === 'saved'" class="autosave-hint autosave-ok">已保存</span><span v-else-if="scriptAutoSaveStatus === 'error'" class="autosave-hint autosave-err">保存失败</span></h2>
        <!-- 行1：集数切换 + 集名 + 添加一集 -->
        <div class="row gap" style="margin-bottom: 10px; flex-wrap: wrap;">
          <el-select
            v-model="selectedEpisodeId"
            placeholder="选择集数"
            clearable
            style="width: 130px"
            :disabled="!dramaId"
            @change="onEpisodeSelect"
          >
            <el-option
              v-for="ep in (store.drama?.episodes || [])"
              :key="ep.id"
              :label="ep.title || '第' + (ep.episode_number || 0) + '集'"
              :value="ep.id"
            />
          </el-select>
          <div v-if="dramaId && (store.drama?.episodes || []).length === 0" class="episode-empty-hint">
            <el-icon><WarningFilled /></el-icon>
            请先在下方「故事剧本」区域生成剧本，或手动添加一集
          </div>
          <el-input v-model="scriptTitle" placeholder="集标题" style="width: 150px" />
          <el-button v-if="dramaId" style="margin-left: auto" @click="onAddEpisode">
            <el-icon><Plus /></el-icon>添加一集
          </el-button>
          <el-button v-if="dramaId" class="btn-back-drama" @click="router.push('/drama/' + dramaId + '?importBatch=true')">
            <el-icon><Upload /></el-icon>批量导入剧集
          </el-button>
        </div>
        <!-- 剧本文本框 -->
        <el-input
          v-model="scriptContent"
          type="textarea"
          :rows="8"
          placeholder="剧本内容将显示在这里，可直接编辑..."
          class="story-textarea"
        />
        <!-- 行2：保存（紧贴文本框下方） -->
        <div class="row gap" style="margin-top: 8px; flex-wrap: wrap;">
          <el-button
            :loading="scriptGenerating"
            :disabled="!!dramaId && (store.drama?.episodes?.length > 0) && !currentEpisodeId"
            @click="onGenerateScript"
          >
            保存当前集
          </el-button>
        </div>
      </section>

      <!-- 本集配置：成片流水线 + 分镜生成参数 -->
      <section class="section card pipeline-section">
        <div class="one-click-actions">
          <span class="one-click-label">本集配置</span>
          <el-select v-model="projectAspectRatio" style="width: 130px" @change="() => saveProjectSettings(false)">
            <el-option label="16:9 横屏" value="16:9" />
            <el-option label="9:16 竖屏" value="9:16" />
            <el-option label="3:4 竖版" value="3:4" />
            <el-option label="1:1 方形" value="1:1" />
            <el-option label="4:3" value="4:3" />
            <el-option label="21:9 宽银幕" value="21:9" />
          </el-select>
          <el-input
            v-model="assetImageModel"
            clearable
            placeholder="资产生图模型 id（选填）"
            style="width: 200px"
            title="填写与「AI 配置」中图片服务一致的模型名/id；与角色/场景/道具编辑里的负面提示词配合时才会传入图生 API"
            @change="() => saveProjectSettings(false)"
          />
          <el-select v-model="videoClipDuration" style="width: 105px" @change="() => saveProjectSettings(false)">
            <el-option label="4秒/段" :value="4" />
            <el-option label="5秒/段" :value="5" />
            <el-option label="8秒/段" :value="8" />
            <el-option label="10秒/段" :value="10" />
            <el-option label="12秒/段" :value="12" />
            <el-option label="15秒/段" :value="15" />
          </el-select>
          <el-select v-model="scriptLanguage" placeholder="分镜语言" clearable style="width: 105px">
            <el-option label="中文" value="zh" />
            <el-option label="英文" value="en" />
          </el-select>
          <StylePickerButton
            v-model="generationStyle"
            :options="generationStyleOptions"
            @change="() => saveProjectSettings(true)"
          />
        </div>
        <div class="episode-sb-config-wrap">
          <div class="sb-config-row episode-sb-config-row">
            <label class="sb-config-item">
              <span class="sb-config-label">分镜数量</span>
              <el-input-number v-model="storyboardCount" :min="1" :max="200" :step="5" placeholder="自动" class="sb-config-input" />
              <span class="sb-config-hint sb-config-hint--estimate" :title="scriptEstimateStoryboardTitle">留空由 AI 决定{{ scriptEstimateStoryboardHint }}</span>
            </label>
            <span class="sb-config-divider">｜</span>
            <label class="sb-config-item">
              <span class="sb-config-label">视频总时长(秒)</span>
              <el-input-number v-model="videoDuration" :min="10" :max="600" :step="5" placeholder="自动" class="sb-config-input" />
              <span class="sb-config-hint sb-config-hint--estimate" :title="scriptEstimateVideoDurationTitle">留空由 AI 决定{{ scriptEstimateVideoDurationHint }}</span>
            </label>
            <span class="sb-config-divider">｜</span>
            <label class="sb-config-item">
              <span class="sb-config-label">序列图模式</span>
              <el-select v-model="gridMode" size="small" style="width:110px">
                <el-option label="单张" value="single" />
                <el-option label="四宫格" value="quad_grid" />
                <el-option label="九宫格" value="nine_grid" />
              </el-select>
              <span class="sb-config-hint">四/九宫格自动按视角拆分</span>
            </label>
          </div>
          <div class="sb-config-row sb-narration-export-row episode-sb-checkbox-row" style="margin-top:0;margin-bottom:0;flex-wrap:wrap;align-items:center;gap:12px">
            <el-checkbox v-model="storyboardUniversalOmni" @change="() => saveProjectSettings(false)">
              全能分镜模式（每镜输出 universal_segment_text，便于 Seedance / 可灵 Omni 生视频）
            </el-checkbox>
            <el-checkbox v-model="storyboardIncludeNarration" @change="() => saveProjectSettings(false)">
              生成分镜时生成解说旁白（narration，与对白分开，便于后期 TTS）
            </el-checkbox>
          </div>
        </div>
        <div class="episode-pipeline-actions">
                  <el-button
                  type="primary"
            :loading="pipelineRunning && !pipelinePaused"
            :disabled="!currentEpisodeId || pipelineRunning"
            title="仅提取角色、场景、道具与生成分镜文本，不生成图片与视频"
            @click="startTextFrameworkPipeline"
          >
            一键生成文本框架
          </el-button>

          <el-button
            type="primary"
            :loading="pipelineRunning && !pipelinePaused"
            :disabled="!currentEpisodeId || pipelineRunning"
            @click="startOneClickPipeline"
          >
            一键成片带图片视频
          </el-button>

          <template v-if="pipelineRunning">
            <el-button v-if="!pipelinePaused" type="warning" @click="pipelinePaused = true">⏸ 暂停</el-button>
            <el-button v-else type="success" @click="onPipelineResume">▶ 继续</el-button>
          </template>
        </div>
        <div v-if="pipelineRunning || pipelineErrorLog.length > 0" class="pipeline-status">
          <div v-if="pipelineCurrentStep" class="pipeline-current-step">
            <span v-if="pipelineStepIndex > 0" class="pipeline-step-badge">{{ pipelineStepIndex }}/{{ pipelineStepTotal }}</span>
            {{ pipelineCurrentStep.replace(/^\[步骤 \d+\/\d+\] /, '') }}
          </div>
          <!-- 阶段间倒计时 -->
          <div v-if="pipelineCountdown > 0" class="pipeline-countdown">
            <div class="pipeline-countdown-ring">
              <span class="pipeline-countdown-num">{{ pipelineCountdown }}</span>
              <span class="pipeline-countdown-unit">秒</span>
            </div>
            <div class="pipeline-countdown-body">
              <p class="pipeline-countdown-msg">{{ pipelineCountdownMsg }}</p>
              <div class="pipeline-countdown-actions">
                <el-button size="small" type="success" @click="skipPipelineCountdown">⚡ 立即开始下一阶段</el-button>
                <el-button v-if="!pipelinePaused" size="small" type="warning" @click="pipelinePaused = true">⏸ 暂停倒计时</el-button>
                <span v-else class="pipeline-countdown-paused">已暂停 — 点击右上角"继续"恢复</span>
              </div>
            </div>
          </div>
          <div v-if="pipelineActiveTasks.size > 0" class="pipeline-active-tasks">
            <span
              v-for="label in Array.from(pipelineActiveTasks)"
              :key="label"
              class="pipeline-task-chip"
            >
              <span class="pipeline-task-dot" />{{ label }}
            </span>
          </div>
          <div v-if="pipelineErrorLog.length > 0" class="pipeline-error-log">
            <div class="pipeline-error-title">执行过程中的错误：</div>
            <div v-for="(entry, idx) in pipelineErrorLog" :key="idx" class="pipeline-error-line">
              [{{ entry.step }}] {{ entry.message }}
            </div>
          </div>
        </div>
      </section>

      <!-- 资源管理：角色 / 道具 / 场景 -->
      <ResourcePanel
        :resource-panel-collapsed="resourcePanelCollapsed"
        :characters-block-collapsed="charactersBlockCollapsed"
        :props-block-collapsed="propsBlockCollapsed"
        :scenes-block-collapsed="scenesBlockCollapsed"
        :characters="characters"
        :props-list="props"
        :scenes-list="scenes"
        :generating-char-ids="generatingCharIds"
        :generating-scene-ids="generatingSceneIds"
        :generating-prop-ids="generatingPropIds"
        :drama-id="dramaId"
        :current-episode-id="currentEpisodeId"
        :characters-generating="charactersGenerating"
        :props-extracting="propsExtracting"
        :scenes-extracting="scenesExtracting"
        :uploading-resource-id="uploadingResourceId"
        :drag-over-resource-key="dragOverResourceKey"
        :adding-char-to-library-id="addingCharToLibraryId"
        :adding-char-to-material-id="addingCharToMaterialId"
        :sd2-certifying-id="sd2CertifyingId"
        :adding-prop-to-library-id="addingPropToLibraryId"
        :adding-prop-to-material-id="addingPropToMaterialId"
        :adding-scene-to-library-id="addingSceneToLibraryId"
        :adding-scene-to-material-id="addingSceneToMaterialId"
        :regen-sb-images-for-asset="regenSbImagesForAsset"
        :regen-sb-images-progress="regenSbImagesProgress"
        :is-char-in-library="isCharInLibrary"
        :is-char-in-material-library="isCharInMaterialLibrary"
        :is-prop-in-library="isPropInLibrary"
        :is-prop-in-material-library="isPropInMaterialLibrary"
        :is-scene-in-library="isSceneInLibrary"
        :is-scene-in-material-library="isSceneInMaterialLibrary"
        :get-char-affected-storyboards="getCharAffectedStoryboards"
        :get-scene-affected-storyboards="getSceneAffectedStoryboards"
        :char-sd2-tag-text="charSd2TagText"
        :parse-extra-images="parseExtraImages"
        @toggle:resource-panel="resourcePanelCollapsed = !resourcePanelCollapsed"
        @toggle:characters-block="charactersBlockCollapsed = !charactersBlockCollapsed"
        @toggle:props-block="propsBlockCollapsed = !propsBlockCollapsed"
        @toggle:scenes-block="scenesBlockCollapsed = !scenesBlockCollapsed"
        @extract:characters="onGenerateCharacters"
        @add:character="showEditCharacter = true; editCharacterForm = { name: '', role: 'main', description: '', personality: '', appearance: '', negative_prompt: '' }"
        @library:character="showCharLibrary = true"
        @edit:character="c => { editCharacterForm = { ...c }; showEditCharacter = true }"
        @delete:character="c => onConfirmDeleteCharacter(c.id)"
        @generate-image:character="c => onGenerateCharacterImage(c)"
        @add-to-library:character="c => onAddCharToLibrary(c)"
        @add-to-material-library:character="c => onAddCharToMaterialLibrary(c)"
        @certify-sd2:character="c => onCertifySd2(c)"
        @regen-storyboards:character="c => onRegenAffectedSbImages(c.id, 'character')"
        @drag-over:character="e => onResourceDragOver(e, 'character')"
        @drag-leave:character="onResourceDragLeave"
        @drop:character="(c, e) => onResourceDrop(e, 'character', c)"
        @upload-click:character="c => onUploadResourceClick('character', c.id)"
        @extract:props="onExtractProps"
        @add:prop="showAddProp = true"
        @library:prop="showPropLibrary = true"
        @edit:prop="p => { editPropForm = { ...p }; showEditProp = true }"
        @delete:prop="p => onConfirmDeleteProp(p.id)"
        @generate-image:prop="p => onGeneratePropImage(p)"
        @add-to-library:prop="p => onAddPropToLibrary(p)"
        @add-to-material-library:prop="p => onAddPropToMaterialLibrary(p)"
        @drag-over:prop="e => onResourceDragOver(e, 'prop')"
        @drag-leave:prop="onResourceDragLeave"
        @drop:prop="(p, e) => onResourceDrop(e, 'prop', p)"
        @upload-click:prop="p => onUploadResourceClick('prop', p.id)"
        @extract:scenes="onExtractScenes"
        @add:scene="showEditScene = true; editSceneForm = { location: '', time: '', description: '', prompt: '', negative_prompt: '' }"
        @library:scene="showSceneLibrary = true"
        @edit:scene="s => { editSceneForm = { ...s }; showEditScene = true }"
        @delete:scene="s => onConfirmDeleteScene(s.id)"
        @generate-image:scene="s => onGenerateSceneImage(s)"
        @add-to-library:scene="s => onAddSceneToLibrary(s)"
        @add-to-material-library:scene="s => onAddSceneToMaterialLibrary(s)"
        @regen-storyboards:scene="s => onRegenAffectedSbImages(s.id, 'scene')"
        @drag-over:scene="e => onResourceDragOver(e, 'scene')"
        @drag-leave:scene="onResourceDragLeave"
        @drop:scene="(s, e) => onResourceDrop(e, 'scene', s)"
        @upload-click:scene="s => onUploadResourceClick('scene', s.id)"
        @preview-image="openImagePreview"
        @set-primary-image="onSetPrimaryImage"
        @remove-extra-image="onRemoveExtraImage"
      />

      <!-- 6. 分镜生成 -->
      <StoryboardSection
        :storyboards="storyboards"
        :sb-images="sbImages"
        :sb-videos="sbVideos"
        :storyboard-generating="storyboardGenerating"
        :batch-image-running="batchImageRunning"
        :batch-video-running="batchVideoRunning"
        :batch-image-stopping="batchImageStopping"
        :batch-video-stopping="batchVideoStopping"
        :batch-image-progress="batchImageProgress"
        :batch-video-progress="batchVideoProgress"
        :batch-image-errors="batchImageErrors"
        :batch-video-errors="batchVideoErrors"
        :video-frame-contiguity="videoFrameContiguity"
        :drama-id="dramaId"
        :current-episode-id="currentEpisodeId"
        :characters="characters"
        :scenes="scenes"
        :props-list="props"
        :generating-sb-image-ids="generatingSbImageIds"
        :generating-sb-video-ids="generatingSbVideoIds"
        :generating-universal-segment-ids="generatingUniversalSegmentIds"
        :is-dark="isDark"
        @generate:storyboard="onGenerateStoryboard"
        @add:storyboard="onAddSingleStoryboard"
        @delete:storyboard="sb => onDeleteSingleStoryboard(sb)"
        @insert:storyboard="sb => onInsertStoryboardBefore(sb)"
        @generate:sb-image="sb => onGenerateSbImage(sb)"
        @generate:sb-video="sb => onGenerateSbVideo(sb)"
        @upload:sb-image="sb => onUploadSbImageClick(sb)"
        @upscale:sb-image="sb => onUpscaleSbImage(sb)"
        @start:batch-image="startBatchImageGeneration"
        @stop:batch-image="batchImageStopping = true"
        @start:batch-video="startBatchVideoGeneration"
        @stop:batch-video="batchVideoStopping = true"
        @update:frame-contiguity="v => videoFrameContiguity = v"
        @select:sb-character="(sbId, ids) => setSbCharacterIds(sbId, ids)"
        @select:sb-scene="(sbId, id) => onStoryboardSceneChange(sbId, id)"
        @select:sb-prop="(sbId, ids) => onStoryboardPropChange(sbId, ids)"
        @tts:dialogue="sb => onTtsSbDialogue(sb)"
        @tts:narration="sb => onTtsSbNarration(sb)"
        @open:prompt-dialog="sb => onOpenSbPromptDialog(sb)"
        @open:video-params-dialog="sb => onOpenVideoParamsDialog(sb)"
        @edit:sb-image-prompt="sb => onEditSbImagePrompt(sb)"
        @edit:sb-video-prompt="sb => onEditSbVideoPrompt(sb)"
        @play:tts-dialogue="sb => playSbDialogueTts(sb)"
        @play:tts-narration="sb => playSbNarrationTts(sb)"
        @select:sb-main-image="(sbId, imgId) => onSelectSbMainImage(sbId, imgId)"
        @select:sb-main-video="(sbId, vidId) => onSelectSbMainVideo(sbId, vidId)"
        @drag-over:sb="e => {}"
        @drag-leave:sb="() => {}"
        @drop:sb="(sb, e) => {}"
        @toggle:universal-mode="sb => onToggleSbUniversalMode(sb)"
        @save:universal-segment="args => onSaveUniversalSegmentField(args)"
        @generate:universal-segment-prompt="sb => onGenerateUniversalSegmentPrompt(sb)"
        @polish:universal-segment-prompt="sb => onPolishUniversalSegmentPromptStream(sb)"
        @polish:classic-video-prompt="sb => onPolishClassicVideoPromptStream(sb)"
        @export:narration-srt="onExportNarrationSrt"
        @open-image-preview="url => openImagePreview(url)"
      />


      <!-- 7. 视频配置 + AI 模型配置 -->
      <section class="section card">
        <h2 class="section-title">视频配置</h2>
        <div class="config-grid">
          <el-form-item label="分辨率">
            <el-select v-model="videoResolution" style="width: 160px">
              <el-option label="480p" value="480p" />
              <el-option label="720p" value="720p" />
              <el-option label="1080p" value="1080p" />
            </el-select>
          </el-form-item>
          <!--
          <el-form-item label="配乐">
            <el-select v-model="videoMusic" placeholder="无" clearable style="width: 160px">
              <el-option label="无" value="" />
            </el-select>
          </el-form-item>
          <el-form-item label="音效">
            <el-select v-model="videoSfx" placeholder="无" clearable style="width: 160px">
              <el-option label="无" value="" />
            </el-select>
          </el-form-item>
          <el-form-item label="画质">
            <el-select v-model="videoQuality" style="width: 120px">
              <el-option label="高" value="high" />
              <el-option label="中" value="medium" />
            </el-select>
          </el-form-item>
          -->
          <el-form-item label="字幕">
            <div class="video-option-row">
              <el-switch v-model="videoSubtitle" />
              <span v-if="videoSubtitle" class="video-option-hint">开启后，合成整集时会检测解说旁白：若有文案则自动生成 SRT、按分镜时长合成旁白语音（过长加速 / 过短补静音）、与成片对齐后烧录字幕并混音。</span>
            </div>
          </el-form-item>
          <el-form-item label="对白烧录">
            <div class="video-option-row">
              <el-switch v-model="videoBurnDialogue" />
              <span v-if="videoBurnDialogue" class="video-option-hint">开启后，将把各镜「配音」生成的对白 TTS 按分镜时长对齐并混入整集成片（无对白音频的分镜为静音）。可与「字幕」旁白同时开启，两条音轨会叠混。</span>
            </div>
          </el-form-item>
          <el-form-item label="水印">
            <div class="video-option-row">
              <el-switch v-model="videoWatermark" />
              <el-input
                v-if="videoWatermark"
                v-model="videoWatermarkText"
                placeholder="右下角水印文字"
                maxlength="200"
                show-word-limit
                clearable
                class="video-watermark-input"
              />
            </div>
          </el-form-item>
        </div>
        <p class="config-tip">文本/图片/视频使用的模型以「<el-link type="primary" :underline="false" @click="showAiConfigDialog = true">AI 配置</el-link>」中设为默认的为准。</p>
      </section>

      <!-- 8. 合成视频 -->
      <section id="anchor-video" class="section card">
        <h2 class="section-title">合成视频</h2>
        <el-button
          type="primary"
          size="large"
          :loading="videoStatus === 'generating'"
          :disabled="!currentEpisodeId || storyboards.length === 0 || videoStatus === 'generating'"
          @click="onGenerateVideo"
        >
          合成视频
        </el-button>
        <div v-if="videoStatus === 'generating'" class="video-progress">
          <el-progress :percentage="videoProgress" :status="videoProgress >= 100 ? 'success' : undefined" />
          <p>视频生成中...</p>
        </div>
        <div v-if="videoStatus === 'done'" class="video-done">
          <el-alert type="success" title="视频生成完成" show-icon />
        </div>
        <div v-else-if="videoStatus === 'error'" class="video-error">
          <el-alert type="error" :title="videoErrorMsg" show-icon />
        </div>
        <div v-if="currentEpisodeVideoUrl" class="video-preview-wrap">
          <p class="video-preview-label">本集合成视频预览</p>
          <video
            :src="currentEpisodeVideoUrl"
            controls
            class="video-preview-player"
            preload="metadata"
          />
        </div>
      </section>
    </main>

    <!-- 资源编辑对话框 -->
    <ResourceEditDialogs
      :show-add-prop="showAddProp"
      :add-prop-form="addPropForm"
      :add-prop-saving="addPropSaving"
      :add-prop-ref-image="addPropAddRefImage ? addPropAddRefImage.dataUrl : ''"
      :add-prop-ref-image-extracting="extractingPropAddDesc"
      :show-edit-character="showEditCharacter"
      :edit-character-form="editCharacterForm"
      :edit-character-saving="editCharacterSaving"
      :edit-character-prompt-generating="editCharacterPromptGenerating"
      :extracting-char-appearance="extractingCharAppearance"
      :extracting-anchors="extractingAnchors"
      :add-char-ref-image="addCharRefImage"
      :show-char-sd2-cert="showCharSd2Cert"
      :char-sd2-cert-payload="charSd2CertPayload"
      :show-edit-prop="showEditProp"
      :edit-prop-form="editPropForm"
      :edit-prop-saving="editPropSaving"
      :edit-prop-prompt-generating="editPropPromptGenerating"
      :show-edit-scene="showEditScene"
      :edit-scene-form="editSceneForm"
      :edit-scene-saving="editSceneSaving"
      :edit-scene-prompt-generating="editScenePromptGenerating"
      @submit:add-prop="onSubmitAddProp"
      @cancel:add-prop="showAddProp = false"
      @extract:prop-add-desc="doExtractFromRef2('addProp')"
      @clear:prop-add-ref="addPropAddRefImage = null"
      @submit:edit-character="onSubmitEditCharacter"
      @cancel:edit-character="showEditCharacter = false"
      @generate:character-prompt="onGenerateCharacterPrompt"
      @extract:char-appearance="onExtractCharAppearance"
      @extract:char-anchors="onExtractAnchors"
      @clear:char-ref-image="addCharRefImage = null"
      @file-change:char-ref="onRefImageFileChange"
      @close:sd2-cert="showCharSd2Cert = false"
      @submit:edit-prop="onSubmitEditProp"
      @cancel:edit-prop="showEditProp = false"
      @generate:prop-prompt="onGeneratePropPrompt"
      @submit:edit-scene="onSubmitEditScene"
      @cancel:edit-scene="showEditScene = false"
      @generate:scene-prompt="onGenerateScenePrompt"
    />

    <!-- 素材库对话框 -->
    <LibraryDialogs
      :current-episode-id="currentEpisodeId"
      :show-char-library="showCharLibrary"
      :char-library-list="charLibraryList"
      :char-library-loading="charLibraryLoading"
      :char-library-page="charLibraryPage"
      :char-library-page-size="charLibraryPageSize"
      :char-library-total="charLibraryTotal"
      :char-library-keyword="charLibraryKeyword"
      :show-edit-char-library="showEditCharLibrary"
      :edit-char-library-form="editCharLibraryForm"
      :edit-char-library-saving="editCharLibrarySaving"
      :edit-char-library-img-uploading="editCharLibraryImgUploading"
      :edit-char-library-img-generating="editCharLibraryImgGenerating"
      :show-prop-library="showPropLibrary"
      :prop-library-list="propLibraryList"
      :prop-library-loading="propLibraryLoading"
      :prop-library-page="propLibraryPage"
      :prop-library-page-size="propLibraryPageSize"
      :prop-library-total="propLibraryTotal"
      :prop-library-keyword="propLibraryKeyword"
      :show-edit-prop-library="showEditPropLibrary"
      :edit-prop-library-form="editPropLibraryForm"
      :edit-prop-library-saving="editPropLibrarySaving"
      :edit-prop-library-img-uploading="editPropLibraryImgUploading"
      :edit-prop-library-img-generating="editPropLibraryImgGenerating"
      :show-scene-library="showSceneLibrary"
      :scene-library-list="sceneLibraryList"
      :scene-library-loading="sceneLibraryLoading"
      :scene-library-page="sceneLibraryPage"
      :scene-library-page-size="sceneLibraryPageSize"
      :scene-library-total="sceneLibraryTotal"
      :scene-library-keyword="sceneLibraryKeyword"
      :show-edit-scene-library="showEditSceneLibrary"
      :edit-scene-library-form="editSceneLibraryForm"
      :edit-scene-library-saving="editSceneLibrarySaving"
      :edit-scene-library-img-uploading="editSceneLibraryImgUploading"
      :edit-scene-library-img-generating="editSceneLibraryImgGenerating"
      @load:char-library="loadCharLibraryList"
      @search:char-library="debouncedLoadCharLibrary"
      @open-edit:char-library="item => { editCharLibraryForm = { ...item }; showEditCharLibrary = true }"
      @delete:char-library="item => onDeleteCharLibrary(item)"
      @add-char-from-library="item => onAddCharFromLibrary(item)"
      @submit:edit-char-library="onSubmitEditCharLibrary"
      @cancel:edit-char-library="showEditCharLibrary = false"
      @upload-img:char-library="e => onUploadLibImg(e, editCharLibraryForm, characterLibraryAPI, loadCharLibraryList)"
      @generate-img:char-library="() => doGenerateLibImg(editCharLibraryForm, editCharLibraryForm.name, characterLibraryAPI, loadCharLibraryList)"
      @file-change:char-library="e => onLibFileChange(e, 'char')"
      @update:showCharLibrary="v => showCharLibrary = v"
      @update:showEditCharLibrary="v => showEditCharLibrary = v"
      @load:prop-library="loadPropLibraryList"
      @search:prop-library="debouncedLoadPropLibrary"
      @open-edit:prop-library="item => { editPropLibraryForm = { ...item }; showEditPropLibrary = true }"
      @delete:prop-library="item => onDeletePropLibrary(item)"
      @add-prop-from-library="item => onAddPropFromLibrary(item)"
      @submit:edit-prop-library="onSubmitEditPropLibrary"
      @cancel:edit-prop-library="showEditPropLibrary = false"
      @upload-img:prop-library="e => onUploadLibImg(e, editPropLibraryForm, propLibraryAPI, loadPropLibraryList)"
      @generate-img:prop-library="() => doGenerateLibImg(editPropLibraryForm, editPropLibraryForm.name, propLibraryAPI, loadPropLibraryList)"
      @file-change:prop-library="e => onLibFileChange(e, 'prop')"
      @update:showPropLibrary="v => showPropLibrary = v"
      @update:showEditPropLibrary="v => showEditPropLibrary = v"
      @load:scene-library="loadSceneLibraryList"
      @search:scene-library="debouncedLoadSceneLibrary"
      @open-edit:scene-library="item => { editSceneLibraryForm = { ...item }; showEditSceneLibrary = true }"
      @delete:scene-library="item => onDeleteSceneLibrary(item)"
      @add-scene-from-library="item => onAddSceneFromLibrary(item)"
      @submit:edit-scene-library="onSubmitEditSceneLibrary"
      @cancel:edit-scene-library="showEditSceneLibrary = false"
      @upload-img:scene-library="e => onUploadLibImg(e, editSceneLibraryForm, sceneLibraryAPI, loadSceneLibraryList)"
      @generate-img:scene-library="() => doGenerateLibImg(editSceneLibraryForm, editSceneLibraryForm.location || editSceneLibraryForm.description, sceneLibraryAPI, loadSceneLibraryList)"
      @file-change:scene-library="e => onLibFileChange(e, 'scene')"
      @update:showSceneLibrary="v => showSceneLibrary = v"
      @update:showEditSceneLibrary="v => showEditSceneLibrary = v"
    />

    <!-- 其他对话框 -->
    <FilmCreateDialogs
      :show-sb-prompt-dialog="showSbPromptDialog"
      :sb-prompt-target="sbPromptTarget"
      :sb-prompt-image-text="sbPromptImageText"
      :sb-prompt-polished-text="sbPromptPolishedText"
      :sb-prompt-video-text="sbPromptVideoText"
      :sb-prompt-saving="sbPromptSaving"
      :sb-prompt-polishing="sbPromptPolishing"
      :sb-prompt-target-universal="sbPromptTarget && isSbUniversalMode(sbPromptTarget.id)"
      :sb-prompt-classic-polishing="false"
      :show-video-params-dialog="showVideoParamsDialog"
      :video-params-target="videoParamsTarget"
      :video-params-saving="videoParamsSaving"
      :inferring-params="inferringParams"
      :video-params-form="{
        creationMode: sbCreationMode[videoParamsTarget?.id] || '',
        title: sbTitle[videoParamsTarget?.id] || '',
        location: sbLocation[videoParamsTarget?.id] || '',
        time: sbTime[videoParamsTarget?.id] || '',
        duration: sbDuration[videoParamsTarget?.id] || '',
        shotType: sbShotType[videoParamsTarget?.id] || '',
        movement: sbMovement[videoParamsTarget?.id] || '',
        atmosphere: sbAtmosphere[videoParamsTarget?.id] || '',
        angle: sbAngle[videoParamsTarget?.id] || '',
        angleH: sbAngleH[videoParamsTarget?.id] || '',
        angleV: sbAngleV[videoParamsTarget?.id] || '',
        angleS: sbAngleS[videoParamsTarget?.id] || '',
        lighting: sbLighting[videoParamsTarget?.id] || '',
        dof: sbDof[videoParamsTarget?.id] || '',
        action: sbAction[videoParamsTarget?.id] || '',
        dialogue: sbDialogue[videoParamsTarget?.id] || '',
        narration: sbNarration[videoParamsTarget?.id] || '',
        result: sbResult[videoParamsTarget?.id] || '',
      }"
      :video-prompt-preview="videoParamsTarget ? buildVideoPromptFromFields(videoParamsTarget.id) : ''"
      :show-novel-import="showNovelImport"
      :novel-import-mode="novelImportMode"
      :novel-text="novelText"
      :novel-file-name="novelFileName"
      :novel-file-content="novelFileContent"
      :novel-max-chapters="novelMaxChapters"
      :novel-ai-summarize="novelAiSummarize"
      :novel-importing="novelImporting"
      :show-generate-story-mode-dialog="showGenerateStoryModeDialog"
      :generate-story-save-mode="generateStorySaveMode"
      :story-generating="storyGenerating"
      :show-ai-config-dialog="showAiConfigDialog"
      :preview-image-url="previewImageUrl"
      @save:sb-prompt="onSaveSbPromptDialog"
      @cancel:sb-prompt="showSbPromptDialog = false"
      @polish:sb-prompt="onPolishSbPrompt"
      @update:sb-prompt-image-text="v => sbPromptImageText = v"
      @update:sb-prompt-polished-text="v => sbPromptPolishedText = v"
      @update:sb-prompt-video-text="v => sbPromptVideoText = v"
      @save:video-params="onSaveVideoParams"
      @cancel:video-params="showVideoParamsDialog = false; onVideoParamsDialogClosed()"
      @infer:video-params="onBatchInferParams"
      @update:video-params-form="form => onSaveSbVideoFields(videoParamsTarget?.id, form)"
      @submit:novel-import="onImportNovel"
      @cancel:novel-import="showNovelImport = false"
      @update:novel-text="v => novelText = v"
      @update:novel-file="args => { novelFileName = args.name; novelFileContent = args.content }"
      @update:novel-import-mode="v => novelImportMode = v"
      @update:novel-max-chapters="v => novelMaxChapters = v"
      @update:novel-ai-summarize="v => novelAiSummarize = v"
      @submit:generate-story-mode="onConfirmGenerateStoryMode"
      @cancel:generate-story-mode="showGenerateStoryModeDialog = false"
      @update:generate-story-save-mode="v => generateStorySaveMode = v"
      @update:show-ai-config-dialog="v => showAiConfigDialog = v"
      @close:preview="closeImagePreview"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, reactive, nextTick, defineAsyncComponent, provide } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Setting, Plus, Minus, Sunny, Moon, MagicStick, Upload, Delete, Check, Loading, WarningFilled, User, Box, Picture, Film, VideoCamera, Document, InfoFilled, Refresh, ZoomIn, QuestionFilled, DocumentAdd, Expand, Fold, VideoPlay } from '@element-plus/icons-vue'
import { useTheme } from '@/composables/useTheme'
import { useFilmStore } from '@/stores/film'
import { dramaAPI } from '@/api/drama'
import { generationAPI } from '@/api/generation'
import { aiAPI } from '@/api/ai'
import { characterAPI } from '@/api/characters'
import { propAPI } from '@/api/props'
import { sceneAPI } from '@/api/scenes'
import { taskAPI } from '@/api/task'
import { imagesAPI } from '@/api/images'
import { videosAPI } from '@/api/videos'
import { storyboardsAPI } from '@/api/storyboards'
import { uploadAPI } from '@/api/upload'
import { characterLibraryAPI } from '@/api/characterLibrary'
import { sceneLibraryAPI } from '@/api/sceneLibrary'
import { propLibraryAPI } from '@/api/propLibrary'
import { generationSettingsAPI } from '@/api/prompts'
import StylePickerButton from '@/components/StylePickerButton.vue'
const AIConfigContent = defineAsyncComponent(() => import('@/components/AIConfigContent.vue'))
import UniversalSegmentOmniAtEditor from '@/components/UniversalSegmentOmniAtEditor.vue'
import AppHeader from '@/components/filmCreate/AppHeader.vue'
import SidebarNav from '@/components/filmCreate/SidebarNav.vue'
import ResourcePanel from '@/components/filmCreate/ResourcePanel.vue'
import StoryboardSection from '@/components/filmCreate/StoryboardSection.vue'
import ResourceEditDialogs from '@/components/filmCreate/ResourceEditDialogs.vue'
import LibraryDialogs from '@/components/filmCreate/LibraryDialogs.vue'
import FilmCreateDialogs from '@/components/filmCreate/FilmCreateDialogs.vue'
import { generationStyleOptions, getStylePromptEn, getStylePromptZh, stylePromptMetadataForSave, backfillDramaStylePromptMetadataIfNeeded } from '@/constants/styleOptions'
import { useNavigation } from '@/composables/filmCreate/useNavigation'
import { useCharacters } from '@/composables/filmCreate/useCharacters'
import { useProps as usePropsComposable } from '@/composables/filmCreate/useProps'
import { useScenes } from '@/composables/filmCreate/useScenes'
import { trackPollTimer, cancelAllPolls } from '@/composables/filmCreate/usePollTask'
import { useAutoSave } from '@/composables/filmCreate/useAutoSave'
import { friendlyError } from '@/utils/errorMessages'
import { assetImageUrl, hasAssetImage, localPathToUrl } from '@/utils/assetImageUrl'

const route = useRoute()
const router = useRouter()
const store = useFilmStore()
const { isDark, toggle: toggleTheme } = useTheme()
const { videoResolution: storeVideoResolution } = storeToRefs(store)

// ── Provide storyboard state for StoryboardSection inject ─────
// ── Composable: Navigation ─────────────────────────────
const { navCollapsed, storyboardMenuExpanded, toggleNav, scrollToTop, scrollToAnchor } = useNavigation()

function goList() {
  router.push('/')
}


const showAiConfigDialog = ref(false)
const storyInput = ref('')
const storyStyle = ref('')
const storyType = ref('')
const storyEpisodeCount = ref(6)
const storyGenerating = ref(false)
// P1-2: 小说导入
const showNovelImport = ref(false)
const showGenerateStoryModeDialog = ref(false)
/** 已有剧本时：overwrite=整剧替换，append=保留旧集并追加 */
const generateStorySaveMode = ref('overwrite')
const novelImportMode = ref('text')
const novelText = ref('')
const novelFileName = ref('')
const novelFileContent = ref('')
const novelMaxChapters = ref(10)
const novelAiSummarize = ref(false)
const novelImporting = ref(false)
const scriptTitle = ref('')
const selectedEpisodeId = ref(null)
/** 保存剧本后用于恢复选中集（后端重插后 id 会变，用 episode_number 匹配） */
const savedCurrentEpisodeNumber = ref(1)
const scriptLanguage = ref('zh')
const scriptStoryboardStyle = ref('')
const scriptGenerating = ref(false)
const generationStyle = ref('')
const projectAspectRatio = ref('16:9')
/** 与资产「负面提示词」配合：非空时作为图生请求的 model 传入后端（与 YAML 默认图模区分） */
const assetImageModel = ref('')
function getAssetImageModel() {
  const m = (assetImageModel.value || '').trim()
  return m || undefined
}
const videoClipDuration = ref(5)

/** 根据 value 查找样式选项对象 */
function _findStyleOption(val) {
  for (const group of generationStyleOptions) {
    const found = group.options.find(o => o.value === val)
    if (found) return found
  }
  return null
}

/** 传给图像/视频 AI 用的英文 prompt（效果最好）；
 *  找不到 promptEn 时降级到 prompt，再降级到原始值 */
function getSelectedStylePrompt() {
  const val = (generationStyle.value || '').toString().trim()
  if (!val) return undefined
  const opt = _findStyleOption(val)
  if (opt) return opt.promptEn || opt.prompt || val
  return val
}

/** 中文风格描述（用于界面展示或中文场景提示词拼接） */
function getSelectedStylePromptZh() {
  const val = (generationStyle.value || '').toString().trim()
  if (!val) return undefined
  const opt = _findStyleOption(val)
  if (opt) return opt.prompt || opt.promptEn || val
  return val
}

/** 保存剧集时写入 metadata，供后端提示词使用（与 dramas.style 选项 value 对应） */
function projectStylePromptMetadata() {
  return stylePromptMetadataForSave(generationStyle.value)
}
const scriptContent = computed({
  get: () => store.scriptContent,
  set: (v) => store.setScriptContent(v)
})
const videoResolution = storeVideoResolution
const videoMusic = ref('')
const videoSfx = ref('')
const videoQuality = ref('high')
const videoSubtitle = ref(true)
/** 合成整集时把各镜对白 TTS（audio_local_path）按分镜时长对齐并混入成片 */
const videoBurnDialogue = ref(false)
const videoWatermark = ref(false)
/** 水印开启时烧录到成片右下角 */
const videoWatermarkText = ref('')

// ── Auto-save for script content ─────────────────────────────
const { status: scriptAutoSaveStatus } = useAutoSave(scriptContent, {
  saveFn: (content) => saveScriptToBackend(content),
  debounceMs: 1500,
  shouldSave: (v) => !!(v && v.trim()),
})
const dramaId = computed(() => store.dramaId)
const characters = computed(() => store.characters)
const scenes = computed(() => store.scenes)
const props = computed(() => store.props)
const storyboards = computed(() => store.storyboards)
const currentEpisode = computed(() => store.currentEpisode)
const currentEpisodeId = computed(() => store.currentEpisode?.id ?? null)
const videoProgress = computed(() => store.videoProgress)
const videoStatus = computed(() => store.videoStatus)
/** 当前集合成视频的播放地址（用于按钮下方预览） */
const currentEpisodeVideoUrl = computed(() => {
  const url = currentEpisode.value?.video_url
  if (!url || !String(url).trim()) return ''
  const s = String(url).trim()
  if (s.startsWith('http://') || s.startsWith('https://')) return s
  return '/static/' + s.replace(/^\//, '')
})

const storyboardGenerating = ref(false)
/** 分镜批量生成结束后，按镜序逐个润色全能片段（仅勾选全能模式且各镜为 universal 且有正文时） */
const universalOmniPolishRunning = ref(false)
const universalOmniPolishProgress = ref({ current: 0, total: 0, label: '' })
const sbTruncatedWarning = ref(false)
const sbTruncatedDismissed = ref(false)
const videoErrorMsg = ref('')
// 本集配置 / 成片流水线
const pipelineRunning = ref(false)
const pipelinePaused = ref(false)
const pipelineErrorLog = ref([])
const pipelineCurrentStep = ref('')
const pipelineStepIndex = ref(0)    // 当前步骤序号（1-based）
/** 全流程 10 步；仅文本框架为前 4 步 */
const pipelineStepTotal = ref(10)
let pipelineResolveResume = null
// 倒计时（两个生成阶段之间的确认窗口）
const pipelineCountdown = ref(0)      // 剩余秒数，0 表示不在倒计时
const pipelineCountdownMsg = ref('')  // 倒计时说明文字
const pipelineConcurrency = ref(3)
const pipelineVideoConcurrency = ref(3)
/** 与后端 config video.generation_timeout_minutes 一致，用于视频类任务轮询 */
const videoTaskPollTimeoutMinutes = ref(30)
const pipelineActiveTasks = reactive(new Set())

async function loadPipelineConcurrency() {
  try {
    const res = await generationSettingsAPI.get()
    pipelineConcurrency.value = Math.max(1, Number(res?.concurrency) || 3)
    pipelineVideoConcurrency.value = Math.max(1, Number(res?.video_concurrency) || 3)
    videoTaskPollTimeoutMinutes.value = Math.max(1, Number(res?.video_generation_timeout_minutes) || 30)
  } catch (_) {}
}

/**
 * 带并发度的批量执行器。
 * @param {Array} items - 需要处理的项目列表
 * @param {number} concurrency - 最大并发数
 * @param {Function} fn - async (item, index) => void，内部可 throw 或 return {paused}
 * @param {{ getLabel?: (item) => string }} options
 * @returns {Promise<{paused: boolean}>}
 */
async function runConcurrently(items, concurrency, fn, options = {}) {
  let index = 0
  let anyPaused = false
  const getLabel = options.getLabel || (() => null)

  async function worker() {
    while (index < items.length) {
      const i = index++
      const item = items[i]
      const label = getLabel(item)
      if (label) pipelineActiveTasks.add(label)
      try {
        const result = await fn(item, i)
        if (result && typeof result === 'object' && result.paused) {
          anyPaused = true
          return
        }
      } finally {
        if (label) pipelineActiveTasks.delete(label)
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  await Promise.allSettled(workers)
  return { paused: anyPaused }
}
// ── Composable: Characters ────────────────────────────
const {
  showEditCharacter, editCharacterForm, editCharacterSaving, editCharacterPromptGenerating,
  extractingCharAppearance, extractingAnchors, addCharRefImage, addCharRefFileInput,
  charactersGenerating, generatingCharIds,
  showCharLibrary, charLibraryList, charLibraryLoading, charLibraryPage, charLibraryPageSize,
  charLibraryTotal, charLibraryKeyword, showEditCharLibrary, editCharLibraryForm,
  editCharLibrarySaving, addingCharToLibraryId, addingCharToMaterialId, addingCharFromLibraryId,
  sd2CertifyingId, showCharSd2Cert, charSd2CertPayload, charSd2TagText,
  charRoleLabel, onGenerateCharacters, openAddCharacter, stopCharacterPromptPoll, editCharacter,
  saveCharRefImageIfAny, submitEditCharacter, doGenerateCharacterPrompt, doExtractCharFromImage,
  extractIdentityAnchors, clearCharRefImage, onCloseCharDialog, onDeleteCharacter, onGenerateCharacterImage,
  loadCharLibraryMembership, isCharInLibrary, isCharInMaterialLibrary,
  loadCharLibraryList, debouncedLoadCharLibrary, openEditCharLibrary, submitEditCharLibrary,
  onDeleteCharLibrary, onAddCharacterToLibrary, onAddCharacterToMaterialLibrary, onSd2CertifyCharacter,
  onSd2CertifyRefresh, openCharSd2CertDialog, onAddCharFromLibrary,
  cleanup: cleanupCharacters,
} = useCharacters({ store, dramaId, currentEpisodeId, getSelectedStyle, getAssetImageModel, loadDrama, pollTask, pollUntilResourceHasImage, hasAssetImage })

// ── Composable: Props ──────────────────────────────────
const {
  showAddProp, addPropSaving, addPropForm,
  showEditProp, editPropForm, editPropSaving, editPropPromptGenerating,
  extractingPropDesc, addPropRefImage, addPropRefFileInput,
  addPropAddRefImage, addPropAddRefFileInput, extractingPropAddDesc,
  propsExtracting, generatingPropIds,
  showPropLibrary, propLibraryList, propLibraryLoading, propLibraryPage, propLibraryPageSize,
  propLibraryTotal, propLibraryKeyword, showEditPropLibrary, editPropLibraryForm,
  editPropLibrarySaving, addingPropToLibraryId, addingPropToMaterialId, addingPropFromLibraryId,
  onExtractProps, stopPropPromptPoll, editProp, doGeneratePropPrompt, savePropRefImageIfAny,
  clearPropRefImage, doExtractPropFromImage, submitEditProp, submitAddProp,
  onClosePropDialog, onDeleteProp, onGeneratePropImage,
  loadPropLibraryMembership, isPropInLibrary, isPropInMaterialLibrary,
  loadPropLibraryList, debouncedLoadPropLibrary, openEditPropLibrary, submitEditPropLibrary,
  onDeletePropLibrary, onAddPropToLibrary, onAddPropToMaterialLibrary, onAddPropFromLibrary,
  doExtractFromRef2,
  cleanup: cleanupProps,
} = usePropsComposable({ store, dramaId, currentEpisodeId, getSelectedStyle, getAssetImageModel, loadDrama, pollTask, pollUntilResourceHasImage, hasAssetImage })

// ── Composable: Scenes ─────────────────────────────────
const {
  showEditScene, editSceneForm, editSceneSaving, editScenePromptGenerating,
  extractingSceneDesc, addSceneRefImage, addSceneRefFileInput,
  scenesExtracting, generatingSceneIds,
  // 场景多视角额外 state（由 FilmCreate 管理）
  showSceneLibrary, sceneLibraryList, sceneLibraryLoading, sceneLibraryPage, sceneLibraryPageSize,
  sceneLibraryTotal, sceneLibraryKeyword, showEditSceneLibrary, editSceneLibraryForm,
  editSceneLibrarySaving, addingSceneToLibraryId, addingSceneToMaterialId, addingSceneFromLibraryId,
  onExtractScenes, openAddScene, stopScenePromptPoll, editScene, doGenerateScenePrompt,
  saveSceneRefImageIfAny, clearSceneRefImage, doExtractSceneFromImage, submitEditScene,
  onCloseSceneDialog, onDeleteScene, onGenerateSceneImage,
  loadSceneLibraryMembership, isSceneInLibrary, isSceneInMaterialLibrary,
  loadSceneLibraryList, debouncedLoadSceneLibrary, openEditSceneLibrary, submitEditSceneLibrary,
  onDeleteSceneLibrary, onAddSceneToLibrary, onAddSceneToMaterialLibrary, onAddSceneFromLibrary,
  cleanup: cleanupScenes,
} = useScenes({ store, dramaId, currentEpisodeId, getSelectedStyle, getAssetImageModel, scriptLanguage, loadDrama, pollTask, pollUntilResourceHasImage, hasAssetImage, dramaAPI })



// 资源管理大面板及子区块折叠状态
const resourcePanelCollapsed = ref(false)
const charactersBlockCollapsed = ref(false)
const propsBlockCollapsed = ref(false)
const scenesBlockCollapsed = ref(false)

// 分镜行内编辑状态（按 storyboard id 存储）
// navCollapsed/storyboardMenuExpanded/toggleNav → 已移至 useNavigation composable

/** 左侧导航各步骤状态 */
const navSteps = computed(() => {
  // 剧本
  const hasScript = !!(scriptContent?.value?.trim())
  const scriptStatus = (storyGenerating.value || scriptGenerating.value)
    ? 'generating'
    : hasScript ? 'done' : 'pending'

  // 角色
  const charList = characters.value || []
  const charDone = charList.length > 0 && charList.every(c => c.image_url)
  const charGen = charactersGenerating.value || generatingCharIds.size > 0
  const charStatus = charGen ? 'generating' : charDone ? 'done' : charList.length > 0 ? 'partial' : 'pending'

  // 道具
  const propList = props.value || []
  const propDone = propList.length > 0 && propList.every(p => p.image_url)
  const propGen = propsExtracting.value || generatingPropIds.size > 0
  const propStatus = propGen ? 'generating' : propDone ? 'done' : propList.length > 0 ? 'partial' : 'pending'

  // 场景
  const sceneList = scenes.value || []
  const sceneDone = sceneList.length > 0 && sceneList.every(s => s.image_url)
  const sceneGen = scenesExtracting.value || generatingSceneIds.size > 0
  const sceneStatus = sceneGen ? 'generating' : sceneDone ? 'done' : sceneList.length > 0 ? 'partial' : 'pending'

  // 分镜脚本
  const sbList = storyboards.value || []
  const sbScriptDone = sbList.length > 0
  const sbScriptGen = storyboardGenerating.value || universalOmniPolishRunning.value
  const sbScriptStatus = sbScriptGen ? 'generating' : sbScriptDone ? 'done' : 'pending'

  // 分镜图
  const sbImgDone = sbList.length > 0 && sbList.every(sb => {
    const imgs = sbImages.value[sb.id]
    return imgs && imgs.length > 0
  })
  const sbImgGen = generatingSbImageIds.size > 0 || batchImageRunning.value
  const sbImgStatus = sbImgGen ? 'generating' : sbImgDone ? 'done' : sbList.length > 0 ? 'partial' : 'pending'

  // 视频
  const sbVideoAllDone = sbList.length > 0 && sbList.every(sb => {
    const vids = sbVideos.value[sb.id]
    return vids && vids.length > 0
  })
  const sbVideoSome = sbList.some(sb => {
    const vids = sbVideos.value[sb.id]
    return vids && vids.length > 0
  })
  const sbVideoGen = batchVideoRunning.value || generatingSbVideoIds.size > 0
  const videoStatus = sbVideoGen ? 'generating' : sbVideoAllDone ? 'done' : sbVideoSome ? 'partial' : 'pending'

  return [
    { key: 'script',   label: '故事剧本',   anchor: 'anchor-script',     status: scriptStatus,    count: hasScript ? 1 : 0 },
    { key: 'chars',    label: '角色',        anchor: 'anchor-characters', status: charStatus,      count: charList.length },
    { key: 'props',    label: '道具',        anchor: 'anchor-props',      status: propStatus,      count: propList.length },
    { key: 'scenes',   label: '场景',        anchor: 'anchor-scenes',     status: sceneStatus,     count: sceneList.length },
    { key: 'sb',       label: '分镜脚本',   anchor: 'anchor-storyboard', status: sbScriptStatus,  count: sbList.length },
    { key: 'sbimg',    label: '分镜图',      anchor: 'anchor-storyboard', status: sbImgStatus,     count: sbList.length },
    { key: 'video',    label: '分镜视频',   anchor: 'anchor-video',      status: videoStatus,     count: 0 },
  ]
})

/** 聚合所有当前正在运行的任务标签，用于悬浮任务面板 */
const allActiveTasks = computed(() => {
  const tasks = []
  // 本集成片流水线
  if (pipelineRunning.value) {
    const step = pipelineCurrentStep.value
    tasks.push(step ? step.replace(/^\[步骤 \d+\/\d+\] /, '') : '本集流水线运行中...')
  }
  // 整体操作
  if (storyGenerating.value || scriptGenerating.value) tasks.push('生成剧本...')
  if (charactersGenerating.value) tasks.push('提取角色...')
  if (propsExtracting.value) tasks.push('提取道具...')
  if (scenesExtracting.value) tasks.push('提取场景...')
  if (storyboardGenerating.value) tasks.push('生成分镜脚本...')
  if (universalOmniPolishRunning.value) {
    const p = universalOmniPolishProgress.value
    tasks.push(`润色全能分镜 ${p.current}/${p.total}${p.label ? ' ' + p.label : ''}`)
  }
  if (batchImageRunning.value) tasks.push('批量生成分镜图...')
  if (batchVideoRunning.value) tasks.push('批量生成分镜视频...')
  // 单个角色图
  for (const id of generatingCharIds) {
    const char = (characters.value || []).find(c => Number(c.id) === Number(id))
    tasks.push('角色图: ' + (char?.name || '#' + id))
  }
  // 单个道具图
  for (const id of generatingPropIds) {
    const prop = (props.value || []).find(p => Number(p.id) === Number(id))
    tasks.push('道具图: ' + (prop?.name || '#' + id))
  }
  // 单个场景图
  for (const id of generatingSceneIds) {
    const scene = (scenes.value || []).find(s => Number(s.id) === Number(id))
    tasks.push('场景图: ' + (scene?.location || '#' + id))
  }
  // 单个分镜图
  for (const id of generatingSbImageIds) {
    const sb = (storyboards.value || []).find(s => Number(s.id) === Number(id))
    tasks.push('分镜图 #' + (sb?.storyboard_number ?? id))
  }
  // 单个分镜视频
  for (const id of generatingSbVideoIds) {
    const sb = (storyboards.value || []).find(s => Number(s.id) === Number(id))
    tasks.push('分镜视频 #' + (sb?.storyboard_number ?? id))
  }
  return tasks
})
const sbCharacterIds = ref({})  // sbId -> number[] 多选角色
const sbPropIds = ref({})       // sbId -> number[] 多选物品
const sbSceneId = ref({})
const sbDialogue = ref({})
const sbNarration = ref({})
const sbShotType = ref({})
/** 视频提示词组成（可编辑），key 为分镜 id */
const sbTitle = ref({})
const sbLocation = ref({})
const sbTime = ref({})
const sbDuration = ref({})
const sbAction = ref({})
const sbResult = ref({})
const sbAtmosphere = ref({})
const sbAngle = ref({})
const sbAngleH = ref({})   // 结构化视角：水平方向
const sbAngleV = ref({})   // 结构化视角：俯仰角度
const sbAngleS = ref({})   // 结构化视角：景别
const sbMovement = ref({})
const sbLighting = ref({})   // 灯光风格
const sbDof = ref({})        // 景深
/** 分镜创作模式：classic | universal（默认 classic，存库 storyboards.creation_mode） */
const sbCreationMode = ref({})
/** 全能模式片段描述（存库 universal_segment_text，与经典参考图字段独立） */
const sbUniversalSegmentText = ref({})
// 分镜图片/视频列表（由 /images?storyboard_id=xx 和 /videos?storyboard_id=xx 拉取）
const sbImages = ref({})
const sbVideos = ref({})
const sbVideoErrors = ref({})
const generatingSbImageIds = reactive(new Set())
const generatingSbVideoIds = reactive(new Set())
const generatingUniversalSegmentIds = reactive(new Set())
/** 经典分镜：流式润色 video_prompt 进行中 */
const classicVideoPolishIds = reactive(new Set())
// 重新生成角色/场景关联分镜图的 loading set，key: 'char-{id}' | 'scene-{id}'
const regenSbImagesForAsset = reactive(new Set())
const regenSbImagesProgress = ref({})
// 批量生成分镜图
const batchImageRunning = ref(false)
const batchImageStopping = ref(false)
const batchImageProgress = ref({ current: 0, total: 0, failed: 0 })
const inferringParams = ref(false)
const showVideoParamsDialog = ref(false)
const videoParamsTarget = ref(null)
const videoParamsSaving = ref(false)
const batchImageErrors = ref([])
// 批量生成分镜视频
const batchVideoRunning = ref(false)
const batchVideoStopping = ref(false)
const batchVideoProgress = ref({ current: 0, total: 0, failed: 0 })
const batchVideoErrors = ref([])
// P0-1: 连贯帧模式
const videoFrameContiguity = ref(false)
// P0-3: 分镜超分辨率 loading set
const upscalingSbIds = reactive(new Set())
// P2-3: 场景多视角 loading set
const generatingSceneMultiViewIds = reactive(new Set())
// P2-4: TTS 状态
const ttsSbIds = reactive(new Set())
const ttsSbNarrationIds = reactive(new Set())
/** 对白 TTS 路径缓存（与 storyboards.audio_local_path 一致） */
const sbDialogueAudioPaths = ref({})
/** 解说旁白 TTS 路径缓存（与 storyboards.narration_audio_local_path 一致） */
const sbNarrationAudioPaths = ref({})
/** 分镜 TTS 试听：避免多条同时播放 */
let sbTtsPreviewAudio = null
/** 正在编辑视频提示词的分镜 id；编辑中显示文本框与保存/取消 */
const editingSbVideoPromptId = ref(null)
const editingSbVideoPromptText = ref('')
/** 正在编辑图片提示词的分镜 id（行内编辑，保留供内部 onSaveSbImagePrompt 使用） */
const editingSbImagePromptId = ref(null)
const editingSbImagePromptText = ref('')

// ── Provide storyboard state for StoryboardSection inject ─────
provide('storyboardSection', {
  sbCharacterIds, sbPropIds, sbSceneId,
  sbDialogue, sbNarration, sbShotType, sbTitle, sbLocation, sbTime, sbDuration,
  sbAction, sbResult, sbAtmosphere, sbAngle, sbAngleH, sbAngleV, sbAngleS,
  sbMovement, sbLighting, sbDof, sbCreationMode, sbUniversalSegmentText,
  sbSelectedImgId, sbSelectedVideoId, sbVideoErrors,
  editingSbVideoPromptId, editingSbVideoPromptText,
  editingSbImagePromptId, editingSbImagePromptText,
  sbDialogueAudioPaths, sbNarrationAudioPaths,
  classicVideoPolishIds,
})

/** 分镜提示词弹窗 */
const showSbPromptDialog = ref(false)
const sbPromptTarget = ref(null)
const sbPromptImageText = ref('')       // 原始 image_prompt
const sbPromptPolishedText = ref('')    // AI 优化后 polished_prompt
const sbPromptVideoText = ref('')       // video_prompt
const sbPromptSaving = ref(false)
const sbPromptPolishing = ref(false)
const uploadingSbImageId = ref(null)
const sbImageFileInput = ref(null)
const sbImageUploadForId = ref(null)
// 角色/道具/场景 上传图片
const resourceImageFileInput = ref(null)
const resourceUploadType = ref(null) // 'character' | 'prop' | 'scene'
const resourceUploadId = ref(null)
const uploadingResourceId = ref(null) // 'char-1' | 'prop-2' | 'scene-3'
const dragOverResourceKey = ref(null) // 'char-1' | 'prop-2' | 'scene-3'
const dragOverSbId = ref(null)
// 公共库弹窗状态已移至各 composable
const storyboardCount = ref(null) // 分镜数量
const videoDuration = ref(null) // 视频总长度
/** 分镜生成时是否要求 AI 输出 narration（解说旁白） */
const storyboardIncludeNarration = ref(false)
/** 分镜生成是否使用全能模式（universal_segment_text，对接 Seedance / 可灵 Omni）；初始 false，进页后按默认视频配置与项目 metadata 再定 */
const storyboardUniversalOmni = ref(false)
/** 与全能分镜链路一致的视频接口规范（与 AI 配置 · 视频 一致） */
const OMNI_VIDEO_API_PROTOCOLS = new Set(['kling_omni', 'volcengine_omni'])

function resolveStoryboardUniversalOmniFromMetadataAndVideoDefault(metadata, videoConfigs) {
  const arr = Array.isArray(videoConfigs) ? videoConfigs : []
  const videoRows = arr.filter((c) => c && c.service_type === 'video')
  const def = videoRows.find((c) => c.is_default) || videoRows[0] || null
  const proto = (def?.api_protocol || '').toString().toLowerCase()
  const omniDefault = OMNI_VIDEO_API_PROTOCOLS.has(proto)
  if (!omniDefault) return false
  return metadata?.storyboard_universal_omni !== false
}

async function fetchStoryboardUniversalOmniForLoad(metadata) {
  try {
    const list = await aiAPI.list('video')
    return resolveStoryboardUniversalOmniFromMetadataAndVideoDefault(metadata, list)
  } catch {
    return metadata?.storyboard_universal_omni !== false
  }
}
const gridMode = ref('single') // 序列图模式：single / quad_grid / nine_grid

// ── 剧本长度 → 估算总时长；自动分镜数与项目「每段秒数」(videoClipDuration) 对齐 ──

/** 用于估算的每段时长（秒），与一键成片处「X秒/段」一致 */
function clipSecondsForStoryboardEstimate() {
  const c = Number(videoClipDuration.value)
  return Math.max(2, Math.min(60, Number.isFinite(c) && c > 0 ? c : 5))
}

/** 由估算总时长与每段秒数得镜数中枢与宽松参考区间（±1 镜） */
function shotCountEstimateFromDurationSec(sec) {
  const s = Math.max(10, Math.min(600, Math.round(Number(sec) || 0)))
  const clip = clipSecondsForStoryboardEstimate()
  const ideal = s / clip
  const locked = Math.max(1, Math.min(200, Math.round(ideal)))
  const minR = Math.max(1, locked - 1)
  const maxR = Math.min(200, locked + 1)
  const range = minR >= maxR ? { min: locked, max: locked } : { min: minR, max: maxR }
  return { locked, range, clip }
}

/** 由剧本字符数粗估成片总时长（短剧偏长镜）：秒数 = round(10 + (字数/600)×60)，夹在 10–600s */
function estimateVideoDurationSecFromCharLen(charLen) {
  const len = Math.max(0, Math.floor(Number(charLen) || 0))
  if (len < 1) return null
  const raw = Math.round(10 + (len / 600) * 60)
  return Math.min(600, Math.max(10, raw))
}

/** 当前剧本下的估算：总秒数、镜数中枢、镜数区间、采用的每段秒数 */
const scriptStoryboardEstimate = computed(() => {
  const script = (scriptContent.value || '').toString().trim()
  const len = script.length
  if (!len) return null
  const sec = estimateVideoDurationSecFromCharLen(len)
  if (sec == null) return null
  const { locked, range, clip } = shotCountEstimateFromDurationSec(sec)
  return { sec, locked, range, clip, len }
})

const scriptEstimateVideoDurationHint = computed(() => {
  const e = scriptStoryboardEstimate.value
  if (!e) return ''
  return `（约 ${e.sec}s）`
})

const scriptEstimateVideoDurationTitle = computed(() => {
  const e = scriptStoryboardEstimate.value
  if (!e) return ''
  return `按当前剧本文本约 ${e.len} 个字符（含标点；常见汉字在浏览器里一字一算，并非按 UTF-8 字节翻倍）、短剧公式 round(10+(字符/600)×60) 粗估总时长约 ${e.sec} 秒；未填输入框时该值会作为约束传给生成接口。仅供参考`
})

const scriptEstimateStoryboardHint = computed(() => {
  const e = scriptStoryboardEstimate.value
  if (!e) return ''
  if (e.range && e.range.min !== e.range.max) {
    return `（约 ${e.locked} 镜，参考 ${e.range.min}–${e.range.max}）`
  }
  return `（约 ${e.locked} 镜）`
})

const scriptEstimateStoryboardTitle = computed(() => {
  const e = scriptStoryboardEstimate.value
  if (!e) return ''
  return `按估算时长 ${e.sec}s ÷ 项目「每段 ${e.clip} 秒」四舍五入粗估约 ${e.locked} 镜；旁注区间为 ±1 镜供参考。切换「X秒/段」会同步改变本估算。`
})

function scriptTextTrimmedForEstimate() {
  return (scriptContent.value || '').toString().trim()
}

function userFilledStoryboardCount() {
  const v = storyboardCount.value
  return v != null && Number.isFinite(Number(v)) && Number(v) >= 1
}

function userFilledVideoDuration() {
  const v = videoDuration.value
  return v != null && Number.isFinite(Number(v)) && Number(v) >= 10
}

/** 请求后端的视频总时长：仅未手动填时传剧本估算 */
function getVideoDurationForApi() {
  if (userFilledVideoDuration()) return Math.round(Number(videoDuration.value))
  const len = scriptTextTrimmedForEstimate().length
  if (len < 1) return undefined
  return estimateVideoDurationSecFromCharLen(len) ?? undefined
}

/** 请求后端的分镜数量：仅未手动填时按「估算总时长 ÷ 每段秒数」推算，与项目 X秒/段 一致 */
function getStoryboardCountForApi() {
  if (userFilledStoryboardCount()) return Math.round(Number(storyboardCount.value))
  const sec = getVideoDurationForApi()
  if (sec == null || !Number.isFinite(sec)) return undefined
  return shotCountEstimateFromDurationSec(sec).locked
}

function getFirstImageFile(dataTransfer) {
  if (!dataTransfer?.files?.length) return null
  const file = Array.from(dataTransfer.files).find((f) => f.type.startsWith('image/'))
  return file || null
}

// ── 参考图文件读取工具 ──────────────────────────────────
function readFileAsRefImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (ev) => resolve({ dataUrl: ev.target.result, filename: file.name })
    reader.readAsDataURL(file)
  })
}

/**
 * 处理角色/道具/场景参考图文件选择（<input type="file"> change 事件）
 * type: 'character' | 'prop' | 'scene'
 */
async function onRefImageFileChange(type, event) {
  const file = event.target?.files?.[0]
  if (!file) return
  const result = await readFileAsRefImage(file)
  if (type === 'character') addCharRefImage.value = result
  else if (type === 'prop') addPropRefImage.value = result
  else if (type === 'scene') addSceneRefImage.value = result
  event.target.value = ''
}

/**
 * 处理角色/道具/场景参考图拖放（drop 事件）
 * type: 'character' | 'prop' | 'scene'
 */
async function onRefImageDrop(type, event) {
  const file = getFirstImageFile(event.dataTransfer)
  if (!file) return
  const result = await readFileAsRefImage(file)
  if (type === 'character') addCharRefImage.value = result
  else if (type === 'prop') addPropRefImage.value = result
  else if (type === 'scene') addSceneRefImage.value = result
}

/**
 * 处理"添加道具"简单弹窗的参考图文件选择
 * type: 'addProp'
 */
async function onRefImageFileChange2(type, event) {
  const file = event.target?.files?.[0]
  if (!file) return
  const result = await readFileAsRefImage(file)
  if (type === 'addProp') addPropAddRefImage.value = result
  event.target.value = ''
}

/**
 * 处理"添加道具"简单弹窗的参考图拖放
 * type: 'addProp'
 */
async function onRefImageDrop2(type, event) {
  const file = getFirstImageFile(event.dataTransfer)
  if (!file) return
  const result = await readFileAsRefImage(file)
  if (type === 'addProp') addPropAddRefImage.value = result
}

/**
 * 从本地选择（尚未保存到服务器）的参考图中提取特征描述
 * type: 'character' | 'prop' | 'scene'
 */
async function doExtractFromRef(type) {
  if (type === 'character') {
    const refImage = addCharRefImage.value
    if (!refImage) return
    extractingCharAppearance.value = true
    try {
      const name = editCharacterForm.value?.name || ''
      const res = await uploadAPI.extractDescriptionFromImage('character', refImage.dataUrl, name)
      if (res?.description && editCharacterForm.value) {
        editCharacterForm.value.appearance = res.description
        ElMessage.success('已从参考图提取外貌描述')
      }
    } catch (e) {
      ElMessage.error(friendlyError(e))
    } finally {
      extractingCharAppearance.value = false
    }
  } else if (type === 'prop') {
    const refImage = addPropRefImage.value
    if (!refImage) return
    extractingPropDesc.value = true
    try {
      const name = editPropForm.value?.name || ''
      const res = await uploadAPI.extractDescriptionFromImage('prop', refImage.dataUrl, name)
      if (res?.description && editPropForm.value) {
        editPropForm.value.description = res.description
        ElMessage.success('已从参考图提取特征描述')
      }
    } catch (e) {
      ElMessage.error(friendlyError(e))
    } finally {
      extractingPropDesc.value = false
    }
  } else if (type === 'scene') {
    const refImage = addSceneRefImage.value
    if (!refImage) return
    extractingSceneDesc.value = true
    try {
      const name = editSceneForm.value?.name || ''
      const res = await uploadAPI.extractDescriptionFromImage('scene', refImage.dataUrl, name)
      if (res?.description && editSceneForm.value) {
        editSceneForm.value.description = res.description
        ElMessage.success('已从参考图提取场景描述')
      }
    } catch (e) {
      ElMessage.error(friendlyError(e))
    } finally {
      extractingSceneDesc.value = false
    }
  }
}

function onResourceDragOver(e, type, id) {
  e.preventDefault()
  e.stopPropagation()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
  const key = type === 'character' ? 'char-' : type === 'prop' ? 'prop-' : 'scene-'
  dragOverResourceKey.value = key + id
}
function onResourceDragLeave(e, key) {
  e.preventDefault()
  if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget)) return
  if (key && dragOverResourceKey.value !== key) return
  dragOverResourceKey.value = null
}
function onResourceDrop(e, type, id) {
  e.preventDefault()
  e.stopPropagation()
  dragOverResourceKey.value = null
  const file = getFirstImageFile(e.dataTransfer)
  if (file) doUploadResourceImage(type, id, file)
}
function onSbImageDragOver(e, sbId) {
  e.preventDefault()
  e.stopPropagation()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
  dragOverSbId.value = sbId
}
function onSbImageDragLeave(e, sbId) {
  e.preventDefault()
  if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget)) return
  if (sbId != null && dragOverSbId.value !== sbId) return
  dragOverSbId.value = null
}
function onSbImageDrop(e, sb) {
  e.preventDefault()
  e.stopPropagation()
  dragOverSbId.value = null
  const file = getFirstImageFile(e.dataTransfer)
  if (file && sb?.id) doUploadSbImage(sb.id, file)
}

const baseUrl = ref('')
const previewImageUrl = ref(null)
function imageUrl(url) {
  if (!url) return ''
  if (url.startsWith('http')) return url
  const base = (baseUrl.value || '').replace(/\/$/, '')
  return base ? base + '/' + url.replace(/^\//, '') : url
}
function getSelectedStyle() {
  return getSelectedStylePrompt()
}
function openImagePreview(url) {
  previewImageUrl.value = url
}
function closeImagePreview() {
  previewImageUrl.value = null
}
/** 视频地址：优先 local_path（/static/），否则 video_url */
function assetVideoUrl(item) {
  if (!item) return ''
  const localPath = item.local_path && String(item.local_path).trim()
  if (localPath) return '/static/' + localPath.replace(/^\//, '')
  if (item.video_url) return imageUrl(item.video_url)
  return ''
}
/** 列表项是否具备可播放地址（避免仅有空白 local_path 时外层有卡片、内层无 <video>） */
function recordHasPlayableVideoUrl(i) {
  if (!i) return false
  const u = i.video_url && String(i.video_url).trim()
  const lp = i.local_path && String(i.local_path).trim()
  return !!(u || lp)
}
/** 主播放器强制随记录/地址重建，避免重新生成后 <video> 仍缓存旧 src */
function sbMainVideoPlayerKey(sbId) {
  const v = getSbVideo(sbId)
  if (!v) return ''
  const src = assetVideoUrl(v)
  return `${v.id}:${v.updated_at || ''}:${src.slice(0, 160)}`
}
/** 该分镜是否有图（接口拉取的或 composed_image） */
function hasSbImage(sb) {
  return !!(getSbImage(sb.id) || (sb && (sb.composed_image || sb.image_url)))
}
/** 取该分镜下所有已完成的非四宫格图片列表 */
function getSbAllImages(storyboardId) {
  const list = sbImages.value[storyboardId]
  if (!Array.isArray(list)) return []
  return list.filter((i) => i.status === 'completed' && i.frame_type !== 'quad_grid' && i.frame_type !== 'nine_grid' && (i.image_url || i.local_path))
}
/** 取当前主图（尊重 sbSelectedImgId 选择，否则默认第一张） */
function getSbImage(storyboardId) {
  const images = getSbAllImages(storyboardId)
  if (!images.length) return null
  const selectedId = sbSelectedImgId.value[storyboardId]
  if (selectedId != null) {
    const found = images.find((i) => i.id === selectedId)
    if (found) return found
  }
  return images[0]
}
/** 取该分镜下的四宫格整图记录 */
/** 取该分镜下的四宫格整图记录 */
function getQuadGridImage(storyboardId) {
  const list = sbImages.value[storyboardId]
  if (!Array.isArray(list)) return null
  return list.find((i) => i.status === 'completed' && (i.frame_type === 'quad_grid' || i.frame_type === 'nine_grid') && (i.image_url || i.local_path)) || null
}
/** 取该分镜所有已完成的视频记录 */
function getSbAllVideos(storyboardId) {
  const list = sbVideos.value[storyboardId]
  if (!Array.isArray(list)) return []
  return list.filter((i) => i.status === 'completed' && recordHasPlayableVideoUrl(i))
}
/** 取该分镜当前选中的视频（尊重 sbSelectedVideoId，否则默认第一条） */
function getSbVideo(storyboardId) {
  const all = getSbAllVideos(storyboardId)
  if (all.length === 0) return null
  const selectedId = sbSelectedVideoId.value[storyboardId]
  if (selectedId != null) {
    const found = all.find((v) => v.id === selectedId)
    if (found) return found
  }
  return all[0]
}
/** 视频历史条：返回非当前选中的已完成视频列表 */
function getVideoStripItems(storyboardId) {
  const all = getSbAllVideos(storyboardId)
  const current = getSbVideo(storyboardId)
  return all
    .filter((v) => !current || v.id !== current.id)
    .map((v, idx) => ({
      key: `vid-${v.id}`,
      video: v,
      src: assetVideoUrl(v),
      label: `历史${idx + 2}`,
    }))
}
/** 选中某条历史视频为当前视频，并持久化到分镜记录供合成视频使用 */
function onSelectSbMainVideo(sb, video) {
  sbSelectedVideoId.value = { ...sbSelectedVideoId.value, [sb.id]: video.id }
  storyboardsAPI.update(sb.id, {
    video_url: video.video_url || null,
    local_path: video.local_path || undefined,
  }).catch(e => console.warn('[主视频] 保存后端失败', e))
}
/** 取该分镜最近一次视频生成的错误信息（从 API 返回的记录或本地即时错误） */
function getSbVideoError(storyboardId) {
  if (sbVideoErrors.value[storyboardId]) return sbVideoErrors.value[storyboardId]
  const list = sbVideos.value[storyboardId]
  if (!Array.isArray(list) || list.length === 0) return ''
  const hasCompleted = list.some((i) => i.status === 'completed' && recordHasPlayableVideoUrl(i))
  if (hasCompleted) return ''
  const failed = list.filter((i) => i.status === 'failed' && i.error_msg)
  if (failed.length === 0) return ''
  return failed[0].error_msg
}

async function loadStoryboardMedia() {
  const boards = store.storyboards || []
  if (boards.length === 0) {
    sbImages.value = {}
    sbVideos.value = {}
    return
  }
  const nextImages = { ...sbImages.value }
  const nextVideos = { ...sbVideos.value }
  await Promise.all(
    boards.map(async (sb) => {
      try {
        const [imgRes, vidRes] = await Promise.all([
          imagesAPI.list({ storyboard_id: sb.id, page: 1, page_size: 100 }),
          videosAPI.list({ storyboard_id: sb.id, page: 1, page_size: 50 })
        ])
        nextImages[sb.id] = (imgRes && imgRes.items) ? imgRes.items : []
        nextVideos[sb.id] = (vidRes && vidRes.items) ? vidRes.items : []
      } catch (_) {
        nextImages[sb.id] = []
        nextVideos[sb.id] = []
      }
    })
  )
  sbImages.value = nextImages
  sbVideos.value = nextVideos
  // 从后端恢复主图选择
  restoreSelectionsFromBackend()
}

/** 只刷新单条分镜的图片/视频，避免每次单图操作都全量请求所有分镜 */
async function loadSingleStoryboardMedia(sbId) {
  if (!sbId) return
  try {
    const [imgRes, vidRes] = await Promise.all([
      imagesAPI.list({ storyboard_id: sbId, page: 1, page_size: 100 }),
      videosAPI.list({ storyboard_id: sbId, page: 1, page_size: 50 })
    ])
    sbImages.value = {
      ...sbImages.value,
      [sbId]: (imgRes && imgRes.items) ? imgRes.items : []
    }
    sbVideos.value = {
      ...sbVideos.value,
      [sbId]: (vidRes && vidRes.items) ? vidRes.items : []
    }
    restoreSelectionsFromBackend()
  } catch (_) {
    // 静默忽略，不影响其他分镜的显示
  }
}

// ── 主图选择 ─────────────────────────────────────────────────────────

const sbSelectedImgId = ref({})   // sbId → 选中的 image_generation.id
const sbSelectedVideoId = ref({}) // sbId → 选中的 video_generation.id

/**
 * 从后端 storyboard.image_url / local_path 恢复主图选择状态。
 * 与 image_generation 记录比对，找到匹配的记录并恢复 sbSelectedImgId。
 */
function restoreSelectionsFromBackend() {
  const boards = store.storyboards || []
  for (const sb of boards) {
    if (sbSelectedImgId.value[sb.id] != null) continue
    const sbPath = (sb.local_path || '').trim()
    const sbUrl  = (sb.image_url  || '').trim()
    if (!sbPath && !sbUrl) continue
    const images = getSbAllImages(sb.id)
    const matched = images.find((img) =>
      (sbPath && img.local_path && img.local_path === sbPath) ||
      (sbUrl  && img.image_url  && img.image_url  === sbUrl)
    )
    if (matched) {
      sbSelectedImgId.value = { ...sbSelectedImgId.value, [sb.id]: matched.id }
    }
  }
}

/** 获取缩略图条数据：主图以外的所有已完成图片（四宫格子图 + 普通历史图） */
function getStripItems(storyboardId) {
  const allImgs = getSbAllImages(storyboardId)
  const mainImg = getSbImage(storyboardId)
  return allImgs
    .filter((img) => !mainImg || img.id !== mainImg.id)
    .map((img) => ({
      key: `img-${img.id}`,
      src: assetImageUrl(img),
      type: 'img',
      img,
      label: quadPanelLabel(img.frame_type),
      prompt: img.prompt || '',
    }))
}

/** 宫格子图位置标签 */
function quadPanelLabel(frameType) {
  const map = {
    quad_panel_0: '左上', quad_panel_1: '右上', quad_panel_2: '左下', quad_panel_3: '右下',
    nine_panel_0: '左上', nine_panel_1: '中上', nine_panel_2: '右上',
    nine_panel_3: '左中', nine_panel_4: '中间', nine_panel_5: '右中',
    nine_panel_6: '左下', nine_panel_7: '中下', nine_panel_8: '右下',
  }
  return map[frameType] || null
}

/** 点击缩略图条中的图片切换为主图 */
function onSelectStripItem(sb, item) {
  onSelectSbMainImage(sb, item.img)
}

/** 选定某张 API 图为主图（持久化到后端） */
function onSelectSbMainImage(sb, img) {
  sbSelectedImgId.value = { ...sbSelectedImgId.value, [sb.id]: img.id }
  storyboardsAPI.update(sb.id, {
    image_url: img.image_url || null,
    local_path: img.local_path || undefined,
  }).catch(e => console.warn('[主图] 保存后端失败', e))
}

// ──────────────────────────────────────────────────────────────────────

async function onGenerateSbImage(sb) {
  if (!dramaId.value || !sb?.id) return
  sb.errorMsg = ''
  sb.error_msg = ''
  generatingSbImageIds.add(sb.id)
  try {
    // 仅当本页已同步过该分镜的角色勾选状态时落库（避免用「空数组」误清空未初始化的分镜）
    const localCharIds = sbCharacterIds.value[sb.id]
    if (localCharIds !== undefined) {
      try {
        await storyboardsAPI.update(sb.id, { character_ids: Array.isArray(localCharIds) ? localCharIds : [] })
      } catch (e) {
        console.warn('[分镜图] 保存角色勾选失败', e)
        ElMessage.warning('保存分镜角色失败，请稍后重试')
        return
      }
    }
    const res = await imagesAPI.create({
      storyboard_id: sb.id,
      drama_id: dramaId.value,
      prompt: sb.polished_prompt || sb.image_prompt || sb.description || '',
      model: undefined,
      style: getSelectedStyle(),
      frame_type: gridMode.value !== 'single' ? gridMode.value : undefined,
      aspect_ratio: projectAspectRatio.value || '16:9',
    })
    ElMessage.success('分镜图生成任务已提交')
    if (res?.task_id) {
      const pollRes = await pollTask(res.task_id, () => loadSingleStoryboardMedia(sb.id))
      if (pollRes?.status === 'failed') {
        sb.errorMsg = pollRes.error || '生成失败'
      } else {
        ElMessage.success('分镜图生成完成')
      }
    } else {
      await loadSingleStoryboardMedia(sb.id)
    }
  } catch (e) {
    console.error(e)
    sb.errorMsg = e.message || '生成失败'
    ElMessage.error(friendlyError(e))
  } finally {
    generatingSbImageIds.delete(sb.id)
  }
}

function onUploadSbImageClick(sb) {
  if (!sb?.id) return
  sbImageUploadForId.value = sb.id
  if (sbImageFileInput.value) {
    sbImageFileInput.value.value = ''
    sbImageFileInput.value.click()
  }
}

async function doUploadSbImage(sbId, file) {
  if (!file || !sbId || !dramaId.value) return
  uploadingSbImageId.value = sbId
  try {
    const res = await uploadAPI.uploadImage(file, { dramaId: dramaId.value })
    const url = res?.url || res?.path
    const localPath = res?.local_path
    if (!url && !localPath) {
      ElMessage.error('上传未返回地址')
      return
    }
    await imagesAPI.upload({
      storyboard_id: sbId,
      drama_id: dramaId.value,
      image_url: url || '',
      local_path: localPath || undefined
    })
    ElMessage.success('上传成功')
    // 清除手动选择，让最新上传的图（images[0]）自动成为主图
    const { [sbId]: _r, ...rest } = sbSelectedImgId.value
    sbSelectedImgId.value = rest
    await loadSingleStoryboardMedia(sbId)
  } catch (e) {
    ElMessage.error(friendlyError(e))
  } finally {
    uploadingSbImageId.value = null
  }
}

function onSbImageFileChange(ev) {
  const file = ev.target?.files?.[0]
  const sid = sbImageUploadForId.value
  if (!file || !sid) {
    ev.target.value = ''
    return
  }
  doUploadSbImage(sid, file).finally(() => {
    sbImageUploadForId.value = null
    ev.target.value = ''
  })
}

function syncStoryboardStateFromEpisode(ep) {
  const boards = ep?.storyboards || []
  const nextCharIds = {}
  const nextPropIds = {}
  const nextScene = {}
  const nextDialogue = {}
  const nextNarration = {}
  const nextShot = {}
  const nextTitle = {}
  const nextLocation = {}
  const nextTime = {}
  const nextDuration = {}
  const nextAction = {}
  const nextResult = {}
  const nextAtmosphere = {}
  const nextAngle = {}
  const nextAngleH = {}
  const nextAngleV = {}
  const nextAngleS = {}
  const nextMovement = {}
  const nextLighting = {}
  const nextDof = {}
  const nextCreationMode = {}
  const nextUniversalSegment = {}
  for (const sb of boards) {
    nextScene[sb.id] = sb.scene_id ?? null
    nextDialogue[sb.id] = sb.dialogue ?? ''
    nextNarration[sb.id] = sb.narration ?? ''
    nextShot[sb.id] = (sb.shot_type ?? '').toString() || ''
    nextTitle[sb.id] = (sb.title ?? '').toString()
    nextLocation[sb.id] = (sb.location ?? '').toString()
    nextTime[sb.id] = (sb.time ?? '').toString()
    nextDuration[sb.id] = sb.duration != null ? Number(sb.duration) : 5
    nextAction[sb.id] = (sb.action ?? '').toString()
    nextResult[sb.id] = (sb.result ?? '').toString()
    nextAtmosphere[sb.id] = (sb.atmosphere ?? '').toString()
    nextAngle[sb.id] = (sb.angle ?? '').toString()
    nextAngleH[sb.id] = sb.angle_h || ''
    nextAngleV[sb.id] = sb.angle_v || ''
    nextAngleS[sb.id] = sb.angle_s || ''
    nextMovement[sb.id] = (sb.movement ?? '').toString()
    nextLighting[sb.id] = sb.lighting_style || ''
    nextDof[sb.id] = sb.depth_of_field || ''
    const charList = Array.isArray(sb.characters) ? sb.characters : (sb.characters != null ? [sb.characters] : [])
    nextCharIds[sb.id] = charList.map((c) => (typeof c === 'object' && c != null ? Number(c.id) : Number(c))).filter((n) => Number.isFinite(n))
    nextPropIds[sb.id] = Array.isArray(sb.prop_ids) ? sb.prop_ids : []
    nextCreationMode[sb.id] = sb.creation_mode === 'universal' ? 'universal' : 'classic'
    nextUniversalSegment[sb.id] = (sb.universal_segment_text ?? '').toString()
  }
  sbCharacterIds.value = nextCharIds
  sbPropIds.value = nextPropIds
  sbSceneId.value = nextScene
  sbDialogue.value = nextDialogue
  sbNarration.value = nextNarration
  sbShotType.value = nextShot
  sbTitle.value = nextTitle
  sbLocation.value = nextLocation
  sbTime.value = nextTime
  sbDuration.value = nextDuration
  sbAction.value = nextAction
  sbResult.value = nextResult
  sbAtmosphere.value = nextAtmosphere
  sbAngle.value = nextAngle
  sbAngleH.value = nextAngleH
  sbAngleV.value = nextAngleV
  sbAngleS.value = nextAngleS
  sbMovement.value = nextMovement
  sbLighting.value = nextLighting
  sbDof.value = nextDof
  sbCreationMode.value = nextCreationMode
  sbUniversalSegmentText.value = nextUniversalSegment
}

function onEpisodeSelect(epId) {
  if (epId == null) {
    store.setCurrentEpisode(null)
    store.setScriptContent('')
    scriptTitle.value = ''
    syncStoryboardStateFromEpisode(null)
    return
  }
  const list = store.drama?.episodes || []
  const ep = list.find((e) => Number(e.id) === Number(epId))
  if (!ep) return
  store.setCurrentEpisode(ep)
  store.setScriptContent(ep.script_content || '')
  scriptTitle.value = ep.title || '第' + (ep.episode_number || 0) + '集'
  syncStoryboardStateFromEpisode(ep)
  loadStoryboardMedia()
}

async function refreshLibraryMembership() {
  await Promise.allSettled([
    loadCharLibraryMembership(),
    loadPropLibraryMembership(),
    loadSceneLibraryMembership(),
  ])
}

// loadDrama 请求去重：多个轮询同时触发时只发一次请求
let _loadDramaPromise = null

async function _doLoadDrama() {
  if (!store.dramaId) return
  try {
    let d = await dramaAPI.get(store.dramaId)
    d = await backfillDramaStylePromptMetadataIfNeeded(dramaAPI, store.dramaId, d)
    store.setDrama(d)
    // 恢复「故事生成」框的梗概（项目 description 存的是故事梗概）
    storyInput.value = (d.description || '').toString().trim()
    storyStyle.value = (d.metadata && d.metadata.story_style) ? d.metadata.story_style : ''
    storyType.value = d.genre || ''
    generationStyle.value = d.style || ''
    projectAspectRatio.value = (d.metadata && d.metadata.aspect_ratio) ? d.metadata.aspect_ratio : '16:9'
    assetImageModel.value = (d.metadata && d.metadata.asset_image_model) ? String(d.metadata.asset_image_model) : ''
    videoClipDuration.value = (d.metadata && d.metadata.video_clip_duration) ? Number(d.metadata.video_clip_duration) : 5
    storyboardIncludeNarration.value = !!(d.metadata && d.metadata.storyboard_include_narration)
    storyboardUniversalOmni.value = await fetchStoryboardUniversalOmniForLoad(d.metadata)
    const list = d.episodes || []
    // 优先保持当前选中的集（按 id 在最新列表中查找），避免 AI 生成角色等操作后误切到其他集
    const currentId = selectedEpisodeId.value
    let ep = currentId != null ? list.find((e) => Number(e.id) === Number(currentId)) : null
    if (!ep) {
      const wantNum = savedCurrentEpisodeNumber.value
      ep = list.find((e) => Number(e.episode_number) === Number(wantNum)) || list[0] || null
    }
    store.setCurrentEpisode(ep)
    if (ep) {
      store.setScriptContent(ep.script_content || '')
      scriptTitle.value = ep.title || '第' + (ep.episode_number || 0) + '集'
      selectedEpisodeId.value = ep.id
    } else {
      store.setScriptContent('')
      scriptTitle.value = ''
      selectedEpisodeId.value = null
    }
    await refreshLibraryMembership()
    syncStoryboardStateFromEpisode(ep)
    await loadStoryboardMedia()
  } catch (e) {
    ElMessage.error(friendlyError(e))
  }
}

async function loadDrama() {
  if (_loadDramaPromise) return _loadDramaPromise
  _loadDramaPromise = _doLoadDrama()
  try {
    return await _loadDramaPromise
  } finally {
    _loadDramaPromise = null
  }
}

const EMPTY_ARR = []
/** 当前分镜已选角色 id 列表（供 el-select 绑定） */
function getSbCharacterIds(sbId) {
  const arr = sbCharacterIds.value[sbId]
  return Array.isArray(arr) && arr.length > 0 ? arr : EMPTY_ARR
}

function setSbCharacterIds(sbId, v) {
  const next = Array.isArray(v) ? v : []
  sbCharacterIds.value = { ...sbCharacterIds.value, [sbId]: next }
  onStoryboardCharacterChange(sbId)
}

/** 当前分镜尚未勾选的角色（供缩略图旁「+」下拉添加） */
function charactersAvailableToAddToSb(sbId) {
  const all = characters.value ?? []
  const cur = new Set((getSbCharacterIds(sbId) || []).map((x) => Number(x)))
  return all.filter((c) => c && !cur.has(Number(c.id)))
}

function onSbAddCharacterCommand(sbId, charId) {
  const id = Number(charId)
  if (!Number.isFinite(id)) return
  const cur = [...(getSbCharacterIds(sbId) || [])]
  if (cur.some((x) => Number(x) === id)) return
  cur.push(id)
  setSbCharacterIds(sbId, cur)
}

/** 当前分镜已选物品 id 列表 */
function getSbPropIds(sbId) {
  const arr = sbPropIds.value[sbId]
  return Array.isArray(arr) && arr.length > 0 ? arr : EMPTY_ARR
}

function setSbPropIds(sbId, v) {
  sbPropIds.value = { ...sbPropIds.value, [sbId]: Array.isArray(v) ? v : [] }
  onStoryboardPropChange(sbId)
}

function onStoryboardPropChange(sbId) {
  const ids = sbPropIds.value[sbId] || []
  storyboardsAPI.update(sbId, { prop_ids: ids }).catch(() => {})
}

/** 当前分镜选中的场景对象（用于下方缩略图） */
function getSbSelectedScene(sbId) {
  const sceneId = sbSceneId.value[sbId]
  if (sceneId == null) return null
  const list = scenes.value ?? []
  return list.find((s) => Number(s.id) === Number(sceneId)) || null
}

/** 当前分镜选中的角色对象列表（用于下方缩略图） */
function getSbSelectedCharacters(sbId) {
  const ids = getSbCharacterIds(sbId)
  if (!ids.length) return []
  const list = characters.value ?? []
  return ids.map((id) => list.find((c) => Number(c.id) === Number(id))).filter(Boolean)
}

/** 当前分镜选中的物品对象列表（用于下方缩略图） */
function getSbSelectedProps(sbId) {
  const ids = getSbPropIds(sbId)
  if (!ids.length) return []
  const list = props.value ?? []
  return ids.map((id) => list.find((p) => Number(p.id) === Number(id))).filter(Boolean)
}

async function onStoryboardCharacterChange(sbId) {
  const ids = sbCharacterIds.value[sbId] || []
  try {
    await storyboardsAPI.update(sbId, { character_ids: ids })
  } catch (e) {
    console.warn('[分镜] 保存角色失败', e)
  }
}

function onStoryboardSceneChange(sbId) {
  const sceneId = sbSceneId.value[sbId] ?? null
  storyboardsAPI.update(sbId, { scene_id: sceneId }).catch(() => {})
}

/** 返回包含指定角色的所有分镜（已排序） */
function getCharAffectedStoryboards(charId) {
  return (storyboards.value || []).filter((sb) => {
    if (!sb.characters) return false
    const chars = Array.isArray(sb.characters) ? sb.characters : []
    return chars.some((c) => Number(typeof c === 'object' && c != null ? c.id : c) === Number(charId))
  })
}

/** 返回指定场景关联的所有分镜 */
function getSceneAffectedStoryboards(sceneId) {
  return (storyboards.value || []).filter((sb) => sb.scene_id != null && Number(sb.scene_id) === Number(sceneId))
}

/** 点击分镜 chip → 滚动到对应分镜行 */
function scrollToStoryboard(sbId) {
  const el = document.getElementById('sb-' + sbId)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

/** 对关联分镜批量重新生成图片 */
async function onRegenAffectedSbImages(assetKey, affectedBoards) {
  if (!affectedBoards.length || regenSbImagesForAsset.has(assetKey)) return
  try {
    await ElMessageBox.confirm(
      `将为 ${affectedBoards.length} 个关联分镜重新生成图片（#${affectedBoards.map((s) => s.storyboard_number).join('、#')}），原有图片将被覆盖，是否继续？`,
      '重新生成关联分镜图',
      { confirmButtonText: '确认生成', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return
  }
  regenSbImagesForAsset.add(assetKey)
  // 用 Map 存进度以便响应式更新
  if (!regenSbImagesProgress.value) regenSbImagesProgress.value = {}
  regenSbImagesProgress.value[assetKey] = { current: 0, total: affectedBoards.length }
  let failed = 0
  try {
    for (let i = 0; i < affectedBoards.length; i++) {
      regenSbImagesProgress.value[assetKey] = { current: i + 1, total: affectedBoards.length }
      const sb = affectedBoards[i]
      try {
        const res = await imagesAPI.create({
          storyboard_id: sb.id,
          drama_id: dramaId.value,
          prompt: sb.polished_prompt || sb.image_prompt || sb.description || '',
          style: getSelectedStyle(),
          aspect_ratio: projectAspectRatio.value || '16:9',
        })
        if (res?.task_id) {
          const pollRes = await new Promise((resolve) => {
            const maxAttempts = 180
            let attempts = 0
            const tick = async () => {
              attempts++
              try {
                const t = await taskAPI.get(res.task_id)
                if (t.status === 'completed') { await loadSingleStoryboardMedia(sb.id); return resolve({ status: 'completed' }) }
                if (t.status === 'failed') return resolve({ status: 'failed', error: t.error || '任务失败' })
              } catch (_) {}
              if (attempts < maxAttempts) setTimeout(tick, 2000)
              else resolve({ status: 'timeout' })
            }
            setTimeout(tick, 2000)
          })
          if (pollRes?.status !== 'completed') failed++
        } else {
          await loadSingleStoryboardMedia(sb.id)
        }
      } catch (_) {
        failed++
      }
      if (i < affectedBoards.length - 1) await new Promise((r) => setTimeout(r, 500))
    }
    if (failed === 0) ElMessage.success(`已重新生成 ${affectedBoards.length} 张关联分镜图`)
    else ElMessage.warning(`完成，${failed}/${affectedBoards.length} 条失败`)
  } finally {
    regenSbImagesForAsset.delete(assetKey)
    if (regenSbImagesProgress.value) delete regenSbImagesProgress.value[assetKey]
  }
}

function updateStoryboardDialogue(sbId) {
  // 可在此防抖后调用后端更新 dialogue
}

/** 将当前剧本内容保存到后端（创建/更新项目与集数），供「保存剧本」与「AI 生成」后自动保存共用 */
async function saveScriptToBackend(content) {
  const trimmed = (content ?? '').toString().trim()
  if (!trimmed) return
  let dramaId = store.dramaId
  const curEp = store.currentEpisode
  if (!dramaId) {
    const drama = await dramaAPI.create({
      title: scriptTitle.value || '新故事',
      description: storyInput.value?.trim() || trimmed.slice(0, 200),
      genre: storyType.value || undefined,
      style: generationStyle.value || undefined,
      metadata: {
        ...projectStylePromptMetadata(),
        story_style: storyStyle.value || undefined,
        aspect_ratio: projectAspectRatio.value || '16:9',
      }
    })
    store.setDrama(drama)
    dramaId = drama.id
    savedCurrentEpisodeNumber.value = 1
    const episodes = [{ episode_number: 1, title: scriptTitle.value || '第1集', script_content: trimmed }]
    await dramaAPI.saveEpisodes(dramaId, episodes)
    await loadDrama()
    if (route.params.id === 'new') {
      router.replace('/film/' + dramaId)
    }
    return { created: true }
  }
  const episodes = store.drama?.episodes || []
  savedCurrentEpisodeNumber.value = curEp?.episode_number ?? 1
  const updated = episodes.map((ep, i) => {
    const num = ep.episode_number ?? i + 1
    const isCurrent = curEp && Number(ep.id) === Number(curEp.id)
    return {
      episode_number: num,
      title: isCurrent ? (scriptTitle.value || '第' + num + '集') : (ep.title || ''),
      script_content: isCurrent ? trimmed : (ep.script_content || ''),
      description: ep.description,
      duration: ep.duration
    }
  })
  if (updated.length === 0) {
    updated.push({ episode_number: 1, title: scriptTitle.value || '第1集', script_content: trimmed })
  }
  await dramaAPI.saveEpisodes(dramaId, updated)
  if (storyInput.value?.trim()) {
    await dramaAPI.saveOutline(dramaId, {
      summary: storyInput.value.trim(),
      genre: storyType.value || undefined,
      style: generationStyle.value || undefined,
      metadata: {
        ...projectStylePromptMetadata(),
        story_style: storyStyle.value || undefined,
        aspect_ratio: projectAspectRatio.value || '16:9',
      }
    }).catch(() => {})
  }
  await loadDrama()
  return { created: false }
}

/**
 * @param {boolean} includeGenerationStyle - 仅在选择「画面风格」为 true：写入 dramas.style 与 style_prompt_*。
 * 其它项目设置改为 false，避免界面未刷新时仍用旧的 generationStyle 覆盖外部已更新的画风（如直接调 API PUT outline）。
 */
async function saveProjectSettings(includeGenerationStyle = false) {
  if (!store.dramaId) return
  const metadata = {
    story_style: storyStyle.value || undefined,
    aspect_ratio: projectAspectRatio.value || '16:9',
    asset_image_model: (assetImageModel.value || '').trim() || undefined,
    video_clip_duration: videoClipDuration.value || 5,
    storyboard_include_narration: !!storyboardIncludeNarration.value,
    storyboard_universal_omni: !!storyboardUniversalOmni.value,
  }
  if (includeGenerationStyle) {
    Object.assign(metadata, projectStylePromptMetadata())
  }
  const payload = {
    genre: storyType.value || undefined,
    metadata,
  }
  if (includeGenerationStyle) {
    payload.style = generationStyle.value || undefined
  }
  dramaAPI.saveOutline(store.dramaId, payload).catch(e => console.error('Settings auto-save failed', e))
}

async function onGenerateStory() {
  const text = (storyInput.value || '').trim()
  if (!text) {
    ElMessage.warning('请先输入故事梗概')
    return
  }
  const existingDramaId = store.dramaId
  if (existingDramaId) {
    const eps = store.drama?.episodes || []
    const hasExistingScript = eps.some((ep) => String(ep.script_content ?? '').trim().length > 0)
    if (hasExistingScript) {
      generateStorySaveMode.value = 'overwrite'
      showGenerateStoryModeDialog.value = true
      return
    }
  }
  await executeGenerateStory({ append: false })
}

async function onConfirmGenerateStoryMode() {
  const append = generateStorySaveMode.value === 'append'
  showGenerateStoryModeDialog.value = false
  await executeGenerateStory({ append })
}

/**
 * @param {{ append: boolean }} opts append=true 时在保留当前 store 中剧集的前提下追加新集；false 为整剧按本次生成结果替换
 */
async function executeGenerateStory(opts) {
  const append = !!opts?.append
  const text = (storyInput.value || '').trim()
  if (!text) {
    ElMessage.warning('请先输入故事梗概')
    return
  }
  storyGenerating.value = true
  try {
    const rawEp = Number(storyEpisodeCount.value)
    const episodeCount = Number.isFinite(rawEp)
      ? Math.min(6, Math.max(1, Math.round(rawEp)))
      : 6
    const res = await generationAPI.generateStory({
      premise: text,
      style: storyStyle.value || undefined,
      type: storyType.value || undefined,
      episode_count: episodeCount,
    })

    const episodes = res?.episodes || []
    if (episodes.length === 0) {
      ElMessage.error('AI 未能生成剧本，请重试')
      return
    }

    scriptGenerating.value = true
    try {
      let dramaId = store.dramaId
      if (!dramaId) {
        const drama = await dramaAPI.create({
          title: scriptTitle.value || '新故事',
          description: text,
          genre: storyType.value || undefined,
          style: generationStyle.value || undefined,
          metadata: {
            ...projectStylePromptMetadata(),
            story_style: storyStyle.value || undefined,
            aspect_ratio: projectAspectRatio.value || '16:9',
          }
        })
        store.setDrama(drama)
        dramaId = drama.id
        if (route.params.id === 'new') {
          router.replace('/film/' + dramaId)
        }
      }

      let existingList = [...(store.drama?.episodes || [])].sort(
        (a, b) => (Number(a.episode_number) || 0) - (Number(b.episode_number) || 0)
      )
      if (append && dramaId) {
        try {
          const fresh = await dramaAPI.get(dramaId)
          const serverEps = [...(fresh.episodes || [])].sort(
            (a, b) => (Number(a.episode_number) || 0) - (Number(b.episode_number) || 0)
          )
          if (serverEps.length > 0) existingList = serverEps
        } catch (_) {
          /* 拉取失败时仍用当前 store 中的列表 */
        }
      }
      let epPayload
      let selectEpisodeNumber = 1

      if (append && dramaId && existingList.length > 0) {
        const maxNum = Math.max(0, ...existingList.map((e) => Number(e.episode_number) || 0))
        const kept = existingList.map((ep) => ({
          episode_number: Number(ep.episode_number) || 0,
          title: ep.title || '',
          script_content: ep.script_content ?? '',
          description: ep.description ?? null,
          duration: ep.duration ?? 0,
        }))
        const appended = episodes.map((ep, i) => ({
          episode_number: maxNum + i + 1,
          title: ep.title || `第${maxNum + i + 1}集`,
          script_content: ep.content || '',
          description: ep.description ?? null,
          duration: ep.duration ?? 0,
        }))
        epPayload = [...kept, ...appended]
        selectEpisodeNumber = maxNum + 1
        savedCurrentEpisodeNumber.value = selectEpisodeNumber
      } else {
        epPayload = episodes.map((ep, i) => ({
          episode_number: ep.episode ?? i + 1,
          title: ep.title || `第${ep.episode ?? i + 1}集`,
          script_content: ep.content || '',
          description: ep.description ?? null,
          duration: ep.duration ?? 0,
        }))
        savedCurrentEpisodeNumber.value = 1
        selectEpisodeNumber = 1
      }

      await dramaAPI.saveEpisodes(dramaId, epPayload)

      await dramaAPI.saveOutline(dramaId, {
        summary: text,
        genre: storyType.value || undefined,
        style: generationStyle.value || undefined,
        metadata: {
          ...projectStylePromptMetadata(),
          story_style: storyStyle.value || undefined,
          aspect_ratio: projectAspectRatio.value || '16:9',
        }
      }).catch(() => {})

      await loadDrama()

      const epList = store.drama?.episodes || []
      const targetEp =
        epList.find((e) => Number(e.episode_number) === selectEpisodeNumber) || epList[0]
      if (targetEp) {
        selectedEpisodeId.value = targetEp.id
        onEpisodeSelect(targetEp.id)
      }

      const n = episodes.length
      if (append && existingList.length > 0) {
        ElMessage.success(n > 1 ? `已追加 ${n} 集，已定位到新增的第一集` : '已追加 1 集')
      } else {
        ElMessage.success(n > 1 ? `剧本已生成，共 ${n} 集，已默认选中第1集` : '剧本已生成并已保存')
      }
    } catch (e) {
      ElMessage.error(friendlyError(e))
    } finally {
      scriptGenerating.value = false
    }
  } catch (e) {
    ElMessage.error(friendlyError(e))
  } finally {
    storyGenerating.value = false
  }
}

function novelImportReset() {
  novelText.value = ''
  novelFileName.value = ''
  novelFileContent.value = ''
}

function onNovelFileChange(file) {
  novelFileName.value = file.name
  const reader = new FileReader()
  reader.onload = (ev) => { novelFileContent.value = ev.target.result }
  reader.readAsText(file.raw || file, 'utf-8')
}

async function onImportNovel() {
  const text = novelImportMode.value === 'file' ? novelFileContent.value : novelText.value
  if (!text?.trim()) {
    ElMessage.warning('请输入或上传小说内容')
    return
  }
  novelImporting.value = true
  try {
    const formData = new FormData()
    if (novelImportMode.value === 'file' && novelFileContent.value) {
      const blob = new Blob([novelFileContent.value], { type: 'text/plain' })
      formData.append('file', blob, novelFileName.value || 'novel.txt')
    } else {
      formData.append('text', text)
    }
    formData.append('title', scriptTitle.value || '导入小说')
    formData.append('max_chapters', String(novelMaxChapters.value))
    formData.append('ai_summarize', String(novelAiSummarize.value))
    const { default: axios } = await import('axios')
    const baseURL = (await import('@/utils/request')).default.defaults.baseURL || '/api/v1'
    const res = await axios.post(`${baseURL}/dramas/import-novel`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    const chapters = res.data?.data?.chapters || res.data?.chapters || []
    if (!chapters.length) {
      ElMessage.warning('未能识别到章节内容')
      return
    }
    // 将章节内容填入剧本区域（合并所有集）
    const combinedScript = chapters.map((ch, i) =>
      `【第${i + 1}集：${ch.title}】\n${ch.script || ch.content}`
    ).join('\n\n---\n\n')
    store.setScriptContent(combinedScript)
    ElMessage.success(`成功导入 ${chapters.length} 个章节，请继续编辑剧本`)
    showNovelImport.value = false
    novelImportReset()
  } catch (e) {
    ElMessage.error(friendlyError(e))
  } finally {
    novelImporting.value = false
  }
}

async function onGenerateScript() {
  const content = (scriptContent.value ?? store.scriptContent ?? '').toString().trim()
  if (!content) {
    ElMessage.warning('请先在「故事生成」中点击 AI 生成，或手动输入剧本内容')
    return
  }
  scriptGenerating.value = true
  try {
    const result = await saveScriptToBackend(content)
    if (result?.created) {
      ElMessage.success('项目已创建，剧本已保存')
    } else {
      ElMessage.success('剧本已保存')
    }
  } catch (e) {
    ElMessage.error(friendlyError(e))
  } finally {
    scriptGenerating.value = false
  }
}

async function onAddEpisode() {
  if (!store.dramaId) return
  const list = store.drama?.episodes || []
  const nextNum = list.length > 0
    ? Math.max(...list.map((e) => Number(e.episode_number) || 0), 0) + 1
    : 1
  const updated = list.map((ep, i) => ({
    episode_number: ep.episode_number ?? i + 1,
    title: ep.title || '第' + (ep.episode_number ?? i + 1) + '集',
    script_content: ep.script_content || '',
    description: ep.description,
    duration: ep.duration
  }))
  updated.push({
    episode_number: nextNum,
    title: '第' + nextNum + '集',
    script_content: '',
    description: null,
    duration: 0
  })
  try {
    await dramaAPI.saveEpisodes(store.dramaId, updated)
    savedCurrentEpisodeNumber.value = nextNum
    await loadDrama()
    ElMessage.success('已添加第' + nextNum + '集')
  } catch (e) {
    ElMessage.error(friendlyError(e))
  }
}

function onUploadResourceClick(type, id) {
  resourceUploadType.value = type
  resourceUploadId.value = id
  resourceImageFileInput.value?.click()
}

// 解析 extra_images JSON，返回 local_path 数组
function parseExtraImages(item) {
  if (!item?.extra_images) return []
  try {
    const arr = typeof item.extra_images === 'string' ? JSON.parse(item.extra_images) : item.extra_images
    return Array.isArray(arr) ? arr.filter(Boolean) : []
  } catch { return [] }
}

// 查找角色/道具/场景在 store 中的当前对象
function findResource(type, id) {
  const list = type === 'character' ? (store.characters ?? [])
    : type === 'prop' ? (store.props ?? [])
    : (store.scenes ?? [])
  return list.find((x) => Number(x.id) === Number(id)) || null
}

async function doUploadResourceImage(type, id, file) {
  if (!file || !type || id == null) return
  const key = type === 'character' ? 'char-' : type === 'prop' ? 'prop-' : 'scene-'
  uploadingResourceId.value = key + id
  try {
    const res = await uploadAPI.uploadImage(file, { dramaId: dramaId.value })
    const data = res?.data ?? res
    const uploadedLocalPath = data?.local_path || data?.path || null
    const url = data?.url || uploadedLocalPath
    if (!url) { ElMessage.error('上传未返回地址'); return }

    const current = findResource(type, id)
    const hasPrimary = !!(current?.local_path || current?.image_url)

    if (hasPrimary) {
      // 已有主图 → 追加到 extra_images
      const extras = parseExtraImages(current)
      const newPath = uploadedLocalPath || url
      if (!extras.includes(newPath)) extras.push(newPath)
      const extraJson = JSON.stringify(extras)
      if (type === 'character') {
        await characterAPI.putImage(id, { extra_images: extraJson })
      } else if (type === 'prop') {
        await propAPI.update(id, { extra_images: extraJson })
      } else if (type === 'scene') {
        await sceneAPI.update(id, { extra_images: extraJson })
      }
    } else {
      // 无主图 → 设为主图
      if (type === 'character') {
        await characterAPI.putImage(id, { image_url: url, local_path: uploadedLocalPath ?? null })
      } else if (type === 'prop') {
        await propAPI.update(id, { image_url: url, local_path: uploadedLocalPath ?? null })
      } else if (type === 'scene') {
        await sceneAPI.update(id, { image_url: url, local_path: uploadedLocalPath ?? null })
      }
    }
    await loadDrama()
    ElMessage.success('上传成功')
  } catch (e) {
    ElMessage.error(friendlyError(e))
  } finally {
    uploadingResourceId.value = null
  }
}

// 将某张额外图片设为主图（主图降级到 extra_images 第一位）
async function onSetPrimaryImage(type, item, extraPath) {
  const extras = parseExtraImages(item)
  const oldPrimary = item.local_path || ''
  const newExtras = extras.filter((p) => p !== extraPath)
  if (oldPrimary) newExtras.unshift(oldPrimary)
  const extraJson = JSON.stringify(newExtras)
  try {
    if (type === 'character') {
      await characterAPI.putImage(item.id, { local_path: extraPath, image_url: '', extra_images: extraJson })
    } else if (type === 'prop') {
      await propAPI.update(item.id, { local_path: extraPath, image_url: '', extra_images: extraJson })
    } else if (type === 'scene') {
      await sceneAPI.update(item.id, { local_path: extraPath, image_url: '', extra_images: extraJson })
    }
    await loadDrama()
  } catch (e) {
    ElMessage.error(friendlyError(e))
  }
}

// 删除某张额外图片
async function onRemoveExtraImage(type, item, extraPath) {
  const extras = parseExtraImages(item).filter((p) => p !== extraPath)
  const extraJson = extras.length ? JSON.stringify(extras) : null
  try {
    if (type === 'character') {
      await characterAPI.putImage(item.id, { extra_images: extraJson })
    } else if (type === 'prop') {
      await propAPI.update(item.id, { extra_images: extraJson })
    } else if (type === 'scene') {
      await sceneAPI.update(item.id, { extra_images: extraJson })
    }
    await loadDrama()
  } catch (e) {
    ElMessage.error(friendlyError(e))
  }
}

function onResourceImageFileChange(ev) {
  const file = ev.target?.files?.[0]
  const type = resourceUploadType.value
  const id = resourceUploadId.value
  if (!file || !type || id == null) {
    ev.target.value = ''
    return
  }
  doUploadResourceImage(type, id, file).finally(() => {
    resourceUploadType.value = null
    resourceUploadId.value = null
    ev.target.value = ''
  })
}


function getSbFirstFrameUrl(sb) {
  const img = getSbImage(sb.id)
  if (img && (img.image_url || img.local_path)) return assetImageUrl(img)
  if (sb.composed_image || sb.image_url) return imageUrl(sb.composed_image || sb.image_url)
  return ''
}

/** 获取分镜主图的本地路径（用于超分辨率判断） */
function getSbLocalImage(sb) {
  const img = getSbImage(sb.id)
  return img?.local_path || sb.local_path || null
}

/**
 * P0-1: 从视频 URL 捕获末帧（浏览器 canvas 方案）
 * 返回 Blob（JPEG），失败返回 null
 */
async function captureVideoLastFrame(videoUrl) {
  return new Promise((resolve) => {
    if (!videoUrl) return resolve(null)
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.muted = true
    video.preload = 'metadata'
    let captured = false
    const timeout = setTimeout(() => { if (!captured) resolve(null) }, 12000)
    video.addEventListener('error', () => { clearTimeout(timeout); if (!captured) resolve(null) })
    video.addEventListener('loadedmetadata', () => {
      video.currentTime = Math.max(0, video.duration - 0.5)
    })
    video.addEventListener('seeked', () => {
      if (captured) return
      captured = true
      clearTimeout(timeout)
      try {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth || 512
        canvas.height = video.videoHeight || 288
        const ctx = canvas.getContext('2d')
        ctx.drawImage(video, 0, 0)
        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.85)
      } catch (_) {
        resolve(null)
      }
    })
    video.src = videoUrl
  })
}

/** P0-3: 对分镜图执行超分辨率（2x） */
async function onUpscaleSbImage(sb) {
  if (!sb?.id || upscalingSbIds.has(sb.id)) return
  upscalingSbIds.add(sb.id)
  try {
    await storyboardsAPI.upscale(sb.id)
    ElMessage.success('超分完成，图片已更新为高清版本')
    await loadSingleStoryboardMedia(sb.id)
  } catch (e) {
    ElMessage.error(friendlyError(e))
  } finally {
    upscalingSbIds.delete(sb.id)
  }
}

function normalizeAudioRelPath(raw) {
  const s = String(raw != null ? raw : '').trim().replace(/^\//, '')
  return s
}

/** 对白 TTS 相对路径 */
function sbDialogueAudioRelPath(sb) {
  if (!sb?.id) return ''
  const fromCache = sbDialogueAudioPaths.value[sb.id]
  const fromRow = sb.audio_local_path
  const raw = (fromCache != null && String(fromCache).trim() !== '') ? fromCache : (fromRow != null ? fromRow : '')
  return normalizeAudioRelPath(raw)
}

/** 解说旁白 TTS 相对路径 */
function sbNarrationAudioRelPath(sb) {
  if (!sb?.id) return ''
  const fromCache = sbNarrationAudioPaths.value[sb.id]
  const fromRow = sb.narration_audio_local_path
  const raw = (fromCache != null && String(fromCache).trim() !== '') ? fromCache : (fromRow != null ? fromRow : '')
  return normalizeAudioRelPath(raw)
}

function playSbTtsFromRel(rel) {
  if (!rel) return
  const url = `/static/${rel}`
  try {
    if (sbTtsPreviewAudio) {
      sbTtsPreviewAudio.pause()
      sbTtsPreviewAudio = null
    }
    const a = new Audio(url)
    sbTtsPreviewAudio = a
    a.addEventListener('ended', () => {
      if (sbTtsPreviewAudio === a) sbTtsPreviewAudio = null
    })
    a.play().catch(() => {
      ElMessage.warning('无法播放音频，请检查文件是否存在')
      if (sbTtsPreviewAudio === a) sbTtsPreviewAudio = null
    })
  } catch (_) {
    ElMessage.warning('无法播放音频')
  }
}

function playSbDialogueTts(sb) {
  playSbTtsFromRel(sbDialogueAudioRelPath(sb))
}

function playSbNarrationTts(sb) {
  playSbTtsFromRel(sbNarrationAudioRelPath(sb))
}

/** P2-4: 为分镜对白生成 TTS 配音 */
async function onTtsSbDialogue(sb) {
  if (!sb?.id || ttsSbIds.has(sb.id)) return
  if (!sb.dialogue?.trim()) {
    ElMessage.warning('该分镜没有对白内容')
    return
  }
  ttsSbIds.add(sb.id)
  try {
    const res = await fetch('/api/v1/audio/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storyboard_id: sb.id, text: sb.dialogue, tts_kind: 'dialogue' }),
    })
    const data = await res.json()
    const businessOk = data.success === true || Number(data.code) === 200
    if (!res.ok || !businessOk) {
      throw new Error(data.error?.message || data.message || '配音失败')
    }
    if (data.data?.local_path) {
      sbDialogueAudioPaths.value = { ...sbDialogueAudioPaths.value, [sb.id]: data.data.local_path }
      sb.audio_local_path = data.data.local_path
      ElMessage.success('配音已生成')
    }
  } catch (e) {
    ElMessage.error(friendlyError(e))
  } finally {
    ttsSbIds.delete(sb.id)
  }
}

/** 为分镜解说旁白生成 TTS（与对白共用接口，文本不同） */
async function onTtsSbNarration(sb) {
  if (!sb?.id || ttsSbNarrationIds.has(sb.id)) return
  const text = ((sbNarration.value[sb.id] ?? sb.narration) || '').toString().trim()
  if (!text) {
    ElMessage.warning('该分镜没有解说旁白内容')
    return
  }
  ttsSbNarrationIds.add(sb.id)
  try {
    const res = await fetch('/api/v1/audio/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storyboard_id: sb.id, text, tts_kind: 'narration' }),
    })
    const data = await res.json()
    const businessOk = data.success === true || Number(data.code) === 200
    if (!res.ok || !businessOk) {
      throw new Error(data.error?.message || data.message || '解说配音失败')
    }
    if (data.data?.local_path) {
      sbNarrationAudioPaths.value = { ...sbNarrationAudioPaths.value, [sb.id]: data.data.local_path }
      sb.narration_audio_local_path = data.data.local_path
      ElMessage.success('解说配音已生成')
    }
  } catch (e) {
    ElMessage.error(friendlyError(e))
  } finally {
    ttsSbNarrationIds.delete(sb.id)
  }
}

function formatSrtTimestamp(ms) {
  if (!Number.isFinite(ms) || ms < 0) ms = 0
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  const z = Math.floor(ms % 1000)
  const p2 = (n) => String(n).padStart(2, '0')
  return `${p2(h)}:${p2(m)}:${p2(s)},${String(z).padStart(3, '0')}`
}

/** 按分镜顺序与 duration 累计时间轴，导出非空解说为 SRT */
function onExportNarrationSrt() {
  const boards = storyboards.value || []
  if (!boards.length) {
    ElMessage.warning('暂无分镜')
    return
  }
  let tMs = 0
  const lines = []
  let idx = 1
  for (const sb of boards) {
    const durSec = Number(sbDuration.value[sb.id] ?? sb.duration)
    const sec = Number.isFinite(durSec) && durSec > 0 ? durSec : 5
    const durMs = Math.round(sec * 1000)
    const text = ((sbNarration.value[sb.id] ?? sb.narration) || '').toString().trim()
    if (text) {
      const start = formatSrtTimestamp(tMs)
      const end = formatSrtTimestamp(tMs + durMs)
      lines.push(String(idx++), `${start} --> ${end}`, text, '')
    }
    tMs += durMs
  }
  if (!lines.length) {
    ElMessage.warning('当前分镜没有可导出的解说文案')
    return
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `narration-${currentEpisodeId.value || 'episode'}.srt`
  a.click()
  URL.revokeObjectURL(a.href)
  ElMessage.success('已下载解说 SRT')
}

async function onSaveSbNarrationField(sb) {
  if (!sb?.id) return
  const next = (sbNarration.value[sb.id] || '').toString().trim()
  const prev = (sb.narration || '').toString().trim()
  if (next === prev) return
  try {
    await storyboardsAPI.update(sb.id, { narration: next || null })
    const list = store.currentEpisode?.storyboards
    if (Array.isArray(list)) {
      const row = list.find((x) => Number(x.id) === Number(sb.id))
      if (row) row.narration = next || null
    }
  } catch (_) { /* 静默失败，避免打断输入 */ }
}

function isSbUniversalMode(sbId) {
  return sbCreationMode.value[sbId] === 'universal'
}

function setSbCreationModeId(sbId, mode) {
  if (sbId == null) return
  const m = mode === 'universal' ? 'universal' : 'classic'
  sbCreationMode.value = { ...sbCreationMode.value, [sbId]: m }
}

async function onToggleSbUniversalMode(sb) {
  if (!sb?.id) return
  const cur = isSbUniversalMode(sb.id) ? 'universal' : 'classic'
  const next = cur === 'universal' ? 'classic' : 'universal'
  sbCreationMode.value = { ...sbCreationMode.value, [sb.id]: next }
  try {
    await storyboardsAPI.update(sb.id, { creation_mode: next })
    const list = store.currentEpisode?.storyboards
    if (Array.isArray(list)) {
      const row = list.find((x) => Number(x.id) === Number(sb.id))
      if (row) row.creation_mode = next
    }
  } catch (e) {
    sbCreationMode.value = { ...sbCreationMode.value, [sb.id]: cur }
    ElMessage.error(friendlyError(e))
  }
}

async function onSaveUniversalSegmentField(sb) {
  if (!sb?.id) return
  const next = (sbUniversalSegmentText.value[sb.id] || '').toString()
  const prev = (sb.universal_segment_text || '').toString()
  if (next === prev) return
  try {
    await storyboardsAPI.update(sb.id, { universal_segment_text: next.trim() || null })
    const list = store.currentEpisode?.storyboards
    if (Array.isArray(list)) {
      const row = list.find((x) => Number(x.id) === Number(sb.id))
      if (row) row.universal_segment_text = next.trim() || null
    }
  } catch (_) { /* 静默失败，避免打断输入 */ }
}

function universalSegmentDurationSecForSb(sb) {
  const dUi = Number(sbDuration.value[sb?.id])
  const dRow = Number(sb?.duration)
  const dProj = Number(videoClipDuration.value)
  return Number.isFinite(dUi) && dUi > 0
    ? dUi
    : Number.isFinite(dRow) && dRow > 0
      ? dRow
      : Number.isFinite(dProj) && dProj > 0
        ? dProj
        : 5
}

/** 全能片段：@图片N → Grok 视频占位 <IMAGE_N>（与 Omni 链路的 @图片 标识区分） */
function universalSegmentAtImageToGrokTags(text) {
  return (text || '').replace(/@图片(\d+)/g, '<IMAGE_$1>')
}

function onUniversalSegmentToGrokVideoTags(sb) {
  if (!sb?.id) return
  const raw = (sbUniversalSegmentText.value[sb.id] ?? '').toString()
  if (!raw.trim()) {
    ElMessage.warning('请先填写或生成片段描述')
    return
  }
  const next = universalSegmentAtImageToGrokTags(raw)
  if (next === raw) {
    ElMessage.info('未找到 @图片N 标记，无需转换')
    return
  }
  sbUniversalSegmentText.value = { ...sbUniversalSegmentText.value, [sb.id]: next }
  void onSaveUniversalSegmentField(sb)
  ElMessage.success('已改为 Grok 视频占位符格式（<IMAGE_N>）')
}

function onUniversalSegmentPromptMenu(sb, cmd) {
  if (cmd === 'generate') onGenerateUniversalSegmentPrompt(sb, {})
  else if (cmd === 'generate-force') onGenerateUniversalSegmentPrompt(sb, { forceWithoutReferenceImages: true })
  else if (cmd === 'polish') onPolishUniversalSegmentPromptStream(sb, {})
  else if (cmd === 'polish-force') onPolishUniversalSegmentPromptStream(sb, { forceWithoutReferenceImages: true })
  else if (cmd === 'to-grok-video-tags') onUniversalSegmentToGrokVideoTags(sb)
}

/** 全能模式：根据当前分镜结构化字段流式生成片段描述（NDJSON） */
async function onGenerateUniversalSegmentPrompt(sb, opts = {}) {
  if (!sb?.id || generatingUniversalSegmentIds.has(sb.id)) return
  const force = !!opts.forceWithoutReferenceImages
  generatingUniversalSegmentIds.add(sb.id)
  let live = ''
  try {
    const durationSec = universalSegmentDurationSecForSb(sb)
    const data = await storyboardsAPI.generateUniversalSegmentPromptStream(
      sb.id,
      { duration: durationSec, ...(force ? { force_without_reference_images: true } : {}) },
      (delta) => {
        live += delta
        sbUniversalSegmentText.value = { ...sbUniversalSegmentText.value, [sb.id]: live }
      }
    )
    const text = (data?.universal_segment_text ?? '').toString().trim()
    if (!text) {
      ElMessage.warning('未收到完整生成结果，请重试')
      return
    }
    sbUniversalSegmentText.value = { ...sbUniversalSegmentText.value, [sb.id]: text }
    const list = store.currentEpisode?.storyboards
    if (Array.isArray(list)) {
      const row = list.find((x) => Number(x.id) === Number(sb.id))
      if (row) row.universal_segment_text = text
    }
    ElMessage.success(force ? '已强制生成全能片段提示词（无图模式）' : '已根据分镜生成全能片段提示词')
  } catch (e) {
    ElMessage.error(friendlyError(e))
  } finally {
    generatingUniversalSegmentIds.delete(sb.id)
  }
}

/** 经典分镜：结合剧本与邻镜流式润色 video_prompt（服务端 NDJSON，落库 storyboards.video_prompt） */
async function onPolishClassicVideoPromptStream(sb, opts = {}) {
  const fromDialog = !!opts.fromDialog
  if (!sb?.id || classicVideoPolishIds.has(sb.id)) return
  if (isSbUniversalMode(sb.id)) {
    ElMessage.warning('当前为全能模式，请使用「润色全能提示词」')
    return
  }
  classicVideoPolishIds.add(sb.id)
  let live = ''
  const draftPayload = fromDialog
    ? (sbPromptVideoText.value || '').toString()
    : (sb.video_prompt || '').toString()
  try {
    const data = await storyboardsAPI.polishClassicVideoPromptStream(
      sb.id,
      { draft_video_prompt: draftPayload },
      (delta) => {
        live += delta
        if (fromDialog) sbPromptVideoText.value = live
        const row = (storyboards.value || []).find((x) => Number(x.id) === Number(sb.id))
        if (row) row.video_prompt = live
      }
    )
    const text = (data?.video_prompt ?? '').toString().trim()
    if (!text) {
      ElMessage.warning('未收到完整润色结果，请重试')
      return
    }
    if (fromDialog) sbPromptVideoText.value = text
    const row = (storyboards.value || []).find((x) => Number(x.id) === Number(sb.id))
    if (row) row.video_prompt = text
    ElMessage.success('分镜视频提示词已润色并保存')
  } catch (e) {
    ElMessage.error(friendlyError(e))
  } finally {
    classicVideoPolishIds.delete(sb.id)
  }
}

/** 全能模式：结合剧本与邻镜流式润色片段描述（服务端 NDJSON） */
async function onPolishUniversalSegmentPromptStream(sb, opts = {}) {
  if (!sb?.id || generatingUniversalSegmentIds.has(sb.id)) return
  const force = !!opts.forceWithoutReferenceImages
  const draft = sbUniversalSegmentTrimmed(sb)
  if (!draft) {
    ElMessage.warning('请先填写或生成片段描述后再润色')
    return
  }
  generatingUniversalSegmentIds.add(sb.id)
  let live = ''
  try {
    const durationSec = universalSegmentDurationSecForSb(sb)
    const data = await storyboardsAPI.polishUniversalSegmentPromptStream(
      sb.id,
      {
        duration: durationSec,
        draft_universal_segment_text: draft,
        ...(force ? { force_without_reference_images: true } : {}),
      },
      (delta) => {
        live += delta
        sbUniversalSegmentText.value = { ...sbUniversalSegmentText.value, [sb.id]: live }
      }
    )
    const text = (data?.universal_segment_text ?? '').toString().trim()
    if (!text) {
      ElMessage.warning('未收到完整润色结果，请重试')
      return
    }
    sbUniversalSegmentText.value = { ...sbUniversalSegmentText.value, [sb.id]: text }
    const list = store.currentEpisode?.storyboards
    if (Array.isArray(list)) {
      const row = list.find((x) => Number(x.id) === Number(sb.id))
      if (row) row.universal_segment_text = text
    }
    ElMessage.success(force ? '全能片段已强制润色并保存（无图模式）' : '全能片段提示词已润色并保存')
  } catch (e) {
    ElMessage.error(friendlyError(e))
  } finally {
    generatingUniversalSegmentIds.delete(sb.id)
  }
}

/**
 * 分镜脚本生成完成后：按镜序逐个流式润色全能片段（服务端已落库）。
 * @param {{ checkPause?: () => Promise<void>, onShotProgress?: (cur:number,total:number,sb:object)=>void, onShotError?: (sb:object,msg:string)=>void }} opts
 */
async function polishUniversalSegmentsAfterGeneration(opts = {}) {
  const checkPause = typeof opts.checkPause === 'function' ? opts.checkPause : async () => {}
  const onShotProgress = typeof opts.onShotProgress === 'function' ? opts.onShotProgress : null
  const onShotError = typeof opts.onShotError === 'function' ? opts.onShotError : null

  if (!storyboardUniversalOmni.value) return { polished: 0, skipped: true }

  const rawList = store.currentEpisode?.storyboards || []
  const list = rawList.slice().sort((a, b) => (Number(a.storyboard_number) || 0) - (Number(b.storyboard_number) || 0))
  const targets = list.filter((sb) => sb?.id && isSbUniversalMode(sb.id) && sbUniversalSegmentTrimmed(sb))

  if (!targets.length) return { polished: 0, skipped: true }

  universalOmniPolishRunning.value = true
  universalOmniPolishProgress.value = { current: 0, total: targets.length, label: '' }
  let polished = 0
  try {
    for (let i = 0; i < targets.length; i++) {
      await checkPause()
      const sb = targets[i]
      const cur = i + 1
      const label = '#' + (sb.storyboard_number ?? cur) + (sb.title ? ' ' + String(sb.title).slice(0, 20) : '')
      universalOmniPolishProgress.value = { current: cur, total: targets.length, label }
      if (onShotProgress) onShotProgress(cur, targets.length, sb)

      const draft = sbUniversalSegmentTrimmed(sb)
      if (!draft) continue

      generatingUniversalSegmentIds.add(sb.id)
      let live = ''
      try {
        const durationSec = universalSegmentDurationSecForSb(sb)
        const data = await storyboardsAPI.polishUniversalSegmentPromptStream(
          sb.id,
          {
            duration: durationSec,
            draft_universal_segment_text: draft,
            force_without_reference_images: true,
          },
          (delta) => {
            live += delta
            sbUniversalSegmentText.value = { ...sbUniversalSegmentText.value, [sb.id]: live }
          }
        )
        const text = (data?.universal_segment_text ?? '').toString().trim()
        if (text) {
          polished += 1
          sbUniversalSegmentText.value = { ...sbUniversalSegmentText.value, [sb.id]: text }
          const storyList = store.currentEpisode?.storyboards
          if (Array.isArray(storyList)) {
            const row = storyList.find((x) => Number(x.id) === Number(sb.id))
            if (row) row.universal_segment_text = text
          }
        }
      } catch (e) {
        const msg = e?.message || String(e)
        if (onShotError) onShotError(sb, msg)
        else ElMessage.warning(`分镜 #${sb.storyboard_number ?? sb.id} 全能润色失败：${msg}`)
      } finally {
        generatingUniversalSegmentIds.delete(sb.id)
      }
      await pipelineRest()
    }
  } finally {
    universalOmniPolishRunning.value = false
    universalOmniPolishProgress.value = { current: 0, total: 0, label: '' }
  }
  return { polished, skipped: false }
}

/** P2-3: 生成场景多视角图 */
async function onGenerateSceneMultiView(scene) {
  if (!scene?.id || generatingSceneMultiViewIds.has(scene.id)) return
  generatingSceneMultiViewIds.add(scene.id)
  try {
    const { sceneAPI: sceneAPIMultiView } = await import('@/api/scenes')
    const res = await sceneAPIMultiView.generateFourViewImage(scene.id)
    if (res?.image_generation?.id) {
      ElMessage.success('多视角生成任务已提交，稍后刷新查看结果')
    } else {
      ElMessage.success('多视角生成任务已提交')
    }
    await loadDrama()
  } catch (e) {
    ElMessage.error(friendlyError(e))
  } finally {
    generatingSceneMultiViewIds.delete(scene.id)
  }
}

/** 为视频生成获取参考图的真实 URL */
async function getMainImageUrlForVideo(sb) {
  return getSbFirstFrameUrl(sb)
}

/** 转为视频接口可请求的绝对 URL（后端/第三方需能访问） */
function toAbsoluteImageUrl(url) {
  if (!url || !String(url).trim()) return ''
  const s = String(url).trim()
  if (s.startsWith('http://') || s.startsWith('https://')) return s
  const base = (baseUrl.value || '').replace(/\/$/, '') || (typeof window !== 'undefined' ? window.location.origin : '')
  return base ? base + (s.startsWith('/') ? s : '/' + s) : s
}

function sbUniversalSegmentTrimmed(sb) {
  if (!sb?.id) return ''
  return (sbUniversalSegmentText.value[sb.id] ?? sb.universal_segment_text ?? '').toString().trim()
}

function sbCanSubmitVideo(sb) {
  if (!sb) return false
  const vp = (sb.video_prompt || '').toString().trim()
  if (vp) return true
  if (isSbUniversalMode(sb.id)) return !!sbUniversalSegmentTrimmed(sb)
  return false
}

/** 提交给视频 API 的文案：全能模式有片段描述时仅提交该段（不拼接 video_prompt，避免动作/旁白盖过 @图片 等编排） */
function buildSbVideoPromptForApi(sb) {
  const vp = (sb.video_prompt || '').toString().trim()
  const seg = sbUniversalSegmentTrimmed(sb)
  if (isSbUniversalMode(sb.id)) {
    if (seg) return seg
    return vp
  }
  return vp
}

/** 全能槽位里场景的展示名（与制作页场景卡一致：主用地点，不用易空的 name） */
function pickSceneOmniSlotName(scene) {
  if (!scene) return '场景'
  const loc = (scene.location && String(scene.location).trim()) || ''
  if (loc) return loc
  const n = (scene.name && String(scene.name).trim()) || ''
  if (n) return n
  const p = (scene.prompt && String(scene.prompt).trim()) || ''
  if (p) return p.length > 36 ? `${p.slice(0, 36)}…` : p
  const d = (scene.description && String(scene.description).trim()) || ''
  if (d) return d.length > 36 ? `${d.slice(0, 36)}…` : d
  return '场景'
}

/** 全能模式：与 collectSbOmniReferenceAbsoluteUrls 同序的参考槽位（用于 @ 选择器缩略图） */
function getSbUniversalOmniRefSlots(sb) {
  if (!sb?.id) return []
  const out = []
  let idx = 1
  const scene = getSbSelectedScene(sb.id)
  if (scene && hasAssetImage(scene)) {
    out.push({
      index: idx++,
      kind: 'scene',
      name: pickSceneOmniSlotName(scene),
      thumbUrl: assetImageUrl(scene),
    })
  }
  for (const c of getSbSelectedCharacters(sb.id)) {
    if (hasAssetImage(c)) {
      out.push({
        index: idx++,
        kind: 'character',
        name: (c.name || '角色').toString(),
        thumbUrl: assetImageUrl(c),
      })
    }
  }
  for (const p of getSbSelectedProps(sb.id)) {
    if (hasAssetImage(p)) {
      out.push({
        index: idx++,
        kind: 'prop',
        name: (p.name || '物品').toString(),
        thumbUrl: assetImageUrl(p),
      })
    }
  }
  return out
}

/** 全能模式：场景/角色/物品 → 绝对 URL 列表（不含经典分镜中间主图；供可灵 Omni / 火山多图参考，最多 10，方舟侧最多取 9 张） */
function collectSbOmniReferenceAbsoluteUrls(sb) {
  if (!sb?.id) return []
  const urls = []
  const seen = new Set()
  function pushAbs(u) {
    const abs = toAbsoluteImageUrl(u)
    if (!abs || seen.has(abs)) return
    seen.add(abs)
    urls.push(abs)
  }
  const scene = getSbSelectedScene(sb.id)
  if (scene && hasAssetImage(scene)) pushAbs(assetImageUrl(scene))
  for (const c of getSbSelectedCharacters(sb.id)) {
    if (hasAssetImage(c)) pushAbs(assetImageUrl(c))
  }
  for (const p of getSbSelectedProps(sb.id)) {
    if (hasAssetImage(p)) pushAbs(assetImageUrl(p))
  }
  return urls.slice(0, 10)
}

function onEditSbImagePrompt(sb) {
  if (!sb?.id) return
  editingSbImagePromptId.value = sb.id
  editingSbImagePromptText.value = (sb.image_prompt || '').toString()
}

async function onOpenSbPromptDialog(sb) {
  if (!sb?.id) return
  // 先用缓存数据快速打开弹窗，避免等待感
  sbPromptTarget.value = sb
  sbPromptImageText.value = (sb.image_prompt || '').toString()
  sbPromptPolishedText.value = (sb.polished_prompt || '').toString()
  sbPromptVideoText.value = (sb.video_prompt || '').toString()
  showSbPromptDialog.value = true
  // 后台拉取最新数据（图片生成后 polished_prompt 可能已被写入）
  try {
    const fresh = await storyboardsAPI.get(sb.id)
    if (fresh?.id) {
      sbPromptTarget.value = fresh
      sbPromptImageText.value = (fresh.image_prompt || '').toString()
      sbPromptPolishedText.value = (fresh.polished_prompt || '').toString()
      sbPromptVideoText.value = (fresh.video_prompt || '').toString()
    }
  } catch (_) {}
}

async function onPolishSbPrompt() {
  const sb = sbPromptTarget.value
  if (!sb?.id) return
  sbPromptPolishing.value = true
  try {
    const res = await storyboardsAPI.polishPrompt(sb.id)
    if (res?.polished_prompt) {
      sbPromptPolishedText.value = res.polished_prompt
      ElMessage.success('优化提示词已生成')
    }
  } catch (e) {
    ElMessage.error(friendlyError(e))
  } finally {
    sbPromptPolishing.value = false
  }
}

async function onSaveSbPromptDialog() {
  const sb = sbPromptTarget.value
  if (!sb?.id) return
  sbPromptSaving.value = true
  try {
    await storyboardsAPI.update(sb.id, {
      image_prompt: sbPromptImageText.value.trim() || null,
      polished_prompt: sbPromptPolishedText.value.trim() || null,
      video_prompt: sbPromptVideoText.value.trim() || null,
    })
    await loadDrama()
    showSbPromptDialog.value = false
    ElMessage.success('提示词已保存')
  } catch (e) {
    ElMessage.error(friendlyError(e))
  } finally {
    sbPromptSaving.value = false
  }
}

async function onSaveSbImagePrompt(sb) {
  if (!sb?.id) return
  try {
    await storyboardsAPI.update(sb.id, { image_prompt: (editingSbImagePromptText.value || '').toString().trim() || null })
    await loadDrama()
    editingSbImagePromptId.value = null
    ElMessage.success('图片提示词已保存')
  } catch (e) {
    ElMessage.error(friendlyError(e))
  }
}

function onEditSbVideoPrompt(sb) {
  if (!sb?.id) return
  editingSbVideoPromptId.value = sb.id
  editingSbVideoPromptText.value = (sb.video_prompt || '').toString()
}

/** 将结构化视角三元组转为英文描述片段 + 中文标签（与 angleService.js 保持一致） */
function angleToPromptFragment(h, v, s) {
  const hDesc = { front:'shooting from the front', front_left:'shooting from front-left at 45-degree angle', left:'shooting from the left side, profile view', back_left:'shooting from back-left at 135-degree angle', back:"shooting from behind, character's back to camera", back_right:'shooting from back-right at 135-degree angle', right:'shooting from the right side, profile view', front_right:'shooting from front-right at 45-degree angle' }
  const vDesc = { worm:"extreme low-angle worm's eye view, camera near ground pointing sharply upward, strong upward perspective distortion, background shows sky/ceiling", low:'low-angle upward shot, camera below eye-line, slight upward tilt, empowering perspective', eye_level:'eye-level shot, neutral perspective, natural horizontal framing', high:"high-angle bird's eye view, camera above looking down, background shows floor/ground with downward perspective distortion" }
  const sDesc = { close_up:'close-up shot (face/bust framing), subject fills most of frame, shallow depth of field, background softly blurred', medium:'medium shot (waist-up to full body), character and immediate surroundings visible, moderate depth of field', wide:'wide shot (full body with environment), subject small relative to scene, deep depth of field, environment context prominent' }
  const hLabel = { front:'正面', front_left:'前左', left:'左侧', back_left:'后左', back:'背面', back_right:'后右', right:'右侧', front_right:'前右' }
  const vLabel = { worm:'虫眼仰', low:'仰拍', eye_level:'平视', high:'俯拍' }
  const sLabel = { close_up:'特写', medium:'中景', wide:'远景' }
  const fragment = [sDesc[s] || sDesc.medium, vDesc[v] || vDesc.eye_level, hDesc[h] || hDesc.front].join(', ')
  const label = `${sLabel[s] || '中景'}·${vLabel[v] || '平视'}·${hLabel[h] || '正面'}`
  return { fragment, label }
}

/** 根据当前分镜的「视频提示词组成」字段拼出完整 video_prompt 文案（与后端 generateVideoPrompt 顺序一致） */
function buildVideoPromptFromFields(sbId) {
  const parts = []
  const loc = (sbLocation.value[sbId] || '').toString().trim()
  const time = (sbTime.value[sbId] || '').toString().trim()
  if (loc) parts.push('场景：' + (time ? loc + '，' + time : loc))
  const title = (sbTitle.value[sbId] || '').toString().trim()
  if (title) parts.push('镜头标题：' + title)
  const action = (sbAction.value[sbId] || '').toString().trim()
  if (action) parts.push('动作：' + action)
  const dialogue = (sbDialogue.value[sbId] || '').toString().trim()
  if (dialogue) parts.push('对话：' + dialogue)
  const narr = (sbNarration.value[sbId] || '').toString().trim()
  if (narr) parts.push('解说旁白：' + narr)
  const shotType = (sbShotType.value[sbId] || '').toString().trim()
  if (shotType) parts.push('景别：' + shotType)
  // 优先使用结构化三元组：中文标签 + 英文描述（兼顾中英文视频模型）
  const angleH = sbAngleH.value[sbId] || ''
  const angleV = sbAngleV.value[sbId] || ''
  const angleS = sbAngleS.value[sbId] || ''
  if (angleH && angleV && angleS) {
    const { fragment, label } = angleToPromptFragment(angleH, angleV, angleS)
    parts.push(`镜头角度：${label}（${fragment}）`)
  } else {
    const angle = (sbAngle.value[sbId] || '').toString().trim()
    if (angle) parts.push('镜头角度：' + angle)
  }
  const movement = (sbMovement.value[sbId] || '').toString().trim()
  if (movement) parts.push('运镜：' + movement)
  const atmosphere = (sbAtmosphere.value[sbId] || '').toString().trim()
  if (atmosphere) parts.push('氛围：' + atmosphere)
  const result = (sbResult.value[sbId] || '').toString().trim()
  if (result) parts.push('结果：' + result)
  const duration = Number(sbDuration.value[sbId])
  const sec = Number.isFinite(duration) && duration > 0 ? duration : 5
  parts.push('时长：' + sec + '秒')
  return parts.length ? parts.join('。') : '视频场景'
}

async function onSaveSbVideoFields(sb) {
  if (!sb?.id) return
  try {
    const video_prompt = buildVideoPromptFromFields(sb.id)
    await storyboardsAPI.update(sb.id, {
      title: (sbTitle.value[sb.id] || '').toString().trim() || null,
      location: (sbLocation.value[sb.id] || '').toString().trim() || null,
      time: (sbTime.value[sb.id] || '').toString().trim() || null,
      duration: Number(sbDuration.value[sb.id]) || 5,
      action: (sbAction.value[sb.id] || '').toString().trim() || null,
      dialogue: (sbDialogue.value[sb.id] || '').toString().trim() || null,
      narration: (sbNarration.value[sb.id] || '').toString().trim() || null,
      atmosphere: (sbAtmosphere.value[sb.id] || '').toString().trim() || null,
      result: (sbResult.value[sb.id] || '').toString().trim() || null,
      angle: (sbAngle.value[sb.id] || '').toString().trim() || null,
      angle_h: sbAngleH.value[sb.id] || null,
      angle_v: sbAngleV.value[sb.id] || null,
      angle_s: sbAngleS.value[sb.id] || null,
      movement: (sbMovement.value[sb.id] || '').toString().trim() || null,
      lighting_style: sbLighting.value[sb.id] || null,
      depth_of_field: sbDof.value[sb.id] || null,
      shot_type: (sbShotType.value[sb.id] || '').toString().trim() || null,
      video_prompt,
      creation_mode: sbCreationMode.value[sb.id] === 'universal' ? 'universal' : 'classic',
      universal_segment_text: (sbUniversalSegmentText.value[sb.id] || '').toString().trim() || null
    })
    await loadDrama()
    ElMessage.success('已保存并更新视频提示词')
  } catch (e) {
    ElMessage.error(friendlyError(e))
  }
}

async function onSaveSbVideoPrompt(sb) {
  if (!sb?.id) return
  try {
    await storyboardsAPI.update(sb.id, { video_prompt: (editingSbVideoPromptText.value || '').toString().trim() || null })
    await loadDrama()
    editingSbVideoPromptId.value = null
    ElMessage.success('视频提示词已保存')
  } catch (e) {
    ElMessage.error(friendlyError(e))
  }
}

function onOpenVideoParamsDialog(sb) {
  videoParamsTarget.value = sb
  showVideoParamsDialog.value = true
}

/** 取消关闭弹窗时，将创作模式与片段描述与服务器状态对齐（避免仅改单选未保存导致本地漂移） */
function onVideoParamsDialogClosed() {
  const sb = videoParamsTarget.value
  if (!sb?.id) return
  const row = (storyboards.value || []).find((x) => Number(x.id) === Number(sb.id))
  if (!row) return
  sbCreationMode.value = { ...sbCreationMode.value, [sb.id]: row.creation_mode === 'universal' ? 'universal' : 'classic' }
  sbUniversalSegmentText.value = { ...sbUniversalSegmentText.value, [sb.id]: (row.universal_segment_text ?? '').toString() }
}

async function onSaveVideoParams() {
  const sb = videoParamsTarget.value
  if (!sb?.id) return
  videoParamsSaving.value = true
  try {
    await onSaveSbVideoFields(sb)
    showVideoParamsDialog.value = false
  } catch (e) {
    ElMessage.error(friendlyError(e))
  } finally {
    videoParamsSaving.value = false
  }
}

async function onBatchInferParams() {
  if (!currentEpisodeId.value) return
  inferringParams.value = true
  try {
    const res = await storyboardsAPI.batchInferParams(currentEpisodeId.value, false)
    await loadDrama()
    ElMessage.success(`摄影参数推断完成，更新了 ${res?.updated ?? 0} 条分镜`)
  } catch (e) {
    ElMessage.error(friendlyError(e))
  } finally {
    inferringParams.value = false
  }
}

async function onGenerateSbVideo(sb) {
  if (!dramaId.value || !sb?.id || !sbCanSubmitVideo(sb)) return
  const universal = isSbUniversalMode(sb.id)
  const omniRefs = universal ? collectSbOmniReferenceAbsoluteUrls(sb) : []
  const hasClassicFrame = !!getSbFirstFrameUrl(sb)
  const hasAnyImage = universal ? omniRefs.length > 0 : hasClassicFrame
  if (!hasAnyImage) {
    try {
      await ElMessageBox.confirm(
        universal
          ? '当前没有可用的参考图（场景/角色/道具等；不含经典分镜主图），将按纯文案提交 Omni-Video（模型以 AI 配置为准），效果可能不稳定。确认继续？'
          : '当前没有分镜参考图，将根据文字提示词直接生成视频，效果可能不稳定。确认继续？',
        universal ? '全能模式无参考图' : '没有分镜参考图',
        { confirmButtonText: '继续生成', cancelButtonText: '取消', type: 'warning' }
      )
    } catch {
      return
    }
  }
  generatingSbVideoIds.add(sb.id)
  sbVideoErrors.value[sb.id] = ''
  // 清除前端选中状态 + 清除后端手动指定的 video_url，让合成时自动取最新生成的视频
  if (sbSelectedVideoId.value[sb.id] != null) {
    const next = { ...sbSelectedVideoId.value }
    delete next[sb.id]
    sbSelectedVideoId.value = next
  }
  storyboardsAPI.update(sb.id, { video_url: null }).catch(() => {})
  try {
    let absoluteUrl = ''
    let referenceUrls = undefined
    if (universal) {
      referenceUrls = omniRefs.length ? omniRefs : undefined
      absoluteUrl = omniRefs[0] || ''
    } else {
      const firstFrameUrl = await getMainImageUrlForVideo(sb)
      absoluteUrl = toAbsoluteImageUrl(firstFrameUrl)
      referenceUrls = absoluteUrl ? [absoluteUrl] : undefined
    }
    const res = await videosAPI.create({
      drama_id: dramaId.value,
      storyboard_id: sb.id,
      prompt: buildSbVideoPromptForApi(sb),
      image_url: absoluteUrl || undefined,
      reference_image_urls: referenceUrls,
      style: getSelectedStyle(),
      aspect_ratio: projectAspectRatio.value || '16:9',
      resolution: videoResolution.value || undefined,
      duration: videoClipDuration.value || undefined,
    })
    if (res?.task_id) {
      const pollRes = await pollTask(res.task_id, () => loadSingleStoryboardMedia(sb.id), {
        timeoutMinutes: videoTaskPollTimeoutMinutes.value,
      })
      if (pollRes?.status === 'failed') {
        sbVideoErrors.value[sb.id] = pollRes.error || '视频生成失败'
      } else if (pollRes?.status === 'completed') {
        sbVideoErrors.value[sb.id] = ''
        ElMessage.success('视频生成完成')
      }
    } else {
      await loadSingleStoryboardMedia(sb.id)
      ElMessage.success('视频生成已提交，请稍后查看')
    }
  } catch (e) {
    sbVideoErrors.value[sb.id] = e.message || '提交失败'
    ElMessage.error(friendlyError(e))
  } finally {
    generatingSbVideoIds.delete(sb.id)
    await loadSingleStoryboardMedia(sb.id)
  }
}

/** 生成期间轻量刷新分镜列表（只更新 currentEpisode.storyboards，不重载整个 drama） */
async function refreshStoryboardsOnly() {
  if (!currentEpisodeId.value) return
  try {
    const res = await dramaAPI.getStoryboards(currentEpisodeId.value)
    // API 返回 { storyboards: [...], total: N }，需要取 .storyboards
    const list = Array.isArray(res) ? res : (res?.storyboards ?? null)
    if (store.currentEpisode && Array.isArray(list)) {
      store.currentEpisode.storyboards = list
    }
  } catch (_) { /* 静默忽略，不影响主流程 */ }
}

async function onGenerateStoryboard() {
  if (!currentEpisodeId.value) return
  storyboardGenerating.value = true
  // 生成期间每 2 秒刷新分镜列表，让已解析的分镜逐步出现
  const refreshTimer = setInterval(refreshStoryboardsOnly, 2000)
  try {
    const res = await dramaAPI.generateStoryboard(currentEpisodeId.value, {
      model: undefined,
      style: getSelectedStyle(),
      storyboard_count: getStoryboardCountForApi(),
      video_duration: getVideoDurationForApi(),
      aspect_ratio: projectAspectRatio.value || '16:9',
      include_narration: !!storyboardIncludeNarration.value,
      universal_omni_storyboard: !!storyboardUniversalOmni.value,
    })
    const taskId = res?.task_id ?? (typeof res === 'string' ? res : null)
    if (taskId) {
      const pollRes = await pollTask(taskId, () => loadDrama())
      // failed / timeout：pollTask 内已展示对应提示，直接返回，不显示「完成」
      if (pollRes?.status !== 'completed') return
      if (pollRes?.result?.truncated) {
        sbTruncatedWarning.value = true
        sbTruncatedDismissed.value = false
      }
    }
    await loadDrama()
    // 生成完成后静默补全空缺的摄影参数（只填未填字段，不覆盖 AI 已填的）
    storyboardsAPI.batchInferParams(currentEpisodeId.value, false).catch(() => {})
    const polishRes = await polishUniversalSegmentsAfterGeneration({})
    const polishedN = polishRes?.polished ?? 0
    ElMessage.success(
      storyboardUniversalOmni.value
        ? polishedN > 0
          ? `全能分镜生成完成，已自动润色 ${polishedN} 条片段`
          : '全能分镜生成完成'
        : '分镜生成完成'
    )
  } catch (e) {
    // HTTP 错误由 request 拦截器统一展示，此处仅处理拦截器未覆盖的异常
    if (!e.response) ElMessage.error(friendlyError(e))
  } finally {
    clearInterval(refreshTimer)
    storyboardGenerating.value = false
  }
}

async function onAddSingleStoryboard(){
  if (!currentEpisodeId.value) {
    ElMessage.warning('请先选择集')
    return
  }
  try {
    // 获取当前最大序号（仅计算当前集的分镜）
    const maxNum = (store.storyboards || [])
      .filter(sb => sb.episode_id === currentEpisodeId.value)
      .reduce((max, sb) => Math.max(max, sb.storyboard_number || 0), 0)
    await storyboardsAPI.create({
      episode_id: currentEpisodeId.value,
      storyboard_number: maxNum + 1,
      title: `镜头 ${maxNum + 1}`,
      description: '',
    })
    ElMessage.success('添加成功')
    await loadDrama() // 刷新列表
  } catch (e) {
    ElMessage.error(friendlyError(e))
  }
}

async function onDeleteSingleStoryboard(id){
  try {
    await ElMessageBox.confirm('确定要删除这个分镜吗？', '提示', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await storyboardsAPI.delete(id)
    ElMessage.success('删除成功')
    await loadDrama() // 刷新列表
  } catch (e) {
    if (e !== 'cancel') {
      ElMessage.error(friendlyError(e))
    }
  }
}

async function onInsertStoryboardBefore(sb) {
  try {
    await storyboardsAPI.insertBefore(sb.id)
    ElMessage.success('已在此位置前新增空白分镜')
    await loadDrama()
  } catch (e) {
    ElMessage.error(friendlyError(e))
  }
}

async function startBatchImageGeneration() {
  if (!currentEpisodeId.value || batchImageRunning.value || pipelineRunning.value) return
  batchImageErrors.value = []
  batchImageStopping.value = false
  batchImageRunning.value = true
  try {
    // 仅当媒体数据尚未加载时才全量拉取，避免点击时触发大量冗余请求
    if (Object.keys(sbImages.value).length === 0) {
      await loadStoryboardMedia()
    }
    const boards = store.storyboards || []
    const todo = boards.filter((sb) => !hasSbImage(sb))
    if (todo.length === 0) {
      ElMessage.info('所有分镜均已有图片，无需重新生成')
      return
    }
    batchImageProgress.value = { current: 0, total: todo.length, failed: 0 }
    const concurrency = pipelineConcurrency.value || 3
    let doneCount = 0

    // 并发执行，使用与 pipeline 相同的并发模型
    let queueIdx = 0
    const worker = async () => {
      while (queueIdx < todo.length) {
        if (batchImageStopping.value) break
        const sb = todo[queueIdx++]
        try {
          const res = await imagesAPI.create({
            storyboard_id: sb.id,
            drama_id: dramaId.value,
            prompt: sb.polished_prompt || sb.image_prompt || sb.description || '',
            style: getSelectedStyle(),
            frame_type: gridMode.value !== 'single' ? gridMode.value : undefined,
            aspect_ratio: projectAspectRatio.value || '16:9',
          })
          if (res?.task_id) {
            const pollRes = await pollTask(res.task_id, () => loadSingleStoryboardMedia(sb.id))
            if (pollRes?.status === 'failed') {
              batchImageErrors.value.push(`#${sb.storyboard_number ?? sb.id}: ${pollRes.error || '生成失败'}`)
              batchImageProgress.value = { ...batchImageProgress.value, failed: batchImageProgress.value.failed + 1 }
            }
          } else {
            await loadSingleStoryboardMedia(sb.id)
          }
        } catch (e) {
          batchImageErrors.value.push(`#${sb.storyboard_number ?? sb.id}: ${e.message || '提交失败'}`)
          batchImageProgress.value = { ...batchImageProgress.value, failed: batchImageProgress.value.failed + 1 }
        }
        doneCount++
        batchImageProgress.value = { ...batchImageProgress.value, current: doneCount }
      }
    }
    await Promise.allSettled(Array.from({ length: Math.min(concurrency, todo.length) }, () => worker()))
    if (!batchImageStopping.value) {
      if (batchImageProgress.value.failed === 0) ElMessage.success(`分镜图批量生成完成（共 ${todo.length} 条）`)
      else ElMessage.warning(`批量完成，${batchImageProgress.value.failed}/${todo.length} 条失败`)
    } else {
      ElMessage.info('批量生成已停止')
    }
  } finally {
    batchImageRunning.value = false
  }
}

async function startBatchVideoGeneration() {
  if (!currentEpisodeId.value || batchVideoRunning.value || pipelineRunning.value) return
  batchVideoErrors.value = []
  batchVideoStopping.value = false
  batchVideoRunning.value = true
  try {
    // 仅当媒体数据尚未加载时才全量拉取，避免点击时触发大量冗余请求
    if (Object.keys(sbVideos.value).length === 0) {
      await loadStoryboardMedia()
    }
    const boards = store.storyboards || []
    // 只处理：有参考图（经典=分镜主图；全能=场景/角色/道具，不含经典主图）且 还没有已完成视频 的分镜
    const todo = boards.filter((sb) => {
      const vidList = sbVideos.value[sb.id] || []
      if (vidList.some((v) => v.status === 'completed' && recordHasPlayableVideoUrl(v))) return false
      if (isSbUniversalMode(sb.id)) {
        if (!sbCanSubmitVideo(sb)) return false
        return collectSbOmniReferenceAbsoluteUrls(sb).length > 0
      }
      return !!getSbFirstFrameUrl(sb)
    })
    if (todo.length === 0) {
      ElMessage.info('没有需要生成视频的分镜（分镜缺少图片，或视频已全部生成）')
      return
    }
    batchVideoProgress.value = { current: 0, total: todo.length, failed: 0 }
    const contiguity = videoFrameContiguity.value
    // 连贯帧模式强制顺序（concurrency=1），普通模式并发
    const videoConcurrency = contiguity ? 1 : (pipelineVideoConcurrency.value || 2)
    let videoDoneCount = 0
    let prevVideoItem = null  // 连贯帧：保存上一条已完成的视频记录

    let videoQueueIdx = 0
    const videoWorker = async () => {
      while (videoQueueIdx < todo.length) {
        if (batchVideoStopping.value) break
        const sb = todo[videoQueueIdx++]
        const universal = isSbUniversalMode(sb.id)
        const omniRefs = universal ? collectSbOmniReferenceAbsoluteUrls(sb) : []
        if (!universal && !getSbFirstFrameUrl(sb)) {
          videoDoneCount++
          batchVideoProgress.value = { ...batchVideoProgress.value, current: videoDoneCount }
          continue
        }
        if (universal && !omniRefs.length) {
          videoDoneCount++
          batchVideoProgress.value = { ...batchVideoProgress.value, current: videoDoneCount }
          continue
        }
        try {
          // 批量生成时清除手动指定的视频，确保合成时使用最新生成记录
          storyboardsAPI.update(sb.id, { video_url: null }).catch(() => {})
          if (sbSelectedVideoId.value[sb.id] != null) {
            const next = { ...sbSelectedVideoId.value }
            delete next[sb.id]
            sbSelectedVideoId.value = next
          }
          const firstFrameUrl = await getMainImageUrlForVideo(sb)
          const absoluteUrl = universal ? (omniRefs[0] || '') : toAbsoluteImageUrl(firstFrameUrl)
          // 连贯帧：提取上一条视频末帧作为参考（全能模式不走连贯帧替换）
          let contiguityFirstFrameUrl = absoluteUrl
          if (contiguity && prevVideoItem && !universal) {
            const prevVideoUrl = prevVideoItem.local_path
              ? toAbsoluteImageUrl('/static/' + prevVideoItem.local_path.replace(/^\//, ''))
              : prevVideoItem.video_url
            if (prevVideoUrl) {
              try {
                const lastFrameBlob = await captureVideoLastFrame(prevVideoUrl)
                if (lastFrameBlob) {
                  const file = new File([lastFrameBlob], 'continuity_frame.jpg', { type: 'image/jpeg' })
                  const uploadRes = await uploadAPI.uploadImage(file, { dramaId: dramaId.value })
                  if (uploadRes?.local_path) {
                    contiguityFirstFrameUrl = toAbsoluteImageUrl('/static/' + uploadRes.local_path.replace(/^\//, ''))
                  }
                }
              } catch (_) {}
            }
          }
          const refUrls = universal
            ? (omniRefs.length ? omniRefs : undefined)
            : (absoluteUrl ? [absoluteUrl] : undefined)
          const res = await videosAPI.create({
            drama_id: dramaId.value,
            storyboard_id: sb.id,
            prompt: buildSbVideoPromptForApi(sb),
            image_url: contiguityFirstFrameUrl || undefined,
            first_frame_url: contiguityFirstFrameUrl || undefined,
            reference_image_urls: refUrls,
            style: getSelectedStyle(),
            aspect_ratio: projectAspectRatio.value || '16:9',
            resolution: videoResolution.value || undefined,
            duration: videoClipDuration.value || undefined,
          })
          if (res?.task_id) {
            const pollRes = await pollTask(res.task_id, () => loadSingleStoryboardMedia(sb.id), {
              timeoutMinutes: videoTaskPollTimeoutMinutes.value,
            })
            if (pollRes?.status === 'failed') {
              batchVideoErrors.value.push(`#${sb.storyboard_number ?? sb.id}: ${pollRes.error || '生成失败'}`)
              batchVideoProgress.value = { ...batchVideoProgress.value, failed: batchVideoProgress.value.failed + 1 }
              prevVideoItem = null
            } else if (contiguity && pollRes?.status === 'completed') {
              // 连贯帧：保存本条视频用于下一条
              const vList = sbVideos.value[sb.id] || []
              prevVideoItem = vList.find((v) => v.status === 'completed') || null
            }
          } else {
            await loadSingleStoryboardMedia(sb.id)
            if (contiguity) {
              const vList = sbVideos.value[sb.id] || []
              prevVideoItem = vList.find((v) => v.status === 'completed') || null
            }
          }
        } catch (e) {
          batchVideoErrors.value.push(`#${sb.storyboard_number ?? sb.id}: ${e.message || '提交失败'}`)
          batchVideoProgress.value = { ...batchVideoProgress.value, failed: batchVideoProgress.value.failed + 1 }
          if (contiguity) prevVideoItem = null
        }
        videoDoneCount++
        batchVideoProgress.value = { ...batchVideoProgress.value, current: videoDoneCount }
      }
    }
    await Promise.allSettled(Array.from({ length: Math.min(videoConcurrency, todo.length) }, () => videoWorker()))
    if (!batchVideoStopping.value) {
      if (batchVideoProgress.value.failed === 0) ElMessage.success(`分镜视频批量生成完成（共 ${todo.length} 条）`)
      else ElMessage.warning(`批量完成，${batchVideoProgress.value.failed}/${todo.length} 条失败`)
    } else {
      ElMessage.info('批量生成已停止')
    }
  } finally {
    batchVideoRunning.value = false
  }
}

function getFinalizeMergeOptions() {
  return {
    burn_narration_subtitles: !!videoSubtitle.value,
    burn_dialogue_audio: !!videoBurnDialogue.value,
    watermark_text: videoWatermark.value ? String(videoWatermarkText.value || '').trim().slice(0, 200) : '',
  }
}

async function onGenerateVideo() {
  if (!currentEpisodeId.value) return
  store.setVideoStatus('generating')
  store.setVideoProgress(5)
  videoErrorMsg.value = ''
  try {
    const result = await dramaAPI.finalizeEpisode(currentEpisodeId.value, getFinalizeMergeOptions())
    if (result?.task_id != null) {
      store.setVideoProgress(10)
      ElMessage.success(result?.message || '视频合成任务已提交，请稍后查看')
      const pollResult = await pollTask(result.task_id, () => loadDrama(), {
        timeoutMinutes: videoTaskPollTimeoutMinutes.value,
      })
      await loadDrama()
      if (pollResult?.status === 'completed') {
        store.setVideoProgress(100)
        if (currentEpisodeVideoUrl.value) {
          store.setVideoStatus('done')
          ElMessage.success('视频生成完成')
        } else {
          store.setVideoStatus('error')
          videoErrorMsg.value = '视频生成完成但未获取到播放地址，请稍后刷新'
          ElMessage.warning(videoErrorMsg.value)
        }
      } else if (pollResult?.status === 'failed') {
        store.setVideoStatus('error')
        videoErrorMsg.value = pollResult?.error || '视频生成失败'
      } else if (pollResult?.status === 'timeout') {
        store.setVideoStatus('generating')
        videoErrorMsg.value = '任务仍在排队或生成中，请稍后刷新查看'
        ElMessage.warning(videoErrorMsg.value)
      }
    } else {
      store.setVideoStatus('error')
      const msg = result?.message || '本集没有可合成的视频片段'
      videoErrorMsg.value = msg
      ElMessage.warning(msg)
    }
  } catch (e) {
    videoErrorMsg.value = e.message || '生成失败'
    store.setVideoStatus('error')
  }
}

/** 无 task_id 时轮询刷新直到资源出现图片或超时（用于角色/道具/场景图生成） */
async function pollUntilResourceHasImage(checker, maxAttempts = 20, intervalMs = 3000) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, intervalMs))
    await loadDrama()
    if (checker()) return
  }
}

/** 轮询异步任务。opts.timeoutMinutes：视频类任务传 videoTaskPollTimeoutMinutes，缺省 15 分钟（分镜/图片等） */
const DEFAULT_TASK_POLL_MINUTES = 15

function pollTask(taskId, onDone, opts = {}) {
  const interval = opts.intervalMs ?? 2000
  const timeoutMinutes =
    opts.timeoutMinutes != null && Number.isFinite(opts.timeoutMinutes) && opts.timeoutMinutes > 0
      ? opts.timeoutMinutes
      : DEFAULT_TASK_POLL_MINUTES
  const maxAttempts = Math.max(1, Math.ceil((timeoutMinutes * 60 * 1000) / interval))
  let attempts = 0
  return new Promise((resolve) => {
    const tick = async () => {
      attempts++
      try {
        const t = await taskAPI.get(taskId)
        if (t.status === 'completed') {
          if (onDone) await onDone()
          return resolve({ status: 'completed', result: t.result })
        }
        if (t.status === 'failed') {
          const errMsg = t.error || '任务失败'
          ElMessage.error(errMsg)
          return resolve({ status: 'failed', error: errMsg })
        }
      } catch (pollErr) {
        // 轮询网络异常时仅打印，不打断轮询（服务短暂重启等情况）
        console.warn('[pollTask] poll attempt failed:', pollErr?.message)
      }
      if (attempts < maxAttempts) trackPollTimer(setTimeout(tick, interval))
      else {
        const timeoutMsg = `任务已超时（超过 ${timeoutMinutes} 分钟），请刷新页面查看是否已完成`
        ElMessage.warning(timeoutMsg)
        resolve({ status: 'timeout', error: timeoutMsg })
      }
    }
    trackPollTimer(setTimeout(tick, interval))
  })
}

/** 一键生成视频：暂停时等待，返回 { paused: true } 表示被暂停中断 */
function pollTaskWithPause(taskId, onDone, opts = {}) {
  const interval = opts.intervalMs ?? 2000
  const timeoutMinutes =
    opts.timeoutMinutes != null && Number.isFinite(opts.timeoutMinutes) && opts.timeoutMinutes > 0
      ? opts.timeoutMinutes
      : DEFAULT_TASK_POLL_MINUTES
  const maxAttempts = Math.max(1, Math.ceil((timeoutMinutes * 60 * 1000) / interval))
  let attempts = 0
  return new Promise((resolve) => {
    const tick = async () => {
      if (pipelinePaused.value) {
        resolve({ paused: true })
        return
      }
      attempts++
      try {
        const t = await taskAPI.get(taskId)
        if (t.status === 'completed') {
          if (onDone) await onDone()
          resolve({ result: t.result })
          return
        }
        if (t.status === 'failed') {
          resolve({ error: t.error || '任务失败' })
          return
        }
      } catch (pollErr) {
        console.warn('[pollTaskWithPause] poll attempt failed:', pollErr?.message)
      }
      if (attempts < maxAttempts) trackPollTimer(setTimeout(tick, interval))
      else {
        resolve({ error: `任务查询超时（超过 ${timeoutMinutes} 分钟）` })
      }
    }
    trackPollTimer(setTimeout(tick, interval))
  })
}

function waitForResume() {
  return new Promise((resolve) => {
    pipelineResolveResume = resolve
  })
}

function onPipelineResume() {
  pipelinePaused.value = false
  if (pipelineResolveResume) {
    pipelineResolveResume()
    pipelineResolveResume = null
  }
}

function addPipelineError(step, message) {
  const time = new Date().toLocaleTimeString('zh-CN')
  pipelineErrorLog.value = [...pipelineErrorLog.value, { time, step, message }]
}

async function checkPause() {
  while (pipelinePaused.value) {
    await waitForResume()
  }
}

/** 每生成好一个图片或内容后休息，防止任务队列过紧 */
function pipelineRest() {
  return new Promise((r) => setTimeout(r, 1000))
}

/** 跳过倒计时，立即进入下一阶段 */
function skipPipelineCountdown() {
  pipelineCountdown.value = 0
}

/** 阶段间倒计时，支持暂停冻结 + 立即跳过 */
async function runPipelineCountdown(totalSeconds, msg) {
  pipelineCountdown.value = totalSeconds
  pipelineCountdownMsg.value = msg
  try {
    while (pipelineCountdown.value > 0) {
      await checkPause()                              // 暂停时冻结在此
      await new Promise((r) => setTimeout(r, 1000))  // 等 1 秒
      if (pipelineCountdown.value > 0) pipelineCountdown.value--
    }
  } finally {
    pipelineCountdown.value = 0
    pipelineCountdownMsg.value = ''
  }
}

/** 执行可失败步骤，失败时重试最多 maxRetries 次；fn 返回 { paused: true } 表示暂停不重试；返回 true 表示成功；抛错会触发重试 */
async function pipelineWithRetry(stepName, fn, maxRetries = 3) {
  let lastErr
  for (let r = 0; r < maxRetries; r++) {
    try {
      const result = await fn()
      if (result && result.paused === true) return result
      return true
    } catch (e) {
      lastErr = e
      if (r < maxRetries - 1) await pipelineRest()
    }
  }
  addPipelineError(stepName, '重试3次均失败: ' + (lastErr?.message || String(lastErr)))
  return false
}

async function startOneClickPipeline() {
  if (!currentEpisodeId.value || pipelineRunning.value) return
  pipelineErrorLog.value = []
  pipelineCurrentStep.value = ''
  pipelineStepIndex.value = 0
  pipelineActiveTasks.clear()
  pipelineStepTotal.value = 10
  pipelineRunning.value = true
  pipelinePaused.value = false
  try {
    await runOneClickPipeline(false)
  } finally {
    pipelineRunning.value = false
    pipelineActiveTasks.clear()
  }
}

async function startTextFrameworkPipeline() {
  if (!currentEpisodeId.value || pipelineRunning.value) return
  pipelineErrorLog.value = []
  pipelineCurrentStep.value = ''
  pipelineStepIndex.value = 0
  pipelineActiveTasks.clear()
  pipelineStepTotal.value = 4
  pipelineRunning.value = true
  pipelinePaused.value = false
  try {
    await runOneClickPipeline(true)
  } finally {
    pipelineRunning.value = false
    pipelineActiveTasks.clear()
  }
}

function setPipelineStep(idx, text) {
  pipelineStepIndex.value = idx
  pipelineCurrentStep.value = `[步骤 ${idx}/${pipelineStepTotal.value}] ${text}`
}

async function runOneClickPipeline(textOnly = false) {
  const episodeId = currentEpisodeId.value
  const dramaIdVal = dramaId.value
  if (!episodeId || !dramaIdVal) return
  const style = getSelectedStyle()

  try {
    // ════════════════════════════════════════════════════════
    // 阶段一：内容提取 & 分镜生成（快速、低成本）
    // ════════════════════════════════════════════════════════

    // 步骤 1：提取角色
    await checkPause()
    let chars = store.currentEpisode?.characters ?? []
    if (chars.length === 0) {
      setPipelineStep(1, '提取角色...')
      try {
        const outline = (store.scriptContent || '').toString().trim() || (storyInput.value || '').toString().trim() || undefined
        const res = await generationAPI.generateCharacters(dramaIdVal, { episode_id: store.currentEpisode?.id ?? undefined, outline: outline || undefined })
        const taskId = res?.task_id
        if (taskId) {
          const result = await pollTaskWithPause(taskId, () => loadDrama())
          if (result?.paused) { await waitForResume(); return }
          if (result?.error) { addPipelineError('提取角色', result.error); return }
        } else {
          await loadDrama()
        }
        await pipelineRest()
      } catch (e) {
        addPipelineError('提取角色', e.message || String(e))
        return
      }
      chars = store.currentEpisode?.characters ?? []
    } else {
      setPipelineStep(1, `已有 ${chars.length} 个角色，跳过提取`)
    }

    // 步骤 2：提取场景
    await checkPause()
    let sceneList = store.currentEpisode?.scenes ?? []
    if (sceneList.length === 0) {
      setPipelineStep(2, '提取场景...')
      try {
        const res = await dramaAPI.extractBackgrounds(episodeId, { model: undefined, style, language: scriptLanguage.value })
        const taskId = res?.task_id
        if (taskId) {
          const result = await pollTaskWithPause(taskId, () => loadDrama())
          if (result?.paused) { await waitForResume(); return }
          if (result?.error) { addPipelineError('提取场景', result.error); return }
        } else {
          await loadDrama()
        }
        await pipelineRest()
      } catch (e) {
        addPipelineError('提取场景', e.message || String(e))
        return
      }
      sceneList = store.currentEpisode?.scenes ?? []
    } else {
      setPipelineStep(2, `已有 ${sceneList.length} 个场景，跳过提取`)
    }

    // 步骤 3：提取道具
    await checkPause()
    let propList = store.props ?? []
    if (propList.length === 0) {
      setPipelineStep(3, '提取道具...')
      try {
        const res = await propAPI.extractFromScript(episodeId)
        const taskId = res?.task_id
        if (taskId) {
          const result = await pollTaskWithPause(taskId, () => loadDrama())
          if (result?.paused) { await waitForResume(); return }
          if (result?.error) { addPipelineError('提取道具', result.error); return }
        } else {
          await loadDrama()
        }
        await pipelineRest()
      } catch (e) {
        addPipelineError('提取道具', e.message || String(e))
        // 道具提取失败不中断流程
      }
      propList = store.props ?? []
    } else {
      setPipelineStep(3, `已有 ${propList.length} 个道具，跳过提取`)
    }

    // 步骤 4：生成分镜脚本
    await checkPause()
    await loadStoryboardMedia()
    let boards = store.storyboards || []
    const hadBoardsBeforeStep4 = boards.length > 0
    if (boards.length === 0) {
      setPipelineStep(4, '生成分镜脚本...')
      // 与手动生成一样，每 2 秒刷新一次分镜列表，让已解析的分镜逐步显示
      const sbRefreshTimer = setInterval(refreshStoryboardsOnly, 2000)
      try {
        const res = await dramaAPI.generateStoryboard(episodeId, {
          style,
          aspect_ratio: projectAspectRatio.value || '16:9',
          storyboard_count: getStoryboardCountForApi(),
          video_duration: getVideoDurationForApi(),
          include_narration: !!storyboardIncludeNarration.value,
          universal_omni_storyboard: !!storyboardUniversalOmni.value,
        })
        const taskId = res?.task_id ?? (typeof res === 'string' ? res : null)
        if (taskId) {
          const result = await pollTaskWithPause(taskId, () => loadDrama())
          if (result?.paused) { clearInterval(sbRefreshTimer); await waitForResume(); return }
          if (result?.error) {
            // 任务失败，但后端可能已保存了部分分镜，确保最新状态显示出来再停止
            await loadDrama()
            addPipelineError('生成分镜', result.error)
            clearInterval(sbRefreshTimer)
            return
          }
          if (result?.result?.truncated) {
            sbTruncatedWarning.value = true
            sbTruncatedDismissed.value = false
          }
        }
        await loadDrama()
        await pipelineRest()
      } catch (e) {
        addPipelineError('生成分镜', e.message || String(e))
        clearInterval(sbRefreshTimer)
        return
      }
      clearInterval(sbRefreshTimer)
      await loadStoryboardMedia()
      boards = store.storyboards || []
    } else {
      setPipelineStep(4, `已有 ${boards.length} 个分镜，跳过生成`)
    }

    const generatedSbThisPipeline = !hadBoardsBeforeStep4
    if (generatedSbThisPipeline && storyboardUniversalOmni.value) {
      await checkPause()
      await polishUniversalSegmentsAfterGeneration({
        checkPause,
        onShotProgress: (cur, total, sb) =>
          setPipelineStep(
            4,
            `润色全能分镜(${cur}/${total}) #${sb.storyboard_number ?? cur} ${(sb.title || '').slice(0, 16)}`
          ),
        onShotError: (sb, msg) =>
          addPipelineError('润色全能分镜', `镜#${sb.storyboard_number ?? sb.id}: ${msg}`),
      })
      await loadDrama()
      await loadStoryboardMedia()
    }

    if (textOnly) {
      pipelineCurrentStep.value = '文本框架已就绪（未生成图片与视频）'
      ElMessage.success('文本框架已生成：角色、场景、道具与分镜脚本已就绪')
      return
    }

    // ════════════════════════════════════════════════════════
    // ⏱ 倒计时 20 秒：请浏览分镜内容，确认后开始生成角色/场景/道具图片
    // ════════════════════════════════════════════════════════
    await runPipelineCountdown(20, '分镜脚本生成完毕，请浏览确认内容。倒计时结束后将开始生成角色、场景、道具图片。')
    await checkPause()

    // ════════════════════════════════════════════════════════
    // 阶段二：角色 / 场景 / 道具 图片生成（中等消耗）
    // ════════════════════════════════════════════════════════

    // 步骤 5：生成角色图
    {
      const charsWithoutImage = chars.filter((c) => !hasAssetImage(c))
      const concurrency = pipelineConcurrency.value
      setPipelineStep(5, `生成角色图（${charsWithoutImage.length} 个，并发 ${concurrency}）...`)
      const { paused } = await runConcurrently(charsWithoutImage, concurrency, async (char) => {
        await checkPause()
        generatingCharIds.add(char.id)
        try {
          const stepName = '角色图 ' + (char.name || char.id)
          const ok = await pipelineWithRetry(stepName, async () => {
            const res = await characterAPI.generateImage(char.id, getAssetImageModel(), style)
            const taskId = res?.image_generation?.task_id ?? res?.task_id
            if (taskId) {
              const result = await pollTaskWithPause(taskId, () => loadDrama())
              if (result?.paused) return { paused: true }
              if (result?.error) throw new Error(result.error)
            } else {
              await loadDrama()
              await pollUntilResourceHasImage(() => {
                const list = store.currentEpisode?.characters ?? []
                const c = list.find((x) => Number(x.id) === Number(char.id))
                return !!(c && (c.image_url || c.local_path))
              })
            }
          })
          if (ok && typeof ok === 'object' && ok.paused) return { paused: true }
        } finally {
          generatingCharIds.delete(char.id)
        }
      }, { getLabel: (char) => '角色图 ' + (char.name || char.id) })
      if (paused) { await waitForResume() }
    }

    // 步骤 6：生成场景图
    {
      const scenesWithoutImage = sceneList.filter((s) => !hasAssetImage(s))
      const concurrency = pipelineConcurrency.value
      setPipelineStep(6, `生成场景图（${scenesWithoutImage.length} 个，并发 ${concurrency}）...`)
      await checkPause()
      const { paused } = await runConcurrently(scenesWithoutImage, concurrency, async (scene) => {
        await checkPause()
        generatingSceneIds.add(scene.id)
        try {
          const stepName = '场景图 ' + (scene.location || scene.id)
          const ok = await pipelineWithRetry(stepName, async () => {
            const res = await sceneAPI.generateImage({ scene_id: scene.id, model: getAssetImageModel(), style })
            const taskId = res?.image_generation?.task_id ?? res?.task_id
            if (taskId) {
              const result = await pollTaskWithPause(taskId, () => loadDrama())
              if (result?.paused) return { paused: true }
              if (result?.error) throw new Error(result.error)
            } else {
              await loadDrama()
              await pollUntilResourceHasImage(() => {
                const list = store.currentEpisode?.scenes ?? []
                const s = list.find((x) => Number(x.id) === Number(scene.id))
                return !!(s && (s.image_url || s.local_path))
              })
            }
          })
          if (ok && typeof ok === 'object' && ok.paused) return { paused: true }
        } finally {
          generatingSceneIds.delete(scene.id)
        }
      }, { getLabel: (scene) => '场景图 ' + (scene.location || scene.id) })
      if (paused) { await waitForResume() }
    }

    // 步骤 7：生成道具图
    {
      const propsWithoutImage = propList.filter((p) => !hasAssetImage(p))
      const concurrency = pipelineConcurrency.value
      setPipelineStep(7, `生成道具图（${propsWithoutImage.length} 个，并发 ${concurrency}）...`)
      await checkPause()
      const { paused } = await runConcurrently(propsWithoutImage, concurrency, async (prop) => {
        await checkPause()
        generatingPropIds.add(prop.id)
        try {
          const stepName = '道具图 ' + (prop.name || prop.id)
          const ok = await pipelineWithRetry(stepName, async () => {
            const res = await propAPI.generateImage(prop.id, getAssetImageModel(), style)
            const taskId = res?.image_generation?.task_id ?? res?.task_id
            if (taskId) {
              const result = await pollTaskWithPause(taskId, () => loadDrama())
              if (result?.paused) return { paused: true }
              if (result?.error) throw new Error(result.error)
            } else {
              await loadDrama()
              await pollUntilResourceHasImage(() => {
                const list = store.props ?? []
                const p = list.find((x) => Number(x.id) === Number(prop.id))
                return !!(p && (p.image_url || p.local_path))
              })
            }
          })
          if (ok && typeof ok === 'object' && ok.paused) return { paused: true }
        } finally {
          generatingPropIds.delete(prop.id)
        }
      }, { getLabel: (prop) => '道具图 ' + (prop.name || prop.id) })
      if (paused) { await waitForResume() }
    }

    // ════════════════════════════════════════════════════════
    // ⏱ 倒计时 30 秒：请浏览角色/场景/道具图，确认后开始生成分镜图
    // ════════════════════════════════════════════════════════
    await runPipelineCountdown(30, '角色、场景、道具图片生成完毕，请浏览确认效果。倒计时结束后将开始生成分镜图（消耗较多 Token）。')
    await checkPause()

    // ════════════════════════════════════════════════════════
    // 阶段三：分镜图生成（较高消耗）
    // ════════════════════════════════════════════════════════

    // 步骤 8：生成分镜图
    {
      await loadStoryboardMedia()
      boards = store.storyboards || []
      const boardsWithoutImg = boards.filter((sb) => !hasSbImage(sb))
      const concurrency = pipelineConcurrency.value
      setPipelineStep(8, `生成分镜图（${boardsWithoutImg.length} 个，并发 ${concurrency}）...`)
      const { paused } = await runConcurrently(boardsWithoutImg, concurrency, async (sb) => {
        await checkPause()
        generatingSbImageIds.add(sb.id)
        try {
          const stepName = '分镜图 #' + (sb.storyboard_number ?? sb.id)
          const ok = await pipelineWithRetry(stepName, async () => {
            const res = await imagesAPI.create({
              storyboard_id: sb.id,
              drama_id: dramaIdVal,
              prompt: sb.polished_prompt || sb.image_prompt || sb.description || '',
              model: undefined,
              style,
              aspect_ratio: projectAspectRatio.value || '16:9',
            })
            if (res?.task_id) {
              const result = await pollTaskWithPause(res.task_id, () => loadSingleStoryboardMedia(sb.id))
              if (result?.paused) return { paused: true }
              if (result?.error) throw new Error(result.error)
            } else await loadSingleStoryboardMedia(sb.id)
          })
          if (ok && typeof ok === 'object' && ok.paused) return { paused: true }
        } finally {
          generatingSbImageIds.delete(sb.id)
        }
      }, { getLabel: (sb) => '分镜图 #' + (sb.storyboard_number ?? sb.id) })
      if (paused) { await waitForResume() }
    }

    // ════════════════════════════════════════════════════════
    // ⏱ 倒计时 20 秒：请浏览分镜图，确认后开始生成分镜视频
    // ════════════════════════════════════════════════════════
    await runPipelineCountdown(20, '分镜图生成完毕，请浏览确认图片效果。倒计时结束后将开始生成分镜视频（消耗最多 Token）。')
    await checkPause()

    // ════════════════════════════════════════════════════════
    // 阶段四：分镜视频 & 合集（最高消耗）
    // ════════════════════════════════════════════════════════

    // 步骤 9：生成分镜视频
    {
      await loadStoryboardMedia()
      const boards2 = (store.storyboards || []).filter((sb) => {
        const vidList = sbVideos.value[sb.id] || []
        if (vidList.some((v) => v.status === 'completed' && recordHasPlayableVideoUrl(v))) return false
        if (isSbUniversalMode(sb.id)) {
          if (!sbCanSubmitVideo(sb)) return false
          return collectSbOmniReferenceAbsoluteUrls(sb).length > 0
        }
        return !!getSbFirstFrameUrl(sb)
      })
      const concurrency = pipelineVideoConcurrency.value
      setPipelineStep(9, `生成分镜视频（${boards2.length} 个，并发 ${concurrency}）...`)
      const { paused } = await runConcurrently(boards2, concurrency, async (sb) => {
        await checkPause()
        generatingSbVideoIds.add(sb.id)
        try {
          const stepName = '分镜视频 #' + (sb.storyboard_number ?? sb.id)
          const ok = await pipelineWithRetry(stepName, async () => {
            const universal = isSbUniversalMode(sb.id)
            const omniRefs = universal ? collectSbOmniReferenceAbsoluteUrls(sb) : []
            const firstFrameUrl = await getMainImageUrlForVideo(sb)
            const absoluteUrl = universal ? (omniRefs[0] || '') : toAbsoluteImageUrl(firstFrameUrl)
            const refUrls = universal
              ? (omniRefs.length ? omniRefs : undefined)
              : (absoluteUrl ? [absoluteUrl] : undefined)
            const res = await videosAPI.create({
              drama_id: dramaIdVal,
              storyboard_id: sb.id,
              prompt: buildSbVideoPromptForApi(sb),
              image_url: absoluteUrl || undefined,
              reference_image_urls: refUrls,
              style,
              aspect_ratio: projectAspectRatio.value || '16:9',
              resolution: videoResolution.value || undefined,
              duration: videoClipDuration.value || undefined,
            })
            if (res?.task_id) {
              const result = await pollTaskWithPause(res.task_id, () => loadSingleStoryboardMedia(sb.id), {
                timeoutMinutes: videoTaskPollTimeoutMinutes.value,
              })
              if (result?.paused) return { paused: true }
              if (result?.error) throw new Error(result.error)
            } else await loadSingleStoryboardMedia(sb.id)
          })
          if (ok && typeof ok === 'object' && ok.paused) return { paused: true }
        } finally {
          generatingSbVideoIds.delete(sb.id)
        }
      }, { getLabel: (sb) => '分镜视频 #' + (sb.storyboard_number ?? sb.id) })
      if (paused) { await waitForResume() }
    }

    // 步骤 10：合成整集视频
    await checkPause()
    setPipelineStep(10, '合成整集视频...')
    try {
      const result = await dramaAPI.finalizeEpisode(episodeId, getFinalizeMergeOptions())
      if (result?.task_id != null) {
        const pollResult = await pollTaskWithPause(result.task_id, () => loadDrama(), {
          timeoutMinutes: videoTaskPollTimeoutMinutes.value,
        })
        if (pollResult?.paused) { await waitForResume(); return }
        if (pollResult?.error) addPipelineError('合成整集视频', pollResult.error)
        else await pipelineRest()
      } else {
        addPipelineError('合成整集视频', result?.message || '本集没有可合成的视频片段')
      }
    } catch (e) {
      addPipelineError('合成整集视频', e.message || String(e))
    }

    pipelineCurrentStep.value = '一键生成视频流程已执行完成'
    ElMessage.success('一键生成视频流程已执行完成')
  } catch (e) {
    addPipelineError('流程', e.message || String(e))
  }
}

async function startRepairPipeline() {
  if (!currentEpisodeId.value || pipelineRunning.value) return
  pipelineErrorLog.value = []
  pipelineCurrentStep.value = ''
  pipelineActiveTasks.clear()
  pipelineRunning.value = true
  pipelinePaused.value = false
  try {
    await runRepairPipeline()
  } finally {
    pipelineRunning.value = false
    pipelineActiveTasks.clear()
  }
}

/** 修复缺失：哪一步没有就生成哪一步，有图/有内容就跳过 */
async function runRepairPipeline() {
  const episodeId = currentEpisodeId.value
  const dramaIdVal = dramaId.value
  if (!episodeId || !dramaIdVal) return
  const style = getSelectedStyle()

  try {
    pipelineCurrentStep.value = '正在加载数据...'
    await loadDrama()

    // 1. 角色：没有则生成角色；再为每个无图角色生成图
    let chars = store.currentEpisode?.characters ?? []
    if (chars.length === 0) {
      await checkPause()
      pipelineCurrentStep.value = '正在生成角色列表...'
      try {
        const outline = (store.scriptContent || '').toString().trim() || (storyInput.value || '').toString().trim() || undefined
        const res = await generationAPI.generateCharacters(dramaIdVal, { episode_id: store.currentEpisode?.id ?? undefined, outline: outline || undefined })
        const taskId = res?.task_id
        if (taskId) {
          const result = await pollTaskWithPause(taskId, () => loadDrama())
          if (result?.paused) { await waitForResume(); return }
          if (result?.error) { addPipelineError('生成角色', result.error); return }
        } else await loadDrama()
        await pipelineRest()
      } catch (e) {
        addPipelineError('生成角色', e.message || String(e))
        return
      }
      chars = store.currentEpisode?.characters ?? []
    }
    const charsWithoutImage = chars.filter((c) => !hasAssetImage(c))
    {
      const concurrency = pipelineConcurrency.value
      pipelineCurrentStep.value = `正在生成角色图（并发${concurrency}）...`
      const { paused } = await runConcurrently(charsWithoutImage, concurrency, async (char) => {
        await checkPause()
        const stepName = '角色图 ' + (char.name || char.id)
        const ok = await pipelineWithRetry(stepName, async () => {
          const res = await characterAPI.generateImage(char.id, getAssetImageModel(), style)
          const taskId = res?.image_generation?.task_id ?? res?.task_id
          if (taskId) {
            const result = await pollTaskWithPause(taskId, () => loadDrama())
            if (result?.paused) return { paused: true }
            if (result?.error) throw new Error(result.error)
          } else {
            await loadDrama()
            await pollUntilResourceHasImage(() => {
              const list = store.currentEpisode?.characters ?? []
              const c = list.find((x) => Number(x.id) === Number(char.id))
              return !!(c && (c.image_url || c.local_path))
            })
          }
        })
        if (ok && typeof ok === 'object' && ok.paused) return { paused: true }
      }, { getLabel: (char) => '角色图 ' + (char.name || char.id) })
      if (paused) { await waitForResume() }
    }

    // 2. 场景：没有则提取；再为每个无图场景生成图
    let sceneList = store.currentEpisode?.scenes ?? []
    if (sceneList.length === 0) {
      await checkPause()
      pipelineCurrentStep.value = '正在提取场景...'
      try {
        const res = await dramaAPI.extractBackgrounds(episodeId, { model: undefined, style, language: scriptLanguage.value })
        const taskId = res?.task_id
        if (taskId) {
          const result = await pollTaskWithPause(taskId, () => loadDrama())
          if (result?.paused) { await waitForResume(); return }
          if (result?.error) { addPipelineError('提取场景', result.error); return }
        } else await loadDrama()
        await pipelineRest()
      } catch (e) {
        addPipelineError('提取场景', e.message || String(e))
        return
      }
      sceneList = store.currentEpisode?.scenes ?? []
    }
    const scenesWithoutImage = sceneList.filter((s) => !hasAssetImage(s))
    {
      const concurrency = pipelineConcurrency.value
      pipelineCurrentStep.value = `正在生成场景图（并发${concurrency}）...`
      const { paused } = await runConcurrently(scenesWithoutImage, concurrency, async (scene) => {
        await checkPause()
        const stepName = '场景图 ' + (scene.location || scene.id)
        const ok = await pipelineWithRetry(stepName, async () => {
          const res = await sceneAPI.generateImage({ scene_id: scene.id, model: getAssetImageModel(), style })
          const taskId = res?.image_generation?.task_id ?? res?.task_id
          if (taskId) {
            const result = await pollTaskWithPause(taskId, () => loadDrama())
            if (result?.paused) return { paused: true }
            if (result?.error) throw new Error(result.error)
          } else {
            await loadDrama()
            await pollUntilResourceHasImage(() => {
              const list = store.currentEpisode?.scenes ?? []
              const s = list.find((x) => Number(x.id) === Number(scene.id))
              return !!(s && (s.image_url || s.local_path))
            })
          }
        })
        if (ok && typeof ok === 'object' && ok.paused) return { paused: true }
      }, { getLabel: (scene) => '场景图 ' + (scene.location || scene.id) })
      if (paused) { await waitForResume() }
    }

    // 2.5 道具：没有则提取；再为每个无图道具生成图
    let propList2 = store.props ?? []
    if (propList2.length === 0) {
      await checkPause()
      pipelineCurrentStep.value = '正在提取道具...'
      try {
        const res = await propAPI.extractFromScript(episodeId)
        const taskId = res?.task_id
        if (taskId) {
          const result = await pollTaskWithPause(taskId, () => loadDrama())
          if (result?.paused) { await waitForResume(); return }
          if (result?.error) { addPipelineError('提取道具', result.error); /* 不中断 */ }
        } else await loadDrama()
        await pipelineRest()
      } catch (e) {
        addPipelineError('提取道具', e.message || String(e))
      }
      propList2 = store.props ?? []
    }
    const propsWithoutImage2 = propList2.filter((p) => !hasAssetImage(p))
    {
      const concurrency = pipelineConcurrency.value
      pipelineCurrentStep.value = `正在生成道具图（并发${concurrency}）...`
      await checkPause()
      const { paused } = await runConcurrently(propsWithoutImage2, concurrency, async (prop) => {
        await checkPause()
        generatingPropIds.add(prop.id)
        try {
          const stepName = '道具图 ' + (prop.name || prop.id)
          const ok = await pipelineWithRetry(stepName, async () => {
            const res = await propAPI.generateImage(prop.id, getAssetImageModel(), style)
            const taskId = res?.image_generation?.task_id ?? res?.task_id
            if (taskId) {
              const result = await pollTaskWithPause(taskId, () => loadDrama())
              if (result?.paused) return { paused: true }
              if (result?.error) throw new Error(result.error)
            } else {
              await loadDrama()
              await pollUntilResourceHasImage(() => {
                const list = store.props ?? []
                const p = list.find((x) => Number(x.id) === Number(prop.id))
                return !!(p && (p.image_url || p.local_path))
              })
            }
          })
          if (ok && typeof ok === 'object' && ok.paused) return { paused: true }
        } finally {
          generatingPropIds.delete(prop.id)
        }
      }, { getLabel: (prop) => '道具图 ' + (prop.name || prop.id) })
      if (paused) { await waitForResume() }
    }

    // 3. 分镜：没有则生成分镜；再逐个检查分镜图，没有则生成；再逐个检查分镜视频，没有则生成
    let boards = store.storyboards || []
    const hadBoardsBeforeRepairSb = boards.length > 0
    if (boards.length === 0) {
      await checkPause()
      pipelineCurrentStep.value = '正在生成分镜...'
      try {
        const res = await dramaAPI.generateStoryboard(episodeId, {
          aspect_ratio: projectAspectRatio.value || '16:9',
          storyboard_count: getStoryboardCountForApi(),
          video_duration: getVideoDurationForApi(),
          include_narration: !!storyboardIncludeNarration.value,
          universal_omni_storyboard: !!storyboardUniversalOmni.value,
        })
        const taskId = res?.task_id ?? (typeof res === 'string' ? res : null)
        if (taskId) {
          const result = await pollTaskWithPause(taskId, () => loadDrama())
          if (result?.paused) { await waitForResume(); return }
          if (result?.error) { addPipelineError('分镜生成', result.error); return }
        }
        await loadDrama()
        await pipelineRest()
      } catch (e) {
        addPipelineError('分镜生成', e.message || String(e))
        return
      }
      boards = store.storyboards || []
    }
    if (!hadBoardsBeforeRepairSb && storyboardUniversalOmni.value) {
      await checkPause()
      await polishUniversalSegmentsAfterGeneration({
        checkPause,
        onShotProgress: (cur, total, sb) => {
          pipelineCurrentStep.value = `润色全能分镜(${cur}/${total}) #${sb.storyboard_number ?? cur} ${(sb.title || '').slice(0, 16)}`
        },
        onShotError: (sb, msg) =>
          addPipelineError('润色全能分镜', `镜#${sb.storyboard_number ?? sb.id}: ${msg}`),
      })
      await loadDrama()
    }
    // 先拉取分镜图片/视频列表，再批量生成分镜图（并发）
    await loadStoryboardMedia()
    const boardsWithoutImg = boards.filter((sb) => !hasSbImage(sb))
    {
      const concurrency = pipelineConcurrency.value
      pipelineCurrentStep.value = `正在生成分镜图（并发${concurrency}）...`
      const { paused } = await runConcurrently(boardsWithoutImg, concurrency, async (sb) => {
        await checkPause()
        const stepName = '分镜图 #' + (sb.storyboard_number ?? sb.id)
        const ok = await pipelineWithRetry(stepName, async () => {
          const res = await imagesAPI.create({
            storyboard_id: sb.id,
            drama_id: dramaIdVal,
            prompt: sb.polished_prompt || sb.image_prompt || sb.description || '',
            model: undefined,
            style,
            aspect_ratio: projectAspectRatio.value || '16:9',
          })
          if (res?.task_id) {
            const result = await pollTaskWithPause(res.task_id, () => loadSingleStoryboardMedia(sb.id))
            if (result?.paused) return { paused: true }
            if (result?.error) throw new Error(result.error)
          } else await loadSingleStoryboardMedia(sb.id)
        })
        if (ok && typeof ok === 'object' && ok.paused) return { paused: true }
      }, { getLabel: (sb) => '分镜图 #' + (sb.storyboard_number ?? sb.id) })
      if (paused) { await waitForResume() }
    }
    await loadStoryboardMedia()
    const boards2 = (store.storyboards || []).filter((sb) => {
      const vidList = sbVideos.value[sb.id] || []
      if (vidList.some((v) => v.status === 'completed' && recordHasPlayableVideoUrl(v))) return false
      if (isSbUniversalMode(sb.id)) {
        if (!sbCanSubmitVideo(sb)) return false
        return collectSbOmniReferenceAbsoluteUrls(sb).length > 0
      }
      return !!getSbFirstFrameUrl(sb)
    })
    {
      const concurrency = pipelineVideoConcurrency.value
      pipelineCurrentStep.value = `正在生成分镜视频（并发${concurrency}）...`
      const { paused } = await runConcurrently(boards2, concurrency, async (sb) => {
        await checkPause()
        const stepName = '分镜视频 #' + (sb.storyboard_number ?? sb.id)
        const ok = await pipelineWithRetry(stepName, async () => {
          const universal = isSbUniversalMode(sb.id)
          const omniRefs = universal ? collectSbOmniReferenceAbsoluteUrls(sb) : []
          const firstFrameUrl = await getMainImageUrlForVideo(sb)
          const absoluteUrl = universal ? (omniRefs[0] || '') : toAbsoluteImageUrl(firstFrameUrl)
          const refUrls = universal
            ? (omniRefs.length ? omniRefs : undefined)
            : (absoluteUrl ? [absoluteUrl] : undefined)
          const res = await videosAPI.create({
            drama_id: dramaIdVal,
            storyboard_id: sb.id,
            prompt: buildSbVideoPromptForApi(sb),
            image_url: absoluteUrl || undefined,
            reference_image_urls: refUrls,
            aspect_ratio: projectAspectRatio.value || '16:9',
            resolution: videoResolution.value || undefined,
            duration: videoClipDuration.value || undefined,
          })
          if (res?.task_id) {
            const result = await pollTaskWithPause(res.task_id, () => loadSingleStoryboardMedia(sb.id), {
              timeoutMinutes: videoTaskPollTimeoutMinutes.value,
            })
            if (result?.paused) return { paused: true }
            if (result?.error) throw new Error(result.error)
          } else await loadSingleStoryboardMedia(sb.id)
        })
        if (ok && typeof ok === 'object' && ok.paused) return { paused: true }
      }, { getLabel: (sb) => '分镜视频 #' + (sb.storyboard_number ?? sb.id) })
      if (paused) { await waitForResume() }
    }

    // 4. 生成整集视频（合成整个视频）
    await checkPause()
    pipelineCurrentStep.value = '正在生成整集视频...'
    try {
      const result = await dramaAPI.finalizeEpisode(episodeId, getFinalizeMergeOptions())
      if (result?.task_id != null) {
        const pollResult = await pollTaskWithPause(result.task_id, () => loadDrama(), {
          timeoutMinutes: videoTaskPollTimeoutMinutes.value,
        })
        if (pollResult?.paused) { await waitForResume(); return }
        if (pollResult?.error) addPipelineError('生成整集视频', pollResult.error)
        else await pipelineRest()
      } else {
        addPipelineError('生成整集视频', result?.message || '本集没有可合成的视频片段')
      }
    } catch (e) {
      addPipelineError('生成整集视频', e.message || String(e))
    }

    pipelineCurrentStep.value = '补全并生成流程已执行完成'
    ElMessage.success('修复缺失流程已执行完成')
  } catch (e) {
    addPipelineError('流程', e.message || String(e))
  }
}


onBeforeUnmount(() => {
  // 清理 composable 中的轮询和防抖计时器
  cleanupCharacters()
  cleanupProps()
  cleanupScenes()
  // 取消所有未完成的 pollTask / pollTaskWithPause 轮询定时器
  cancelAllPolls()
})

onMounted(() => {
  loadPipelineConcurrency()
  const id = route.params.id
  if (id && id !== 'new') {
    store.setDrama({ id: Number(id) })
    // 如果 URL 带了 ?episode=X，先设置好，让 loadDrama 优先恢复到该集
    if (route.query.episode) {
      selectedEpisodeId.value = Number(route.query.episode)
    }
    loadDrama()
  } else {
    store.reset()
    storyInput.value = ''
    scriptTitle.value = ''
    selectedEpisodeId.value = null
    savedCurrentEpisodeNumber.value = 1
    storyStyle.value = ''
    storyType.value = ''
    scriptLanguage.value = 'zh'
    scriptStoryboardStyle.value = ''
    generationStyle.value = ''
  }
})
</script>

<style src="@/styles/film-create.scss" lang="scss"></style>
