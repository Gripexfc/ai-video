<template>
  <!-- 6. 分镜生成 -->
  <section id="anchor-storyboard" class="section card">
    <h2 class="section-title">
      <span>5. 分镜生成</span>
      <span class="step-desc">根据剧本、角色、场景自动生成分镜头脚本（分镜数量、时长、序列图与全能/解说选项见上方「本集配置」）</span>
    </h2>
    <div
      v-if="storyboards.length > 0"
      class="sb-config-row sb-narration-export-row"
      style="margin-top:0;margin-bottom:12px;flex-wrap:wrap;align-items:center;gap:12px"
    >
      <el-button
        class="sb-export-srt-btn"
        size="small"
        plain
        type="primary"
        :disabled="!currentEpisodeId"
        @click="$emit('export:narration-srt')"
      >
        导出解说 SRT
      </el-button>
    </div>
    <div class="asset-actions sb-batch-actions">
      <div class="flex">
        <el-button
          type="primary"
          size="large"
          :loading="storyboardGenerating || (injected.universalOmniPolishRunning && injected.universalOmniPolishRunning.value)"
          :disabled="!currentEpisodeId || storyboardGenerating || (injected.universalOmniPolishRunning && injected.universalOmniPolishRunning.value)"
          @click="$emit('generate:storyboard')"
        >
          {{ storyboards.length > 0 ? '重新生成分镜' : 'AI 生成分镜' }}
        </el-button>
        <ElButton type="info" plain size="large" @click="$emit('add:storyboard')">
          添加一个分镜
        </ElButton>
      </div>
      <template v-if="storyboards.length > 0">
        <div class="sb-batch-right">
          <el-button
            type="success"
            plain
            size="large"
            :loading="batchImageRunning"
            :disabled="!currentEpisodeId || batchImageRunning || batchVideoRunning || (injected.pipelineRunning && injected.pipelineRunning.value) || storyboardGenerating || (injected.universalOmniPolishRunning && injected.universalOmniPolishRunning.value)"
            @click="$emit('start:batch-image')"
          >
            批量生成分镜图
          </el-button>
          <el-button
            type="warning"
            plain
            size="large"
            :loading="batchVideoRunning"
            :disabled="!currentEpisodeId || batchImageRunning || batchVideoRunning || (injected.pipelineRunning && injected.pipelineRunning.value) || storyboardGenerating || (injected.universalOmniPolishRunning && injected.universalOmniPolishRunning.value)"
            @click="$emit('start:batch-video')"
          >
            批量生成分镜视频
          </el-button>
          <el-button v-if="batchImageRunning" size="large" type="danger" plain @click="$emit('stop:batch-image')">停止图片</el-button>
          <el-button v-if="batchVideoRunning" size="large" type="danger" plain @click="$emit('stop:batch-video')">停止视频</el-button>
        </div>
        <div class="batch-video-options" style="margin-top:8px;display:flex;align-items:center;gap:8px;font-size:13px;">
          <el-checkbox :model-value="videoFrameContiguity" size="small" @update:model-value="$emit('update:frame-contiguity', $event)">
            连贯帧模式（自动衔接相邻视频帧）
          </el-checkbox>
          <el-tooltip placement="top" :show-after="100">
            <template #content>
              <div style="max-width:320px;line-height:1.7">
                <div style="font-weight:600;margin-bottom:4px">连贯帧模式说明</div>
                <div>启用后批量视频顺序生成，每条视频的<b>末帧</b>自动截取并作为下一条视频的<b>首帧参考图</b>，减少镜头切换的跳跃感。</div>
                <div style="margin-top:8px;font-weight:600">⚠️ 需要模型支持图生视频（i2v）</div>
                <div style="margin-top:4px">
                  ✅ 支持：kling-video、kling-omni-video、wan2.2-kf2v-flash、wan2.6-i2v-flash<br/>
                  ❌ 不支持（末帧将被忽略）：wan2.6-t2v、wan2.6-r2v-flash、wanx2.1-vace-plus 等纯文生视频模型
                </div>
                <div style="margin-top:8px;color:#faad14">如当前视频模型不支持 i2v，启用此选项不会报错，但末帧衔接不会生效。</div>
              </div>
            </template>
            <el-icon style="color:#9ca3af;cursor:help"><QuestionFilled /></el-icon>
          </el-tooltip>
        </div>
      </template>
    </div>
    <!-- 批量生成进度 -->
    <div v-if="batchImageRunning || batchVideoRunning || batchImageErrors.length || batchVideoErrors.length" class="batch-status">
      <div v-if="batchImageRunning" class="batch-progress">
        <el-icon class="is-loading"><Loading /></el-icon>
        <span>批量生成分镜图：{{ batchImageProgress.current }}/{{ batchImageProgress.total }}</span>
        <span v-if="batchImageProgress.failed > 0" class="batch-failed">{{ batchImageProgress.failed }} 条失败</span>
        <span v-if="batchImageStopping" class="batch-stopping">（正在停止...）</span>
      </div>
      <div v-if="batchVideoRunning" class="batch-progress">
        <el-icon class="is-loading"><Loading /></el-icon>
        <span>批量生成分镜视频：{{ batchVideoProgress.current }}/{{ batchVideoProgress.total }}</span>
        <span v-if="batchVideoProgress.failed > 0" class="batch-failed">{{ batchVideoProgress.failed }} 条失败</span>
        <span v-if="batchVideoStopping" class="batch-stopping">（正在停止...）</span>
      </div>
      <div v-if="batchImageErrors.length > 0" class="batch-error-log">
        <div class="batch-error-title">分镜图生成失败记录：</div>
        <div v-for="(e, i) in batchImageErrors" :key="i" class="batch-error-line">{{ e }}</div>
      </div>
      <div v-if="batchVideoErrors.length > 0" class="batch-error-log">
        <div class="batch-error-title">分镜视频生成失败记录：</div>
        <div v-for="(e, i) in batchVideoErrors" :key="i" class="batch-error-line">{{ e }}</div>
      </div>
    </div>
    <div v-if="storyboardGenerating || (injected.universalOmniPolishRunning && injected.universalOmniPolishRunning.value)" class="storyboard-generating-tip">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span v-if="injected.universalOmniPolishRunning && injected.universalOmniPolishRunning.value">
        正在润色全能提示词：第 {{ injected.universalOmniPolishProgress?.current ?? 0 }} / {{ injected.universalOmniPolishProgress?.total ?? 0 }} 镜
        <template v-if="injected.universalOmniPolishProgress?.label">（{{ injected.universalOmniPolishProgress.label }}）</template>
        …
      </span>
      <span v-else>正在分析剧本并拆解分镜，请稍候...</span>
    </div>
    <div v-if="injected.sbTruncatedWarning && injected.sbTruncatedWarning.value && !(injected.sbTruncatedDismissed && injected.sbTruncatedDismissed.value) && storyboards.length > 0" class="sb-truncated-warning">
      <el-icon><WarningFilled /></el-icon>
      <span>检测到分镜可能不完整（AI 输出被截断），请确认分镜数量是否符合预期，必要时可重新生成。</span>
      <el-button size="small" text @click="injected.sbTruncatedDismissed && (injected.sbTruncatedDismissed.value = true)">关闭</el-button>
    </div>
    <template v-if="storyboards.length > 0">
      <template v-for="(sb, i) in storyboards" :key="sb.id">
        <!-- 段落分隔标头：segment_title 存在且是新段落的第一个镜头时显示 -->
        <div
          v-if="sb.segment_title && (i === 0 || sb.segment_index !== storyboards[i - 1].segment_index)"
          class="segment-header"
        >
          <div class="segment-header-inner">
            <span class="segment-index-badge">第 {{ (sb.segment_index ?? 0) + 1 }} 幕</span>
            <span class="segment-title-text">{{ sb.segment_title }}</span>
            <span class="segment-shot-range">
              镜头 {{ i + 1 }}–{{ (() => {
                let end = i
                while (end + 1 < storyboards.length && storyboards[end + 1].segment_index === sb.segment_index) end++
                return end + 1
              })() }}
            </span>
          </div>
        </div>
      <!-- 分镜控制栏（卡片外，缩进表示属于当前幕） -->
      <div class="sb-ctrl-bar">
        <span class="sb-ctrl-num">{{ i + 1 }}</span>
        <span class="sb-ctrl-title">{{ sb.title || '未命名分镜' }}</span>
        <el-button size="small" plain class="sb-ctrl-btn sb-ctrl-config-btn" @click="$emit('open:video-params-dialog', sb)">⚙ 分镜配置</el-button>
        <el-button
          size="small"
          plain
          class="sb-ctrl-btn sb-ctrl-mode-btn"
          :title="injected.isSbUniversalMode && injected.isSbUniversalMode(sb.id) ? '切换为经典分镜（中间显示参考图）' : '切换为全能模式（中间为片段描述，经典字段保留）'"
          @click="$emit('toggle:universal-mode', sb)"
        >
          {{ injected.isSbUniversalMode && injected.isSbUniversalMode(sb.id) ? '经典分镜' : '全能模式' }}
        </el-button>
        <el-button size="small" plain class="sb-ctrl-btn" title="在本镜头前增加一个分镜" @click="$emit('insert:storyboard', sb)">＋ 新增</el-button>
        <el-button
          class="sb-ctrl-delete"
          type="danger"
          text
          size="small"
          :title="`删除分镜${i + 1}`"
          @click="$emit('delete:storyboard', sb.id)"
        >
          <el-icon><Delete /></el-icon>
        </el-button>
      </div>
      <div :id="'sb-' + sb.id" class="storyboard-row">
        <!-- 左：分镜脚本 -->
        <div class="sb-panel sb-script">
          <div class="sb-script-row sb-script-selects">
            <el-select
              :model-value="injected.getSbCharacterIds ? injected.getSbCharacterIds(sb.id) : []"
              placeholder="选择角色"
              multiple
              collapse-tags
              collapse-tags-tooltip
              size="small"
              class="sb-select"
              @update:model-value="(v) => $emit('select:sb-character', sb.id, v)"
            >
              <el-option
                v-for="c in (characters || [])"
                :key="String(c.id)"
                :label="c.name || '未命名'"
                :value="c.id"
              />
              <template v-if="!(characters || []).length" #empty>
                <span class="sb-select-empty">请先在「角色生成」中添加角色</span>
              </template>
            </el-select>
            <el-select
              :model-value="injected.sbSceneId && injected.sbSceneId[sb.id]"
              placeholder="选择场景"
              clearable
              size="small"
              class="sb-select"
              @update:model-value="(v) => $emit('select:sb-scene', sb.id, v)"
            >
              <el-option
                v-for="s in (scenes || [])"
                :key="s.id"
                :label="s.location"
                :value="s.id"
              />
            </el-select>
            <el-select
              :model-value="injected.getSbPropIds ? injected.getSbPropIds(sb.id) : []"
              placeholder="选择物品"
              multiple
              collapse-tags
              collapse-tags-tooltip
              size="small"
              class="sb-select"
              @update:model-value="(v) => $emit('select:sb-prop', sb.id, v)"
            >
              <el-option
                v-for="p in (propsList || [])"
                :key="String(p.id)"
                :label="p.name || '未命名'"
                :value="p.id"
              />
              <template v-if="!(propsList || []).length" #empty>
                <span class="sb-select-empty">请先在「道具生成」中添加物品</span>
              </template>
            </el-select>
          </div>
          <!-- 当前选中：场景 / 角色 / 物品缩略图 -->
          <div v-if="(injected.getSbSelectedScene && injected.getSbSelectedScene(sb.id)) || (injected.getSbSelectedCharacters && injected.getSbSelectedCharacters(sb.id).length) || (injected.getSbSelectedProps && injected.getSbSelectedProps(sb.id).length) || (characters || []).length" class="sb-selected-thumbs">
            <div v-if="injected.getSbSelectedScene && injected.getSbSelectedScene(sb.id)" class="sb-thumb-row">
              <span class="sb-thumb-label">场景</span>
              <div class="sb-thumb-list">
                <div
                  v-for="s in [injected.getSbSelectedScene(sb.id)]"
                  :key="s.id"
                  class="sb-thumb-item sb-thumb-scene"
                  :class="{ 'sb-thumb-clickable': injected.hasAssetImage && injected.hasAssetImage(s) }"
                  :title="s.location"
                  role="button"
                  @click="injected.hasAssetImage && injected.hasAssetImage(s) && $emit('open-image-preview', assetImageUrl(s))"
                >
                  <img v-if="injected.hasAssetImage && injected.hasAssetImage(s)" :src="assetImageUrl(s)" alt="" />
                  <span v-else class="sb-thumb-placeholder">{{ (s.location || '')[0] }}</span>
                </div>
              </div>
            </div>
            <div v-if="(characters || []).length" class="sb-thumb-row">
              <span class="sb-thumb-label">角色</span>
              <div class="sb-thumb-list">
                <div
                  v-for="c in (injected.getSbSelectedCharacters ? injected.getSbSelectedCharacters(sb.id) : [])"
                  :key="c.id"
                  class="sb-thumb-item sb-thumb-avatar"
                  :class="{ 'sb-thumb-clickable': injected.hasAssetImage && injected.hasAssetImage(c) }"
                  :title="c.name"
                  role="button"
                  @click="injected.hasAssetImage && injected.hasAssetImage(c) && $emit('open-image-preview', assetImageUrl(c))"
                >
                  <img v-if="injected.hasAssetImage && injected.hasAssetImage(c)" :src="assetImageUrl(c)" alt="" />
                  <span v-else class="sb-thumb-placeholder">{{ (c.name || '')[0] }}</span>
                </div>
                <el-dropdown trigger="click" @command="(cmd) => $emit('select:sb-character', sb.id, cmd, true)">
                  <div
                    class="sb-thumb-item sb-thumb-avatar sb-thumb-add-char"
                    title="添加角色"
                    role="button"
                    @click.stop
                  >
                    <el-icon><Plus /></el-icon>
                  </div>
                  <template #dropdown>
                    <el-dropdown-menu class="sb-char-add-dropdown">
                      <el-dropdown-item
                        v-for="c in (injected.charactersAvailableToAddToSb ? injected.charactersAvailableToAddToSb(sb.id) : [])"
                        :key="c.id"
                        :command="c.id"
                      >
                        {{ c.name || '未命名' }}
                      </el-dropdown-item>
                      <el-dropdown-item v-if="!(injected.charactersAvailableToAddToSb ? injected.charactersAvailableToAddToSb(sb.id) : []).length" disabled>
                        已全部添加或无角色
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
            </div>
            <div v-if="injected.getSbSelectedProps && injected.getSbSelectedProps(sb.id).length" class="sb-thumb-row">
              <span class="sb-thumb-label">物品</span>
              <div class="sb-thumb-list">
                <div
                  v-for="p in injected.getSbSelectedProps(sb.id)"
                  :key="p.id"
                  class="sb-thumb-item sb-thumb-prop"
                  :class="{ 'sb-thumb-clickable': injected.hasAssetImage && injected.hasAssetImage(p) }"
                  :title="p.name"
                  role="button"
                  @click="injected.hasAssetImage && injected.hasAssetImage(p) && $emit('open-image-preview', assetImageUrl(p))"
                >
                  <img v-if="injected.hasAssetImage && injected.hasAssetImage(p)" :src="assetImageUrl(p)" alt="" />
                  <span v-else class="sb-thumb-placeholder">{{ (p.name || '')[0] }}</span>
                </div>
              </div>
            </div>
          </div>
          <div class="sb-prompt-label">
            <span class="sb-dot"></span>
            <span>图片提示词</span>
          </div>
          <div class="sb-prompt-row">
            <span class="sb-prompt-text">{{ sb.image_prompt || '暂无图片提示词' }}</span>
            <el-button size="small" link type="primary" @click="$emit('edit:sb-image-prompt', sb)">编辑</el-button>
          </div>
          <template v-if="(injected.storyboardIncludeNarration && injected.storyboardIncludeNarration.value) || (injected.sbNarration && injected.sbNarration[sb.id] || '').trim() || (sb.narration || '').trim()">
            <div class="sb-prompt-label">
              <span class="sb-dot"></span>
              <span>解说旁白</span>
            </div>
            <el-input
              :model-value="injected.sbNarration ? injected.sbNarration[sb.id] : ''"
              type="textarea"
              :rows="2"
              placeholder="本镜解说文案（画外音 / 纪录片式旁白，供 TTS 或导出 SRT）"
              class="sb-narration-input"
              @update:model-value="(v) => { if (injected.sbNarration) injected.sbNarration[sb.id] = v }"
              @blur="$emit('save:universal-segment', sb, 'narration')"
            />
            <div v-if="(injected.sbNarration && (injected.sbNarration[sb.id] || sb.narration || '')).toString().trim()" class="sb-narration-actions">
              <el-tooltip content="解说旁白配音（TTS）" placement="top">
                <el-button size="small" :loading="injected.ttsSbNarrationIds && injected.ttsSbNarrationIds.has && injected.ttsSbNarrationIds.has(sb.id)" @click="$emit('tts:narration', sb)">
                  解说配音
                </el-button>
              </el-tooltip>
              <el-tooltip v-if="injected.sbNarrationAudioRelPath && injected.sbNarrationAudioRelPath(sb)" content="播放解说旁白配音" placement="top">
                <el-button size="small" @click="$emit('play:tts-narration', sb)">
                  <el-icon><VideoPlay /></el-icon>
                </el-button>
              </el-tooltip>
            </div>
          </template>
        </div>
        <!-- 中：经典模式=分镜参考图；全能模式=片段描述（独立字段，与参考图并存） -->
        <div class="sb-panel sb-image" :class="{ 'sb-image--universal': injected.isSbUniversalMode && injected.isSbUniversalMode(sb.id) }">
          <template v-if="injected.isSbUniversalMode && injected.isSbUniversalMode(sb.id)">
            <div class="sb-prompt-label sb-universal-label-row">
              <div class="sb-universal-label-left">
                <span class="sb-dot"></span>
                <span>全能模式片段描述</span>
                <el-tooltip placement="top" :show-after="280" :show-arrow="false" popper-class="sb-universal-tooltip-popper">
                  <template #content>
                    <div class="sb-universal-tooltip">
                      全能生视频链路（<strong>AI 配置 · 视频</strong> 中选接口规范：<code>kling_omni</code> 可灵 Omni，或 <code>volcengine_omni</code> 火山即梦 Seedance 2.0 多图参考；模型如 <code>kling-video-o1</code>、<code>doubao-seedance-2-0-260128</code> 等以控制台为准）：此处为提交主提示词；只要本框有内容，生视频时<strong>只</strong>发送这段，不会拼接下方「视频提示词」里的动作/对话/旁白。参考图顺序一般为：场景 → 角色（多张）→ 物品（<strong>不含</strong>经典分镜中间主图）；请用 <strong>@图片1</strong>、<strong>@图片2</strong>…（<strong>@图片N 后建议加半角空格</strong>）对应参考图，勿用 @姓名 指图；有场景图时 <strong>@图片1</strong> 只表环境，人物从 <strong>@图片2</strong> 起。若场景参考是<strong>四宫格/多视角拼图</strong>，仅借空间与氛围，须在文案中写明<strong>单镜头完整画幅、禁止分屏宫格</strong>，避免成片模仿拼图布局。全能提示词下拉中「生成」会按<strong>本条分镜总时长</strong>与本集剧本、镜序、邻镜信息，自动决定子分镜数 M（第2行「由以下M个分镜…」），第4行起为「分镜1：T1秒:」…多行，且各段秒数之和等于本镜时长；第3行仍为环境/参考图约束；「生成」与「润色」均为<strong>流式输出</strong>到本框；「润色」在此基础上增强。若本框留空，则退回仅用「视频提示词」。
                    </div>
                  </template>
                  <el-icon class="sb-universal-hint-icon" tabindex="0" role="img" aria-label="片段说明">
                    <QuestionFilled />
                  </el-icon>
                </el-tooltip>
              </div>
              <el-dropdown
                trigger="click"
                class="sb-universal-prompt-dd"
                @command="(cmd) => $emit(cmd === 'polish' || cmd === 'polish-force' ? 'polish:universal-segment-prompt' : 'generate:universal-segment-prompt', sb, cmd)"
              >
                <el-button
                  type="primary"
                  link
                  size="small"
                  class="sb-universal-gen-btn"
                  :loading="generatingUniversalSegmentIds.has(sb.id)"
                >
                  全能提示词
                  <el-icon class="sb-universal-dd-caret"><ArrowDown /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="generate">生成全能提示词</el-dropdown-item>
                    <el-dropdown-item command="generate-force">不查图片强制生成</el-dropdown-item>
                    <el-dropdown-item command="polish" :disabled="!(injected.sbUniversalSegmentTrimmed && injected.sbUniversalSegmentTrimmed(sb))">
                      润色全能提示词
                    </el-dropdown-item>
                    <el-dropdown-item command="polish-force" :disabled="!(injected.sbUniversalSegmentTrimmed && injected.sbUniversalSegmentTrimmed(sb))">
                      不查图片强制润色
                    </el-dropdown-item>
                    <el-dropdown-item
                      command="to-grok-video-tags"
                      divided
                      :disabled="!(injected.sbUniversalSegmentTrimmed && injected.sbUniversalSegmentTrimmed(sb))"
                    >
                      改为 grok视频格式
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
            <UniversalSegmentOmniAtEditor
              v-if="!generatingUniversalSegmentIds.has(sb.id)"
              :model-value="injected.sbUniversalSegmentText ? injected.sbUniversalSegmentText[sb.id] : ''"
              :slots="injected.getSbUniversalOmniRefSlots ? injected.getSbUniversalOmniRefSlots(sb) : []"
              class="sb-universal-textarea"
              @update:model-value="(v) => { if (injected.sbUniversalSegmentText) injected.sbUniversalSegmentText[sb.id] = v }"
              @blur="$emit('save:universal-segment', sb, 'universalSegment')"
            />
            <el-input
              v-else
              :model-value="injected.sbUniversalSegmentText ? injected.sbUniversalSegmentText[sb.id] : ''"
              type="textarea"
              :rows="10"
              :autosize="{ minRows: 10, maxRows: 22 }"
              placeholder="例如：@图片1 为夜景街道，@图片2 从餐厅冲出停在光斑里，低头操作手机…"
              class="sb-universal-textarea"
              @update:model-value="(v) => { if (injected.sbUniversalSegmentText) injected.sbUniversalSegmentText[sb.id] = v }"
              @blur="$emit('save:universal-segment', sb, 'universalSegment')"
            />
          </template>
          <template v-else>
          <div
            class="sb-image-area"
            :class="{ 'sb-image-area--dragover': injected.dragOverSbId && injected.dragOverSbId.value === sb.id, 'sb-image-area--has-quad': injected.getStripItems && injected.getStripItems(sb.id).length > 0 }"
            @dragover="(e) => $emit('drag-over:sb', e, sb.id)"
            @dragleave="(e) => $emit('drag-leave:sb', e, sb.id)"
            @drop="(e) => $emit('drop:sb', e, sb)"
          >
            <!-- 主图区：最新选中/默认图 > legacy composed_image > 错误 > 空 -->
            <div class="sb-main-image-wrap">
              <template v-if="injected.getSbImage && injected.getSbImage(sb.id)">
                <img
                  :src="assetImageUrl(injected.getSbImage(sb.id))"
                  class="sb-generated-img"
                  alt=""
                  :title="injected.getSbImage(sb.id).prompt || ''"
                  @click="$emit('open-image-preview', assetImageUrl(injected.getSbImage(sb.id)))"
                />
                <div v-if="injected.getSbImage(sb.id).prompt" class="sb-main-img-prompt">{{ injected.getSbImage(sb.id).prompt }}</div>
              </template>
              <template v-else-if="sb.composed_image || sb.image_url">
                <img
                  :src="injected.imageUrl ? injected.imageUrl(sb.composed_image || sb.image_url) : (sb.composed_image || sb.image_url)"
                  class="sb-generated-img"
                  alt=""
                  @click="$emit('open-image-preview', injected.imageUrl ? injected.imageUrl(sb.composed_image || sb.image_url) : (sb.composed_image || sb.image_url))"
                />
              </template>
              <template v-else-if="sb.error_msg || sb.errorMsg">
                <div class="sb-image-error" :title="sb.error_msg || sb.errorMsg">{{ sb.error_msg || sb.errorMsg }}</div>
                <el-button type="primary" size="small" class="sb-gen-btn" :loading="generatingSbImageIds.has(sb.id)" @click="$emit('generate:sb-image', sb)">
                  <el-icon><Refresh /></el-icon>
                  重试
                </el-button>
                <el-button size="small" :loading="injected.uploadingSbImageId && injected.uploadingSbImageId.value === sb.id" @click="$emit('upload:sb-image', sb)">上传</el-button>
              </template>
              <template v-else>
                <el-button type="primary" size="small" class="sb-gen-btn" :loading="generatingSbImageIds.has(sb.id)" @click="$emit('generate:sb-image', sb)">
                  <el-icon><MagicStick /></el-icon>
                  生成分镜参考图
                </el-button>
                <el-button size="small" :loading="injected.uploadingSbImageId && injected.uploadingSbImageId.value === sb.id" @click="$emit('upload:sb-image', sb)">上传</el-button>
              </template>
            </div>

            <!-- 统一缩略图条：未选中的面板 + 其他已生成图（点击切换主图，不触发上传） -->
            <div v-if="injected.getStripItems && injected.getStripItems(sb.id).length" class="sb-imgs-strip">
              <el-tooltip content="历史图：点击缩略图可设为主图" placement="top" :show-arrow="false">
                <el-icon class="sb-strip-hint-icon"><InfoFilled /></el-icon>
              </el-tooltip>
              <div
                v-for="item in (injected.getStripItems(sb.id))"
                :key="item.key"
                class="sb-img-thumb"
                :title="[item.label, item.prompt].filter(Boolean).join('\n\n') || '点击设为主图'"
                @click="$emit('select:sb-main-image', sb, item)"
              >
                <img :src="item.src" alt="" />
                <span v-if="item.label" class="sb-img-thumb-label">{{ item.label }}</span>
              </div>
            </div>

            <div v-if="injected.dragOverSbId && injected.dragOverSbId.value === sb.id" class="sb-image-area-drop-hint">松开上传</div>
          </div>
          <div v-if="injected.hasSbImage && injected.hasSbImage(sb)" class="sb-image-actions">
            <el-button size="small" :loading="generatingSbImageIds.has(sb.id)" @click="$emit('generate:sb-image', sb)">重新生成</el-button>
            <el-button
              v-if="!(injected.isSbUniversalMode && injected.isSbUniversalMode(sb.id))"
              size="small"
              type="success"
              plain
              :loading="injected.classicVideoPolishIds && injected.classicVideoPolishIds.has && injected.classicVideoPolishIds.has(sb.id)"
              :disabled="generatingSbVideoIds.has(sb.id)"
              @click="$emit('polish:classic-video-prompt', sb)"
            >润色分镜视频提示词</el-button>
            <el-button size="small" :loading="injected.uploadingSbImageId && injected.uploadingSbImageId.value === sb.id" @click="$emit('upload:sb-image', sb)">上传</el-button>
            <el-tooltip content="高清放大（2x超分辨率）" placement="top">
              <el-button
                size="small"
                :loading="injected.upscalingSbIds && injected.upscalingSbIds.has && injected.upscalingSbIds.has(sb.id)"
                :disabled="!(injected.getSbLocalImage && injected.getSbLocalImage(sb))"
                @click="$emit('upscale:sb-image', sb)"
              >
                <el-icon><ZoomIn /></el-icon>超分
              </el-button>
            </el-tooltip>
          </div>
          </template>
        </div>
        <!-- 右：分镜视频（由 /videos?storyboard_id 拉取）；有视频时仍显示提示词与生成按钮便于调整后重新生成 -->
        <div class="sb-panel sb-video">
          <div v-if="injected.getSbVideo && injected.getSbVideo(sb.id)" class="sb-video-area">
            <video
              v-if="injected.assetVideoUrl && injected.assetVideoUrl(injected.getSbVideo(sb.id))"
              :key="injected.sbMainVideoPlayerKey ? injected.sbMainVideoPlayerKey(sb.id) : sb.id"
              :src="injected.assetVideoUrl(injected.getSbVideo(sb.id))"
              controls
              class="sb-video-player"
              preload="metadata"
            />
            <span v-if="generatingSbVideoIds.has(sb.id)" class="sb-video-regenerating-overlay">
              <el-icon class="is-loading"><Loading /></el-icon>
              正在重新生成...
            </span>
          </div>
          <div v-else class="sb-video-area sb-video-placeholder">
            <span v-if="generatingSbVideoIds.has(sb.id)" class="sb-video-generating-text">
              <el-icon class="is-loading"><Loading /></el-icon>
              正在生成视频...
            </span>
            <template v-else>
              <div v-if="injected.getSbVideoError && injected.getSbVideoError(sb.id)" class="sb-video-error">
                {{ injected.getSbVideoError(sb.id) }}
              </div>
              <el-button
                type="primary"
                size="small"
                class="sb-generate-video-btn"
                :loading="generatingSbVideoIds.has(sb.id)"
                :disabled="!(injected.sbCanSubmitVideo && injected.sbCanSubmitVideo(sb))"
                @click="$emit('generate:sb-video', sb)"
              >
                生成分镜视频
              </el-button>
            </template>
          </div>
          <!-- 视频历史条：有多条历史时显示，点击可切换 -->
          <div v-if="injected.getVideoStripItems && injected.getVideoStripItems(sb.id).length" class="sb-videos-strip">
            <el-tooltip content="历史视频：点击可切换为当前视频" placement="top" :show-arrow="false">
              <el-icon class="sb-strip-hint-icon"><InfoFilled /></el-icon>
            </el-tooltip>
            <div
              v-for="item in (injected.getVideoStripItems(sb.id))"
              :key="item.key"
              class="sb-video-thumb"
              :title="`${item.label}（点击切换）`"
              @click="$emit('select:sb-main-video', sb, item.video)"
            >
              <video :src="item.src" preload="metadata" class="sb-video-thumb-player" />
              <span class="sb-video-thumb-label">{{ item.label }}</span>
            </div>
          </div>
          <div v-if="injected.getSbVideo && injected.getSbVideo(sb.id)" class="sb-video-actions">
            <el-button size="small" :loading="generatingSbVideoIds.has(sb.id)" :disabled="!(injected.sbCanSubmitVideo && injected.sbCanSubmitVideo(sb))" @click="$emit('generate:sb-video', sb)">重新生成</el-button>
            <el-tooltip v-if="sb.dialogue" content="对白配音（TTS）" placement="top">
              <el-button size="small" :loading="injected.ttsSbIds && injected.ttsSbIds.has && injected.ttsSbIds.has(sb.id)" @click="$emit('tts:dialogue', sb)">
                对白配音
              </el-button>
            </el-tooltip>
            <el-tooltip v-if="sb.dialogue && injected.sbDialogueAudioRelPath && injected.sbDialogueAudioRelPath(sb)" content="播放对白配音" placement="top">
              <el-button size="small" @click="$emit('play:tts-dialogue', sb)">
                <el-icon><VideoPlay /></el-icon>
              </el-button>
            </el-tooltip>
          </div>
          <div class="sb-video-prompt-label">
            <span class="sb-dot"></span>
            <span>经典视频提示词</span>
          </div>
          <div class="sb-video-params-bar">
            <span class="sb-video-prompt-text sb-video-prompt-text--preview">{{ sb.video_prompt || '暂无视频提示词' }}</span>
            <el-button size="small" link type="primary" @click="$emit('edit:sb-video-prompt', sb)">手工编辑</el-button>
          </div>
        </div>
      </div>
      </template>
    </template>
    <!-- 分镜生成中提示条 -->
    <div v-if="storyboardGenerating || (injected.universalOmniPolishRunning && injected.universalOmniPolishRunning.value)" class="sb-generating-tip">
      <span class="sb-gen-dot" /><span class="sb-gen-dot" /><span class="sb-gen-dot" />
      <span v-if="injected.universalOmniPolishRunning && injected.universalOmniPolishRunning.value" class="sb-gen-text">
        全能片段润色中 {{ injected.universalOmniPolishProgress?.current ?? 0 }}/{{ injected.universalOmniPolishProgress?.total ?? 0 }}
        <template v-if="injected.universalOmniPolishProgress?.label"> · {{ injected.universalOmniPolishProgress.label }}</template>
      </span>
      <span v-else class="sb-gen-text">分镜持续生成中，客官稍等片刻…</span>
    </div>
    <div v-else-if="storyboards.length === 0" class="empty-tip">请先生成分镜</div>
  </section>
</template>

<script setup>
import { inject, computed } from 'vue'
import {
  Loading,
  QuestionFilled,
  Delete,
  Plus,
  Refresh,
  MagicStick,
  ZoomIn,
  VideoPlay,
  ArrowDown,
  InfoFilled,
  WarningFilled
} from '@element-plus/icons-vue'
import { assetImageUrl } from '@/utils/assetImageUrl.js'
import UniversalSegmentOmniAtEditor from '@/components/UniversalSegmentOmniAtEditor.vue'

defineOptions({ name: 'StoryboardSection' })

const props = defineProps({
  storyboards: { type: Array, default: () => [] },
  sbImages: { type: Object, default: () => ({}) },
  sbVideos: { type: Object, default: () => ({}) },
  storyboardGenerating: { type: Boolean, default: false },
  batchImageRunning: { type: Boolean, default: false },
  batchVideoRunning: { type: Boolean, default: false },
  batchImageStopping: { type: Boolean, default: false },
  batchVideoStopping: { type: Boolean, default: false },
  batchImageProgress: { type: Object, default: () => ({ current: 0, total: 0, failed: 0 }) },
  batchVideoProgress: { type: Object, default: () => ({ current: 0, total: 0, failed: 0 }) },
  batchImageErrors: { type: Array, default: () => [] },
  batchVideoErrors: { type: Array, default: () => [] },
  videoFrameContiguity: { type: Boolean, default: false },
  dramaId: { type: [String, Number], default: '' },
  currentEpisodeId: { type: [String, Number], default: '' },
  characters: { type: Array, default: () => [] },
  scenes: { type: Array, default: () => [] },
  props: { type: Array, default: () => [] },
  generatingSbImageIds: { type: Set, default: () => new Set() },
  generatingSbVideoIds: { type: Set, default: () => new Set() },
  generatingUniversalSegmentIds: { type: Set, default: () => new Set() },
  isDark: { type: Boolean, default: false }
})

defineEmits([
  'generate:storyboard',
  'add:storyboard',
  'delete:storyboard',
  'insert:storyboard',
  'generate:sb-image',
  'generate:sb-video',
  'upload:sb-image',
  'upscale:sb-image',
  'start:batch-image',
  'stop:batch-image',
  'start:batch-video',
  'stop:batch-video',
  'update:frame-contiguity',
  'select:sb-character',
  'select:sb-scene',
  'select:sb-prop',
  'tts:dialogue',
  'tts:narration',
  'open:prompt-dialog',
  'open:video-params-dialog',
  'edit:sb-image-prompt',
  'edit:sb-video-prompt',
  'play:tts-dialogue',
  'play:tts-narration',
  'select:sb-main-image',
  'select:sb-main-video',
  'drag-over:sb',
  'drag-leave:sb',
  'drop:sb',
  'toggle:universal-mode',
  'save:universal-segment',
  'generate:universal-segment-prompt',
  'polish:universal-segment-prompt',
  'export:narration-srt',
  'open-image-preview',
  'polish:classic-video-prompt'
])

/**
 * Injected state from parent FilmCreate.vue.
 * Parent provides these via provide('storyboardSection', { ... }).
 * Each key is a reactive ref, reactive object, or function as needed.
 */
const injected = inject('storyboardSection', {})

/**
 * Alias for props.props to avoid collision with JS reserved word.
 * Template uses propsList via the alias.
 */
const propsList = computed(() => props.props)
</script>

<style scoped>
/* === Storyboard Rows — staggered fadeInUp === */
@keyframes sb-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes sb-stagger-1 { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes sb-stagger-2 { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

/* === Segment Headers === */
.segment-header {
  margin: 24px 0 14px;
  position: relative;
}
.segment-header:first-child { margin-top: 0; }
.segment-header-inner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 18px;
  background: linear-gradient(90deg, var(--accent-soft) 0%, transparent 80%);
  border-left: 3px solid var(--accent);
  border-radius: 0 12px 12px 0;
}
.segment-index-badge {
  font-size: 11px;
  font-weight: 600;
  color: var(--accent);
  background: var(--accent-soft);
  padding: 2px 8px;
  border-radius: 20px;
  letter-spacing: 0.3px;
  white-space: nowrap;
}
.segment-title-text {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  flex: 1;
  letter-spacing: -0.01em;
}
.segment-shot-range {
  font-size: 11px;
  color: var(--text-faint);
  white-space: nowrap;
}
:global(html.light) .segment-header-inner {
  background: linear-gradient(90deg, var(--accent-soft) 0%, transparent 80%);
  border-left-color: var(--accent);
}
:global(html.light) .segment-title-text { color: var(--text-primary); }
:global(html.light) .segment-index-badge { color: var(--accent); background: var(--accent-soft); }
:global(html.light) .segment-shot-range { color: var(--text-faint); }

/* === Storyboard Row — Glass with staggered fadeInUp === */
.storyboard-row {
  display: flex;
  align-items: flex-start;
  gap: 0;
  margin-bottom: 16px;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  border: 1px solid var(--glass-border);
  overflow: hidden;
  position: relative;
  transition: border-color var(--duration-fast) ease, box-shadow var(--duration-fast) ease;
  animation: sb-fade-in 0.45s ease both;
  box-shadow: var(--shadow-card);
}
.storyboard-row:nth-child(2) { animation-delay: 0.05s; }
.storyboard-row:nth-child(3) { animation-delay: 0.1s; }
.storyboard-row:nth-child(4) { animation-delay: 0.15s; }
.storyboard-row:nth-child(5) { animation-delay: 0.2s; }
.storyboard-row:hover {
  border-color: var(--accent-border);
  box-shadow: var(--shadow-hover);
}
:global(html.light) .storyboard-row {
  background: var(--bg-card);
  border-color: var(--glass-border);
  box-shadow: var(--shadow-card);
}
:global(html.light) .storyboard-row:hover {
  border-color: var(--accent-border);
  box-shadow: var(--shadow-hover);
}
.storyboard-row:last-child { margin-bottom: 0; }

/* === Storyboard Control Bar === */
.sb-ctrl-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: 32px;
  margin-bottom: 4px;
  height: 26px;
}
.sb-ctrl-num {
  background: var(--accent);
  color: var(--bg-page);
  border-radius: 6px;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}
.sb-ctrl-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary);
  max-width: 12em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
:global(html.light) .sb-ctrl-title {
  color: var(--text-primary);
}
.sb-ctrl-btn.el-button {
  height: 22px;
  padding: 0 8px;
  font-size: 11px;
}
.sb-ctrl-config-btn.el-button {
  border-color: var(--accent-border);
  color: var(--accent);
  background: var(--accent-soft);
}
.sb-ctrl-config-btn.el-button:hover {
  border-color: var(--accent);
  color: var(--text-bright);
  background: var(--accent-border);
}
:global(html.light) .sb-ctrl-config-btn.el-button {
  border-color: var(--accent-border);
  color: var(--accent);
  background: var(--accent-muted);
}
:global(html.light) .sb-ctrl-config-btn.el-button:hover {
  border-color: var(--accent);
  color: var(--text-bright);
  background: var(--accent);
}
.sb-ctrl-delete {
  margin-left: auto;
  opacity: 0.4;
  transition: opacity 0.2s;
  height: 22px;
  padding: 0 4px;
}
.sb-ctrl-bar:hover .sb-ctrl-delete {
  opacity: 1;
}

/* === SB Panel — Glass === */
.sb-panel {
  flex: 1;
  min-width: 0;
  padding: 14px 16px;
  border-right: 1px solid var(--glass-border);
  display: flex;
  flex-direction: column;
  background: var(--bg-card);
}
:global(html.light) .sb-panel {
  border-right-color: var(--glass-border);
}
.sb-panel:last-child { border-right: none; }
.sb-panel-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 10px;
}
.sb-panel-title .el-icon { font-size: 1rem; color: var(--text-muted); }
.sb-panel-title-name {
  margin-left: 4px;
  color: var(--text-muted);
  font-weight: 500;
  max-width: 12em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sb-script { padding-top: 10px; }
.sb-script-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}
.sb-select { flex: 1; min-width: 0; }
.sb-select-empty { font-size: 0.8rem; color: var(--text-subtle); padding: 8px; }
.sb-selected-thumbs {
  margin: 10px 0;
  padding: 8px 0;
  border-top: 1px solid var(--glass-border);
}
.sb-thumb-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.sb-thumb-row:last-child { margin-bottom: 0; }
.sb-thumb-label {
  font-size: 0.8rem;
  color: var(--text-subtle);
  flex-shrink: 0;
  width: 36px;
}
.sb-thumb-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.sb-thumb-item {
  flex-shrink: 0;
  border-radius: 6px;
  overflow: hidden;
  background: var(--bg-inner);
}
.sb-thumb-item.sb-thumb-clickable {
  cursor: pointer;
}
.sb-thumb-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
}
.sb-thumb-add-char {
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border: 1.5px dashed var(--text-faint);
  background: transparent;
  color: var(--text-muted);
  transition: color 0.15s, border-color 0.15s, background 0.15s;
}
.sb-thumb-add-char:hover {
  color: var(--text-primary);
  border-color: var(--accent-border);
  background: var(--bg-hover);
}
:global(html.light) .sb-thumb-add-char {
  border-color: var(--border-muted);
  color: var(--text-subtle);
}
:global(html.light) .sb-thumb-add-char:hover {
  color: var(--text-primary);
  border-color: var(--accent-border);
  background: var(--bg-hover);
}
.sb-thumb-prop,
.sb-thumb-scene {
  width: 36px;
  height: 36px;
}
.sb-script-row.sb-script-selects {
  gap: 6px;
}
.sb-script-row.sb-script-selects .sb-select {
  min-width: 0;
}
.sb-script-row.sb-script-selects .el-select { flex: 1; min-width: 0; }
.sb-thumb-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.sb-thumb-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  color: var(--text-muted);
  background: var(--bg-inner);
}
.sb-script-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  color: var(--text-subtle);
  margin-bottom: 6px;
}
.sb-script-label .el-icon { font-size: 0.9rem; }
.sb-upload-icon { margin-left: auto; cursor: pointer; color: var(--text-muted); }
.sb-meta {
  font-size: 0.75rem;
  color: var(--text-subtle);
  display: flex;
  gap: 12px;
}

/* === SB Image Area — Dark bg with glass border === */
.sb-image-area {
  flex: 1;
  min-height: 200px;
  max-height: 320px;
  background: var(--bg-page);
  border: 1px dashed var(--accent-border);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  overflow: hidden;
  position: relative;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.sb-image-area:hover {
  border-color: var(--accent);
}
:global(html.light) .sb-image-area {
  background: var(--bg-page);
  border-color: var(--accent-border);
}
:global(html.light) .sb-image-area:hover {
  border-color: var(--accent);
}
.sb-image-area--dragover {
  outline: 2px dashed var(--accent);
  outline-offset: -2px;
  background: var(--accent-soft);
}
.sb-image-area-drop-hint {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 0.9rem;
  border-radius: 10px;
  pointer-events: none;
}
.sb-generated-img {
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  object-fit: contain;
  border-radius: 8px;
}
.sb-image-file-input { position: absolute; width: 0; height: 0; opacity: 0; pointer-events: none; }
.sb-gen-btn { margin-top: 4px; }
.sb-image-area img.sb-generated-img { cursor: pointer; }
.sb-panel.sb-image.sb-image--universal {
  min-height: 300px;
  justify-content: flex-start;
}
.sb-universal-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  width: 100%;
}
.sb-universal-label-left {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.sb-universal-hint-icon {
  cursor: help;
  color: var(--text-faint);
  font-size: 16px;
  flex-shrink: 0;
}
.sb-universal-hint-icon:hover {
  color: var(--accent);
}
.sb-universal-gen-btn {
  flex-shrink: 0;
}
.sb-universal-prompt-dd {
  flex-shrink: 0;
}
.sb-universal-dd-caret {
  margin-left: 2px;
  font-size: 12px;
  vertical-align: middle;
}
:global(.sb-universal-tooltip-popper.el-popper) {
  padding: 0 !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
}
.sb-universal-tooltip {
  max-width: 360px;
  font-size: 12px;
  line-height: 1.55;
  padding: 10px 12px;
  border-radius: 10px;
  color: var(--text-primary);
  background: var(--bg-card-solid);
  border: 1px solid var(--glass-border);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}
.sb-universal-tooltip strong {
  font-weight: 600;
  color: var(--text-bright);
}
:global(html.light) .sb-universal-tooltip {
  color: var(--text-primary);
  background: var(--bg-card-solid);
  border-color: var(--glass-border);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
}
:global(html.light) .sb-universal-tooltip strong {
  color: var(--text-bright);
}
.sb-universal-textarea {
  flex: 1;
  min-height: 0;
}
.sb-universal-textarea :deep(.el-textarea__inner) {
  min-height: 220px !important;
  font-size: 13px;
  line-height: 1.55;
}
.sb-ctrl-mode-btn.el-button {
  border-color: rgba(34, 197, 94, 0.35);
  color: #86efac;
  background: rgba(34, 197, 94, 0.08);
}
.sb-ctrl-mode-btn.el-button:hover {
  border-color: #22c55e;
  color: #fff;
  background: rgba(34, 197, 94, 0.45);
}
:global(html.light) .sb-ctrl-mode-btn.el-button {
  border-color: rgba(22, 163, 74, 0.35);
  color: #15803d;
  background: rgba(22, 163, 74, 0.06);
}
:global(html.light) .sb-ctrl-mode-btn.el-button:hover {
  border-color: #16a34a;
  color: #fff;
  background: #16a34a;
}
.sb-image-area--has-quad {
  flex-direction: column;
  align-items: stretch;
  overflow-y: auto;
  max-height: 340px;
}

/* === SB Image Strip === */
.sb-imgs-strip {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  gap: 4px;
  width: 100%;
  padding: 6px 8px 4px;
  overflow-x: auto;
  border-top: 1px solid var(--glass-border);
  flex-shrink: 0;
}
.sb-strip-hint-icon {
  font-size: 12px;
  color: var(--text-faint);
  cursor: default;
  transition: color 0.15s;
}
.sb-strip-hint-icon:hover {
  color: var(--accent);
}
.sb-img-thumb {
  position: relative;
  cursor: pointer;
  border-radius: 6px;
  overflow: hidden;
  border: 2px solid transparent;
  transition: border-color 0.2s;
  flex-shrink: 0;
  width: 52px;
  height: 52px;
}
.sb-img-thumb:hover { border-color: var(--accent); }
.sb-img-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.sb-img-thumb-label {
  position: absolute;
  bottom: 1px;
  left: 0;
  right: 0;
  text-align: center;
  font-size: 10px;
  color: #fff;
  background: rgba(0,0,0,0.5);
  border-radius: 0 0 4px 4px;
  pointer-events: none;
}
.sb-main-image-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 80px;
}
.sb-main-img-prompt {
  width: 100%;
  font-size: 10px;
  color: var(--text-muted);
  background: var(--bg-inner);
  border-top: 1px solid var(--glass-border);
  padding: 4px 6px;
  line-height: 1.4;
  max-height: 48px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  word-break: break-all;
  cursor: default;
}
.sb-image-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  flex-shrink: 0;
  padding-top: 6px;
}

/* === SB Video Area === */
.sb-video-area {
  flex: 1;
  min-height: 200px;
  background: var(--bg-page);
  border: 1px dashed var(--accent-border);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.2s, box-shadow 0.2s;
}
:global(html.light) .sb-video-area {
  background: var(--bg-page);
  border-color: var(--accent-border);
}
.sb-video-placeholder {
  color: var(--text-subtle);
  font-size: 0.9rem;
  flex-direction: column;
  gap: 10px;
  text-align: center;
  padding: 16px;
}
:global(html.light) .sb-video-placeholder {
  color: var(--text-muted);
}
.sb-video-generating-text {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--accent);
  font-size: 0.85rem;
}
.sb-video-error {
  color: #f87171;
  font-size: 0.75rem;
  line-height: 1.4;
  word-break: break-word;
  max-height: 80px;
  overflow-y: auto;
  padding: 4px 8px;
  background: rgba(239, 68, 68, 0.06);
  border: 1px solid rgba(239, 68, 68, 0.25);
  border-radius: 6px;
  text-align: left;
  width: 100%;
}
.sb-video-player {
  width: 100%;
  max-height: 240px;
  border-radius: 8px;
}
.sb-video-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  flex-shrink: 0;
  padding-top: 6px;
}
.sb-video-regenerating-overlay {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 6px;
  font-size: 0.82rem;
  color: var(--accent);
}
.sb-videos-strip {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  flex-wrap: wrap;
}
.sb-video-thumb {
  position: relative;
  width: 72px;
  height: 48px;
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  border: 1.5px solid transparent;
  flex-shrink: 0;
  transition: border-color 0.15s;
}
.sb-video-thumb:hover {
  border-color: var(--accent);
}
.sb-video-thumb-player {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  pointer-events: none;
}
.sb-video-thumb-label {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0,0,0,0.55);
  color: var(--text-primary);
  font-size: 0.65rem;
  text-align: center;
  padding: 1px 0;
  pointer-events: none;
}
.sb-video-prompt-label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.sb-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  flex-shrink: 0;
}
.sb-video-prompt-label > span:not(.sb-dot) { font-size: 0.85rem; color: var(--text-primary); }
.sb-video-params-bar {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 4px 0;
}
.sb-video-params-bar .sb-video-prompt-text {
  flex: 1;
  min-width: 0;
}
.sb-video-prompt-text {
  font-size: 0.85rem;
  color: var(--text-muted);
  line-height: 1.5;
  padding: 8px 0;
}
.sb-video-prompt-text--preview {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-all;
}
.sb-generate-video-btn { margin-top: 8px; }
.sb-prompt-label { display: flex; align-items: center; gap: 8px; margin: 10px 0 6px; }
.sb-prompt-label .sb-dot { flex-shrink: 0; }
.sb-prompt-label > span:not(.sb-dot) { font-size: 0.85rem; color: var(--text-primary); }
.sb-prompt-row { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 6px; }
.sb-prompt-row .sb-prompt-text { flex: 1; min-width: 0; font-size: 0.85rem; color: var(--text-muted); line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

/* === Batch Actions === */
.sb-batch-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
}
.sb-batch-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.batch-status {
  margin-top: 12px;
  padding: 12px 16px;
  background: var(--bg-inner);
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  font-size: 13px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.batch-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-primary);
  font-weight: 500;
}
.batch-failed {
  color: var(--el-color-danger);
  font-size: 12px;
}
.batch-stopping {
  color: var(--el-color-warning);
  font-size: 12px;
}
.batch-error-log {
  padding: 10px 12px;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  font-size: 13px;
  color: #f87171;
  max-height: 160px;
  overflow-y: auto;
}
.batch-error-title {
  font-weight: 600;
  margin-bottom: 6px;
  color: #f87171;
}
.batch-error-line {
  margin-bottom: 3px;
  word-break: break-all;
}

/* === Warnings & Tips === */
.sb-truncated-warning {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  margin-bottom: 14px;
  background: rgba(234, 179, 8, 0.08);
  border: 1px solid rgba(234, 179, 8, 0.35);
  border-radius: 10px;
  color: #fbbf24;
  font-size: 0.875rem;
  line-height: 1.5;
}
.sb-truncated-warning .el-icon {
  flex-shrink: 0;
  font-size: 1rem;
  color: #fbbf24;
}
.sb-truncated-warning span {
  flex: 1;
}

/* === Generating Tip === */
.sb-generating-tip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 18px;
  margin-top: 10px;
  background: var(--accent-soft);
  border: 1px dashed var(--accent-border);
  border-radius: 12px;
  color: var(--accent);
  font-size: 0.9rem;
}
.sb-gen-text {
  flex: 1;
  letter-spacing: 0.03em;
}
.sb-gen-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent);
  animation: sb-dot-bounce 1.2s infinite ease-in-out both;
}
.sb-gen-dot:nth-child(1) { animation-delay: 0s; }
.sb-gen-dot:nth-child(2) { animation-delay: 0.2s; }
.sb-gen-dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes sb-dot-bounce {
  0%, 80%, 100% { transform: scale(0.8); opacity: 0.7; }
  40%            { transform: scale(1);   opacity: 1;   }
}

/* === SB Config === */
.sb-config-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}

/* === Narration === */
.sb-narration-export-row :deep(.el-checkbox__label) {
  color: var(--text-primary);
  font-size: 0.875rem;
  line-height: 1.45;
}
:global(html.light) .sb-narration-export-row :deep(.el-checkbox__label) {
  color: var(--text-primary);
}
.sb-export-srt-btn.el-button--primary.is-plain {
  --el-button-bg-color: var(--accent-border);
  --el-button-border-color: var(--accent);
  --el-button-text-color: #fff;
  --el-button-hover-text-color: #fff;
  --el-button-hover-bg-color: var(--accent);
  --el-button-hover-border-color: var(--accent);
}
:global(html.light) .sb-export-srt-btn.el-button--primary.is-plain {
  --el-button-bg-color: var(--accent);
  --el-button-border-color: var(--accent-dim);
  --el-button-text-color: #fff;
  --el-button-hover-text-color: #fff;
  --el-button-hover-bg-color: var(--accent-dim);
  --el-button-hover-border-color: var(--accent-dim);
}
.sb-narration-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}
.sb-narration-input :deep(.el-textarea__inner) {
  color: var(--text-primary) !important;
  background-color: var(--bg-inner) !important;
  border-color: var(--glass-border) !important;
  box-shadow: none;
}
.sb-narration-input :deep(.el-textarea__inner::placeholder) {
  color: var(--text-subtle) !important;
}
:global(html.light) .sb-narration-input :deep(.el-textarea__inner) {
  color: var(--text-primary) !important;
  background-color: var(--bg-card-solid) !important;
  border-color: var(--glass-border) !important;
}
:global(html.light) .sb-narration-input :deep(.el-textarea__inner::placeholder) {
  color: var(--text-faint) !important;
}

/* === Storyboard Generating Tip (top) === */
.storyboard-generating-tip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 18px;
  margin-top: 10px;
  background: var(--accent-soft);
  border: 1px dashed var(--accent-border);
  border-radius: 12px;
  color: var(--accent);
  font-size: 0.9rem;
}
</style>
