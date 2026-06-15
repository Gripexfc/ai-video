<template>
  <div class="login-page">
    <div class="login-card">
      <h2>{{ isRegister ? '注册账号' : '登录' }}</h2>
      <el-form @submit.prevent="onSubmit">
        <el-form-item>
          <el-input v-model="form.username" placeholder="用户名（4-20位，字母数字下划线）" prefix-icon="User" />
        </el-form-item>
        <el-form-item>
          <el-input v-model="form.password" :type="showPwd?'text':'password'" placeholder="密码（至少6位）" prefix-icon="Lock">
            <template #suffix><el-icon @click="showPwd=!showPwd" style="cursor:pointer"><component :is="showPwd?'View':'Hide'" /></el-icon></template>
          </el-input>
        </el-form-item>
        <el-form-item v-if="isRegister">
          <el-input v-model="form.confirmPwd" type="password" placeholder="确认密码" prefix-icon="Lock" />
        </el-form-item>
        <el-button type="primary" style="width:100%" @click="onSubmit" :loading="submitting">{{ isRegister ? '注册' : '登录' }}</el-button>
      </el-form>
      <div class="login-switch">
        <span v-if="!isRegister">没有账号？<el-link type="primary" @click="isRegister=true">立即注册</el-link></span>
        <span v-else>已有账号？<el-link type="primary" @click="isRegister=false">去登录</el-link></span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { View, Hide } from '@element-plus/icons-vue'
import { login, register } from '@/api/auth.js'
import { useUserStore } from '@/stores/user.js'

const isRegister = ref(false)
const showPwd = ref(false)
const submitting = ref(false)
const form = reactive({ username:'', password:'', confirmPwd:'' })
const userStore = useUserStore()

async function onSubmit() {
  if (!form.username || !form.password) return ElMessage.warning('请填写用户名和密码')
  if (isRegister.value && form.password !== form.confirmPwd) return ElMessage.warning('两次密码不一致')
  submitting.value = true
  try {
    if (isRegister.value) {
      await register({ username: form.username, password: form.password })
      ElMessage.success('注册成功，请登录')
      isRegister.value = false
    } else {
      const res = await login({ username: form.username, password: form.password })
      userStore.setToken(res.token)
      userStore.setUser(res)
      ElMessage.success('登录成功')
      location.href = '/'
    }
  } finally { submitting.value = false }
}

onMounted(() => {
  if (userStore.token) location.href = '/'
})
</script>

<style scoped>
.login-page { height:100vh; display:flex; align-items:center; justify-content:center; background:linear-gradient(135deg,#667eea 0%,#764ba2 100%); }
.login-card { background:#fff; padding:40px; border-radius:16px; width:400px; box-shadow:0 12px 40px rgba(0,0,0,0.15); }
.login-card h2 { text-align:center; margin-bottom:28px; color:#333; }
.login-switch { text-align:center; margin-top:16px; font-size:14px; color:#999; }
</style>
