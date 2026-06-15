<template>
  <div class="film-list">
    <header class="header">
      <div class="header-inner">
        <h1 class="logo">
          <img src="/logo.png" class="logo-icon" alt="logo" />
          <span class="logo-main">视频miao~</span>
        </h1>
        <!-- 公共资源库（左侧，靛紫调） -->
        <div class="header-library">
          <el-button class="btn-library" @click="showCharLibrary = true">
            <el-icon><User /></el-icon>素材角色
          </el-button>
          <el-button class="btn-library" @click="showSceneLibrary = true">
            <el-icon><PictureFilled /></el-icon>素材场景
          </el-button>
          <el-button class="btn-library" @click="showPropLibrary = true">
            <el-icon><Box /></el-icon>素材道具
          </el-button>
        </div>
        <!-- 右侧操作区 -->
        <div class="header-actions">
          <!-- 用户信息 + 积分余额 -->
          <el-button class="btn-credits" @click="showCreditsDialog = true">
            <el-icon><Coin /></el-icon>积分: {{ userCredits }}
          </el-button>
          <el-dropdown @command="onUserCommand">
            <el-button class="btn-user">
              <el-icon><User /></el-icon>{{ userName }}<el-icon class="el-icon--right"><ArrowDown /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="credits">积分中心</el-dropdown-item>
                <el-dropdown-item command="password">修改密码</el-dropdown-item>
                <el-dropdown-item divided command="logout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <!-- 暂时隐藏，功能待完善 -->
          <!-- <el-button class="btn-library" title="自由创作" @click="$router.push('/free-create')">
            <el-icon><MagicStick /></el-icon>自由创作
          </el-button>
          <el-button class="btn-library" title="媒体素材库" @click="$router.push('/media-library')">
            <el-icon><Files /></el-icon>素材库
          </el-button> -->
          <el-button class="btn-help" title="使用帮助" @click="showHelp = true">
            <el-icon><QuestionFilled /></el-icon>帮助
          </el-button>
          <el-button class="btn-theme" :title="isDark ? '切换到浅色模式' : '切换到暗色模式'" @click="toggleTheme">
            <el-icon><Sunny v-if="isDark" /><Moon v-else /></el-icon>
            {{ isDark ? '浅色' : '暗色' }}
          </el-button>
          <!-- AI配置：积分模式下由管理员统一配置，普通用户不显示 -->
          <!-- <el-button class="btn-settings" @click="showAiConfigDialog = true">
            <el-icon><Setting /></el-icon>AI配置
          </el-button> -->
          <el-button class="btn-import" :loading="importing" @click="triggerImport">
            <el-icon><Upload /></el-icon>导入项目
          </el-button>
          <input ref="importFileInput" type="file" accept=".zip" style="display:none" @change="onImportFile" />
          <el-button type="primary" class="btn-new" @click="goNewProject">
            <el-icon><Plus /></el-icon>新建项目
          </el-button>
        </div>
      </div>
    </header>

    <main class="main">
      <div class="search-bar" v-if="dramasRich.length > 0 || searchKeyword">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索项目..."
          clearable
          class="search-input"
          @clear="loadList"
          @input="debouncedSearch"
        />
      </div>
      <div v-loading="loading" class="projects-wrap">
        <div class="project-grid">
          <!-- 操作卡片：始终作为第一个格子 -->
          <div class="project-card action-card">
            <div class="action-card-inner">
              <h3 class="action-card-title">快速开始</h3>
              <div class="action-card-buttons">
                <el-button type="primary" size="large" class="action-btn action-btn-new" @click="goNewProject">
                  <el-icon><Plus /></el-icon>新建短剧项目
                </el-button>
                <el-button size="large" class="action-btn action-btn-import" :loading="importing" @click="triggerImport">
                  <el-icon><Upload /></el-icon>导入短剧项目
                </el-button>
              </div>
              <div v-if="exampleList.length > 0" class="action-card-example">
                <div class="example-hint">
                  <el-icon class="example-hint-icon"><QuestionFilled /></el-icon>
                  <span class="example-hint-text">新手？试试导入示例项目快速体验</span>
                </div>
                <div class="example-list">
                  <el-button
                    v-for="ex in exampleList"
                    :key="ex.filename"
                    size="small"
                    class="example-btn"
                    :loading="importingExample === ex.filename"
                    @click="onImportExample(ex)"
                  >
                    <el-icon><FolderOpened /></el-icon>{{ ex.name }}
                  </el-button>
                </div>
              </div>
            </div>
          </div>
          <div
            v-for="d in dramasRich"
            :key="d.id"
            class="project-card"
            @click="openProject(d.id)"
          >
            <div class="project-card-actions" @click.stop>
              <el-button size="small" circle :icon="Download" title="导出项目" :loading="exportingId === d.id" @click="onExport(d)" />
              <el-button size="small" circle :icon="Edit" title="编辑" @click="openEditDialog(d)" />
              <el-button size="small" type="danger" plain circle :icon="Delete" title="删除" @click="onDelete(d)" />
            </div>
            <div class="project-card-body">
              <h3 class="project-title">{{ d.title || '未命名项目' }}</h3>
              <p class="project-desc">{{ d.description || '暂无描述' }}</p>
              <div class="project-badges">
                <span class="badge badge-status" :class="'badge-status--' + (d.status || 'draft')">{{ formatStatus(d.status) }}</span>
                <span v-if="d.episodes?.length" class="badge badge-episodes">{{ d.episodes.length }} 集</span>
                <span v-if="d._totalSb > 0" class="badge badge-storyboards">{{ d._totalSb }} 分镜</span>
                <span v-if="d.metadata?.aspect_ratio" class="badge badge-ratio">{{ d.metadata.aspect_ratio }}</span>
                <span v-if="d.style" class="badge badge-style">{{ formatStyle(d.style) }}</span>
                <span v-if="d.genre" class="badge badge-genre">{{ formatGenre(d.genre) }}</span>
              </div>
              <!-- 创作进度 -->
              <div v-if="d._progressSteps.length > 0" class="project-progress">
                <div
                  v-for="step in d._progressSteps"
                  :key="step.label"
                  class="progress-dot"
                  :class="{ 'progress-dot--done': step.done }"
                  :title="step.label"
                ></div>
                <span class="progress-label">{{ d._progressLabel }}</span>
              </div>
              <p class="project-meta">{{ formatDate(d.updated_at) }}</p>
            </div>
          </div>
        </div>
        <div v-if="!loading && dramas.length === 0" class="empty-state">
          <div class="empty-state-icon">🎬</div>
          <h3 class="empty-state-title">还没有项目</h3>
          <p class="empty-state-desc">点击上方「新建短剧项目」开始创作你的第一个 AI 短剧</p>
        </div>
      </div>
    </main>

    <!-- 新建项目：先填标题和描述 -->
    <el-dialog
      v-model="showNewDialog"
      title="新建项目"
      width="480px"
      :close-on-click-modal="false"
      @closed="resetNewForm"
    >
      <el-form :model="newForm" label-width="80px" label-position="top">
        <el-form-item label="标题" required>
          <el-input v-model="newForm.title" placeholder="输入项目标题" maxlength="100" show-word-limit />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="newForm.description" type="textarea" :rows="3" placeholder="输入项目描述（选填）" />
        </el-form-item>
        <el-form-item label="画面比例">
          <el-select v-model="newForm.aspect_ratio" style="width: 100%">
            <el-option label="16:9 横屏（默认）" value="16:9" />
            <el-option label="9:16 竖屏（短视频）" value="9:16" />
            <el-option label="3:4 竖版" value="3:4" />
            <el-option label="1:1 方形" value="1:1" />
            <el-option label="4:3 传统横屏" value="4:3" />
            <el-option label="21:9 宽银幕" value="21:9" />
          </el-select>
          <p style="margin: 4px 0 0; font-size: 12px; color: #71717a;">影响分镜图和视频的生成比例，短视频选 9:16</p>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showNewDialog = false">取消</el-button>
        <el-button type="primary" :loading="newSaving" :disabled="!newForm.title?.trim()" @click="submitNew">确定</el-button>
      </template>
    </el-dialog>

    <!-- AI 配置弹窗 -->
    <el-dialog v-model="showAiConfigDialog" title="AI 配置" width="90%" destroy-on-close>
      <AIConfigContent v-if="showAiConfigDialog" />
    </el-dialog>

    <!-- 公共角色库 -->
    <el-dialog v-model="showCharLibrary" title="素材库 · 角色" width="720px" destroy-on-close class="library-dialog" @open="loadCharLibraryList">
      <div class="library-toolbar">
        <el-input v-model="charLibraryKeyword" placeholder="搜索名称或描述" clearable style="width: 200px" @input="debouncedLoadCharLibrary()" />
      </div>
      <div v-loading="charLibraryLoading" class="library-list">
        <div v-for="item in charLibraryList" :key="item.id" class="library-item">
          <div class="library-item-cover" @click="openImagePreview(assetImageUrl(item))">
            <img v-if="item.image_url || item.local_path" :src="assetImageUrl(item)" alt="" />
            <span v-else class="library-item-placeholder">暂无图</span>
          </div>
          <div class="library-item-info">
            <div class="library-item-name">{{ item.name || '未命名' }}</div>
            <div class="library-item-desc">{{ (item.description || '').slice(0, 60) }}{{ (item.description || '').length > 60 ? '…' : '' }}</div>
            <div class="library-item-actions">
              <el-button size="small" @click="openEditCharLibrary(item)">编辑</el-button>
              <el-button size="small" type="danger" plain @click="onDeleteCharLibrary(item)">删除</el-button>
            </div>
          </div>
        </div>
        <div v-if="!charLibraryLoading && charLibraryList.length === 0" class="library-empty">素材库暂无角色，可在项目中将角色「加入素材库」后在此查看</div>
      </div>
      <div class="library-pagination">
        <el-pagination v-model:current-page="charLibraryPage" v-model:page-size="charLibraryPageSize" :total="charLibraryTotal" :page-sizes="[10, 20, 50]" layout="total, sizes, prev, pager, next" @current-change="loadCharLibraryList" @size-change="loadCharLibraryList" />
      </div>
      <template #footer><el-button @click="showCharLibrary = false">关闭</el-button></template>
    </el-dialog>
    <!-- 编辑公共角色 -->
    <el-dialog v-model="showEditCharLibrary" title="编辑素材角色" width="480px" @close="editCharLibraryForm = null">
      <el-form v-if="editCharLibraryForm" label-width="80px">
        <el-form-item label="图片">
          <div class="lib-img-editor">
            <div class="lib-img-thumb" @click="openImagePreview(assetImageUrl(editCharLibraryForm))">
              <img v-if="editCharLibraryForm.image_url || editCharLibraryForm.local_path" :src="assetImageUrl(editCharLibraryForm)" />
              <div v-else class="lib-img-empty"><el-icon><PictureFilled /></el-icon></div>
            </div>
            <div class="lib-img-btns">
              <el-button size="small" :loading="editCharLibraryForm.imgUploading" @click="charLibFileRef.click()">上传图片</el-button>
              <el-button size="small" type="primary" :loading="editCharLibraryForm.imgGenerating" @click="doGenerateLibImg(editCharLibraryForm, (editCharLibraryForm.name + (editCharLibraryForm.description ? ', ' + editCharLibraryForm.description : '')), characterLibraryAPI, loadCharLibraryList)">AI 生成</el-button>
            </div>
          </div>
          <input ref="charLibFileRef" type="file" accept="image/*" style="display:none" @change="e => doUploadLibImg(e, editCharLibraryForm, characterLibraryAPI, loadCharLibraryList)" />
        </el-form-item>
        <el-form-item label="名称"><el-input v-model="editCharLibraryForm.name" placeholder="角色名称" /></el-form-item>
        <el-form-item label="分类"><el-input v-model="editCharLibraryForm.category" placeholder="可选" /></el-form-item>
        <el-form-item label="描述"><el-input v-model="editCharLibraryForm.description" type="textarea" :rows="3" placeholder="可选" /></el-form-item>
        <el-form-item label="标签"><el-input v-model="editCharLibraryForm.tags" placeholder="可选，逗号分隔" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditCharLibrary = false">取消</el-button>
        <el-button type="primary" :loading="editCharLibrarySaving" @click="submitEditCharLibrary">保存</el-button>
      </template>
    </el-dialog>

    <!-- 公共场景库 -->
    <el-dialog v-model="showSceneLibrary" title="素材库 · 场景" width="720px" destroy-on-close class="library-dialog" @open="loadSceneLibraryList">
      <div class="library-toolbar">
        <el-input v-model="sceneLibraryKeyword" placeholder="搜索地点或描述" clearable style="width: 200px" @input="debouncedLoadSceneLibrary()" />
      </div>
      <div v-loading="sceneLibraryLoading" class="library-list">
        <div v-for="item in sceneLibraryList" :key="item.id" class="library-item">
          <div class="library-item-cover" @click="openImagePreview(assetImageUrl(item))">
            <img v-if="item.image_url || item.local_path" :src="assetImageUrl(item)" alt="" />
            <span v-else class="library-item-placeholder">暂无图</span>
          </div>
          <div class="library-item-info">
            <div class="library-item-name">{{ item.location || item.time || '未命名' }}</div>
            <div class="library-item-desc">{{ (item.description || item.prompt || '').slice(0, 60) }}{{ (item.description || item.prompt || '').length > 60 ? '…' : '' }}</div>
            <div class="library-item-actions">
              <el-button size="small" @click="openEditSceneLibrary(item)">编辑</el-button>
              <el-button size="small" type="danger" plain @click="onDeleteSceneLibrary(item)">删除</el-button>
            </div>
          </div>
        </div>
        <div v-if="!sceneLibraryLoading && sceneLibraryList.length === 0" class="library-empty">素材库暂无场景，可在项目中将场景「加入素材库」后在此查看</div>
      </div>
      <div class="library-pagination">
        <el-pagination v-model:current-page="sceneLibraryPage" v-model:page-size="sceneLibraryPageSize" :total="sceneLibraryTotal" :page-sizes="[10, 20, 50]" layout="total, sizes, prev, pager, next" @current-change="loadSceneLibraryList" @size-change="loadSceneLibraryList" />
      </div>
      <template #footer><el-button @click="showSceneLibrary = false">关闭</el-button></template>
    </el-dialog>
    <!-- 编辑公共场景 -->
    <el-dialog v-model="showEditSceneLibrary" title="编辑素材场景" width="480px" @close="editSceneLibraryForm = null">
      <el-form v-if="editSceneLibraryForm" label-width="80px">
        <el-form-item label="图片">
          <div class="lib-img-editor">
            <div class="lib-img-thumb" @click="openImagePreview(assetImageUrl(editSceneLibraryForm))">
              <img v-if="editSceneLibraryForm.image_url || editSceneLibraryForm.local_path" :src="assetImageUrl(editSceneLibraryForm)" />
              <div v-else class="lib-img-empty"><el-icon><PictureFilled /></el-icon></div>
            </div>
            <div class="lib-img-btns">
              <el-button size="small" :loading="editSceneLibraryForm.imgUploading" @click="sceneLibFileRef.click()">上传图片</el-button>
              <el-button size="small" type="primary" :loading="editSceneLibraryForm.imgGenerating" @click="doGenerateLibImg(editSceneLibraryForm, ([editSceneLibraryForm.location, editSceneLibraryForm.time, editSceneLibraryForm.description].filter(Boolean).join(', ')), sceneLibraryAPI, loadSceneLibraryList)">AI 生成</el-button>
            </div>
          </div>
          <input ref="sceneLibFileRef" type="file" accept="image/*" style="display:none" @change="e => doUploadLibImg(e, editSceneLibraryForm, sceneLibraryAPI, loadSceneLibraryList)" />
        </el-form-item>
        <el-form-item label="地点"><el-input v-model="editSceneLibraryForm.location" placeholder="场景地点" /></el-form-item>
        <el-form-item label="时间"><el-input v-model="editSceneLibraryForm.time" placeholder="如：浅色/夜晚" /></el-form-item>
        <el-form-item label="分类"><el-input v-model="editSceneLibraryForm.category" placeholder="可选" /></el-form-item>
        <el-form-item label="描述"><el-input v-model="editSceneLibraryForm.description" type="textarea" :rows="3" placeholder="可选" /></el-form-item>
        <el-form-item label="标签"><el-input v-model="editSceneLibraryForm.tags" placeholder="可选，逗号分隔" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditSceneLibrary = false">取消</el-button>
        <el-button type="primary" :loading="editSceneLibrarySaving" @click="submitEditSceneLibrary">保存</el-button>
      </template>
    </el-dialog>

    <!-- 公共道具库 -->
    <el-dialog v-model="showPropLibrary" title="素材库 · 道具" width="720px" destroy-on-close class="library-dialog" @open="loadPropLibraryList">
      <div class="library-toolbar">
        <el-input v-model="propLibraryKeyword" placeholder="搜索名称或描述" clearable style="width: 200px" @input="debouncedLoadPropLibrary()" />
      </div>
      <div v-loading="propLibraryLoading" class="library-list">
        <div v-for="item in propLibraryList" :key="item.id" class="library-item">
          <div class="library-item-cover" @click="openImagePreview(assetImageUrl(item))">
            <img v-if="item.image_url || item.local_path" :src="assetImageUrl(item)" alt="" />
            <span v-else class="library-item-placeholder">暂无图</span>
          </div>
          <div class="library-item-info">
            <div class="library-item-name">{{ item.name || '未命名' }}</div>
            <div class="library-item-desc">{{ (item.description || item.prompt || '').slice(0, 60) }}{{ (item.description || item.prompt || '').length > 60 ? '…' : '' }}</div>
            <div class="library-item-actions">
              <el-button size="small" @click="openEditPropLibrary(item)">编辑</el-button>
              <el-button size="small" type="danger" plain @click="onDeletePropLibrary(item)">删除</el-button>
            </div>
          </div>
        </div>
        <div v-if="!propLibraryLoading && propLibraryList.length === 0" class="library-empty">素材库暂无道具，可在项目中将道具「加入素材库」后在此查看</div>
      </div>
      <div class="library-pagination">
        <el-pagination v-model:current-page="propLibraryPage" v-model:page-size="propLibraryPageSize" :total="propLibraryTotal" :page-sizes="[10, 20, 50]" layout="total, sizes, prev, pager, next" @current-change="loadPropLibraryList" @size-change="loadPropLibraryList" />
      </div>
      <template #footer><el-button @click="showPropLibrary = false">关闭</el-button></template>
    </el-dialog>
    <!-- 编辑公共道具 -->
    <el-dialog v-model="showEditPropLibrary" title="编辑素材道具" width="480px" @close="editPropLibraryForm = null">
      <el-form v-if="editPropLibraryForm" label-width="80px">
        <el-form-item label="图片">
          <div class="lib-img-editor">
            <div class="lib-img-thumb" @click="openImagePreview(assetImageUrl(editPropLibraryForm))">
              <img v-if="editPropLibraryForm.image_url || editPropLibraryForm.local_path" :src="assetImageUrl(editPropLibraryForm)" />
              <div v-else class="lib-img-empty"><el-icon><PictureFilled /></el-icon></div>
            </div>
            <div class="lib-img-btns">
              <el-button size="small" :loading="editPropLibraryForm.imgUploading" @click="propLibFileRef.click()">上传图片</el-button>
              <el-button size="small" type="primary" :loading="editPropLibraryForm.imgGenerating" @click="doGenerateLibImg(editPropLibraryForm, (editPropLibraryForm.name + (editPropLibraryForm.description ? ', ' + editPropLibraryForm.description : '')), propLibraryAPI, loadPropLibraryList)">AI 生成</el-button>
            </div>
          </div>
          <input ref="propLibFileRef" type="file" accept="image/*" style="display:none" @change="e => doUploadLibImg(e, editPropLibraryForm, propLibraryAPI, loadPropLibraryList)" />
        </el-form-item>
        <el-form-item label="名称"><el-input v-model="editPropLibraryForm.name" placeholder="道具名称" /></el-form-item>
        <el-form-item label="分类"><el-input v-model="editPropLibraryForm.category" placeholder="可选" /></el-form-item>
        <el-form-item label="描述"><el-input v-model="editPropLibraryForm.description" type="textarea" :rows="3" placeholder="可选" /></el-form-item>
        <el-form-item label="标签"><el-input v-model="editPropLibraryForm.tags" placeholder="可选，逗号分隔" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditPropLibrary = false">取消</el-button>
        <el-button type="primary" :loading="editPropLibrarySaving" @click="submitEditPropLibrary">保存</el-button>
      </template>
    </el-dialog>

    <!-- 图片放大预览 -->
    <Teleport to="body">
      <div v-if="previewImageUrl" class="image-preview-overlay" @click="previewImageUrl = null">
        <img :src="previewImageUrl" alt="" class="image-preview-img" @click.stop="previewImageUrl = null" />
      </div>
    </Teleport>

    <!-- 编辑项目：修改标题和故事 -->
    <el-dialog
      v-model="showEditDialog"
      title="编辑项目"
      width="480px"
      :close-on-click-modal="false"
      @closed="resetEditForm"
    >
      <el-form :model="editForm" label-width="80px" label-position="top">
        <el-form-item label="标题" required>
          <el-input v-model="editForm.title" placeholder="输入项目标题" maxlength="100" show-word-limit />
        </el-form-item>
        <el-form-item label="故事">
          <el-input v-model="editForm.description" type="textarea" :rows="3" placeholder="输入故事梗概（选填）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditDialog = false">取消</el-button>
        <el-button type="primary" :loading="editSaving" :disabled="!editForm.title?.trim()" @click="submitEdit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 使用帮助 -->
    <el-dialog v-model="showHelp" title="使用帮助" width="560px">
      <div class="help-content">
        <h4>快速上手</h4>
        <ol>
          <li><b>配置 AI 服务</b> — 点击右上角「AI配置」，填入你的 API Key</li>
          <li><b>新建项目</b> — 点击「新建项目」，输入标题和画面比例</li>
          <li><b>生成剧本</b> — 进入项目，输入故事梗概，AI 自动生成剧本</li>
          <li><b>生成角色和场景</b> — AI 提取角色和场景，生成形象图</li>
          <li><b>生成分镜</b> — AI 自动拆分镜脚本</li>
          <li><b>生成图片和视频</b> — 逐镜生成静帧和视频片段</li>
          <li><b>合成视频</b> — 所有分镜视频自动合成为完整剧集</li>
        </ol>
        <h4>支持的 AI 服务商</h4>
        <p>阿里云通义、火山引擎豆包、可灵 Kling、Google Gemini、Vidu 等，详见「AI 配置」页面。</p>
      </div>
    </el-dialog>

    <!-- 积分中心弹窗 -->
    <Credits v-model:visible="showCreditsDialog" @refresh="userStore.fetchProfile()" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Edit, Delete, Setting, Plus, User, PictureFilled, Box, Sunny, Moon, Download, Upload, QuestionFilled, FolderOpened, MagicStick, Files, Coin, ArrowDown } from '@element-plus/icons-vue'
import { useTheme } from '@/composables/useTheme'
import { useDebouncedSearch } from '@/composables/useDebouncedSearch'
import { dramaAPI } from '@/api/drama'
import { characterLibraryAPI } from '@/api/characterLibrary'
import { sceneLibraryAPI } from '@/api/sceneLibrary'
import { propLibraryAPI } from '@/api/propLibrary'
import AIConfigContent from '@/components/AIConfigContent.vue'
import { uploadAPI } from '@/api/upload'
import { aiAPI } from '@/api/ai'
import { imagesAPI } from '@/api/images'
import { taskAPI } from '@/api/task'
import { useUserStore } from '@/stores/user'
import Credits from '@/views/Credits.vue'
import { assetImageUrl } from '@/utils/assetImageUrl'

const router = useRouter()
const { isDark, toggle: toggleTheme } = useTheme()
const userStore = useUserStore()

// 用户信息 + 积分
const userName = computed(() => userStore.user?.username || '')
const userCredits = computed(() => userStore.credits)
const showCreditsDialog = ref(false)

onMounted(async () => {
  if (userStore.isLoggedIn) {
    await userStore.fetchProfile()
  }
})

function onUserCommand(cmd) {
  if (cmd === 'logout') {
    userStore.logout()
    router.push('/login')
  } else if (cmd === 'credits') {
    showCreditsDialog.value = true
  } else if (cmd === 'password') {
    showPasswordDialog.value = true
  }
}
const showPasswordDialog = ref(false)

// 库编辑图片 – 文件输入 refs
const charLibFileRef  = ref(null)
const sceneLibFileRef = ref(null)
const propLibFileRef  = ref(null)

// 共享：上传图片
async function doUploadLibImg(event, form, api, reloadFn) {
  const file = event.target?.files?.[0]
  if (event.target) event.target.value = ''
  if (!file || !form?.id) return
  form.imgUploading = true
  try {
    const res = await uploadAPI.uploadImage(file)
    const data = res?.data ?? res
    const url = data?.url || data?.path || data?.local_path
    if (!url) { ElMessage.error('上传未返回地址'); return }
    form.image_url = url
    form.local_path = data?.local_path ?? null
    await api.update(form.id, { image_url: url, local_path: null })
    reloadFn()
    ElMessage.success('图片已更新')
  } catch (e) { ElMessage.error(e.message || '上传失败') }
  finally { form.imgUploading = false }
}

// 共享：AI 生成图片
async function doGenerateLibImg(form, prompt, api, reloadFn) {
  if (!prompt?.trim()) { ElMessage.warning('请先填写名称或描述'); return }
  form.imgGenerating = true
  try {
    const res = await imagesAPI.create({ prompt: prompt.trim(), drama_id: null })
    const imgData = res?.data ?? res
    const taskId = imgData?.task_id
    if (!taskId) throw new Error('未返回任务ID')
    let task = null
    for (let i = 0; i < 300; i++) {
      await new Promise(r => setTimeout(r, 1500))
      const tr = await taskAPI.get(taskId)
      task = tr?.data ?? tr
      if (task.status === 'completed') break
      if (task.status === 'failed') throw new Error(task.error || '生成失败')
    }
    if (!task || task.status !== 'completed') throw new Error('生成超时')
    const result = task.result
    const imageUrl = result?.image_url
    const localPath = result?.local_path ?? null
    if (!imageUrl && !localPath) throw new Error('未获取到图片地址')
    form.image_url = imageUrl || ''
    form.local_path = localPath
    await api.update(form.id, { image_url: imageUrl || null, local_path: localPath })
    reloadFn()
    ElMessage.success('AI 图片已生成')
  } catch (e) { ElMessage.error(e.message || '生成失败') }
  finally { form.imgGenerating = false }
}

const loading = ref(false)
const dramas = ref([])
const total = ref(0)
const searchKeyword = ref('')
const { trigger: debouncedSearch } = useDebouncedSearch(() => loadList(), 300)

const showAiConfigDialog = ref(false)
const showHelp = ref(false)
const vendorLockEnabled = ref(false)

// 图片预览
const previewImageUrl = ref(null)
function openImagePreview(url) {
  if (url) previewImageUrl.value = url
}

// 公共角色库
const showCharLibrary = ref(false)
const charLibraryList = ref([])
const charLibraryLoading = ref(false)
const charLibraryPage = ref(1)
const charLibraryPageSize = ref(20)
const charLibraryTotal = ref(0)
const charLibraryKeyword = ref('')
const showEditCharLibrary = ref(false)
const editCharLibraryForm = ref(null)
const editCharLibrarySaving = ref(false)
const { trigger: debouncedLoadCharLibrary } = useDebouncedSearch(() => { charLibraryPage.value = 1; loadCharLibraryList() }, 300)

async function loadCharLibraryList() {
  charLibraryLoading.value = true
  try {
    const res = await characterLibraryAPI.list({ page: charLibraryPage.value, page_size: charLibraryPageSize.value, keyword: charLibraryKeyword.value || undefined, global: 1 })
    charLibraryList.value = res?.items ?? []
    const p = res?.pagination ?? {}
    charLibraryTotal.value = p.total ?? 0
    if (p.page != null) charLibraryPage.value = p.page
    if (p.page_size != null) charLibraryPageSize.value = p.page_size
  } catch { charLibraryList.value = [] } finally { charLibraryLoading.value = false }
}
function openEditCharLibrary(item) {
  editCharLibraryForm.value = { id: item.id, name: item.name ?? '', category: item.category ?? '', description: item.description ?? '', tags: item.tags ?? '', image_url: item.image_url ?? '', local_path: item.local_path ?? null, imgUploading: false, imgGenerating: false }
  showEditCharLibrary.value = true
}
async function submitEditCharLibrary() {
  if (!editCharLibraryForm.value?.id) return
  editCharLibrarySaving.value = true
  try {
    await characterLibraryAPI.update(editCharLibraryForm.value.id, { name: editCharLibraryForm.value.name, category: editCharLibraryForm.value.category || null, description: editCharLibraryForm.value.description || null, tags: editCharLibraryForm.value.tags || null, image_url: editCharLibraryForm.value.image_url || null, local_path: editCharLibraryForm.value.local_path ?? null })
    ElMessage.success('已保存')
    showEditCharLibrary.value = false
    loadCharLibraryList()
  } catch (e) { ElMessage.error(e.message || '保存失败') } finally { editCharLibrarySaving.value = false }
}
async function onDeleteCharLibrary(item) {
  try { await ElMessageBox.confirm(`确定删除公共角色「${(item.name || '未命名').slice(0, 20)}」吗？`, '删除确认', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }) } catch { return }
  try { await characterLibraryAPI.delete(item.id); ElMessage.success('已删除'); loadCharLibraryList() } catch (e) { ElMessage.error(e.message || '删除失败') }
}

// 公共场景库
const showSceneLibrary = ref(false)
const sceneLibraryList = ref([])
const sceneLibraryLoading = ref(false)
const sceneLibraryPage = ref(1)
const sceneLibraryPageSize = ref(20)
const sceneLibraryTotal = ref(0)
const sceneLibraryKeyword = ref('')
const showEditSceneLibrary = ref(false)
const editSceneLibraryForm = ref(null)
const editSceneLibrarySaving = ref(false)
const { trigger: debouncedLoadSceneLibrary } = useDebouncedSearch(() => { sceneLibraryPage.value = 1; loadSceneLibraryList() }, 300)

async function loadSceneLibraryList() {
  sceneLibraryLoading.value = true
  try {
    const res = await sceneLibraryAPI.list({ page: sceneLibraryPage.value, page_size: sceneLibraryPageSize.value, keyword: sceneLibraryKeyword.value || undefined, global: 1 })
    sceneLibraryList.value = res?.items ?? []
    const p = res?.pagination ?? {}
    sceneLibraryTotal.value = p.total ?? 0
    if (p.page != null) sceneLibraryPage.value = p.page
    if (p.page_size != null) sceneLibraryPageSize.value = p.page_size
  } catch { sceneLibraryList.value = [] } finally { sceneLibraryLoading.value = false }
}
function openEditSceneLibrary(item) {
  editSceneLibraryForm.value = { id: item.id, location: item.location ?? '', time: item.time ?? '', category: item.category ?? '', description: item.description ?? '', tags: item.tags ?? '', image_url: item.image_url ?? '', local_path: item.local_path ?? null, imgUploading: false, imgGenerating: false }
  showEditSceneLibrary.value = true
}
async function submitEditSceneLibrary() {
  if (!editSceneLibraryForm.value?.id) return
  editSceneLibrarySaving.value = true
  try {
    await sceneLibraryAPI.update(editSceneLibraryForm.value.id, { location: editSceneLibraryForm.value.location, time: editSceneLibraryForm.value.time || null, category: editSceneLibraryForm.value.category || null, description: editSceneLibraryForm.value.description || null, tags: editSceneLibraryForm.value.tags || null, image_url: editSceneLibraryForm.value.image_url || null, local_path: editSceneLibraryForm.value.local_path ?? null })
    ElMessage.success('已保存')
    showEditSceneLibrary.value = false
    loadSceneLibraryList()
  } catch (e) { ElMessage.error(e.message || '保存失败') } finally { editSceneLibrarySaving.value = false }
}
async function onDeleteSceneLibrary(item) {
  const name = (item.location || item.time || '未命名').slice(0, 20)
  try { await ElMessageBox.confirm(`确定删除公共场景「${name}」吗？`, '删除确认', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }) } catch { return }
  try { await sceneLibraryAPI.delete(item.id); ElMessage.success('已删除'); loadSceneLibraryList() } catch (e) { ElMessage.error(e.message || '删除失败') }
}

// 公共道具库
const showPropLibrary = ref(false)
const propLibraryList = ref([])
const propLibraryLoading = ref(false)
const propLibraryPage = ref(1)
const propLibraryPageSize = ref(20)
const propLibraryTotal = ref(0)
const propLibraryKeyword = ref('')
const showEditPropLibrary = ref(false)
const editPropLibraryForm = ref(null)
const editPropLibrarySaving = ref(false)
const { trigger: debouncedLoadPropLibrary } = useDebouncedSearch(() => { propLibraryPage.value = 1; loadPropLibraryList() }, 300)

async function loadPropLibraryList() {
  propLibraryLoading.value = true
  try {
    const res = await propLibraryAPI.list({ page: propLibraryPage.value, page_size: propLibraryPageSize.value, keyword: propLibraryKeyword.value || undefined, global: 1 })
    propLibraryList.value = res?.items ?? []
    const p = res?.pagination ?? {}
    propLibraryTotal.value = p.total ?? 0
    if (p.page != null) propLibraryPage.value = p.page
    if (p.page_size != null) propLibraryPageSize.value = p.page_size
  } catch { propLibraryList.value = [] } finally { propLibraryLoading.value = false }
}
function openEditPropLibrary(item) {
  editPropLibraryForm.value = { id: item.id, name: item.name ?? '', category: item.category ?? '', description: item.description ?? '', tags: item.tags ?? '', image_url: item.image_url ?? '', local_path: item.local_path ?? null, imgUploading: false, imgGenerating: false }
  showEditPropLibrary.value = true
}
async function submitEditPropLibrary() {
  if (!editPropLibraryForm.value?.id) return
  editPropLibrarySaving.value = true
  try {
    await propLibraryAPI.update(editPropLibraryForm.value.id, { name: editPropLibraryForm.value.name, category: editPropLibraryForm.value.category || null, description: editPropLibraryForm.value.description || null, tags: editPropLibraryForm.value.tags || null, image_url: editPropLibraryForm.value.image_url || null, local_path: editPropLibraryForm.value.local_path ?? null })
    ElMessage.success('已保存')
    showEditPropLibrary.value = false
    loadPropLibraryList()
  } catch (e) { ElMessage.error(e.message || '保存失败') } finally { editPropLibrarySaving.value = false }
}
async function onDeletePropLibrary(item) {
  try { await ElMessageBox.confirm(`确定删除公共道具「${(item.name || '未命名').slice(0, 20)}」吗？`, '删除确认', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }) } catch { return }
  try { await propLibraryAPI.delete(item.id); ElMessage.success('已删除'); loadPropLibraryList() } catch (e) { ElMessage.error(e.message || '删除失败') }
}

const showNewDialog = ref(false)
const newForm = ref({ title: '', description: '', aspect_ratio: '16:9' })
const newSaving = ref(false)
const exportingId = ref(null)
const importing = ref(false)
const importFileInput = ref(null)

const exampleList = ref([])
const importingExample = ref(null)

function loadExamples() {
  dramaAPI.listExamples()
    .then(res => { exampleList.value = Array.isArray(res) ? res : (res?.data ?? []) })
    .catch(() => { exampleList.value = [] })
}

async function onImportExample(ex) {
  importingExample.value = ex.filename
  try {
    const data = await dramaAPI.importExample(ex.filename)
    ElMessage.success(`示例导入成功：${data?.title || ex.name}`)
    loadList()
  } catch (e) {
    const msg = e.response?.data?.message || e.message || '导入失败'
    ElMessage.error(msg)
  } finally {
    importingExample.value = null
  }
}

const showEditDialog = ref(false)
const editForm = ref({ id: null, title: '', description: '' })
const editSaving = ref(false)

function loadList() {
  loading.value = true
  dramaAPI
    .list({ page: 1, page_size: 50, keyword: searchKeyword.value || undefined })
    .then((res) => {
      dramas.value = res?.items ?? []
      total.value = res?.pagination?.total ?? 0
    })
    .catch(() => {
      dramas.value = []
    })
    .finally(() => {
      loading.value = false
    })
}

function formatDate(val) {
  if (!val) return ''
  const d = new Date(val)
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const STATUS_MAP = { draft: '草稿', published: '已发布', archived: '已归档', generating: '生成中' }
const STYLE_MAP = {
  realistic: '写实', cinematic: '电影感', documentary: '纪录片',
  noir: '黑色电影', 'retro film': '复古胶片', horror: '恐怖',
  'anime style': '日本动漫', anime: '日本动漫', 'comic style': '欧美漫画', cartoon: '卡通',
  'ink wash': '国画水墨', 'chinese style': '中国风', historical: '古装', wuxia: '武侠',
  watercolor: '水彩', 'oil painting': '油画', sketch: '素描',
  'woodblock print': '版画', impressionist: '印象派',
  fantasy: '奇幻', 'dark fantasy': '暗黑奇幻', 'sci-fi': '科幻', sci_fi: '科幻',
  cyberpunk: '赛博朋克', steampunk: '蒸汽朋克', 'post-apocalyptic': '末世废土',
  '3d render': '3D渲染', 'pixel art': '像素风', 'low poly': '低多边形',
  minimalist: '极简', dreamy: '唯美梦幻',
}
const GENRE_MAP = { drama: '剧情', comedy: '喜剧', adventure: '冒险', romance: '爱情', thriller: '悬疑', action: '动作', horror: '恐怖' }

function formatStatus(status) { return STATUS_MAP[status] || status || '草稿' }
function formatStyle(style) { return STYLE_MAP[style] || style }
function formatGenre(genre) { return GENRE_MAP[genre] || genre }

// 预计算每个项目的衍生数据，避免模板中重复调用函数
const dramasRich = computed(() => dramas.value.map(d => {
  const eps = d.episodes || []
  const totalSb = eps.reduce((sum, ep) => sum + (ep.storyboards?.length || 0), 0)
  let progressSteps = []
  let progressLabel = ''
  if (eps.length > 0) {
    progressSteps = [
      { label: '剧本', done: eps.some(ep => ep.script_content?.trim()) },
      { label: '分镜', done: eps.some(ep => ep.storyboards?.length > 0) },
      { label: '图片', done: eps.some(ep => ep.storyboards?.some(s => s.image_url)) },
      { label: '视频', done: eps.some(ep => ep.video_url) },
    ]
    const done = progressSteps.filter(s => s.done).length
    progressLabel = done + '/' + progressSteps.length
  }
  return { ...d, _totalSb: totalSb, _progressSteps: progressSteps, _progressLabel: progressLabel }
}))

function goNewProject() {
  showNewDialog.value = true
}

function resetNewForm() {
  newForm.value = { title: '', description: '', aspect_ratio: '16:9' }
}

async function submitNew() {
  const title = newForm.value.title?.trim()
  if (!title) return
  newSaving.value = true
  try {
    const drama = await dramaAPI.create({ title, description: newForm.value.description?.trim() || undefined, metadata: { aspect_ratio: newForm.value.aspect_ratio || '16:9' } })
    showNewDialog.value = false
    ElMessage.success('项目已创建')
    loadList()
    router.push('/film/' + drama.id)
  } catch (e) {
    ElMessage.error(e.message || '创建失败')
  } finally {
    newSaving.value = false
  }
}

function openEditDialog(d) {
  editForm.value = { id: d.id, title: d.title || '', description: d.description || '' }
  showEditDialog.value = true
}

function resetEditForm() {
  editForm.value = { id: null, title: '', description: '' }
}

async function submitEdit() {
  const title = editForm.value.title?.trim()
  if (!title || editForm.value.id == null) return
  editSaving.value = true
  try {
    await dramaAPI.update(editForm.value.id, { title, description: editForm.value.description?.trim() || undefined })
    showEditDialog.value = false
    ElMessage.success('已保存')
    loadList()
  } catch (e) {
    ElMessage.error(e.message || '保存失败')
  } finally {
    editSaving.value = false
  }
}

function openProject(id) {
  router.push('/drama/' + id)
}

async function onExport(d) {
  if (exportingId.value) return
  exportingId.value = d.id
  try {
    const blob = await dramaAPI.exportDrama(d.id)
    const url = URL.createObjectURL(blob instanceof Blob ? blob : new Blob([blob], { type: 'application/zip' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${d.title || 'drama'}.zip`
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success('导出成功')
  } catch (e) {
    ElMessage.error(e.message || '导出失败')
  } finally {
    exportingId.value = null
  }
}

function triggerImport() {
  importFileInput.value?.click()
}

async function onImportFile(e) {
  const file = e.target.files?.[0]
  if (!file) return
  e.target.value = ''
  if (!file.name.endsWith('.zip')) {
    ElMessage.error('请选择 .zip 格式的文件')
    return
  }
  importing.value = true
  try {
    const data = await dramaAPI.importDrama(file)
    ElMessage.success(`导入成功：${data?.title || '项目'}`) 
    loadList()
  } catch (e) {
    const msg = e.response?.data?.message || e.message || '导入失败'
    ElMessage.error(msg)
  } finally {
    importing.value = false
  }
}

async function onDelete(d) {
  try {
    await ElMessageBox.confirm(
      `确定要删除项目「${(d.title || '未命名').slice(0, 20)}${(d.title && d.title.length > 20) ? '…' : ''}」吗？此操作不可恢复。`,
      '删除确认',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  try {
    await dramaAPI.delete(d.id)
    ElMessage.success('已删除')
    loadList()
  } catch (e) {
    ElMessage.error(e.message || '删除失败')
  }
}

onBeforeUnmount(() => {
})

onMounted(async () => {
  loadList()
  loadExamples()
  try {
    const lock = await aiAPI.getVendorLock()
    vendorLockEnabled.value = !!lock?.enabled
  } catch (_) {}
})
</script>

<style scoped>
/* ==============================================
   FilmList — Apple HIG Design System
   ============================================== */

/* ── Page ── */
.film-list {
  min-height: 100vh;
  background: var(--bg-page);
  color: var(--text-primary);
  position: relative;
}

/* ── Header — solid background ── */
.header {
  background: var(--bg-card-solid);
  border-bottom: 1px solid var(--border-muted);
  padding: var(--space-md) var(--space-lg);
  position: sticky;
  top: 0;
  z-index: 100;
  transition: background var(--duration-fast) ease, border-color var(--duration-fast) ease;
}
html.light .header {
  background: var(--bg-card-solid);
  border-bottom: 1px solid var(--border-muted);
}

.header-inner {
  max-width: min(1400px, 96vw);
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: var(--space-md);
  flex-wrap: wrap;
}

/* ── Logo ── */
.logo {
  margin: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  line-height: 1;
  transition: filter var(--duration-normal) ease;
}
.logo:hover {
  filter: brightness(1.05);
}
.logo-icon {
  width: 34px;
  height: 34px;
  border-radius: var(--radius-md);
  object-fit: cover;
  box-shadow: var(--shadow);
  transition: box-shadow var(--duration-normal) ease;
}
.logo:hover .logo-icon {
  box-shadow: var(--shadow-hover);
}
.logo-main {
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif;
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--accent);
  letter-spacing: -0.02em;
}
.page-title {
  color: var(--text-muted);
  font-size: 0.95rem;
}

.header-library {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  margin-left: var(--space-lg);
}
.header-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

/* ── Header buttons — solid style ── */
.btn-library, .btn-help, .btn-theme, .btn-settings, .btn-import, .btn-credits, .btn-user {
  --el-button-bg-color: transparent;
  --el-button-border-color: var(--border-muted);
  --el-button-text-color: var(--text-muted);
  --el-button-hover-bg-color: var(--bg-hover);
  --el-button-hover-border-color: var(--accent-border);
  --el-button-hover-text-color: var(--text-primary);
  transition: background var(--duration-fast) ease, border-color var(--duration-fast) ease, color var(--duration-fast) ease;
}

/* ── Main content area ── */
.main {
  max-width: min(1400px, 96vw);
  margin: 0 auto;
  padding: var(--space-lg) var(--space-md) var(--space-2xl);
  animation: fadeIn var(--duration-normal) ease both;
}
.search-bar {
  max-width: 400px;
  margin-bottom: var(--space-md);
}
.search-input {
  --el-input-width: 100%;
}
.search-input :deep(.el-input__wrapper) {
  border-radius: var(--radius-lg);
}
.projects-wrap {
  min-height: 200px;
}

.empty {
  text-align: center;
  padding: var(--space-2xl) var(--space-lg);
}
.empty-title {
  font-size: 1.1rem;
  color: var(--text-primary);
  margin: 0 0 var(--space-sm);
}
.empty-desc {
  color: var(--text-subtle);
  font-size: 0.9rem;
  margin: 0 0 var(--space-md);
}

.empty-state {
  text-align: center;
  padding: var(--space-2xl) var(--space-lg);
  color: var(--text-muted);
}
.empty-state-icon {
  font-size: 48px;
  margin-bottom: var(--space-md);
}
.empty-state-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 var(--space-sm);
}
.empty-state-desc {
  font-size: 14px;
  color: var(--text-muted);
  margin: 0;
}

/* ── Project grid ── */
.project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: var(--space-md);
}

/* ── Project cards — solid background ── */
.project-card {
  position: relative;
  background: var(--bg-card-solid);
  border: 1px solid var(--border-muted);
  border-radius: var(--radius-lg);
  padding: var(--space-md);
  cursor: pointer;
  transition: border-color var(--duration-normal) ease,
              box-shadow var(--duration-normal) ease;
  overflow: hidden;
  box-shadow: var(--shadow-card);
  animation: fadeIn var(--duration-normal) ease both;
}

.project-card:hover {
  border-color: var(--accent-border);
  box-shadow: var(--shadow-hover);
}
html.light .project-card {
  background: var(--bg-card-solid);
  border-color: var(--border-muted);
}
html.light .project-card:hover {
  border-color: var(--accent-border);
  box-shadow: var(--shadow-hover);
}

/* ── Action card (quick start) — solid border ── */
.action-card {
  cursor: default;
  border-style: dashed;
  border-color: var(--accent-border);
  background: var(--bg-card-solid);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color var(--duration-normal) ease, box-shadow var(--duration-normal) ease;
}
.action-card:hover {
  border-color: var(--accent);
  box-shadow: var(--shadow-hover);
}
html.light .action-card {
  background: var(--bg-card-solid);
  border-color: var(--accent-border);
}
html.light .action-card:hover {
  box-shadow: var(--shadow-hover);
}

.action-card-inner {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
}
.action-card-title {
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--accent);
  margin: 0;
  letter-spacing: -0.01em;
}
.action-card-buttons {
  display: flex;
  gap: var(--space-md);
  width: 100%;
  justify-content: center;
}
.action-btn {
  min-width: 150px;
}
.action-btn-new {
  background: var(--accent) !important;
  border-color: var(--accent) !important;
  color: #1a1a1f !important;
  font-weight: 600 !important;
  box-shadow: var(--shadow) !important;
  transition: background var(--duration-fast) ease, box-shadow var(--duration-fast) ease !important;
}
.action-btn-new:hover {
  filter: brightness(1.1);
  box-shadow: var(--shadow-hover) !important;
}
.action-btn-import {
  --el-button-bg-color: transparent;
  --el-button-border-color: var(--border-muted);
  --el-button-text-color: var(--text-muted);
  --el-button-hover-bg-color: var(--bg-hover);
  --el-button-hover-border-color: var(--accent-border);
  --el-button-hover-text-color: var(--text-primary);
}

.action-card-example {
  width: 100%;
  padding-top: var(--space-md);
  border-top: 1px solid var(--border-muted);
}
.example-hint {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  justify-content: center;
  margin-bottom: var(--space-sm);
}
.example-hint-icon {
  color: var(--accent);
  font-size: 15px;
}
.example-hint-text {
  font-size: 0.8rem;
  color: var(--text-subtle);
}
.example-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
  justify-content: center;
}
.example-btn {
  --el-button-bg-color: rgba(255, 255, 255, 0.05);
  --el-button-border-color: var(--border-muted);
  --el-button-text-color: var(--text-muted);
  --el-button-hover-bg-color: var(--bg-hover);
  --el-button-hover-border-color: var(--accent-border);
  --el-button-hover-text-color: var(--text-primary);
}

/* ── Project card body ── */
.project-card-body {
  padding-right: 56px;
}
.project-title {
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif;
  font-size: 1.1rem;
  font-weight: 700;
  margin: 0 0 var(--space-sm);
  color: var(--text-bright);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  letter-spacing: -0.01em;
}
html.light .project-title {
  color: var(--text-bright);
}

.project-desc {
  font-size: 0.875rem;
  color: var(--text-muted);
  margin: 0 0 var(--space-md);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ── Badges — rounded pills ── */
.project-badges {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
  margin: 0 0 10px;
}
.badge {
  display: inline-flex;
  align-items: center;
  font-size: 0.72rem;
  padding: 2px var(--space-sm);
  border-radius: 99px;
  font-weight: 500;
  line-height: 1.5;
  white-space: nowrap;
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-muted);
  border: 1px solid var(--border-muted);
  transition: background var(--duration-fast) ease, border-color var(--duration-fast) ease;
}
.badge-status--draft {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-muted);
  border: 1px solid var(--border-muted);
}
.badge-status--published {
  background: rgba(34, 197, 94, 0.1);
  color: #4ade80;
  border: 1px solid rgba(34, 197, 94, 0.2);
}
.badge-status--generating {
  background: var(--accent-soft);
  color: var(--accent);
  border: 1px solid var(--accent-border);
}
.badge-status--archived {
  background: rgba(91, 143, 185, 0.08);
  color: var(--text-muted);
  border: 1px solid rgba(91, 143, 185, 0.2);
}
.badge-episodes {
  background: rgba(108, 180, 238, 0.08);
  color: var(--accent2);
  border: 1px solid rgba(108, 180, 238, 0.15);
}
.badge-storyboards {
  background: rgba(20, 184, 166, 0.08);
  color: #2dd4bf;
  border: 1px solid rgba(20, 184, 166, 0.15);
}
.badge-ratio {
  background: var(--accent-soft);
  color: var(--accent);
  border: 1px solid var(--accent-border);
  font-family: monospace;
}
.badge-style {
  background: rgba(168, 130, 200, 0.08);
  color: #c4a8e0;
  border: 1px solid rgba(168, 130, 200, 0.15);
}
.badge-genre {
  background: rgba(249, 115, 22, 0.08);
  color: #fb923c;
  border: 1px solid rgba(249, 115, 22, 0.15);
}

html.light .badge-status--published {
  color: #16a34a;
}
html.light .badge-status--generating {
  color: var(--accent);
}
html.light .badge-episodes {
  color: #3b82f6;
}
html.light .badge-storyboards {
  color: #0d9488;
}
html.light .badge-style {
  color: #7c3aed;
}
html.light .badge-genre {
  color: #ea580c;
}

.project-meta {
  font-size: 0.75rem;
  color: var(--text-subtle);
  margin: 0;
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

/* ── Progress dots ── */
.project-progress {
  display: flex;
  gap: 6px;
  margin-top: 10px;
  margin-bottom: 2px;
  align-items: center;
}
.progress-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--border-muted);
  transition: background var(--duration-fast) ease;
  flex-shrink: 0;
}
.progress-dot--done {
  background: var(--accent);
}
.progress-label {
  font-size: 11px;
  color: var(--text-subtle);
  margin-left: 4px;
  font-variant-numeric: tabular-nums;
}
.project-card-actions {
  position: absolute;
  top: var(--space-md);
  right: var(--space-md);
  display: flex;
  gap: var(--space-xs);
  opacity: 0;
  transition: opacity var(--duration-fast) ease;
}
.project-card:hover .project-card-actions {
  opacity: 1;
}
.project-card-actions .el-button {
  --el-button-size: 28px;
  padding: 0;
  width: 28px;
  height: 28px;
  background: var(--bg-card-solid) !important;
  border-color: var(--border-muted) !important;
  color: var(--text-muted) !important;
  transition: background var(--duration-fast) ease, border-color var(--duration-fast) ease, color var(--duration-fast) ease;
}
.project-card-actions .el-button:hover {
  border-color: var(--accent-border) !important;
  color: var(--text-primary) !important;
}
.project-card-actions .el-button .el-icon {
  font-size: 14px;
}

/* ── Library dialog ── */
:global(.library-dialog .el-dialog__body) { padding-top: var(--space-sm); }

/* ── Image editor in dialogs ── */
.lib-img-editor { display: flex; align-items: center; gap: 14px; }
.lib-img-thumb {
  width: 88px; height: 88px;
  border-radius: var(--radius-lg);
  overflow: hidden;
  cursor: zoom-in;
  background: var(--bg-inner);
  border: 1px solid var(--border-muted);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.lib-img-thumb img { width: 100%; height: 100%; object-fit: cover; }
.lib-img-empty { color: var(--text-faint); font-size: 26px; }
.lib-img-btns { display: flex; flex-direction: column; gap: var(--space-sm); }

.library-toolbar { margin-bottom: var(--space-md); }
.library-list {
  min-height: 200px;
  max-height: 420px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* ── Library items — solid style ── */
.library-item {
  display: flex;
  gap: var(--space-md);
  padding: var(--space-md);
  background: var(--bg-card-solid);
  border: 1px solid var(--border-muted);
  border-radius: var(--radius-lg);
  transition: border-color var(--duration-fast) ease, box-shadow var(--duration-fast) ease;
}
.library-item:hover {
  border-color: var(--accent-border);
  box-shadow: var(--shadow-hover);
}

.library-item-cover {
  width: 72px;
  height: 72px;
  flex-shrink: 0;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--bg-inner);
  border: 1px solid var(--border-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: border-color var(--duration-fast) ease;
}
.library-item-cover:hover {
  border-color: var(--accent-border);
}
.library-item-cover img { width: 100%; height: 100%; object-fit: cover; }
.library-item-placeholder { font-size: 0.8rem; color: var(--text-subtle); }
.library-item-info { flex: 1; min-width: 0; }
.library-item-name { font-weight: 500; margin-bottom: var(--space-xs); color: var(--text-bright); }
.library-item-desc { font-size: 0.85rem; color: var(--text-muted); margin-bottom: var(--space-sm); }
.library-item-actions { display: flex; gap: var(--space-sm); }
.library-empty { text-align: center; color: var(--text-subtle); padding: 40px var(--space-md); }
.library-pagination { margin-top: var(--space-md); display: flex; justify-content: center; }

/* ── Image preview overlay ── */
.image-preview-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  cursor: zoom-out;
  animation: fadeIn var(--duration-fast) ease both;
}
.image-preview-img {
  max-width: 90vw;
  max-height: 90vh;
  border-radius: var(--radius-lg);
  object-fit: contain;
  box-shadow: 0 12px 40px rgba(0,0,0,0.5);
  animation: fadeIn var(--duration-normal) ease both;
}

/* ── Help dialog ── */
.help-content h4 {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-bright);
  margin: 16px 0 8px;
}
.help-content h4:first-child {
  margin-top: 0;
}
.help-content ol {
  padding-left: 20px;
  line-height: 2;
  color: var(--text-primary);
}
.help-content ol b {
  color: var(--text-bright);
}
.help-content p {
  color: var(--text-muted);
  font-size: 14px;
  line-height: 1.6;
}
</style>
