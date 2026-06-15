<template>
  <!-- 资源管理：角色 / 道具 / 场景 -->
  <section class="section card resource-panel">
    <div class="collapse-header" @click="$emit('toggle:resource-panel')">
      <h2 class="section-title">资源管理</h2>
      <el-icon class="collapse-icon"><ArrowUp v-if="!resourcePanelCollapsed" /><ArrowDown v-else /></el-icon>
    </div>
    <div v-show="!resourcePanelCollapsed" class="resource-panel-body">
      <!-- 角色生成 -->
      <div id="anchor-characters" class="resource-block card">
        <div class="collapse-header resource-block-header" @click="$emit('toggle:characters-block')">
          <h3 class="resource-block-title">角色生成</h3>
          <el-icon class="collapse-icon"><ArrowUp v-if="!charactersBlockCollapsed" /><ArrowDown v-else /></el-icon>
        </div>
        <div v-show="!charactersBlockCollapsed" class="resource-block-body">
          <div class="asset-actions">
            <el-button type="primary" size="small" :loading="charactersGenerating" :disabled="!dramaId" @click="$emit('extract:characters')">
              剧本自动提取角色
            </el-button>
            <el-button size="small" :disabled="!dramaId" @click="$emit('add:character')">添加角色</el-button>
            <el-button size="small" @click="$emit('library:character')">本剧角色库</el-button>
          </div>
          <div class="asset-list asset-list-two">
            <div v-for="char in characters" :key="char.id" class="asset-item asset-item-left-right">
              <div class="asset-info">
                <div class="asset-name">
                  <span style="display:inline-flex;align-items:center;gap:4px;flex:1;min-width:0;overflow:hidden">
                    <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ char.name }}</span>
                    <el-tag v-if="char.role" size="small" effect="plain" :type="char.role === 'main' ? 'danger' : char.role === 'supporting' ? 'warning' : 'info'" style="flex-shrink:0;padding:0 5px;font-size:11px;height:18px;line-height:18px">{{ charRoleLabel(char.role) }}</el-tag>
                  </span>
                  <el-button type="danger" text size="small" class="btn-delete-icon" title="删除" @click="$emit('delete:character', char)">
                    <el-icon><Delete /></el-icon>
                  </el-button>
                </div>
                <div class="asset-desc-full">{{ char.appearance || char.description || '暂无描述' }}</div>
                <div class="asset-btns">
                  <el-button size="small" @click="$emit('edit:character', char)">编辑</el-button>
                  <el-button size="small" :type="isCharInLibrary(char) ? 'success' : ''" :loading="addingCharToLibraryId === char.id" :disabled="!hasAssetImage(char) || isCharInLibrary(char)" @click="$emit('add-to-library:character', char)">
                    {{ isCharInLibrary(char) ? '已加入本剧库' : '加入本剧库' }}
                  </el-button>
                  <el-button size="small" :type="isCharInMaterialLibrary(char) ? 'success' : ''" :loading="addingCharToMaterialId === char.id" :disabled="!hasAssetImage(char) || isCharInMaterialLibrary(char)" @click="$emit('add-to-material-library:character', char)">
                    {{ isCharInMaterialLibrary(char) ? '已加入素材库' : '加入素材库' }}
                  </el-button>
                  <span v-if="char.seedance2_asset?.status !== 'active'" class="sd2-cert-btn-wrap">
                    <el-button
                      size="small"
                      type="warning"
                      plain
                      :loading="sd2CertifyingId === char.id"
                      :disabled="!hasAssetImage(char)"
                      title="将角色主图注册到即梦素材库（与官方接口一致），供 Seedance 2.0 / 即梦 2.0 等引用 asset://"
                      @click="$emit('certify-sd2:character', char)"
                    >
                      SD2认证
                    </el-button>
                    <el-tooltip placement="top" :show-after="280" popper-class="sd2-cert-tooltip">
                      <template #content>
                        <div class="sd2-tooltip-inner">
                          <div class="sd2-tooltip-status">{{ charSd2TagText(char) }}</div>
                          <p class="sd2-tooltip-p">
                            即梦 2.0 等模型需先在即梦素材库完成认证后方可引用本角色图（接口形态参见
                            <a href="https://83zi.com/sd2realperson.html" target="_blank" rel="noopener noreferrer">官方素材管理 API 说明</a>，base_url 可换用自建或其它兼容网关）。
                          </p>
                        </div>
                      </template>
                      <span class="sd2-help-trigger" role="button" tabindex="0" aria-label="SD2 认证说明">
                        <el-icon><QuestionFilled /></el-icon>
                      </span>
                    </el-tooltip>
                  </span>
                  <el-button
                    v-if="char.seedance2_asset?.hub_asset_id && char.seedance2_asset?.status !== 'active'"
                    size="small"
                    link
                    type="primary"
                    :loading="sd2CertifyingId === char.id"
                    @click="$emit('certify-sd2:character', { ...char, _refresh: true })"
                  >
                    刷新认证状态
                  </el-button>
                  <el-button
                    v-if="char.seedance2_asset?.status === 'active'"
                    size="small"
                    type="success"
                    plain
                    title="查看即梦素材库中的 SD2 登记信息"
                    @click="$emit('certify-sd2:character', { ...char, _view: true })"
                  >
                    查看sd2认证
                  </el-button>
                </div>
                <div v-if="getCharAffectedStoryboards(char.id).length" class="asset-storyboard-link">
                  <span class="asl-label">影响的分镜：</span>
                  <span
                    v-for="sb in getCharAffectedStoryboards(char.id)"
                    :key="sb.id"
                    class="asl-chip"
                    title="点击跳转到该分镜"
                    @click="$emit('regen-storyboards:character', { scrollToSbId: sb.id })"
                  >#{{ sb.storyboard_number }}</span>
                  <span v-if="regenSbImagesForAsset.has('char-' + char.id) && regenSbImagesProgress['char-' + char.id]" class="asl-progress">
                    {{ regenSbImagesProgress['char-' + char.id].current }}/{{ regenSbImagesProgress['char-' + char.id].total }}
                  </span>
                  <el-button
                    size="small"
                    class="asl-regen-btn"
                    :loading="regenSbImagesForAsset.has('char-' + char.id)"
                    @click="$emit('regen-storyboards:character', { assetKey: 'char-' + char.id, storyboards: getCharAffectedStoryboards(char.id) })"
                  >
                    <span v-if="!regenSbImagesForAsset.has('char-' + char.id)">↻ 重新生成分镜图</span>
                  </el-button>
                </div>
              </div>
              <div class="asset-cover-wrap">
                <div
                  class="asset-cover"
                  :class="{ 'asset-cover--clickable': hasAssetImage(char), 'asset-cover--dragover': dragOverResourceKey === 'char-' + char.id }"
                  role="button"
                  tabindex="0"
                  @click="hasAssetImage(char) && $emit('preview-image', assetImageUrl(char))"
                  @dragover="$emit('drag-over:character', { event: $event, id: char.id })"
                  @dragleave="$emit('drag-leave:character', { event: $event, key: 'char-' + char.id })"
                  @drop="$emit('drop:character', { event: $event, id: char.id })"
                >
                  <img v-if="hasAssetImage(char)" :src="assetImageUrl(char)" class="cover-img" alt="" />
                  <div v-else-if="char.error_msg || char.errorMsg" class="cover-placeholder error" :title="char.error_msg || char.errorMsg">{{ char.error_msg || char.errorMsg }}</div>
                  <div v-else class="cover-placeholder">暂无图</div>
                  <div v-if="dragOverResourceKey === 'char-' + char.id" class="asset-cover-drop-hint">松开上传</div>
                </div>
                <!-- 额外参考图条 -->
                <div v-if="parseExtraImages(char).length" class="extra-images-strip">
                  <div v-for="ep in parseExtraImages(char)" :key="ep" class="extra-thumb" :title="'点击设为主图'">
                    <img :src="localPathToUrl(ep)" alt="" @click="$emit('set-primary-image', { type: 'character', item: char, path: ep })" />
                    <button class="extra-thumb-remove" title="移除" @click.stop="$emit('remove-extra-image', { type: 'character', item: char, path: ep })">×</button>
                  </div>
                </div>
                <div class="asset-cover-actions">
                  <el-button type="primary" size="small" :loading="generatingCharIds.has(char.id)" @click="$emit('generate-image:character', char)">
                    <el-icon v-if="!generatingCharIds.has(char.id)"><MagicStick /></el-icon>
                    AI 生成
                  </el-button>
                  <el-button type="success" size="small" :loading="uploadingResourceId === 'char-' + char.id" @click="$emit('upload-click:character', char.id)">
                    <el-icon v-if="uploadingResourceId !== 'char-' + char.id"><Upload /></el-icon>
                    上传
                  </el-button>
                </div>
              </div>
            </div>
            <div v-if="characters.length === 0" class="empty-tip">暂无角色，请先「AI 生成角色」或在上一步保存剧本后提取</div>
          </div>
        </div>
      </div>

      <!-- 道具生成 -->
      <div id="anchor-props" class="resource-block card">
        <div class="collapse-header resource-block-header" @click="$emit('toggle:props-block')">
          <h3 class="resource-block-title">道具生成</h3>
          <el-icon class="collapse-icon"><ArrowUp v-if="!propsBlockCollapsed" /><ArrowDown v-else /></el-icon>
        </div>
        <div v-show="!propsBlockCollapsed" class="resource-block-body">
          <div class="asset-actions">
            <el-button type="primary" size="small" :loading="propsExtracting" :disabled="!currentEpisodeId" @click="$emit('extract:props')">从剧本提取道具</el-button>
            <el-button size="small" :disabled="!dramaId" @click="$emit('add:prop')">添加道具</el-button>
            <el-button size="small" @click="$emit('library:prop')">本剧道具库</el-button>
          </div>
          <div class="asset-list asset-list-two">
            <div v-for="prop in props" :key="prop.id" class="asset-item asset-item-left-right">
              <div class="asset-info">
                <div class="asset-name">
                  <span>{{ prop.name }}</span>
                  <el-button type="danger" text size="small" class="btn-delete-icon" title="删除" @click="$emit('delete:prop', prop)">
                    <el-icon><Delete /></el-icon>
                  </el-button>
                </div>
                <div class="asset-desc-full">{{ prop.description || prop.prompt || '暂无描述' }}</div>
                <div class="asset-btns">
                  <el-button size="small" @click="$emit('edit:prop', prop)">编辑</el-button>
                  <el-button size="small" :type="isPropInLibrary(prop) ? 'success' : ''" :loading="addingPropToLibraryId === prop.id" :disabled="!hasAssetImage(prop) || isPropInLibrary(prop)" @click="$emit('add-to-library:prop', prop)">
                    {{ isPropInLibrary(prop) ? '已加入本剧库' : '加入本剧库' }}
                  </el-button>
                  <el-button size="small" :type="isPropInMaterialLibrary(prop) ? 'success' : ''" :loading="addingPropToMaterialId === prop.id" :disabled="!hasAssetImage(prop) || isPropInMaterialLibrary(prop)" @click="$emit('add-to-material-library:prop', prop)">
                    {{ isPropInMaterialLibrary(prop) ? '已加入素材库' : '加入素材库' }}
                  </el-button>
                </div>
              </div>
              <div class="asset-cover-wrap">
                <div
                  class="asset-cover"
                  :class="{ 'asset-cover--clickable': hasAssetImage(prop), 'asset-cover--dragover': dragOverResourceKey === 'prop-' + prop.id }"
                  role="button"
                  tabindex="0"
                  @click="hasAssetImage(prop) && $emit('preview-image', assetImageUrl(prop))"
                  @dragover="$emit('drag-over:prop', { event: $event, id: prop.id })"
                  @dragleave="$emit('drag-leave:prop', { event: $event, key: 'prop-' + prop.id })"
                  @drop="$emit('drop:prop', { event: $event, id: prop.id })"
                >
                  <img v-if="hasAssetImage(prop)" :src="assetImageUrl(prop)" class="cover-img" alt="" />
                  <div v-else-if="prop.error_msg || prop.errorMsg" class="cover-placeholder error" :title="prop.error_msg || prop.errorMsg">{{ prop.error_msg || prop.errorMsg }}</div>
                  <div v-else class="cover-placeholder">暂无图</div>
                  <div v-if="dragOverResourceKey === 'prop-' + prop.id" class="asset-cover-drop-hint">松开上传</div>
                </div>
                <div v-if="parseExtraImages(prop).length" class="extra-images-strip">
                  <div v-for="ep in parseExtraImages(prop)" :key="ep" class="extra-thumb" title="点击设为主图">
                    <img :src="localPathToUrl(ep)" alt="" @click="$emit('set-primary-image', { type: 'prop', item: prop, path: ep })" />
                    <button class="extra-thumb-remove" title="移除" @click.stop="$emit('remove-extra-image', { type: 'prop', item: prop, path: ep })">×</button>
                  </div>
                </div>
                <div class="asset-cover-actions">
                  <el-button type="primary" size="small" :loading="generatingPropIds.has(prop.id)" @click="$emit('generate-image:prop', prop)">
                    <el-icon v-if="!generatingPropIds.has(prop.id)"><MagicStick /></el-icon>
                    AI 生成
                  </el-button>
                  <el-button type="success" size="small" :loading="uploadingResourceId === 'prop-' + prop.id" @click="$emit('upload-click:prop', prop.id)">
                    <el-icon v-if="uploadingResourceId !== 'prop-' + prop.id"><Upload /></el-icon>
                    上传
                  </el-button>
                </div>
              </div>
            </div>
            <div v-if="props.length === 0" class="empty-tip">暂无道具，可从剧本提取或添加</div>
          </div>
        </div>
      </div>

      <!-- 场景生成 -->
      <div id="anchor-scenes" class="resource-block card">
        <div class="collapse-header resource-block-header" @click="$emit('toggle:scenes-block')">
          <h3 class="resource-block-title">场景生成</h3>
          <el-icon class="collapse-icon"><ArrowUp v-if="!scenesBlockCollapsed" /><ArrowDown v-else /></el-icon>
        </div>
        <div v-show="!scenesBlockCollapsed" class="resource-block-body">
          <div class="asset-actions">
            <el-button type="primary" size="small" :loading="scenesExtracting" :disabled="!currentEpisodeId" @click="$emit('extract:scenes')">
              从剧本提取场景
            </el-button>
            <el-button size="small" :disabled="!dramaId" @click="$emit('add:scene')">添加场景</el-button>
            <el-button size="small" @click="$emit('library:scene')">本剧场景库</el-button>
          </div>
          <div class="asset-list asset-list-two">
            <div v-for="scene in scenes" :key="scene.id" class="asset-item asset-item-left-right">
              <div class="asset-info">
                <div class="asset-name">
                  <span>{{ scene.location }}</span>
                  <el-button type="danger" text size="small" class="btn-delete-icon" title="删除" @click="$emit('delete:scene', scene)">
                    <el-icon><Delete /></el-icon>
                  </el-button>
                </div>
                <div class="asset-desc-full">{{ scene.description || scene.prompt || scene.time || '暂无描述' }}</div>
                <div class="asset-btns">
                  <el-button size="small" @click="$emit('edit:scene', scene)">编辑</el-button>
                  <el-button size="small" :type="isSceneInLibrary(scene) ? 'success' : ''" :loading="addingSceneToLibraryId === scene.id" :disabled="!hasAssetImage(scene) || isSceneInLibrary(scene)" @click="$emit('add-to-library:scene', scene)">
                    {{ isSceneInLibrary(scene) ? '已加入本剧库' : '加入本剧库' }}
                  </el-button>
                  <el-button size="small" :type="isSceneInMaterialLibrary(scene) ? 'success' : ''" :loading="addingSceneToMaterialId === scene.id" :disabled="!hasAssetImage(scene) || isSceneInMaterialLibrary(scene)" @click="$emit('add-to-material-library:scene', scene)">
                    {{ isSceneInMaterialLibrary(scene) ? '已加入素材库' : '加入素材库' }}
                  </el-button>
                </div>
                <div v-if="getSceneAffectedStoryboards(scene.id).length" class="asset-storyboard-link">
                  <span class="asl-label">影响的分镜：</span>
                  <span
                    v-for="sb in getSceneAffectedStoryboards(scene.id)"
                    :key="sb.id"
                    class="asl-chip"
                    title="点击跳转到该分镜"
                    @click="$emit('regen-storyboards:scene', { scrollToSbId: sb.id })"
                  >#{{ sb.storyboard_number }}</span>
                  <span v-if="regenSbImagesForAsset.has('scene-' + scene.id) && regenSbImagesProgress['scene-' + scene.id]" class="asl-progress">
                    {{ regenSbImagesProgress['scene-' + scene.id].current }}/{{ regenSbImagesProgress['scene-' + scene.id].total }}
                  </span>
                  <el-button
                    size="small"
                    class="asl-regen-btn"
                    :loading="regenSbImagesForAsset.has('scene-' + scene.id)"
                    @click="$emit('regen-storyboards:scene', { assetKey: 'scene-' + scene.id, storyboards: getSceneAffectedStoryboards(scene.id) })"
                  >
                    <span v-if="!regenSbImagesForAsset.has('scene-' + scene.id)">↻ 重新生成分镜图</span>
                  </el-button>
                </div>
              </div>
              <div class="asset-cover-wrap">
                <div
                  class="asset-cover"
                  :class="{ 'asset-cover--clickable': hasAssetImage(scene), 'asset-cover--dragover': dragOverResourceKey === 'scene-' + scene.id }"
                  role="button"
                  tabindex="0"
                  @click="hasAssetImage(scene) && $emit('preview-image', assetImageUrl(scene))"
                  @dragover="$emit('drag-over:scene', { event: $event, id: scene.id })"
                  @dragleave="$emit('drag-leave:scene', { event: $event, key: 'scene-' + scene.id })"
                  @drop="$emit('drop:scene', { event: $event, id: scene.id })"
                >
                  <img v-if="hasAssetImage(scene)" :src="assetImageUrl(scene)" class="cover-img" alt="" />
                  <div v-else-if="scene.error_msg || scene.errorMsg" class="cover-placeholder error" :title="scene.error_msg || scene.errorMsg">{{ scene.error_msg || scene.errorMsg }}</div>
                  <div v-else class="cover-placeholder">暂无图</div>
                  <div v-if="dragOverResourceKey === 'scene-' + scene.id" class="asset-cover-drop-hint">松开上传</div>
                </div>
                <div v-if="parseExtraImages(scene).length" class="extra-images-strip">
                  <div v-for="ep in parseExtraImages(scene)" :key="ep" class="extra-thumb" title="点击设为主图">
                    <img :src="localPathToUrl(ep)" alt="" @click="$emit('set-primary-image', { type: 'scene', item: scene, path: ep })" />
                    <button class="extra-thumb-remove" title="移除" @click.stop="$emit('remove-extra-image', { type: 'scene', item: scene, path: ep })">×</button>
                  </div>
                </div>
                <div class="asset-cover-actions">
                  <el-tooltip content="多角度图一张（正/侧/俯/仰）" placement="top">
                    <el-button type="primary" size="small" :loading="generatingSceneIds.has(scene.id)" @click="$emit('generate-image:scene', scene)">
                      <el-icon v-if="!generatingSceneIds.has(scene.id)"><MagicStick /></el-icon>
                      AI 生成
                    </el-button>
                  </el-tooltip>
                  <el-button type="success" size="small" :loading="uploadingResourceId === 'scene-' + scene.id" @click="$emit('upload-click:scene', scene.id)">
                    <el-icon v-if="uploadingResourceId !== 'scene-' + scene.id"><Upload /></el-icon>
                    上传
                  </el-button>
                </div>
              </div>
            </div>
            <div v-if="scenes.length === 0" class="empty-tip">暂无场景，请从剧本提取</div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ArrowUp, ArrowDown, Delete, MagicStick, Upload, QuestionFilled } from '@element-plus/icons-vue'
import { assetImageUrl, hasAssetImage, localPathToUrl } from '@/utils/assetImageUrl.js'

defineProps({
  resourcePanelCollapsed: { type: Boolean, default: false },
  charactersBlockCollapsed: { type: Boolean, default: false },
  propsBlockCollapsed: { type: Boolean, default: false },
  scenesBlockCollapsed: { type: Boolean, default: false },
  characters: { type: Array, default: () => [] },
  props: { type: Array, default: () => [] },
  scenes: { type: Array, default: () => [] },
  generatingCharIds: { type: Set, default: () => new Set() },
  generatingSceneIds: { type: Set, default: () => new Set() },
  generatingPropIds: { type: Set, default: () => new Set() },
  dramaId: { type: [String, Number], default: null },
  currentEpisodeId: { type: [String, Number], default: null },
  // Loading states
  charactersGenerating: { type: Boolean, default: false },
  propsExtracting: { type: Boolean, default: false },
  scenesExtracting: { type: Boolean, default: false },
  uploadingResourceId: { type: String, default: null },
  dragOverResourceKey: { type: String, default: null },
  // Character-specific loading
  addingCharToLibraryId: { type: [String, Number], default: null },
  addingCharToMaterialId: { type: [String, Number], default: null },
  sd2CertifyingId: { type: [String, Number], default: null },
  // Prop-specific loading
  addingPropToLibraryId: { type: [String, Number], default: null },
  addingPropToMaterialId: { type: [String, Number], default: null },
  // Scene-specific loading
  addingSceneToLibraryId: { type: [String, Number], default: null },
  addingSceneToMaterialId: { type: [String, Number], default: null },
  // Storyboard regen
  regenSbImagesForAsset: { type: Set, default: () => new Set() },
  regenSbImagesProgress: { type: Object, default: () => ({}) },
  // Library membership checks (functions)
  isCharInLibrary: { type: Function, default: () => false },
  isCharInMaterialLibrary: { type: Function, default: () => false },
  isPropInLibrary: { type: Function, default: () => false },
  isPropInMaterialLibrary: { type: Function, default: () => false },
  isSceneInLibrary: { type: Function, default: () => false },
  isSceneInMaterialLibrary: { type: Function, default: () => false },
  // Affected storyboards (functions)
  getCharAffectedStoryboards: { type: Function, default: () => [] },
  getSceneAffectedStoryboards: { type: Function, default: () => [] },
  // SD2 helpers
  charSd2TagText: { type: Function, default: () => '' },
  // Extra images helper
  parseExtraImages: { type: Function, default: () => [] },
})

const CHAR_ROLE_LABEL = { main: '主角', supporting: '配角', minor: '次要角色' }
function charRoleLabel(role) { return CHAR_ROLE_LABEL[role] || role || '' }

defineEmits([
  // Panel toggling
  'toggle:resource-panel',
  'toggle:characters-block',
  'toggle:props-block',
  'toggle:scenes-block',
  // Character actions
  'extract:characters',
  'add:character',
  'library:character',
  'edit:character',
  'delete:character',
  'generate-image:character',
  'add-to-library:character',
  'add-to-material-library:character',
  'certify-sd2:character',
  'regen-storyboards:character',
  'drag-over:character',
  'drag-leave:character',
  'drop:character',
  'upload-click:character',
  // Prop actions
  'extract:props',
  'add:prop',
  'library:prop',
  'edit:prop',
  'delete:prop',
  'generate-image:prop',
  'add-to-library:prop',
  'add-to-material-library:prop',
  'drag-over:prop',
  'drag-leave:prop',
  'drop:prop',
  'upload-click:prop',
  // Scene actions
  'extract:scenes',
  'add:scene',
  'library:scene',
  'edit:scene',
  'delete:scene',
  'generate-image:scene',
  'add-to-library:scene',
  'add-to-material-library:scene',
  'regen-storyboards:scene',
  'drag-over:scene',
  'drag-leave:scene',
  'drop:scene',
  'upload-click:scene',
  // Shared
  'preview-image',
  'set-primary-image',
  'remove-extra-image',
])
</script>

<style scoped>
/* === Resource Panel — Glass === */
.resource-panel {
  padding: 0;
  overflow: hidden;
  background: var(--bg-card);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-card);
}
.collapse-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  cursor: pointer;
  user-select: none;
  transition: background 0.2s;
}
.collapse-header:hover {
  background: var(--bg-hover);
}
.resource-panel .collapse-header {
  border-bottom: 1px solid var(--glass-border);
}
.resource-panel .collapse-header .section-title {
  margin: 0;
}
.collapse-icon {
  font-size: 1.1rem;
  color: var(--text-muted);
  flex-shrink: 0;
  margin-left: 8px;
}
.resource-panel-body {
  padding: 16px 20px 20px;
}

/* === Resource Block — Glass === */
.resource-block {
  margin-bottom: 20px;
  padding: 0;
  overflow: hidden;
  background: var(--bg-inner);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
}
.resource-block:last-child {
  margin-bottom: 0;
}
.resource-block-header {
  padding: 10px 14px;
  border-bottom: 1px solid var(--glass-border);
}
.resource-block-header .collapse-icon {
  font-size: 1rem;
}
.resource-block-title {
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
}
html.light .resource-block-title {
  color: var(--text-bright);
}
.resource-block-body {
  padding: 12px 14px 14px;
}
.resource-block-body .asset-actions {
  margin-bottom: 12px;
}
.resource-block-body .asset-list-two {
  gap: 16px;
}

.row { display: flex; flex-wrap: wrap; align-items: center; }
.gap { gap: 12px; }
.asset-actions { margin-bottom: 12px; }
.asset-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
}
.asset-list-two {
  grid-template-columns: repeat(auto-fill, minmax(460px, 1fr));
  gap: 20px;
}

/* === Asset Item — Glass Card with scaleIn === */
.asset-item {
  background: var(--bg-card);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-card);
  transition: border-color var(--duration-fast) ease, box-shadow var(--duration-fast) ease;
  animation: scaleIn 0.35s ease both;
}
.asset-item:hover {
  border-color: var(--accent-border);
  box-shadow: var(--shadow-hover);
}
html.light .asset-item {
  background: var(--bg-card);
  border-color: var(--glass-border);
  box-shadow: var(--shadow-card);
}
html.light .asset-item:hover {
  border-color: var(--accent-border);
  box-shadow: var(--shadow-hover);
}

.asset-item-left-right {
  flex-direction: row;
  align-items: stretch;
}
.asset-item-left-right .asset-info {
  flex: 1;
  min-width: 0;
  padding: 16px;
  display: flex;
  flex-direction: column;
}
.asset-item-left-right .asset-name {
  font-size: 1.05rem;
  margin-bottom: 8px;
}
.asset-item-left-right .asset-desc-full {
  flex: 1;
  font-size: 0.875rem;
  color: var(--text-muted);
  line-height: 1.5;
  margin-bottom: 12px;
  white-space: pre-wrap;
  word-break: break-word;
}
.asset-item-left-right .asset-cover-wrap {
  flex-shrink: 0;
  align-self: flex-start;
}
.asset-item-left-right .asset-cover {
  width: 200px;
  height: 200px;
}
.asset-item-left-right .asset-cover.asset-cover--clickable {
  cursor: pointer;
}
.asset-cover {
  width: 100%;
  aspect-ratio: 1;
  background: var(--bg-inner);
  position: relative;
  overflow: hidden;
}
.asset-item-left-right .asset-cover .cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.cover-img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}
.cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-subtle);
  font-size: 0.85rem;
}
.cover-placeholder.error {
  background: #450a0a;
  color: #f87171;
  font-size: 0.8rem;
  padding: 8px;
  line-height: 1.4;
  word-break: break-all;
  text-align: center;
}
.asset-cover--dragover {
  outline: 2px dashed var(--accent);
  outline-offset: -2px;
  background: var(--accent-soft);
}
.asset-cover-drop-hint {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 0.9rem;
  pointer-events: none;
}
.asset-info { padding: 10px; }
.asset-name {
  font-weight: 600;
  margin-bottom: 4px;
  color: var(--text-primary);
}
.asset-desc {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin-bottom: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.asset-desc-full {
  font-size: 0.875rem;
  color: var(--text-muted);
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}
.asset-btns { display: flex; gap: 6px; flex-wrap: wrap; margin-top: auto; align-items: center; }
.sd2-cert-btn-wrap {
  display: inline-flex;
  align-items: center;
  gap: 0;
  vertical-align: middle;
}
.sd2-help-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  margin-left: 1px;
  color: var(--accent);
  cursor: help;
  flex-shrink: 0;
  border-radius: 50%;
  outline: none;
}
.sd2-help-trigger:hover,
.sd2-help-trigger:focus-visible {
  color: var(--accent);
  background: var(--accent-soft);
}
html.light .sd2-help-trigger { color: var(--accent); }
html.light .sd2-help-trigger:hover,
html.light .sd2-help-trigger:focus-visible { color: var(--accent-dim); background: var(--accent-soft); }
.sd2-mono { font-size: 12px; word-break: break-all; }
.sd2-break { font-size: 12px; word-break: break-all; line-height: 1.4; }
.sd2-break.muted { color: var(--text-muted); margin-top: 4px; }
.sd2-doc-tip { font-size: 12px; color: var(--text-muted); margin-top: 12px; line-height: 1.5; }
.sd2-doc-tip a { color: var(--accent); }
html.light .sd2-doc-tip a { color: var(--accent); }
.asset-item-left-right .asset-name {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
}
.asset-item-left-right .asset-name span { flex: 1; min-width: 0; }
.btn-delete-icon { flex-shrink: 0; padding: 2px 4px !important; opacity: 0.45; transition: opacity 0.15s; }
.btn-delete-icon:hover { opacity: 1; }

.asset-cover-wrap {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  width: 200px;
}
.asset-cover-actions {
  display: flex;
  gap: 6px;
  padding: 6px 8px;
  border-top: 1px solid var(--glass-border);
}
.asset-cover-actions .el-button { flex: 1; justify-content: center; }
html.light .asset-cover-actions { border-top-color: var(--glass-border); }

/* === Extra Images Strip === */
.extra-images-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 5px 8px;
  background: var(--bg-inner);
}
.extra-thumb {
  position: relative;
  width: 52px;
  height: 52px;
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  border: 1.5px solid transparent;
  transition: border-color 0.15s;
}
.extra-thumb:hover { border-color: var(--accent); }
.extra-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.extra-thumb-remove {
  position: absolute;
  top: 1px;
  right: 1px;
  width: 16px;
  height: 16px;
  background: rgba(239,68,68,0.85);
  color: #fff;
  border: none;
  border-radius: 50%;
  font-size: 11px;
  line-height: 16px;
  text-align: center;
  cursor: pointer;
  padding: 0;
  opacity: 0;
  transition: opacity 0.15s;
}
.extra-thumb:hover .extra-thumb-remove { opacity: 1; }
html.light .extra-images-strip { background: var(--bg-inner); }
.empty-tip {
  color: var(--text-subtle);
  font-size: 0.9rem;
  padding: 16px 0;
}
html.light .empty-tip { color: var(--text-faint); }
</style>
