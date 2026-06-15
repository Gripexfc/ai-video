<template>
  <div class="admin-layout">
    <!-- 侧边栏 -->
    <div class="admin-sidebar">
      <div class="admin-logo">视频miao~ 后台</div>
      <el-menu :default-active="activeMenu" @select="onMenuSelect" background-color="#1d1e2c" text-color="#a0a3bd" active-text-color="#7c5cfc">
        <el-menu-item index="dashboard"><el-icon><DataAnalysis /></el-icon>仪表盘</el-menu-item>
        <el-menu-item index="users"><el-icon><User /></el-icon>用户管理</el-menu-item>
        <el-menu-item index="relay"><el-icon><Connection /></el-icon>中转站配置</el-menu-item>
        <el-menu-item index="prices"><el-icon><Coin /></el-icon>积分价格</el-menu-item>
        <el-menu-item index="products"><el-icon><Goods /></el-icon>充值商品</el-menu-item>
        <el-menu-item index="orders"><el-icon><List /></el-icon>订单管理</el-menu-item>
        <el-menu-item index="settings"><el-icon><Setting /></el-icon>系统设置</el-menu-item>
        <el-menu-item index="announcements"><el-icon><Bell /></el-icon>公告管理</el-menu-item>
      </el-menu>
    </div>
    <!-- 主区域 -->
    <div class="admin-main">
      <div class="admin-header">
        <span>{{ menuTitles[activeMenu] }}</span>
        <el-button type="danger" size="small" @click="onLogout">退出登录</el-button>
      </div>
      <div class="admin-body">
        <!-- 仪表盘 -->
        <div v-if="activeMenu === 'dashboard'" v-loading="loading">
          <el-row :gutter="16">
            <el-col :span="6"><el-card shadow="hover"><el-statistic title="总用户" :value="dash.totalUsers" /></el-card></el-col>
            <el-col :span="6"><el-card shadow="hover"><el-statistic title="今日新增" :value="dash.todayUsers" /></el-card></el-col>
            <el-col :span="6"><el-card shadow="hover"><el-statistic title="7日活跃" :value="dash.activeUsers" /></el-card></el-col>
            <el-col :span="6"><el-card shadow="hover"><el-statistic title="累计充值(元)" :value="dash.totalRecharged" :precision="2" /></el-card></el-col>
          </el-row>
          <el-row :gutter="16" style="margin-top:16px">
            <el-col :span="6"><el-card shadow="hover"><el-statistic title="今日充值(元)" :value="dash.todayRecharged" :precision="2" /></el-card></el-col>
            <el-col :span="6"><el-card shadow="hover"><el-statistic title="累计消耗(元)" :value="dash.totalConsumed" :precision="2" /></el-card></el-col>
            <el-col :span="6"><el-card shadow="hover"><el-statistic title="今日消耗(元)" :value="dash.todayConsumed" :precision="2" /></el-card></el-col>
          </el-row>
        </div>

        <!-- 用户管理 -->
        <div v-if="activeMenu === 'users'">
          <div style="margin-bottom:12px;display:flex;gap:12px">
            <el-input v-model="userQuery.keyword" placeholder="搜索用户名" clearable style="width:200px" @clear="fetchUsers" @keyup.enter="fetchUsers" />
            <el-select v-model="userQuery.status" placeholder="状态" clearable style="width:120px" @change="fetchUsers">
              <el-option label="正常" value="active" /><el-option label="封禁" value="banned" />
            </el-select>
            <el-button type="primary" @click="fetchUsers">搜索</el-button>
          </div>
          <el-table :data="usersData.list" border stripe v-loading="loading">
            <el-table-column prop="id" label="ID" width="60" />
            <el-table-column prop="username" label="用户名" width="140" />
            <el-table-column prop="balance" label="积分余额" width="100" />
            <el-table-column prop="total_recharged" label="累计充值" width="100" />
            <el-table-column prop="total_consumed" label="累计消耗" width="100" />
            <el-table-column prop="status" label="状态" width="80">
              <template #default="{ row }"><el-tag :type="row.status === 'banned' ? 'danger' : 'success'">{{ row.status === 'banned' ? '封禁' : '正常' }}</el-tag></template>
            </el-table-column>
            <el-table-column prop="last_login_at" label="最后登录" width="170" />
            <el-table-column prop="last_login_ip" label="IP" width="140" />
            <el-table-column prop="created_at" label="注册时间" width="170" />
            <el-table-column label="操作" fixed="right" width="280">
              <template #default="{ row }">
                <el-button size="small" v-if="row.status==='active'" type="danger" @click="onBanUser(row)">封禁</el-button>
                <el-button size="small" v-else type="success" @click="onUnbanUser(row)">解封</el-button>
                <el-button size="small" @click="onAddCredits(row)">加积分</el-button>
                <el-button size="small" @click="onResetPwd(row)">重置密码</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-pagination style="margin-top:12px" :total="usersData.total" :page-size="userQuery.pageSize" v-model:current-page="userQuery.page" layout="total, prev, pager, next" @current-change="fetchUsers" />
        </div>

        <!-- 中转站配置 -->
        <div v-if="activeMenu === 'relay'" v-loading="loading">
          <el-alert title="配置所有 AI 调用的中转站地址和 Key，用户端无需配置" type="info" :closable="false" style="margin-bottom:16px" />
          <div v-for="group in relayGroups" :key="group.key" style="margin-bottom:20px">
            <h4 style="margin-bottom:8px;color:#7c5cfc">{{ group.label }}</h4>
            <el-form label-width="100px" size="default">
              <el-row :gutter="16">
                <el-col :span="8"><el-form-item label="地址"><el-input v-model="relay[group.key+'_url']" :placeholder="'https://api.xxx.com'" /></el-form-item></el-col>
                <el-col :span="8"><el-form-item label="Key"><el-input v-model="relay[group.key+'_key']" placeholder="sk-..." show-password /></el-form-item></el-col>
                <el-col :span="6"><el-form-item label="模型"><el-input v-model="relay[group.key+'_model']" /></el-form-item></el-col>
                <el-col :span="2"><el-button type="success" @click="onTestRelay(group.key)" :loading="testingRelay===group.key">测试</el-button></el-col>
              </el-row>
            </el-form>
          </div>
          <el-button type="primary" @click="onSaveRelay">保存中转站配置</el-button>
        </div>

        <!-- 积分价格 -->
        <div v-if="activeMenu === 'prices'" v-loading="loading">
          <el-alert title="修改即时生效，无需重启。汇率：1 积分 = ¥0.1" type="info" :closable="false" style="margin-bottom:16px" />
          <el-table :data="priceList" border stripe>
            <el-table-column prop="key" label="配置项" width="260" />
            <el-table-column prop="description" label="说明" width="200" />
            <el-table-column label="积分" width="120">
              <template #default="{ row }"><el-input-number v-model="row.value" :min="0" :max="999" size="small" /></template>
            </el-table-column>
            <el-table-column label="对应金额(元)">
              <template #default="{ row }">{{ (row.value * 0.1).toFixed(1) }}</template>
            </el-table-column>
          </el-table>
          <el-button type="primary" style="margin-top:12px" @click="onSavePrices">保存价格</el-button>
        </div>

        <!-- 充值商品 -->
        <div v-if="activeMenu === 'products'" v-loading="loading">
          <el-button type="primary" style="margin-bottom:12px" @click="onEditProduct(null)">新增商品</el-button>
          <el-table :data="productsData" border stripe>
            <el-table-column prop="id" label="ID" width="60" />
            <el-table-column prop="name" label="名称" width="120" />
            <el-table-column prop="price" label="价格(元)" width="100" />
            <el-table-column prop="credits" label="积分" width="100" />
            <el-table-column prop="bonus" label="赠送" width="80" />
            <el-table-column prop="sort_order" label="排序" width="80" />
            <el-table-column prop="is_active" label="状态" width="80">
              <template #default="{ row }"><el-tag :type="row.is_active ? 'success' : 'info'">{{ row.is_active ? '上架' : '下架' }}</el-tag></template>
            </el-table-column>
            <el-table-column label="操作" fixed="right" width="150">
              <template #default="{ row }">
                <el-button size="small" @click="onEditProduct(row)">编辑</el-button>
                <el-button size="small" type="danger" @click="onDeleteProduct(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <!-- 订单管理 -->
        <div v-if="activeMenu === 'orders'">
          <div style="margin-bottom:12px;display:flex;gap:12px">
            <el-select v-model="orderQuery.status" placeholder="状态" clearable style="width:120px" @change="fetchOrders">
              <el-option label="待支付" value="pending" /><el-option label="已支付" value="paid" /><el-option label="已过期" value="expired" />
            </el-select>
            <el-button type="primary" @click="fetchOrders">搜索</el-button>
          </div>
          <el-table :data="ordersData.list" border stripe v-loading="loading">
            <el-table-column prop="order_no" label="订单号" width="240" />
            <el-table-column prop="username" label="用户" width="120" />
            <el-table-column prop="amount" label="金额" width="80" />
            <el-table-column prop="credits" label="积分" width="80" />
            <el-table-column prop="bonus" label="赠送" width="60" />
            <el-table-column prop="status" label="状态" width="80">
              <template #default="{ row }">
                <el-tag :type="row.status==='paid'?'success':row.status==='expired'?'info':'warning'">{{ {pending:'待支付',paid:'已支付',expired:'已过期'}[row.status] }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="created_at" label="创建时间" width="170" />
            <el-table-column prop="paid_at" label="支付时间" width="170" />
            <el-table-column label="操作" fixed="right" width="100">
              <template #default="{ row }">
                <el-button v-if="row.status==='pending'" size="small" type="warning" @click="onConfirmOrder(row)">补单</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-pagination style="margin-top:12px" :total="ordersData.total" :page-size="orderQuery.pageSize" v-model:current-page="orderQuery.page" layout="total, prev, pager, next" @current-change="fetchOrders" />
        </div>

        <!-- 系统设置 -->
        <div v-if="activeMenu === 'settings'" v-loading="loading">
          <el-form label-width="160px" style="max-width:500px">
            <el-form-item label="开放注册"><el-switch v-model="sysSettings.registration_enabled" active-value="true" inactive-value="false" /></el-form-item>
            <el-form-item label="维护模式"><el-switch v-model="sysSettings.maintenance_mode" active-value="true" inactive-value="false" /></el-form-item>
            <el-form-item label="新人赠送积分"><el-switch v-model="sysSettings.welcome_bonus_enabled" active-value="true" inactive-value="false" /></el-form-item>
            <el-form-item v-if="sysSettings.welcome_bonus_enabled==='true'" label="赠送数量"><el-input-number v-model="sysSettings.welcome_bonus_amount" :min="0" :max="999" /></el-form-item>
            <el-form-item><el-button type="primary" @click="onSaveSettings">保存设置</el-button></el-form-item>
          </el-form>
        </div>

        <!-- 公告管理 -->
        <div v-if="activeMenu === 'announcements'">
          <el-button type="primary" style="margin-bottom:12px" @click="onEditAnnouncement(null)">发布公告</el-button>
          <el-table :data="announcementsData" border stripe v-loading="loading">
            <el-table-column prop="id" label="ID" width="60" />
            <el-table-column prop="title" label="标题" width="200" />
            <el-table-column prop="content" label="内容" show-overflow-tooltip />
            <el-table-column prop="type" label="类型" width="80"><template #default="{ row }">{{ row.type === 'popup' ? '弹窗' : '横幅' }}</template></el-table-column>
            <el-table-column prop="is_active" label="启用" width="80"><template #default="{ row }"><el-tag :type="row.is_active ? 'success' : 'info'">{{ row.is_active ? '是' : '否' }}</el-tag></template></el-table-column>
            <el-table-column label="操作" fixed="right" width="150">
              <template #default="{ row }">
                <el-button size="small" @click="onEditAnnouncement(row)">编辑</el-button>
                <el-button size="small" type="danger" @click="onDeleteAnnouncement(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
    </div>

    <!-- 通用弹窗 -->
    <el-dialog v-model="dlgVisible" :title="dlgTitle" width="480px" @close="dlgVisible=false">
      <!-- 加积分 -->
      <el-form v-if="dlgType==='addCredits'" label-width="80px">
        <el-form-item label="积分数"><el-input-number v-model="dlgForm.amount" :min="1" :max="99999" /></el-form-item>
        <el-form-item label="说明"><el-input v-model="dlgForm.description" placeholder="运营补偿/活动赠送等" /></el-form-item>
      </el-form>
      <!-- 重置密码 -->
      <el-form v-if="dlgType==='resetPwd'" label-width="80px">
        <el-form-item label="新密码"><el-input v-model="dlgForm.newPassword" placeholder="至少6位" /></el-form-item>
      </el-form>
      <!-- 编辑商品 -->
      <el-form v-if="dlgType==='editProduct'" label-width="80px">
        <el-form-item label="名称"><el-input v-model="dlgForm.name" /></el-form-item>
        <el-form-item label="价格(元)"><el-input-number v-model="dlgForm.price" :min="0.01" :precision="2" /></el-form-item>
        <el-form-item label="积分"><el-input-number v-model="dlgForm.credits" :min="1" /></el-form-item>
        <el-form-item label="赠送"><el-input-number v-model="dlgForm.bonus" :min="0" /></el-form-item>
        <el-form-item label="排序"><el-input-number v-model="dlgForm.sort_order" :min="0" /></el-form-item>
        <el-form-item label="上架"><el-switch v-model="dlgForm.is_active" :active-value="1" :inactive-value="0" /></el-form-item>
      </el-form>
      <!-- 编辑公告 -->
      <el-form v-if="dlgType==='editAnnouncement'" label-width="80px">
        <el-form-item label="标题"><el-input v-model="dlgForm.title" /></el-form-item>
        <el-form-item label="内容"><el-input type="textarea" v-model="dlgForm.content" :rows="4" /></el-form-item>
        <el-form-item label="类型"><el-select v-model="dlgForm.type"><el-option label="横幅" value="banner" /><el-option label="弹窗" value="popup" /></el-select></el-form-item>
        <el-form-item label="启用"><el-switch v-model="dlgForm.is_active" :active-value="1" :inactive-value="0" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dlgVisible=false">取消</el-button>
        <el-button type="primary" @click="onDlgConfirm" :loading="dlgSaving">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { DataAnalysis, User, Connection, Coin, Goods, List, Setting, Bell } from '@element-plus/icons-vue'
import * as api from '@/api/admin.js'

const activeMenu = ref('dashboard')
const loading = ref(false)
const menuTitles = { dashboard:'仪表盘', users:'用户管理', relay:'中转站配置', prices:'积分价格', products:'充值商品', orders:'订单管理', settings:'系统设置', announcements:'公告管理' }

// ── 仪表盘 ──
const dash = ref({})
async function fetchDashboard() { loading.value=true; try { dash.value = await api.getDashboard() } finally { loading.value=false } }

// ── 用户管理 ──
const userQuery = reactive({ keyword:'', status:'', page:1, pageSize:20 })
const usersData = ref({ total:0, list:[] })
async function fetchUsers() { loading.value=true; try { usersData.value = await api.getUsers(userQuery) } finally { loading.value=false } }
async function onBanUser(row) { await ElMessageBox.confirm(`封禁用户 ${row.username}？`); await api.banUser(row.id); ElMessage.success('已封禁'); fetchUsers() }
async function onUnbanUser(row) { await api.unbanUser(row.id); ElMessage.success('已解封'); fetchUsers() }

// ── 中转站 ──
const relay = ref({})
const testingRelay = ref('')
const relayGroups = [
  { key:'relay_text', label:'文本生成' },
  { key:'relay_image', label:'图片生成（角色/场景/道具）' },
  { key:'relay_sb_image', label:'分镜图片' },
  { key:'relay_video', label:'视频生成' },
  { key:'relay_tts', label:'TTS 语音' },
]
async function fetchRelay() { loading.value=true; try { const d = await api.getRelayConfig(); const r = {}; for(const [k,v] of Object.entries(d)) r[k]=v.value; relay.value=r } finally { loading.value=false } }
async function onSaveRelay() { await api.updateRelayConfig(relay.value); ElMessage.success('保存成功') }
async function onTestRelay(key) { testingRelay.value=key; try { const r = await api.testRelay({ url:relay.value[key+'_url'], key:relay.value[key+'_key'], model:relay.value[key+'_model'] }); ElMessage[r.success?'success':'warning'](r.message) } finally { testingRelay.value='' } }

// ── 积分价格 ──
const priceList = ref([])
async function fetchPrices() { loading.value=true; try { const d = await api.getCreditPrices(); priceList.value = Object.entries(d).map(([k,v])=>({key:k,...v})) } finally { loading.value=false } }
async function onSavePrices() { const data = {}; priceList.value.forEach(r=>data[r.key]=r.value); await api.updateCreditPrices(data); ElMessage.success('保存成功') }

// ── 充值商品 ──
const productsData = ref([])
async function fetchProducts() { loading.value=true; try { productsData.value = await api.getProducts() } finally { loading.value=false } }
async function onDeleteProduct(row) { await ElMessageBox.confirm(`删除商品「${row.name}」？`); await api.deleteProduct(row.id); ElMessage.success('已删除'); fetchProducts() }

// ── 订单 ──
const orderQuery = reactive({ status:'', page:1, pageSize:20 })
const ordersData = ref({ total:0, list:[] })
async function fetchOrders() { loading.value=true; try { ordersData.value = await api.getOrders(orderQuery) } finally { loading.value=false } }
async function onConfirmOrder(row) { await ElMessageBox.confirm(`手动确认订单 ${row.order_no}？`); await api.confirmOrder(row.order_no); ElMessage.success('补单成功'); fetchOrders() }

// ── 系统设置 ──
const sysSettings = reactive({})
async function fetchSettings() { loading.value=true; try { const d = await api.getSettings(); for(const [k,v] of Object.entries(d)) sysSettings[k]=v.value } finally { loading.value=false } }
async function onSaveSettings() { await api.updateSettings(sysSettings); ElMessage.success('保存成功') }

// ── 公告 ──
const announcementsData = ref([])
async function fetchAnnouncements() { loading.value=true; try { announcementsData.value = await api.getAnnouncements() } finally { loading.value=false } }
async function onDeleteAnnouncement(row) { await ElMessageBox.confirm('删除此公告？'); await api.deleteAnnouncement(row.id); ElMessage.success('已删除'); fetchAnnouncements() }

// ── 通用弹窗 ──
const dlgVisible = ref(false)
const dlgTitle = ref('')
const dlgType = ref('')
const dlgSaving = ref(false)
const dlgForm = reactive({})
let dlgTarget = null

function onAddCredits(row) { dlgType.value='addCredits'; dlgTitle.value=`给 ${row.username} 加积分`; Object.assign(dlgForm, { amount:10, description:'' }); dlgTarget=row; dlgVisible.value=true }
function onResetPwd(row) { dlgType.value='resetPwd'; dlgTitle.value=`重置 ${row.username} 密码`; Object.assign(dlgForm, { newPassword:'' }); dlgTarget=row; dlgVisible.value=true }
function onEditProduct(row) { dlgType.value='editProduct'; dlgTitle.value=row?'编辑商品':'新增商品'; Object.assign(dlgForm, row ? { ...row } : { name:'', price:9.9, credits:99, bonus:0, sort_order:0, is_active:1 }); dlgTarget=row; dlgVisible.value=true }
function onEditAnnouncement(row) { dlgType.value='editAnnouncement'; dlgTitle.value=row?'编辑公告':'发布公告'; Object.assign(dlgForm, row ? { ...row } : { title:'', content:'', type:'banner', is_active:0 }); dlgTarget=row; dlgVisible.value=true }

async function onDlgConfirm() {
  dlgSaving.value = true
  try {
    if (dlgType.value === 'addCredits') { await api.addUserCredits(dlgTarget.id, { amount:dlgForm.amount, description:dlgForm.description }); ElMessage.success(`已加 ${dlgForm.amount} 积分`); fetchUsers() }
    else if (dlgType.value === 'resetPwd') { await api.resetUserPassword(dlgTarget.id, { newPassword:dlgForm.newPassword }); ElMessage.success('密码已重置') }
    else if (dlgType.value === 'editProduct') { if (dlgTarget) await api.updateProduct(dlgTarget.id, dlgForm); else await api.createProduct(dlgForm); ElMessage.success('保存成功'); fetchProducts() }
    else if (dlgType.value === 'editAnnouncement') { if (dlgTarget) await api.updateAnnouncement(dlgTarget.id, dlgForm); else await api.createAnnouncement(dlgForm); ElMessage.success('保存成功'); fetchAnnouncements() }
    dlgVisible.value = false
  } finally { dlgSaving.value = false }
}

// ── 菜单切换 ──
function onMenuSelect(key) {
  activeMenu.value = key
  if (key==='dashboard') fetchDashboard()
  else if (key==='users') fetchUsers()
  else if (key==='relay') fetchRelay()
  else if (key==='prices') fetchPrices()
  else if (key==='products') fetchProducts()
  else if (key==='orders') fetchOrders()
  else if (key==='settings') fetchSettings()
  else if (key==='announcements') fetchAnnouncements()
}

function onLogout() { localStorage.removeItem('admin_token'); location.href = '/admin/login' }

onMounted(() => {
  const token = localStorage.getItem('admin_token')
  if (!token) { location.href = '/admin/login'; return }
  fetchDashboard()
})
</script>

<style scoped>
.admin-layout { display:flex; height:100vh; background:#f0f2f5; }
.admin-sidebar { width:200px; background:#1d1e2c; overflow-y:auto; flex-shrink:0; }
.admin-logo { color:#7c5cfc; font-size:16px; font-weight:bold; padding:20px 16px; text-align:center; border-bottom:1px solid #2a2b3d; }
.admin-main { flex:1; display:flex; flex-direction:column; overflow:hidden; }
.admin-header { height:50px; background:#fff; display:flex; align-items:center; justify-content:space-between; padding:0 24px; border-bottom:1px solid #e8e8e8; font-size:16px; font-weight:600; }
.admin-body { flex:1; padding:20px; overflow-y:auto; }
</style>
