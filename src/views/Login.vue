<template>
  <div class="login-page">
    <div class="login-container">
      <h1 class="app-title">书法集字</h1>
      <div class="login-form">
        <van-field
          v-model="username"
          label="用户名"
          placeholder="4-30字符，汉字算2字符"
          :rules="[{ required: true, message: '请填写用户名' }]"
        />
        <van-field
          v-model="password"
          type="password"
          label="密码"
          placeholder="7-16位，不能是纯数字"
          :rules="[{ required: true, message: '请填写密码' }]"
        />
        <div class="actions">
          <van-button type="primary" block @click="handleLogin" :loading="loading">登录</van-button>
          <!-- <van-button plain block type="primary" @click="handleRegister" style="margin-top: 12px">注册新用户</van-button> -->
          <van-button plain block type="default" @click="handleGuestLogin" style="margin-top: 12px">游客</van-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { loginUser, registerUser, loginAsGuest } from '@/services/db'
import { showToast } from 'vant'

const router = useRouter()
const username = ref('')
const password = ref('')
const loading = ref(false)

const handleLogin = async () => {
  if (!username.value || !password.value) {
    showToast('请输入用户名和密码')
    return
  }

  loading.value = true
  try {
    await loginUser(username.value, password.value)
    showToast('登录成功')
    router.replace('/')
  } catch (e: any) {
    showToast(e.message || '登录失败')
  } finally {
    loading.value = false
  }
}

const handleGuestLogin = async () => {
  try {
    await loginAsGuest()
    showToast('以游客身份登录')
    router.replace('/')
  } catch (e: any) {
    showToast('登录失败')
  }
}

// Registration disabled but kept for future reactivation
// @ts-ignore: intentionally unused
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const handleRegister = async () => {
  if (!username.value || !password.value) {
    showToast('请输入用户名和密码')
    return
  }

  try {
    await registerUser(username.value, password.value)
    showToast('注册成功，已自动登录')
    await loginUser(username.value, password.value)
    router.replace('/')
  } catch (e: any) {
    showToast(e.message || '注册失败')
  }
}
</script>

<style scoped>
.login-page {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--bg-color);
}

.login-container {
  width: 90%;
  max-width: 400px;
  padding: 30px 20px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.app-title {
  text-align: center;
  margin-bottom: 30px;
  color: var(--primary-color);
  font-family: "KaiTi", "STKaiti", serif;
  font-size: 32px;
}

.actions {
  margin-top: 30px;
}
</style>
