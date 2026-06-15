<template>
  <div class="admin-login-page">
    <div class="login-card">
      <h2>视频miao~ 后台管理</h2>
      <el-form @submit.prevent="onLogin" label-position="top">
        <el-form-item label="管理员账号">
          <el-input v-model="form.username" placeholder="admin" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" type="password" placeholder="请输入密码" show-password />
        </el-form-item>
        <el-button type="primary" style="width:100%" @click="onLogin" :loading="submitting">登录</el-button>
      </el-form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { adminLogin } from '@/api/admin.js'

const form = reactive({ username: '', password: '' })
const submitting = ref(false)

async function onLogin() {
  if (!form.username || !form.password) return ElMessage.warning('请输入账号密码')
  submitting.value = true
  try {
    const res = await adminLogin(form)
    localStorage.setItem('admin_token', res.token)
    ElMessage.success('登录成功')
    location.href = '/admin'
  } catch (e) {
    // error handled by interceptor
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  if (localStorage.getItem('admin_token')) location.href = '/admin'
})
</script>

<style scoped>
.admin-login-page { height:100vh; display:flex; align-items:center; justify-content:center; background:linear-gradient(135deg,#1d1e2c 0%,#2a2b3d 100%); }
.login-card { background:#fff; padding:40px; border-radius:12px; width:380px; box-shadow:0 8px 32px rgba(0,0,0,0.2); }
.login-card h2 { text-align:center; margin-bottom:24px; color:#1d1e2c; }
</style>
