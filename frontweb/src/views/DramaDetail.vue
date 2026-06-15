<template>
  <div class="drama-detail">
    <header class="header">
      <div class="header-inner">
        <h1 class="logo" @click="router.push('/')">
          <img src="/logo.png" class="logo-icon" alt="logo" />
          <span class="logo-main">视频miao~</span>
        </h1>
        <span class="breadcrumb-sep">›</span>
        <span class="page-title">{{ drama?.title || '剧集管理' }}</span>
        <el-button class="btn-back-list" @click="router.push('/')">
          <el-icon><ArrowLeft /></el-icon>返回列表
        </el-button>
        <div class="header-actions">
          <el-button class="btn-theme" :title="isDark ? '切换到浅色模式' : '切换到暗色模式'" @click="toggleTheme">
            <el-icon><Sunny v-if="isDark" /><Moon v-else /></el-icon>
            {{ isDark ? '浅色' : '暗色' }}
          </el-button>
          <el-button type="primary" @click="goCreate">
            <el-icon><VideoPlay /></el-icon>进入制作
          </el-button>
        </div>
      </div>
    </header>

    <main class="main" v-loading="loading">
      <!-- 基本信息 + 设置 -->
      <section class="section card">
        <div class="section-title">剧集信息<span v-if="saveStatus" class="save-indicator" :class="'save-' + saveStatus">{{ saveStatus === 'saving' ? '保存中...' : saveStatus === 'saved' ? '已保存' : '保存失败' }}</span></div>
        <el-form :model="infoForm" label-width="110px" label-position="left" class="info-form">
          <el-row :gutter="24">
            <el-col :span="12">
              <el-form-item label="标题">
                <el-input v-model="infoForm.title" placeholder="剧集标题" @blur="saveInfo" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="图片/视频风格">
                <el-select v-model="infoForm.style" placeholder="选择全剧统一风格" clearable style="width: 100%" @change="saveInfo">
                  <el-option-group label="写实 / 影视">
                    <el-option label="写实" value="realistic" />
                    <el-option label="电影感" value="cinematic" />
                    <el-option label="纪录片" value="documentary" />
                    <el-option label="黑色电影" value="noir" />
                    <el-option label="复古胶片" value="retro film" />
                    <el-option label="恐怖" value="horror" />
                  </el-option-group>
                  <el-option-group label="动漫 / 卡通">
                    <el-option label="日本动漫" value="anime style" />
                    <el-option label="欧美漫画" value="comic style" />
                    <el-option label="卡通" value="cartoon" />
                  </el-option-group>
                  <el-option-group label="中国风格">
                    <el-option label="国画水墨" value="ink wash" />
                    <el-option label="中国风" value="chinese style" />
                    <el-option label="古装" value="historical" />
                    <el-option label="武侠" value="wuxia" />
                  </el-option-group>
                  <el-option-group label="绘画艺术">
                    <el-option label="水彩" value="watercolor" />
                    <el-option label="油画" value="oil painting" />
                    <el-option label="素描" value="sketch" />
                    <el-option label="版画" value="woodblock print" />
                    <el-option label="印象派" value="impressionist" />
                  </el-option-group>
                  <el-option-group label="幻想 / 科幻">
                    <el-option label="奇幻" value="fantasy" />
                    <el-option label="暗黑奇幻" value="dark fantasy" />
                    <el-option label="科幻" value="sci-fi" />
                    <el-option label="赛博朋克" value="cyberpunk" />
                    <el-option label="蒸汽朋克" value="steampunk" />
                    <el-option label="末世废土" value="post-apocalyptic" />
                  </el-option-group>
                  <el-option-group label="数字 / 现代">
                    <el-option label="3D 渲染" value="3d render" />
                    <el-option label="像素风" value="pixel art" />
                    <el-option label="低多边形" value="low poly" />
                    <el-option label="极简" value="minimalist" />
                    <el-option label="唯美梦幻" value="dreamy" />
                  </el-option-group>
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="画面比例">
                <el-select v-model="infoForm.aspect_ratio" style="width: 100%" @change="saveInfo">
                  <el-option label="16:9 横屏（默认）" value="16:9" />
                  <el-option label="9:16 竖屏（短视频）" value="9:16" />
                  <el-option label="3:4 竖版" value="3:4" />
                  <el-option label="1:1 方形" value="1:1" />
                  <el-option label="4:3 传统横屏" value="4:3" />
                  <el-option label="21:9 宽银幕" value="21:9" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="24">
              <el-form-item label="故事梗概">
                <el-input v-model="infoForm.description" type="textarea" :rows="3" placeholder="一句话描述故事梗概" @blur="saveInfo" />
              </el-form-item>
            </el-col>
          </el-row>
        </el-form>
      </section>

      <!-- 分集列表 -->
      <section class="section card">
        <div class="section-header">
          <div class="section-title">分集列表</div>
          <span class="section-count">共 {{ episodes.length }} 集</span>
          <EpisodeBatchImportDialog ref="episodeBatchImportDialogRef" :start-episode-number="nextEpisodeNumber" style="margin-left: auto" @import="onBatchImportEpisodes" />
          <el-button size="small" type="primary" :loading="addingEpisode" @click="onAddEpisode">
            <el-icon><Plus /></el-icon>新增一集
          </el-button>
        </div>
        <div v-if="episodes.length === 0" class="empty-tip">暂无分集，点击「新增一集」开始创作</div>
        <div v-else class="episode-grid">
          <div
            v-for="ep in episodes"
            :key="ep.id"
            class="episode-card"
            title="点击进入制作页"
            @click="goEpisode(ep.id)"
          >
            <div class="episode-card-header">
              <span class="episode-num">第 {{ ep.episode_number ?? ep.number ?? '?' }} 集</span>
              <el-button
                size="small"
                type="danger"
                plain
                circle
                :icon="Delete"
                :loading="deletingEpisodeId === ep.id"
                @click.stop="onDeleteEpisode(ep)"
              />
            </div>
            <div class="episode-title">{{ ep.title || '未命名' }}</div>
            <div class="episode-preview">{{ (ep.script_content || '').slice(0, 20) || '暂无剧本' }}</div>
            <div class="episode-stats">
              <span class="ep-stat">
                <span class="ep-stat-num">{{ ep.storyboards?.length ?? 0 }}</span> 分镜
              </span>
              <span v-if="ep.status" class="ep-stat ep-stat--status" :class="'ep-status--' + ep.status">{{ epStatusLabel(ep.status) }}</span>
            </div>
            <div class="episode-enter">
              <el-icon class="episode-enter-icon"><VideoPlay /></el-icon>
              进入制作
            </div>
          </div>
        </div>
      </section>

      <!-- 本剧资源库（Tab 切换） -->
      <section class="section card res-section">
        <nav class="res-tabbar">
          <span class="res-tab-group-label">全局素材库</span>
          <button
            v-for="t in [{v:'lib-char',label:'全局角色'},{v:'lib-scene',label:'全局场景'},{v:'lib-prop',label:'全局道具'}]"
            :key="t.v"
            class="res-tab res-tab--lib"
            :class="{ active: activeResTab === t.v }"
            @click="activeResTab = t.v"
          >{{ t.label }}</button>
          <span class="res-tab-spacer"></span>
          <span class="res-tab-group-label res-tab-group-label--prod">本剧素材</span>
          <button
            v-for="t in [{v:'drama-char',label:'本剧角色'},{v:'drama-scene',label:'本剧场景'},{v:'drama-prop',label:'本剧道具'}]"
            :key="t.v"
            class="res-tab res-tab--drama"
            :class="{ active: activeResTab === t.v }"
            @click="activeResTab = t.v"
          >{{ t.label }}</button>
        </nav>

        <!-- 角色库 -->
        <template v-if="activeResTab === 'lib-char'">
          <div class="library-toolbar">
            <el-input v-model="charKw" placeholder="搜索角色" clearable style="width: 200px" @input="onCharKwInput" />
            <el-button size="small" @click="openImport('char')">从素材库导入</el-button>
          </div>
          <div v-loading="charLoading" class="library-list">
            <div v-for="item in charList" :key="item.id" class="library-item">
              <div class="library-item-cover" @click="openPreview(assetImageUrl(item))">
                <img v-if="item.image_url || item.local_path" :src="assetImageUrl(item)" alt="" />
                <span v-else class="library-placeholder">暂无图</span>
              </div>
              <div class="library-item-info">
                <div class="library-item-name">{{ item.name || '未命名' }}</div>
                <div class="library-item-desc">{{ (item.description || '').slice(0, 60) }}</div>
                <div class="library-item-actions">
                  <el-button size="small" @click="openEditChar(item)">编辑</el-button>
                  <el-button size="small" type="danger" plain @click="deleteChar(item)">删除</el-button>
                </div>
              </div>
            </div>
            <div v-if="!charLoading && charList.length === 0" class="library-empty">暂无本剧角色库记录，可在制作页面「加入本剧库」</div>
          </div>
          <div class="library-pagination">
            <el-pagination v-model:current-page="charPage" v-model:page-size="charPageSize" :total="charTotal" :page-sizes="[10,20,50]" layout="total, sizes, prev, pager, next" @current-change="loadCharList" @size-change="loadCharList" />
          </div>
        </template>

        <!-- 场景库 -->
        <template v-if="activeResTab === 'lib-scene'">
          <div class="library-toolbar">
            <el-input v-model="sceneKw" placeholder="搜索场景" clearable style="width: 200px" @input="onSceneKwInput" />
            <el-button size="small" @click="openImport('scene')">从素材库导入</el-button>
          </div>
          <div v-loading="sceneLoading" class="library-list">
            <div v-for="item in sceneList" :key="item.id" class="library-item">
              <div class="library-item-cover" @click="openPreview(assetImageUrl(item))">
                <img v-if="item.image_url || item.local_path" :src="assetImageUrl(item)" alt="" />
                <span v-else class="library-placeholder">暂无图</span>
              </div>
              <div class="library-item-info">
                <div class="library-item-name">{{ item.location || item.time || '未命名' }}</div>
                <div class="library-item-desc">{{ (item.description || item.prompt || '').slice(0, 60) }}</div>
                <div class="library-item-actions">
                  <el-button size="small" @click="openEditScene(item)">编辑</el-button>
                  <el-button size="small" type="danger" plain @click="deleteScene(item)">删除</el-button>
                </div>
              </div>
            </div>
            <div v-if="!sceneLoading && sceneList.length === 0" class="library-empty">暂无本剧场景库记录，可在制作页面「加入本剧库」</div>
          </div>
          <div class="library-pagination">
            <el-pagination v-model:current-page="scenePage" v-model:page-size="scenePageSize" :total="sceneTotal" :page-sizes="[10,20,50]" layout="total, sizes, prev, pager, next" @current-change="loadSceneList" @size-change="loadSceneList" />
          </div>
        </template>

        <!-- 道具库 -->
        <template v-if="activeResTab === 'lib-prop'">
          <div class="library-toolbar">
            <el-input v-model="propKw" placeholder="搜索道具" clearable style="width: 200px" @input="onPropKwInput" />
            <el-button size="small" @click="openImport('prop')">从素材库导入</el-button>
          </div>
          <div v-loading="propLoading" class="library-list">
            <div v-for="item in propList" :key="item.id" class="library-item">
              <div class="library-item-cover" @click="openPreview(assetImageUrl(item))">
                <img v-if="item.image_url || item.local_path" :src="assetImageUrl(item)" alt="" />
                <span v-else class="library-placeholder">暂无图</span>
              </div>
              <div class="library-item-info">
                <div class="library-item-name">{{ item.name || '未命名' }}</div>
                <div class="library-item-desc">{{ (item.description || item.prompt || '').slice(0, 60) }}</div>
                <div class="library-item-actions">
                  <el-button size="small" @click="openEditProp(item)">编辑</el-button>
                  <el-button size="small" type="danger" plain @click="deleteProp(item)">删除</el-button>
                </div>
              </div>
            </div>
            <div v-if="!propLoading && propList.length === 0" class="library-empty">暂无本剧道具库记录，可在制作页面「加入本剧库」</div>
          </div>
          <div class="library-pagination">
            <el-pagination v-model:current-page="propPage" v-model:page-size="propPageSize" :total="propTotal" :page-sizes="[10,20,50]" layout="total, sizes, prev, pager, next" @current-change="loadPropList" @size-change="loadPropList" />
          </div>
        </template>
        <!-- 本剧制作角色 -->
        <template v-if="activeResTab === 'drama-char'">
          <div class="drama-res-list">
            <template v-if="drama?.characters?.length">
              <div v-for="item in drama.characters" :key="item.id" class="drama-res-item">
                <div class="drama-res-cover" @click="openPreview(assetImageUrl(item))">
                  <img v-if="item.image_url || item.local_path" :src="assetImageUrl(item)" alt="" />
                  <span v-else class="library-placeholder">暂无图</span>
                </div>
                <div class="drama-res-info">
                  <div class="drama-res-name">{{ item.name || '未命名' }}</div>
                  <div class="drama-res-meta" v-if="item.role">
                    <el-tag size="small" type="info">{{ item.role === 'main' ? '主角' : item.role === 'supporting' ? '配角' : item.role }}</el-tag>
                  </div>
                  <div class="drama-res-desc">{{ (item.description || item.prompt || '').slice(0, 80) }}</div>
                  <div class="drama-res-actions">
                    <el-button size="small" @click="openEditDramaChar(item)">编辑</el-button>
                  </div>
                </div>
              </div>
            </template>
            <div v-else class="library-empty">本剧暂无制作角色，请前往剧集制作页面创建</div>
          </div>
        </template>

        <!-- 本剧制作场景 -->
        <template v-if="activeResTab === 'drama-scene'">
          <div class="drama-res-list">
            <template v-if="drama?.scenes?.length">
              <div v-for="item in drama.scenes" :key="item.id" class="drama-res-item">
                <div class="drama-res-cover" @click="openPreview(assetImageUrl(item))">
                  <img v-if="item.image_url || item.local_path" :src="assetImageUrl(item)" alt="" />
                  <span v-else class="library-placeholder">暂无图</span>
                </div>
                <div class="drama-res-info">
                  <div class="drama-res-name">{{ item.location || '未命名' }}</div>
                  <div class="drama-res-meta" v-if="item.time">
                    <el-tag size="small" type="info">{{ item.time }}</el-tag>
                  </div>
                  <div class="drama-res-desc">{{ (item.description || item.prompt || '').slice(0, 80) }}</div>
                  <div class="drama-res-actions">
                    <el-button size="small" @click="openEditDramaScene(item)">编辑</el-button>
                  </div>
                </div>
              </div>
            </template>
            <div v-else class="library-empty">本剧暂无制作场景，请前往剧集制作页面创建</div>
          </div>
        </template>

        <!-- 本剧制作道具 -->
        <template v-if="activeResTab === 'drama-prop'">
          <div class="drama-res-list">
            <template v-if="drama?.props?.length">
              <div v-for="item in drama.props" :key="item.id" class="drama-res-item">
                <div class="drama-res-cover" @click="openPreview(assetImageUrl(item))">
                  <img v-if="item.image_url || item.local_path" :src="assetImageUrl(item)" alt="" />
                  <span v-else class="library-placeholder">暂无图</span>
                </div>
                <div class="drama-res-info">
                  <div class="drama-res-name">{{ item.name || '未命名' }}</div>
                  <div class="drama-res-meta" v-if="item.type">
                    <el-tag size="small" type="info">{{ item.type }}</el-tag>
                  </div>
                  <div class="drama-res-desc">{{ (item.description || item.prompt || '').slice(0, 80) }}</div>
                  <div class="drama-res-actions">
                    <el-button size="small" @click="openEditDramaProp(item)">编辑</el-button>
                  </div>
                </div>
              </div>
            </template>
            <div v-else class="library-empty">本剧暂无制作道具，请前往剧集制作页面创建</div>
          </div>
        </template>
      </section>
    </main>

    <!-- 制作角色 编辑 -->
    <el-dialog v-model="editDramaCharVisible" title="编辑制作角色" width="500px" @close="editDramaCharForm = null">
      <el-form v-if="editDramaCharForm" label-width="80px">
        <el-form-item label="图片">
          <div class="lib-img-editor">
            <div class="lib-img-thumb" @click="openPreview(assetImageUrl(editDramaCharForm))">
              <img v-if="editDramaCharForm.image_url || editDramaCharForm.local_path" :src="assetImageUrl(editDramaCharForm)" />
              <div v-else class="lib-img-empty"><el-icon><PictureFilled /></el-icon></div>
            </div>
            <div class="lib-img-btns">
              <el-button size="small" :loading="editDramaCharForm.imgUploading" @click="dramaCharFileRef.click()">上传图片</el-button>
              <el-button size="small" type="primary" :loading="editDramaCharForm.imgGenerating" @click="generateDramaCharImg">AI 生成</el-button>
            </div>
          </div>
          <input ref="dramaCharFileRef" type="file" accept="image/*" style="display:none" @change="uploadDramaCharImg" />
        </el-form-item>
        <el-form-item label="名称"><el-input v-model="editDramaCharForm.name" /></el-form-item>
        <el-form-item label="角色类型">
          <el-select v-model="editDramaCharForm.role" style="width:100%">
            <el-option label="主角" value="main" />
            <el-option label="配角" value="supporting" />
            <el-option label="次要角色" value="minor" />
          </el-select>
        </el-form-item>
        <el-form-item label="描述"><el-input v-model="editDramaCharForm.description" type="textarea" :rows="3" placeholder="角色背景描述" /></el-form-item>
        <el-form-item label="性格"><el-input v-model="editDramaCharForm.personality" placeholder="性格特征" /></el-form-item>
        <el-form-item label="外貌"><el-input v-model="editDramaCharForm.appearance" type="textarea" :rows="2" placeholder="外貌特征（影响图片生成）" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDramaCharVisible = false">取消</el-button>
        <el-button type="primary" :loading="editDramaCharSaving" @click="saveDramaChar">保存</el-button>
      </template>
    </el-dialog>

    <!-- 制作场景 编辑 -->
    <el-dialog v-model="editDramaSceneVisible" title="编辑制作场景" width="500px" @close="editDramaSceneForm = null">
      <el-form v-if="editDramaSceneForm" label-width="80px">
        <el-form-item label="图片">
          <div class="lib-img-editor">
            <div class="lib-img-thumb" @click="openPreview(assetImageUrl(editDramaSceneForm))">
              <img v-if="editDramaSceneForm.image_url || editDramaSceneForm.local_path" :src="assetImageUrl(editDramaSceneForm)" />
              <div v-else class="lib-img-empty"><el-icon><PictureFilled /></el-icon></div>
            </div>
            <div class="lib-img-btns">
              <el-button size="small" :loading="editDramaSceneForm.imgUploading" @click="dramaSceneFileRef.click()">上传图片</el-button>
              <el-button size="small" type="primary" :loading="editDramaSceneForm.imgGenerating" @click="generateDramaSceneImg">AI 生成</el-button>
            </div>
          </div>
          <input ref="dramaSceneFileRef" type="file" accept="image/*" style="display:none" @change="uploadDramaSceneImg" />
        </el-form-item>
        <el-form-item label="地点"><el-input v-model="editDramaSceneForm.location" /></el-form-item>
        <el-form-item label="时间"><el-input v-model="editDramaSceneForm.time" placeholder="如：浅色/夜晚" /></el-form-item>
        <el-form-item label="描述"><el-input v-model="editDramaSceneForm.description" type="textarea" :rows="3" placeholder="场景描述" /></el-form-item>
        <el-form-item label="图片提示词"><el-input v-model="editDramaSceneForm.prompt" type="textarea" :rows="2" placeholder="图片生成用的详细提示词" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDramaSceneVisible = false">取消</el-button>
        <el-button type="primary" :loading="editDramaSceneSaving" @click="saveDramaScene">保存</el-button>
      </template>
    </el-dialog>

    <!-- 制作道具 编辑 -->
    <el-dialog v-model="editDramaPropVisible" title="编辑制作道具" width="500px" @close="editDramaPropForm = null">
      <el-form v-if="editDramaPropForm" label-width="80px">
        <el-form-item label="图片">
          <div class="lib-img-editor">
            <div class="lib-img-thumb" @click="openPreview(assetImageUrl(editDramaPropForm))">
              <img v-if="editDramaPropForm.image_url || editDramaPropForm.local_path" :src="assetImageUrl(editDramaPropForm)" />
              <div v-else class="lib-img-empty"><el-icon><PictureFilled /></el-icon></div>
            </div>
            <div class="lib-img-btns">
              <el-button size="small" :loading="editDramaPropForm.imgUploading" @click="dramaPropFileRef.click()">上传图片</el-button>
              <el-button size="small" type="primary" :loading="editDramaPropForm.imgGenerating" @click="generateDramaPropImg">AI 生成</el-button>
            </div>
          </div>
          <input ref="dramaPropFileRef" type="file" accept="image/*" style="display:none" @change="uploadDramaPropImg" />
        </el-form-item>
        <el-form-item label="名称"><el-input v-model="editDramaPropForm.name" /></el-form-item>
        <el-form-item label="类型"><el-input v-model="editDramaPropForm.type" placeholder="如：关键道具、背景物件" /></el-form-item>
        <el-form-item label="描述"><el-input v-model="editDramaPropForm.description" type="textarea" :rows="3" placeholder="道具描述" /></el-form-item>
        <el-form-item label="图片提示词"><el-input v-model="editDramaPropForm.prompt" type="textarea" :rows="2" placeholder="图片生成用的详细提示词" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDramaPropVisible = false">取消</el-button>
        <el-button type="primary" :loading="editDramaPropSaving" @click="saveDramaProp">保存</el-button>
      </template>
    </el-dialog>

    <!-- 编辑角色 -->
    <el-dialog v-model="editCharVisible" title="编辑角色库" width="480px" @close="editCharForm = null">
      <el-form v-if="editCharForm" label-width="80px">
        <el-form-item label="图片">
          <div class="lib-img-editor">
            <div class="lib-img-thumb" @click="openPreview(assetImageUrl(editCharForm))">
              <img v-if="editCharForm.image_url || editCharForm.local_path" :src="assetImageUrl(editCharForm)" />
              <div v-else class="lib-img-empty"><el-icon><PictureFilled /></el-icon></div>
            </div>
            <div class="lib-img-btns">
              <el-button size="small" :loading="editCharForm.imgUploading" @click="charFileRef.click()">上传图片</el-button>
              <el-button size="small" type="primary" :loading="editCharForm.imgGenerating" @click="doGenerateLibImg(editCharForm, (editCharForm.name + (editCharForm.description ? ', ' + editCharForm.description : '')), characterLibraryAPI, loadCharList)">AI 生成</el-button>
            </div>
          </div>
          <input ref="charFileRef" type="file" accept="image/*" style="display:none" @change="e => doUploadLibImg(e, editCharForm, characterLibraryAPI, loadCharList)" />
        </el-form-item>
        <el-form-item label="名称"><el-input v-model="editCharForm.name" /></el-form-item>
        <el-form-item label="分类"><el-input v-model="editCharForm.category" placeholder="可选" /></el-form-item>
        <el-form-item label="描述"><el-input v-model="editCharForm.description" type="textarea" :rows="3" placeholder="可选" /></el-form-item>
        <el-form-item label="标签"><el-input v-model="editCharForm.tags" placeholder="逗号分隔" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editCharVisible = false">取消</el-button>
        <el-button type="primary" :loading="editCharSaving" @click="saveChar">保存</el-button>
      </template>
    </el-dialog>

    <!-- 编辑场景 -->
    <el-dialog v-model="editSceneVisible" title="编辑场景库" width="480px" @close="editSceneForm = null">
      <el-form v-if="editSceneForm" label-width="80px">
        <el-form-item label="图片">
          <div class="lib-img-editor">
            <div class="lib-img-thumb" @click="openPreview(assetImageUrl(editSceneForm))">
              <img v-if="editSceneForm.image_url || editSceneForm.local_path" :src="assetImageUrl(editSceneForm)" />
              <div v-else class="lib-img-empty"><el-icon><PictureFilled /></el-icon></div>
            </div>
            <div class="lib-img-btns">
              <el-button size="small" :loading="editSceneForm.imgUploading" @click="sceneFileRef.click()">上传图片</el-button>
              <el-button size="small" type="primary" :loading="editSceneForm.imgGenerating" @click="doGenerateLibImg(editSceneForm, ([editSceneForm.location, editSceneForm.time, editSceneForm.description].filter(Boolean).join(', ')), sceneLibraryAPI, loadSceneList)">AI 生成</el-button>
            </div>
          </div>
          <input ref="sceneFileRef" type="file" accept="image/*" style="display:none" @change="e => doUploadLibImg(e, editSceneForm, sceneLibraryAPI, loadSceneList)" />
        </el-form-item>
        <el-form-item label="地点"><el-input v-model="editSceneForm.location" /></el-form-item>
        <el-form-item label="时间"><el-input v-model="editSceneForm.time" placeholder="如：浅色/夜晚" /></el-form-item>
        <el-form-item label="分类"><el-input v-model="editSceneForm.category" placeholder="可选" /></el-form-item>
        <el-form-item label="描述"><el-input v-model="editSceneForm.description" type="textarea" :rows="3" placeholder="可选" /></el-form-item>
        <el-form-item label="标签"><el-input v-model="editSceneForm.tags" placeholder="逗号分隔" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editSceneVisible = false">取消</el-button>
        <el-button type="primary" :loading="editSceneSaving" @click="saveScene">保存</el-button>
      </template>
    </el-dialog>

    <!-- 编辑道具 -->
    <el-dialog v-model="editPropVisible" title="编辑道具库" width="480px" @close="editPropForm = null">
      <el-form v-if="editPropForm" label-width="80px">
        <el-form-item label="图片">
          <div class="lib-img-editor">
            <div class="lib-img-thumb" @click="openPreview(assetImageUrl(editPropForm))">
              <img v-if="editPropForm.image_url || editPropForm.local_path" :src="assetImageUrl(editPropForm)" />
              <div v-else class="lib-img-empty"><el-icon><PictureFilled /></el-icon></div>
            </div>
            <div class="lib-img-btns">
              <el-button size="small" :loading="editPropForm.imgUploading" @click="propFileRef.click()">上传图片</el-button>
              <el-button size="small" type="primary" :loading="editPropForm.imgGenerating" @click="doGenerateLibImg(editPropForm, (editPropForm.name + (editPropForm.description ? ', ' + editPropForm.description : '')), propLibraryAPI, loadPropList)">AI 生成</el-button>
            </div>
          </div>
          <input ref="propFileRef" type="file" accept="image/*" style="display:none" @change="e => doUploadLibImg(e, editPropForm, propLibraryAPI, loadPropList)" />
        </el-form-item>
        <el-form-item label="名称"><el-input v-model="editPropForm.name" /></el-form-item>
        <el-form-item label="分类"><el-input v-model="editPropForm.category" placeholder="可选" /></el-form-item>
        <el-form-item label="描述"><el-input v-model="editPropForm.description" type="textarea" :rows="3" placeholder="可选" /></el-form-item>
        <el-form-item label="标签"><el-input v-model="editPropForm.tags" placeholder="逗号分隔" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editPropVisible = false">取消</el-button>
        <el-button type="primary" :loading="editPropSaving" @click="saveProp">保存</el-button>
      </template>
    </el-dialog>

    <!-- 从素材库导入 -->
    <el-dialog
      v-model="importVisible"
      :title="`从素材库导入${importType === 'char' ? '角色' : importType === 'scene' ? '场景' : '道具'}`"
      width="760px"
      destroy-on-close
      @open="loadImportList"
    >
      <div class="library-toolbar">
        <el-input v-model="importKw" placeholder="搜索关键词" clearable style="width: 220px" @input="onImportKwInput" />
        <span class="import-tip">点击「导入」将素材复制到本剧资源库</span>
      </div>
      <div v-loading="importLoading" class="library-list import-list">
        <div v-for="item in importList" :key="item.id" class="library-item">
          <div class="library-item-cover" @click="openPreview(assetImageUrl(item))">
            <img v-if="item.image_url || item.local_path" :src="assetImageUrl(item)" alt="" />
            <span v-else class="library-placeholder">暂无图</span>
          </div>
          <div class="library-item-info">
            <div class="library-item-name">
              {{ importType === 'scene' ? (item.location || item.time || '未命名') : (item.name || '未命名') }}
            </div>
            <div class="library-item-desc">{{ (item.description || item.prompt || '').slice(0, 80) }}</div>
            <div class="library-item-actions">
              <el-button size="small" type="primary" :loading="importingId === item.id" @click="doImport(item)">导入</el-button>
            </div>
          </div>
        </div>
        <div v-if="!importLoading && importList.length === 0" class="library-empty">素材库暂无内容</div>
      </div>
      <div class="library-pagination">
        <el-pagination
          v-model:current-page="importPage"
          v-model:page-size="importPageSize"
          :total="importTotal"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          @current-change="loadImportList"
          @size-change="loadImportList"
        />
      </div>
      <template #footer>
        <el-button @click="importVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 图片预览 -->
    <Teleport to="body">
      <div v-if="previewUrl" class="image-preview-overlay" @click="previewUrl = null">
        <img :src="previewUrl" alt="" class="image-preview-img" @click.stop="previewUrl = null" />
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, VideoPlay, Plus, Delete, Sunny, Moon, PictureFilled } from '@element-plus/icons-vue'
import EpisodeBatchImportDialog from '@/components/EpisodeBatchImportDialog.vue'
import { useTheme } from '@/composables/useTheme'
import { useDebouncedSearch } from '@/composables/useDebouncedSearch'
import { dramaAPI } from '@/api/drama'
import { characterLibraryAPI } from '@/api/characterLibrary'
import { sceneLibraryAPI } from '@/api/sceneLibrary'
import { propLibraryAPI } from '@/api/propLibrary'
import { uploadAPI } from '@/api/upload'
import { imagesAPI } from '@/api/images'
import { taskAPI } from '@/api/task'
import { characterAPI } from '@/api/characters'
import { sceneAPI } from '@/api/scenes'
import { propAPI } from '@/api/props'
import { stylePromptMetadataForSave, backfillDramaStylePromptMetadataIfNeeded } from '@/constants/styleOptions'
import { assetImageUrl } from '@/utils/assetImageUrl'

const route = useRoute()
const { isDark, toggle: toggleTheme } = useTheme()
const router = useRouter()
const dramaId = Number(route.params.id)

// 图片编辑 – 文件输入 refs（各资源类型独立）
const charFileRef  = ref(null)
const sceneFileRef = ref(null)
const propFileRef  = ref(null)

// 制作资源编辑
const dramaCharFileRef  = ref(null)
const dramaSceneFileRef = ref(null)
const dramaPropFileRef  = ref(null)

const editDramaCharVisible = ref(false)
const editDramaCharForm    = ref(null)
const editDramaCharSaving  = ref(false)

const editDramaSceneVisible = ref(false)
const editDramaSceneForm    = ref(null)
const editDramaSceneSaving  = ref(false)

const editDramaPropVisible = ref(false)
const editDramaPropForm    = ref(null)
const editDramaPropSaving  = ref(false)
const episodeBatchImportDialogRef = ref(null)

// 共享：上传图片到库条目
async function doUploadLibImg(event, form, api, reloadFn) {
  const file = event.target?.files?.[0]
  if (event.target) event.target.value = ''
  if (!file || !form?.id) return
  form.imgUploading = true
  try {
    const res = await uploadAPI.uploadImage(file, { dramaId })
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

// 共享：AI 生成图片到库条目
async function doGenerateLibImg(form, prompt, api, reloadFn) {
  if (!prompt?.trim()) { ElMessage.warning('请先填写名称或描述'); return }
  form.imgGenerating = true
  try {
    const res = await imagesAPI.create({ prompt: prompt.trim(), drama_id: dramaId || null })
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

// ── 制作资源编辑函数 ────────────────────────────────────────────────────────

function openEditDramaChar(item) {
  editDramaCharForm.value = {
    id: item.id, name: item.name ?? '', role: item.role ?? 'minor',
    description: item.description ?? '', personality: item.personality ?? '',
    appearance: item.appearance ?? '',
    image_url: item.image_url ?? '', local_path: item.local_path ?? null,
    imgUploading: false, imgGenerating: false
  }
  editDramaCharVisible.value = true
}
async function saveDramaChar() {
  if (!editDramaCharForm.value?.id) return
  editDramaCharSaving.value = true
  try {
    await characterAPI.update(editDramaCharForm.value.id, {
      name: editDramaCharForm.value.name,
      role: editDramaCharForm.value.role || null,
      description: editDramaCharForm.value.description || null,
      personality: editDramaCharForm.value.personality || null,
      appearance: editDramaCharForm.value.appearance || null,
    })
    ElMessage.success('已保存')
    editDramaCharVisible.value = false
    loadDrama()
  } catch (e) { ElMessage.error(e.message || '保存失败') }
  finally { editDramaCharSaving.value = false }
}
async function uploadDramaCharImg(event) {
  const file = event.target?.files?.[0]
  if (event.target) event.target.value = ''
  const form = editDramaCharForm.value
  if (!file || !form?.id) return
  form.imgUploading = true
  try {
    const res = await uploadAPI.uploadImage(file, { dramaId })
    const data = res?.data ?? res
    const url = data?.url || data?.path || data?.local_path
    if (!url) { ElMessage.error('上传未返回地址'); return }
    form.image_url = url
    form.local_path = data?.local_path ?? null
    await characterAPI.putImage(form.id, { image_url: url, local_path: null })
    loadDrama()
    ElMessage.success('图片已更新')
  } catch (e) { ElMessage.error(e.message || '上传失败') }
  finally { form.imgUploading = false }
}
async function generateDramaCharImg() {
  const form = editDramaCharForm.value
  if (!form?.id) return
  form.imgGenerating = true
  try {
    const res = await characterAPI.generateImage(form.id, null, null)
    const data = res?.data ?? res
    const taskId = data?.task_id
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
    form.image_url = task.result?.image_url || ''
    form.local_path = task.result?.local_path ?? null
    loadDrama()
    ElMessage.success('AI 图片已生成')
  } catch (e) { ElMessage.error(e.message || '生成失败') }
  finally { form.imgGenerating = false }
}

function openEditDramaScene(item) {
  editDramaSceneForm.value = {
    id: item.id, location: item.location ?? '', time: item.time ?? '',
    description: item.description ?? '', prompt: item.prompt ?? '',
    image_url: item.image_url ?? '', local_path: item.local_path ?? null,
    imgUploading: false, imgGenerating: false
  }
  editDramaSceneVisible.value = true
}
async function saveDramaScene() {
  if (!editDramaSceneForm.value?.id) return
  editDramaSceneSaving.value = true
  try {
    await sceneAPI.update(editDramaSceneForm.value.id, {
      location: editDramaSceneForm.value.location,
      time: editDramaSceneForm.value.time || null,
      description: editDramaSceneForm.value.description || null,
      prompt: editDramaSceneForm.value.prompt || null,
    })
    ElMessage.success('已保存')
    editDramaSceneVisible.value = false
    loadDrama()
  } catch (e) { ElMessage.error(e.message || '保存失败') }
  finally { editDramaSceneSaving.value = false }
}
async function uploadDramaSceneImg(event) {
  const file = event.target?.files?.[0]
  if (event.target) event.target.value = ''
  const form = editDramaSceneForm.value
  if (!file || !form?.id) return
  form.imgUploading = true
  try {
    const res = await uploadAPI.uploadImage(file, { dramaId })
    const data = res?.data ?? res
    const url = data?.url || data?.path || data?.local_path
    if (!url) { ElMessage.error('上传未返回地址'); return }
    form.image_url = url
    form.local_path = data?.local_path ?? null
    await sceneAPI.update(form.id, { image_url: url, local_path: null })
    loadDrama()
    ElMessage.success('图片已更新')
  } catch (e) { ElMessage.error(e.message || '上传失败') }
  finally { form.imgUploading = false }
}
async function generateDramaSceneImg() {
  const form = editDramaSceneForm.value
  if (!form?.id) return
  const prompt = [form.location, form.time, form.description].filter(Boolean).join(', ')
  if (!prompt) { ElMessage.warning('请先填写地点或描述'); return }
  form.imgGenerating = true
  try {
    const res = await sceneAPI.generateImage({ scene_id: form.id, drama_id: dramaId, prompt })
    const data = res?.data ?? res
    const taskId = data?.task_id
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
    form.image_url = task.result?.image_url || ''
    form.local_path = task.result?.local_path ?? null
    loadDrama()
    ElMessage.success('AI 图片已生成')
  } catch (e) { ElMessage.error(e.message || '生成失败') }
  finally { form.imgGenerating = false }
}

function openEditDramaProp(item) {
  editDramaPropForm.value = {
    id: item.id, name: item.name ?? '', type: item.type ?? '',
    description: item.description ?? '', prompt: item.prompt ?? '',
    image_url: item.image_url ?? '', local_path: item.local_path ?? null,
    imgUploading: false, imgGenerating: false
  }
  editDramaPropVisible.value = true
}
async function saveDramaProp() {
  if (!editDramaPropForm.value?.id) return
  editDramaPropSaving.value = true
  try {
    await propAPI.update(editDramaPropForm.value.id, {
      name: editDramaPropForm.value.name,
      type: editDramaPropForm.value.type || null,
      description: editDramaPropForm.value.description || null,
      prompt: editDramaPropForm.value.prompt || null,
    })
    ElMessage.success('已保存')
    editDramaPropVisible.value = false
    loadDrama()
  } catch (e) { ElMessage.error(e.message || '保存失败') }
  finally { editDramaPropSaving.value = false }
}
async function uploadDramaPropImg(event) {
  const file = event.target?.files?.[0]
  if (event.target) event.target.value = ''
  const form = editDramaPropForm.value
  if (!file || !form?.id) return
  form.imgUploading = true
  try {
    const res = await uploadAPI.uploadImage(file, { dramaId })
    const data = res?.data ?? res
    const url = data?.url || data?.path || data?.local_path
    if (!url) { ElMessage.error('上传未返回地址'); return }
    form.image_url = url
    form.local_path = data?.local_path ?? null
    await propAPI.update(form.id, { image_url: url, local_path: null })
    loadDrama()
    ElMessage.success('图片已更新')
  } catch (e) { ElMessage.error(e.message || '上传失败') }
  finally { form.imgUploading = false }
}
async function generateDramaPropImg() {
  const form = editDramaPropForm.value
  if (!form?.id) return
  form.imgGenerating = true
  try {
    const res = await propAPI.generateImage(form.id, null, null)
    const data = res?.data ?? res
    const taskId = data?.task_id
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
    form.image_url = task.result?.image_url || ''
    form.local_path = task.result?.local_path ?? null
    loadDrama()
    ElMessage.success('AI 图片已生成')
  } catch (e) { ElMessage.error(e.message || '生成失败') }
  finally { form.imgGenerating = false }
}

const loading = ref(false)
const drama = ref(null)
const episodes = ref([])
const nextEpisodeNumber = computed(() => (
  episodes.value.length > 0
    ? Math.max(...episodes.value.map((e) => Number(e.episode_number) || 0), 0) + 1
    : 1
))

const infoForm = reactive({ title: '', description: '', genre: '', style: '', aspect_ratio: '16:9' })

function formatDate(val) {
  if (!val) return ''
  return new Date(val).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

async function loadDrama() {
  loading.value = true
  try {
    let d = await dramaAPI.get(dramaId)
    d = await backfillDramaStylePromptMetadataIfNeeded(dramaAPI, dramaId, d)
    drama.value = d
    episodes.value = d.episodes || []
    infoForm.title = d.title || ''
    infoForm.description = d.description || ''
    infoForm.genre = d.genre || ''
    infoForm.style = d.style || ''
    infoForm.aspect_ratio = d.metadata?.aspect_ratio || '16:9'
  } catch (e) {
    ElMessage.error(e.message || '加载失败')
  } finally {
    loading.value = false
  }
}

let infoSaveTimer = null
let saveStatusTimer = null
const saveStatus = ref('') // '' | 'saving' | 'saved' | 'error'
function saveInfo() {
  if (infoSaveTimer) clearTimeout(infoSaveTimer)
  infoSaveTimer = setTimeout(async () => {
    saveStatus.value = 'saving'
    try {
      await dramaAPI.update(dramaId, { title: infoForm.title, description: infoForm.description })
      await dramaAPI.saveOutline(dramaId, {
        genre: infoForm.genre || undefined,
        style: infoForm.style || undefined,
        metadata: {
          ...stylePromptMetadataForSave(infoForm.style),
          aspect_ratio: infoForm.aspect_ratio || '16:9',
        },
      })
      saveStatus.value = 'saved'
      if (saveStatusTimer) clearTimeout(saveStatusTimer)
      saveStatusTimer = setTimeout(() => { saveStatus.value = '' }, 2000)
    } catch (e) {
      console.error('saveInfo failed', e)
      saveStatus.value = 'error'
      if (saveStatusTimer) clearTimeout(saveStatusTimer)
      saveStatusTimer = setTimeout(() => { saveStatus.value = '' }, 3000)
    }
  }, 600)
}

function goCreate() {
  router.push(`/film/${dramaId}`)
}

function goEpisode(epId) {
  router.push(`/film/${dramaId}?episode=${epId}`)
}

const EP_STATUS_MAP = { draft: '草稿', processing: '生成中', completed: '已完成', failed: '失败' }
function epStatusLabel(status) {
  return EP_STATUS_MAP[status] || status
}

async function onBatchImportEpisodes(importedEpisodes) {
  const current = episodes.value.map((ep, i) => ({
    episode_number: ep.episode_number ?? i + 1,
    title: ep.title || '第' + (ep.episode_number ?? i + 1) + '集',
    script_content: ep.script_content || '',
    description: ep.description ?? null,
    duration: ep.duration ?? 0,
  }))
  await dramaAPI.saveEpisodes(dramaId, [...current, ...importedEpisodes])
  await loadDrama()
}

const addingEpisode = ref(false)
const deletingEpisodeId = ref(null)

async function onDeleteEpisode(ep) {
  const label = `第 ${ep.episode_number ?? '?'} 集「${ep.title || '未命名'}」`
  try {
    await ElMessageBox.confirm(`确定删除 ${label}？此操作不可恢复。`, '删除确认', {
      type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消'
    })
  } catch { return }
  deletingEpisodeId.value = ep.id
  try {
    const remaining = episodes.value
      .filter((e) => e.id !== ep.id)
      .map((e, i) => ({
        episode_number: e.episode_number ?? i + 1,
        title: e.title || '第' + (e.episode_number ?? i + 1) + '集',
        script_content: e.script_content || '',
        description: e.description ?? null,
        duration: e.duration ?? 0,
      }))
    await dramaAPI.saveEpisodes(dramaId, remaining)
    ElMessage.success(`${label} 已删除`)
    await loadDrama()
  } catch (e) {
    ElMessage.error(e.message || '删除失败')
  } finally {
    deletingEpisodeId.value = null
  }
}

async function onAddEpisode() {
  addingEpisode.value = true
  try {
    const list = episodes.value
    const nextNum = list.length > 0
      ? Math.max(...list.map((e) => Number(e.episode_number) || 0), 0) + 1
      : 1
    const updated = list.map((ep, i) => ({
      episode_number: ep.episode_number ?? i + 1,
      title: ep.title || '第' + (ep.episode_number ?? i + 1) + '集',
      script_content: ep.script_content || '',
      description: ep.description ?? null,
      duration: ep.duration ?? 0
    }))
    updated.push({ episode_number: nextNum, title: '第' + nextNum + '集', script_content: '', description: null, duration: 0 })
    await dramaAPI.saveEpisodes(dramaId, updated)
    ElMessage.success('已添加第' + nextNum + '集')
    await loadDrama()
  } catch (e) {
    ElMessage.error(e.message || '添加失败')
  } finally {
    addingEpisode.value = false
  }
}

// ---------- 资源库 Tab ----------
const activeResTab = ref('lib-char') // lib-char | lib-scene | lib-prop | drama-char | drama-scene | drama-prop
const previewUrl = ref(null)
function openPreview(url) { if (url) previewUrl.value = url }

// 角色
const charList = ref([]), charLoading = ref(false), charPage = ref(1), charPageSize = ref(20), charTotal = ref(0), charKw = ref('')
const { trigger: debouncedOnCharKw } = useDebouncedSearch(() => { charPage.value = 1; loadCharList() }, 300)
async function loadCharList() {
  charLoading.value = true
  try {
    const res = await characterLibraryAPI.list({ drama_id: dramaId, page: charPage.value, page_size: charPageSize.value, keyword: charKw.value || undefined })
    charList.value = res?.items ?? []; charTotal.value = res?.pagination?.total ?? 0
  } catch { charList.value = [] } finally { charLoading.value = false }
}
function onCharKwInput() { debouncedOnCharKw() }
const editCharVisible = ref(false), editCharForm = ref(null), editCharSaving = ref(false)
function openEditChar(item) {
  editCharForm.value = { id: item.id, name: item.name ?? '', category: item.category ?? '', description: item.description ?? '', tags: item.tags ?? '', image_url: item.image_url ?? '', local_path: item.local_path ?? null, imgUploading: false, imgGenerating: false }
  editCharVisible.value = true
}
async function saveChar() {
  if (!editCharForm.value?.id) return; editCharSaving.value = true
  try {
    await characterLibraryAPI.update(editCharForm.value.id, { name: editCharForm.value.name, category: editCharForm.value.category || null, description: editCharForm.value.description || null, tags: editCharForm.value.tags || null, image_url: editCharForm.value.image_url || null, local_path: editCharForm.value.local_path ?? null })
    ElMessage.success('已保存'); editCharVisible.value = false; loadCharList()
  } catch (e) { ElMessage.error(e.message || '保存失败') } finally { editCharSaving.value = false }
}
async function deleteChar(item) {
  try { await ElMessageBox.confirm(`确定删除「${(item.name || '未命名').slice(0, 20)}」？`, '删除确认', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }) } catch { return }
  try { await characterLibraryAPI.delete(item.id); ElMessage.success('已删除'); loadCharList() } catch (e) { ElMessage.error(e.message || '删除失败') }
}

// 场景
const sceneList = ref([]), sceneLoading = ref(false), scenePage = ref(1), scenePageSize = ref(20), sceneTotal = ref(0), sceneKw = ref('')
const { trigger: debouncedOnSceneKw } = useDebouncedSearch(() => { scenePage.value = 1; loadSceneList() }, 300)
async function loadSceneList() {
  sceneLoading.value = true
  try {
    const res = await sceneLibraryAPI.list({ drama_id: dramaId, page: scenePage.value, page_size: scenePageSize.value, keyword: sceneKw.value || undefined })
    sceneList.value = res?.items ?? []; sceneTotal.value = res?.pagination?.total ?? 0
  } catch { sceneList.value = [] } finally { sceneLoading.value = false }
}
function onSceneKwInput() { debouncedOnSceneKw() }
const editSceneVisible = ref(false), editSceneForm = ref(null), editSceneSaving = ref(false)
function openEditScene(item) {
  editSceneForm.value = { id: item.id, location: item.location ?? '', time: item.time ?? '', category: item.category ?? '', description: item.description ?? '', tags: item.tags ?? '', image_url: item.image_url ?? '', local_path: item.local_path ?? null, imgUploading: false, imgGenerating: false }
  editSceneVisible.value = true
}
async function saveScene() {
  if (!editSceneForm.value?.id) return; editSceneSaving.value = true
  try {
    await sceneLibraryAPI.update(editSceneForm.value.id, { location: editSceneForm.value.location, time: editSceneForm.value.time || null, category: editSceneForm.value.category || null, description: editSceneForm.value.description || null, tags: editSceneForm.value.tags || null, image_url: editSceneForm.value.image_url || null, local_path: editSceneForm.value.local_path ?? null })
    ElMessage.success('已保存'); editSceneVisible.value = false; loadSceneList()
  } catch (e) { ElMessage.error(e.message || '保存失败') } finally { editSceneSaving.value = false }
}
async function deleteScene(item) {
  const n = (item.location || item.time || '未命名').slice(0, 20)
  try { await ElMessageBox.confirm(`确定删除「${n}」？`, '删除确认', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }) } catch { return }
  try { await sceneLibraryAPI.delete(item.id); ElMessage.success('已删除'); loadSceneList() } catch (e) { ElMessage.error(e.message || '删除失败') }
}

// 道具
const propList = ref([]), propLoading = ref(false), propPage = ref(1), propPageSize = ref(20), propTotal = ref(0), propKw = ref('')
const { trigger: debouncedOnPropKw } = useDebouncedSearch(() => { propPage.value = 1; loadPropList() }, 300)
async function loadPropList() {
  propLoading.value = true
  try {
    const res = await propLibraryAPI.list({ drama_id: dramaId, page: propPage.value, page_size: propPageSize.value, keyword: propKw.value || undefined })
    propList.value = res?.items ?? []; propTotal.value = res?.pagination?.total ?? 0
  } catch { propList.value = [] } finally { propLoading.value = false }
}
function onPropKwInput() { debouncedOnPropKw() }
const editPropVisible = ref(false), editPropForm = ref(null), editPropSaving = ref(false)
function openEditProp(item) {
  editPropForm.value = { id: item.id, name: item.name ?? '', category: item.category ?? '', description: item.description ?? '', tags: item.tags ?? '', image_url: item.image_url ?? '', local_path: item.local_path ?? null, imgUploading: false, imgGenerating: false }
  editPropVisible.value = true
}
async function saveProp() {
  if (!editPropForm.value?.id) return; editPropSaving.value = true
  try {
    await propLibraryAPI.update(editPropForm.value.id, { name: editPropForm.value.name, category: editPropForm.value.category || null, description: editPropForm.value.description || null, tags: editPropForm.value.tags || null, image_url: editPropForm.value.image_url || null, local_path: editPropForm.value.local_path ?? null })
    ElMessage.success('已保存'); editPropVisible.value = false; loadPropList()
  } catch (e) { ElMessage.error(e.message || '保存失败') } finally { editPropSaving.value = false }
}
async function deleteProp(item) {
  try { await ElMessageBox.confirm(`确定删除「${(item.name || '未命名').slice(0, 20)}」？`, '删除确认', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }) } catch { return }
  try { await propLibraryAPI.delete(item.id); ElMessage.success('已删除'); loadPropList() } catch (e) { ElMessage.error(e.message || '删除失败') }
}

// ---------- 从素材库导入 ----------
const importVisible = ref(false)
const importType = ref('char') // 'char' | 'scene' | 'prop'
const importList = ref([])
const importLoading = ref(false)
const importPage = ref(1)
const importPageSize = ref(20)
const importTotal = ref(0)
const importKw = ref('')
const importingId = ref(null)
const { trigger: debouncedOnImportKw } = useDebouncedSearch(() => { importPage.value = 1; loadImportList() }, 300)

function openImport(type) {
  importType.value = type
  importKw.value = ''
  importPage.value = 1
  importVisible.value = true
}

async function loadImportList() {
  importLoading.value = true
  try {
    const api = importType.value === 'char' ? characterLibraryAPI
      : importType.value === 'scene' ? sceneLibraryAPI : propLibraryAPI
    // 不传 drama_id，获取全局素材库（所有记录）
    const res = await api.list({ page: importPage.value, page_size: importPageSize.value, keyword: importKw.value || undefined, global: 1 })
    importList.value = res?.items ?? []
    importTotal.value = res?.pagination?.total ?? 0
  } catch { importList.value = [] } finally { importLoading.value = false }
}

function onImportKwInput() {
  debouncedOnImportKw()
}

async function doImport(item) {
  importingId.value = item.id
  try {
    if (importType.value === 'char') {
      await characterLibraryAPI.create({
        drama_id: dramaId,
        name: item.name || '',
        image_url: item.image_url || null,
        local_path: item.local_path || null,
        description: item.description || null,
        category: item.category || null,
        tags: item.tags || null,
        source_type: 'imported',
      })
      loadCharList()
    } else if (importType.value === 'scene') {
      await sceneLibraryAPI.create({
        drama_id: dramaId,
        location: item.location || '',
        time: item.time || null,
        prompt: item.prompt || null,
        description: item.description || null,
        image_url: item.image_url || null,
        local_path: item.local_path || null,
        category: item.category || null,
        tags: item.tags || null,
        source_type: 'imported',
      })
      loadSceneList()
    } else {
      await propLibraryAPI.create({
        drama_id: dramaId,
        name: item.name || '',
        description: item.description || null,
        prompt: item.prompt || null,
        image_url: item.image_url || null,
        local_path: item.local_path || null,
        category: item.category || null,
        tags: item.tags || null,
        source_type: 'imported',
      })
      loadPropList()
    }
    ElMessage.success('已导入到本剧资源库')
  } catch (e) {
    ElMessage.error(e.message || '导入失败')
  } finally {
    importingId.value = null
  }
}

watch(activeResTab, (tab) => {
  if (tab === 'lib-char') loadCharList()
  else if (tab === 'lib-scene') loadSceneList()
  else if (tab === 'lib-prop') loadPropList()
})

onBeforeUnmount(() => {
  // 清理所有防抖/延迟计时器，防止组件卸载后仍触发回调
  if (infoSaveTimer) clearTimeout(infoSaveTimer)
  if (saveStatusTimer) clearTimeout(saveStatusTimer)
})

onMounted(() => {
  loadDrama()
  loadCharList()
  if (route.query.importBatch) {
    setTimeout(() => {
      episodeBatchImportDialogRef.value?.openDialog?.()
    }, 0)
  }
})
</script>

<style scoped>
/* =====================================================
   DramaDetail — Midnight Cinema Design System
   ===================================================== */

/* ── Page root ── */
.drama-detail {
  min-height: 100vh;
  background: var(--bg-page);
  color: var(--text-primary);
  position: relative;
}

/* ── Sticky header ── */
.header {
  background: var(--bg-card-solid);
  border-bottom: 1px solid var(--border-color);
  padding: 12px 24px;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: var(--shadow);
  transition: background var(--duration-normal) ease, border-color var(--duration-normal) ease;
}
html.light .header {
  background: var(--bg-card-solid) !important;
  border-bottom: 1px solid var(--border-color) !important;
  box-shadow: var(--shadow);
}

/* ── Logo ── */
.logo {
  margin: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  line-height: 1;
  transition: filter var(--duration-fast) ease;
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
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--accent);
  letter-spacing: -0.02em;
}

/* ── Header layout ── */
.header-inner {
  max-width: min(1200px, 96vw);
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 16px;
}
.breadcrumb-sep {
  color: var(--text-faint);
  font-size: 1rem;
  font-weight: 300;
  flex-shrink: 0;
  user-select: none;
}

/* ── Page title pill ── */
.page-title {
  font-size: 0.88rem;
  font-weight: 500;
  color: var(--text-muted);
  background: var(--bg-hover);
  border: 1px solid var(--border-color);
  border-radius: 999px;
  padding: 4px 14px;
  max-width: 220px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
html.light .page-title {
  background: var(--bg-hover);
  border-color: var(--border-color);
}

/* ── Buttons ── */
.btn-back-list, .btn-theme {
  flex-shrink: 0;
  background: var(--bg-card-solid) !important;
  border: 1px solid var(--border-color) !important;
  color: var(--text-muted) !important;
  border-radius: var(--radius-md) !important;
  transition: border-color var(--duration-fast) ease, color var(--duration-fast) ease, box-shadow var(--duration-fast) ease !important;
}
.btn-back-list:hover, .btn-theme:hover {
  border-color: var(--accent-border) !important;
  color: var(--accent) !important;
  box-shadow: var(--shadow-hover);
}
html.light .btn-back-list, html.light .btn-theme {
  background: var(--bg-card-solid) !important;
}

/* ── Header actions ── */
.header-actions {
  margin-left: auto;
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

/* ── Main content ── */
.main {
  max-width: min(1200px, 96vw);
  margin: 0 auto;
  padding: 28px 16px 56px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  animation: fadeIn 0.4s ease both;
}

/* ── Section cards ── */
.section.card {
  background: var(--bg-card-solid);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-xl);
  padding: 24px 28px;
  box-shadow: var(--shadow-card);
  transition: box-shadow var(--duration-normal) ease, border-color var(--duration-normal) ease;
  animation: fadeIn 0.4s ease both;
  position: relative;
}
.section.card:hover {
  box-shadow: var(--shadow-hover);
  border-color: var(--accent-border);
}
html.light .section.card {
  background: var(--bg-card-solid) !important;
  border-color: var(--border-color) !important;
  box-shadow: var(--shadow-card) !important;
}

/* ── Section title with accent bar ── */
.section-title {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--text-bright);
  margin-bottom: 18px;
  display: flex;
  align-items: center;
  letter-spacing: -0.01em;
}
.section-title::before {
  content: '';
  display: inline-block;
  width: 3px;
  height: 1.1em;
  background: var(--accent);
  border-radius: var(--radius-sm);
  margin-right: 10px;
  flex-shrink: 0;
}

/* ── Section header ── */
.section-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
}
.section-header .section-title { margin-bottom: 0; }
.section-count {
  color: var(--text-muted);
  font-size: 0.85rem;
  background: var(--accent-soft);
  padding: 2px 10px;
  border-radius: 999px;
  font-weight: 500;
}
.info-form { max-width: 100%; }
.empty-tip {
  color: var(--text-muted);
  text-align: center;
  padding: 40px 20px;
  font-size: 0.9rem;
  background: var(--bg-inner);
  border-radius: var(--radius-lg);
  border: 1px dashed var(--border-color);
}

/* ── Episode grid ── */
.episode-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 14px;
}

/* ── Episode card ── */
.episode-card {
  background: var(--bg-card-solid);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 18px;
  cursor: pointer;
  transition: border-color var(--duration-fast) ease, box-shadow var(--duration-fast) ease;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  animation: fadeIn 0.3s ease both;
}
.episode-card:hover {
  border-color: var(--accent-border);
  box-shadow: var(--shadow-hover);
}
.episode-card:hover .episode-enter {
  color: var(--accent);
  opacity: 1;
}
.episode-card:hover .episode-enter-icon {
  transform: translateX(4px);
}
html.light .episode-card {
  background: var(--bg-card-solid) !important;
  border-color: var(--border-color) !important;
}

/* ── Episode card inner ── */
.episode-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.episode-num {
  font-size: 0.82rem;
  color: var(--accent);
  font-weight: 700;
  letter-spacing: 0.01em;
}
.episode-title {
  font-weight: 500;
  color: var(--text-bright);
  margin-bottom: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.95rem;
}
.episode-preview {
  font-size: 0.78rem;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 10px;
}
.episode-stats {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.ep-stat { font-size: 0.72rem; color: var(--text-muted); }
.ep-stat-num {
  color: var(--accent2);
  font-weight: 600;
}
.ep-stat--status {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 500;
}

/* ── Status badges ── */
.ep-status--draft {
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-muted);
  border: 1px solid rgba(255, 255, 255, 0.08);
}
.ep-status--processing {
  background: var(--accent-soft);
  color: var(--accent);
  border: 1px solid var(--accent-border);
}
.ep-status--completed {
  background: rgba(34, 197, 94, 0.12);
  color: #4ade80;
  border: 1px solid rgba(34, 197, 94, 0.2);
}
.ep-status--failed {
  background: rgba(239, 68, 68, 0.12);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.2);
}

/* ── Episode enter ── */
.episode-enter {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--border-color);
  font-size: 0.78rem;
  color: var(--text-faint);
  display: flex;
  align-items: center;
  gap: 5px;
  opacity: 0.6;
  transition: color var(--duration-fast) ease, opacity var(--duration-fast) ease;
}
.episode-enter-icon {
  font-size: 0.85rem;
  transition: transform var(--duration-fast) ease;
}

/* ── Library toolbar ── */
.library-toolbar {
  margin-bottom: 14px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.import-tip {
  font-size: 0.8rem;
  color: var(--text-muted);
}
.import-list { max-height: 480px; }
.library-list {
  min-height: 120px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 400px;
  overflow-y: auto;
  padding-right: 4px;
}

/* ── Library item ── */
.library-item {
  display: flex;
  gap: 14px;
  padding: 12px;
  background: var(--bg-card-solid);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  transition: border-color var(--duration-fast) ease, box-shadow var(--duration-fast) ease;
}
.library-item:hover {
  border-color: var(--accent-border);
  box-shadow: var(--shadow-hover);
}
html.light .library-item {
  background: var(--bg-inner) !important;
  border-color: var(--border-color) !important;
}

/* ── Library item cover ── */
.library-item-cover {
  width: 72px;
  height: 72px;
  flex-shrink: 0;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--bg-inner);
  border: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: border-color var(--duration-fast) ease, box-shadow var(--duration-fast) ease;
}
.library-item-cover:hover {
  border-color: var(--accent-border);
  box-shadow: var(--shadow-hover);
}
.library-item-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.library-placeholder {
  font-size: 0.8rem;
  color: var(--text-muted);
}
.library-item-info { flex: 1; min-width: 0; }
.library-item-name {
  font-weight: 600;
  color: var(--text-bright);
  margin-bottom: 4px;
}
.library-item-desc {
  font-size: 0.85rem;
  color: var(--text-muted);
  margin-bottom: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.library-item-actions { display: flex; gap: 8px; }
.library-empty {
  text-align: center;
  color: var(--text-muted);
  padding: 40px 20px;
  font-size: 0.88rem;
}
.library-pagination {
  margin-top: 14px;
  display: flex;
  justify-content: center;
}

/* ── Resource tab bar ── */
.res-section { padding-bottom: 0 !important; }
.res-tabbar {
  display: flex;
  align-items: center;
  gap: 0;
  border-bottom: 1px solid var(--border-color);
  padding: 0 4px;
  overflow-x: auto;
  scrollbar-width: none;
  margin: -4px -28px 0;
  padding-left: 28px;
}
.res-tabbar::-webkit-scrollbar { display: none; }
.res-tab-group-label {
  font-size: 11px;
  color: var(--text-faint);
  padding: 0 10px 0 4px;
  white-space: nowrap;
  user-select: none;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  align-self: center;
}
.res-tab-group-label--prod {
  color: var(--accent);
}
.res-tab-spacer {
  flex: 1;
  min-width: 40px;
}

/* ── Resource tabs — pill style ── */
.res-tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  padding: 10px 18px 10px;
  font-size: 13px;
  color: var(--text-muted);
  background: transparent;
  border: none;
  cursor: pointer;
  white-space: nowrap;
  transition: color var(--duration-fast) ease, background var(--duration-fast) ease;
  flex-shrink: 0;
  outline: none;
  border-radius: var(--radius-md) var(--radius-md) 0 0;
}
.res-tab::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 16px;
  right: 16px;
  height: 2px;
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
  background: transparent;
  transition: background var(--duration-fast) ease, box-shadow var(--duration-fast) ease;
}
.res-tab:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

/* ── Library tabs active (accent2) ── */
.res-tab--lib.active {
  color: var(--accent2);
  font-size: 13.5px;
  font-weight: 600;
}
.res-tab--lib.active::after {
  background: var(--accent2);
}

/* ── Drama tabs active (accent) ── */
.res-tab--drama.active {
  color: var(--accent);
  font-size: 13.5px;
  font-weight: 600;
}
.res-tab--drama.active::after {
  background: var(--accent);
}

/* ── Drama resource list ── */
.drama-res-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 6px 0 10px;
}

/* ── Drama resource item ── */
.drama-res-item {
  display: flex;
  gap: 14px;
  width: calc(50% - 6px);
  background: var(--bg-card-solid);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 12px;
  box-sizing: border-box;
  transition: border-color var(--duration-fast) ease, box-shadow var(--duration-fast) ease;
}
.drama-res-item:hover {
  border-color: var(--accent-border);
  box-shadow: var(--shadow-hover);
}
html.light .drama-res-item {
  background: var(--bg-inner) !important;
  border-color: var(--border-color) !important;
}

/* ── Drama resource cover ── */
.drama-res-cover {
  width: 72px;
  height: 72px;
  border-radius: var(--radius-md);
  overflow: hidden;
  flex-shrink: 0;
  cursor: zoom-in;
  background: var(--bg-inner);
  border: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
}
.drama-res-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.drama-res-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.drama-res-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.drama-res-meta { display: flex; gap: 4px; flex-wrap: wrap; }
.drama-res-desc {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.drama-res-actions { margin-top: 6px; }

/* ── Image editor (dialog) ── */
.lib-img-editor { display: flex; align-items: center; gap: 14px; }
.lib-img-thumb {
  width: 88px;
  height: 88px;
  border-radius: var(--radius-md);
  overflow: hidden;
  cursor: zoom-in;
  background: var(--bg-inner);
  border: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.lib-img-thumb img { width: 100%; height: 100%; object-fit: cover; }
.lib-img-empty {
  color: var(--text-faint);
  font-size: 26px;
}
.lib-img-btns { display: flex; flex-direction: column; gap: 8px; }

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
  animation: fadeIn 0.2s ease both;
}
.image-preview-img {
  max-width: 90vw;
  max-height: 90vh;
  border-radius: var(--radius-lg);
  object-fit: contain;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.06);
  animation: fadeIn 0.25s ease both;
}

/* ── Light mode overrides for cards ── */
html.light .episode-title { color: var(--text-bright) !important; }
html.light .library-item-name { color: var(--text-bright) !important; }
html.light .drama-res-name { color: var(--text-primary) !important; }

/* ── Save indicator ── */
.save-indicator {
  font-size: 12px;
  font-weight: 400;
  margin-left: 12px;
  opacity: 0;
  animation: saveFadeIn 0.2s ease forwards;
}
.save-saving { color: var(--text-muted); }
.save-saved { color: #4ade80; }
.save-error { color: #f87171; }
@keyframes saveFadeIn {
  from { opacity: 0; transform: translateX(-4px); }
  to { opacity: 1; transform: translateX(0); }
}
</style>
