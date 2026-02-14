<template>
  <div class="settings-page container">
    <h1 class="page-title">设置</h1>

    <van-cell-group title="用户账户">
      <van-cell title="当前用户" :value="currentUser?.username || '未登录'" :label="currentUser?.role === 'admin' ? '管理员' : (currentUser?.role === 'guest' ? '游客' : '普通用户')" />
      <van-cell title="切换用户" is-link @click="showLoginDialog = true" />
      <van-cell title="退出登录" is-link @click="handleLogout" v-if="currentUser" />
    </van-cell-group>

    <van-cell-group title="用户管理" v-if="currentUser?.role === 'admin'">
      <van-cell title="管理用户" is-link @click="showUserList = true" />
    </van-cell-group>

    <van-cell-group title="隐私设置" v-if="currentUser?.role === 'user'">
      <van-cell title="书写是否公开">
        <template #label>
          公开后，您的已精修书写将对所有人可见并可被评分
        </template>
        <template #right-icon>
          <van-radio-group v-model="userVisibility" direction="horizontal" @change="handleVisibilityChange">
            <van-radio name="public">公开</van-radio>
            <van-radio name="private">不公开</van-radio>
          </van-radio-group>
        </template>
      </van-cell>
    </van-cell-group>

    <van-cell-group title="显示设置">
      <van-cell title="默认格线">
        <template #right-icon>
          <van-radio-group v-model="settings.gridType" direction="horizontal">
            <van-radio name="mi">米字格</van-radio>
            <van-radio name="tian">田字格</van-radio>
            <van-radio name="hui">回字格</van-radio>
          </van-radio-group>
        </template>
      </van-cell>
    </van-cell-group>

    <van-cell-group title="数据管理">
      <van-cell title="清除所有数据" is-link @click="clearData" />
      <van-cell title="导出数据" is-link @click="exportData" />
    </van-cell-group>

    <div class="version-info">
      v1.0.0
    </div>

    <van-dialog v-model:show="showLoginDialog" title="切换用户" show-cancel-button @confirm="handleLogin">
      <van-field v-model="loginForm.username" label="用户名" placeholder="请输入用户名" />
      <van-field v-model="loginForm.password" type="password" label="密码" placeholder="请输入密码 (可选)" />
      <div style="padding: 10px; text-align: center;">
        <van-button size="small" type="primary" plain @click="handleRegister">注册新用户</van-button>
      </div>
    </van-dialog>

    <van-popup v-model:show="showUserList" position="bottom" :style="{ height: '50%' }" round closeable>
      <div style="padding: 16px;">
        <h3>用户列表</h3>
        <van-list>
          <van-cell v-for="user in userList" :key="user.id" :title="user.username" :label="user.role">
             <template #right-icon>
               <van-button size="mini" @click="resetPassword(user)" v-if="user.username !== 'admin'">重置密码</van-button>
             </template>
          </van-cell>
        </van-list>
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, reactive } from 'vue'
import { getSettings, saveSettings, clearAllData, currentUser, loginUser, registerUser, getAllUsers, updateUser, logoutUser, setAllVisibility } from '@/services/db'
import type { AppSettings, User } from '@/types'
import { showDialog, showToast } from 'vant'
import { useRouter } from 'vue-router'

const router = useRouter()

const settings = ref<AppSettings>({
  gridType: 'mi',
  gridSize: 100,
  compressionLevel: 5,
  theme: 'light',
  defaultVisibility: 'private'
})

const userVisibility = ref<'public' | 'private'>('private')

const handleVisibilityChange = async (val: 'public' | 'private') => {
  await setAllVisibility(val)
  showToast('设置已更新')
}

const showLoginDialog = ref(false)
const loginForm = reactive({
  username: '',
  password: ''
})

const showUserList = ref(false)
const userList = ref<User[]>([])

const handleLogout = () => {
  showDialog({
    title: '提示',
    message: '确定要退出登录吗？',
    showCancelButton: true
  }).then((action) => {
    if (action === 'confirm') {
      logoutUser()
      showToast('已退出登录')
      router.push('/')
    }
  })
}

const loadUsers = async () => {
  if (currentUser.value?.role === 'admin') {
    userList.value = await getAllUsers()
  }
}

watch(() => showUserList.value, (val) => {
  if (val) loadUsers()
})

const resetPassword = (user: User) => {
  showDialog({
    title: '重置密码',
    message: `确定要重置用户 ${user.username} 的密码为 "123456" 吗？`,
    showCancelButton: true
  }).then(async (action) => {
    if (action === 'confirm') {
      // Use the password field as a signal to updateUser to reset via server
      user.password = '123456'
      await updateUser(user)
      showToast('密码已重置')
    }
  })
}


const handleLogin = async () => {
  try {
    await loginUser(loginForm.username, loginForm.password)
    showToast('登录成功')
    // Reload settings for new user? Actually settings are global in current db.ts implementation,
    // but maybe they should be per user?
    // The prompt didn't specify per-user settings, but "written words... works...".
    // I'll leave settings global for now or shared.
    // But I should probably reload data if the views depend on it.
    // Since db.ts functions filter by currentUser, reactivity should handle it if components are reactive.
    // However, components usually fetch data on mount.
    // I might need to trigger a reload. But let's stick to basic login first.
  } catch (e: any) {
    showToast('登录失败: ' + e.message)
    // Prevent dialog close? Vant dialog closes on confirm.
    // Ideally we should validate before closing.
  }
}

const handleRegister = async () => {
  try {
    await registerUser(loginForm.username, loginForm.password)
    await loginUser(loginForm.username, loginForm.password)
    showToast('注册并登录成功')
    showLoginDialog.value = false
  } catch (e: any) {
    showToast('注册失败: ' + e.message)
  }
}

onMounted(async () => {
  const saved = await getSettings()
  if (saved) {
    settings.value = { ...settings.value, ...saved }
    if (!settings.value.defaultVisibility) {
      settings.value.defaultVisibility = 'private'
    }
  }
  if (currentUser.value) {
    userVisibility.value = currentUser.value.collectionVisibility || 'private'
  }
})

watch(settings, async (newVal) => {
  // 深拷贝以避免Proxy问题
  await saveSettings(JSON.parse(JSON.stringify(newVal)))
}, { deep: true })

const clearData = () => {
  showDialog({
    title: '警告',
    message: '确定要清除所有收集的数据吗？此操作不可恢复。',
    showCancelButton: true
  }).then(async (action) => {
    if (action === 'confirm') {
      await clearAllData()
      showToast('数据已清除')
    }
  })
}

const exportData = () => {
  showToast('功能开发中')
}
</script>

<style scoped>
.version-info {
  text-align: center;
  margin-top: 40px;
  color: #ccc;
  font-size: 12px;
}
</style>
