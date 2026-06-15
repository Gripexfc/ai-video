<template>
  <el-dialog v-model="visible" title="积分中心" width="600px" :close-on-click-modal="false" @close="emit('close'); emit('refresh')">
    <!-- 余额 -->
    <div class="balance-section">
      <span class="balance-label">当前积分</span>
      <span class="balance-value">{{ balance.balance || 0 }}</span>
    </div>

    <!-- 充值商品 -->
    <h4 style="margin:16px 0 8px">充值</h4>
    <div class="product-grid">
      <div v-for="p in products" :key="p.id" class="product-card" :class="{ active: selectedProduct?.id === p.id }" @click="selectProduct(p)">
        <div class="product-name">{{ p.name }}</div>
        <div class="product-credits">{{ p.credits + p.bonus }} 积分</div>
        <div class="product-price">¥{{ p.price }}</div>
        <div v-if="p.bonus > 0" class="product-bonus">送 {{ p.bonus }}</div>
      </div>
    </div>

    <!-- 支付区域 -->
    <div v-if="payOrder" class="pay-section">
      <div class="pay-info">
        <span>支付金额：<b>¥{{ payOrder.amount }}</b></span>
        <span>获得积分：<b>{{ payOrder.credits }}</b></span>
      </div>
      <div class="pay-qr">
        <p>请使用支付宝扫码支付</p>
        <img :src="qrApiUrl + '?text=' + encodeURIComponent(payOrder.payUrl) + '&size=200x200'" alt="支付二维码" v-if="payOrder.payUrl" />
        <p class="pay-order-no">订单号：{{ payOrder.orderNo }}</p>
      </div>
      <el-button type="primary" @click="pollOrderStatus" :loading="polling">我已完成支付</el-button>
    </div>

    <!-- 流水 -->
    <h4 style="margin:16px 0 8px">最近记录</h4>
    <el-table :data="transactions" size="small" max-height="200">
      <el-table-column prop="created_at" label="时间" width="150" />
      <el-table-column label="类型" width="80">
        <template #default="{ row }">{{ { recharge:'充值', consume:'消耗', gift:'赠送', refund:'退还' }[row.type] || row.type }}</template>
      </el-table-column>
      <el-table-column prop="amount" label="积分" width="80">
        <template #default="{ row }"><span :style="{color: row.amount > 0 ? '#67c23a' : '#f56c6c'}">{{ row.amount > 0 ? '+' : '' }}{{ row.amount }}</span></template>
      </el-table-column>
      <el-table-column prop="description" label="说明" show-overflow-tooltip />
    </el-table>
  </el-dialog>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { getBalance, getTransactions, getCreditProducts, createTopup, getOrderStatus } from '@/api/auth.js'

const props = defineProps({ visible: Boolean })
const emit = defineEmits(['update:visible', 'close', 'refresh'])
const visible = ref(props.visible)

watch(() => props.visible, (v) => { visible.value = v })
watch(visible, (v) => { if (!v) emit('update:visible', false) })
const balance = ref({})
const products = ref([])
const selectedProduct = ref(null)
const payOrder = ref(null)
const polling = ref(false)
const transactions = ref([])
const qrApiUrl = 'https://api.qrserver.com/v1/create-qr-code/'

async function fetchData() {
  balance.value = await getBalance()
  products.value = await getCreditProducts()
  const txData = await getTransactions({ page: 1, pageSize: 20 })
  transactions.value = txData.list || []
}

function selectProduct(p) {
  selectedProduct.value = p
  payOrder.value = null
  onCreateOrder()
}

async function onCreateOrder() {
  if (!selectedProduct.value) return
  try {
    payOrder.value = await createTopup({ productId: selectedProduct.value.id })
  } catch (e) { /* handled */ }
}

async function pollOrderStatus() {
  if (!payOrder.value) return
  polling.value = true
  try {
    const order = await getOrderStatus(payOrder.value.orderNo)
    if (order.status === 'paid') {
      ElMessage.success('充值成功！')
      payOrder.value = null
      selectedProduct.value = null
      fetchData()
    } else {
      ElMessage.info('还未检测到支付，请稍后再试')
    }
  } finally { polling.value = false }
}

onMounted(fetchData)
</script>

<style scoped>
.balance-section { text-align:center; padding:20px 0; background:linear-gradient(135deg,#667eea,#764ba2); border-radius:12px; color:#fff; }
.balance-label { display:block; font-size:14px; opacity:0.8; }
.balance-value { font-size:48px; font-weight:bold; }
.product-grid { display:flex; gap:10px; flex-wrap:wrap; }
.product-card { flex:1; min-width:90px; padding:12px 8px; text-align:center; border:2px solid #e8e8e8; border-radius:10px; cursor:pointer; transition:all 0.2s; }
.product-card:hover, .product-card.active { border-color:#7c5cfc; background:#f5f0ff; }
.product-name { font-size:14px; font-weight:600; }
.product-credits { font-size:12px; color:#666; margin:4px 0; }
.product-price { font-size:18px; font-weight:bold; color:#f56c6c; }
.product-bonus { font-size:11px; color:#67c23a; margin-top:2px; }
.pay-section { text-align:center; margin-top:16px; padding:16px; background:#f9f9f9; border-radius:8px; }
.pay-info { display:flex; justify-content:center; gap:24px; margin-bottom:12px; }
.pay-qr img { margin:8px auto; border:4px solid #fff; box-shadow:0 2px 8px rgba(0,0,0,0.1); }
.pay-order-no { font-size:12px; color:#999; margin-top:4px; }
</style>
