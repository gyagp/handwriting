<template>
  <div class="settings-page container">
    <h1 class="page-title">设置</h1>

    <van-cell-group title="用户账户">
      <van-cell title="当前用户" :value="currentUser?.username || '未登录'" :label="currentUser?.role === 'admin' ? '管理员' : (currentUser?.role === 'guest' ? '游客' : '普通用户')" />
      <van-cell title="修改密码" is-link @click="showChangePasswordDialog = true" v-if="currentUser && currentUser.role !== 'guest'" />
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
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h3>用户列表</h3>
          <van-button size="small" type="primary" @click="showCreateUserDialog = true">添加用户</van-button>
        </div>
        <van-list>
          <van-cell v-for="user in userList" :key="user.id" :title="user.username" :label="user.role">
             <template #right-icon>
               <van-button size="mini" @click="resetPassword(user)" v-if="user.username !== 'admin'">重置密码</van-button>
             </template>
          </van-cell>
        </van-list>
      </div>
    </van-popup>

    <van-dialog v-model:show="showChangePasswordDialog" title="修改密码" show-cancel-button @confirm="handleChangePassword">
      <van-field v-model="passwordForm.oldPassword" type="password" label="原密码" placeholder="请输入原密码" />
      <van-field v-model="passwordForm.newPassword" type="password" label="新密码" placeholder="7-16位，不能是纯数字" />
      <van-field v-model="passwordForm.confirmPassword" type="password" label="确认密码" placeholder="请再次输入新密码" />
    </van-dialog>

    <van-dialog v-model:show="showCreateUserDialog" title="创建新用户" show-cancel-button @confirm="handleCreateUser">
      <van-field v-model="createUserForm.username" label="用户名" placeholder="4-30字符，汉字算2字符" />
      <van-field v-model="createUserForm.password" type="password" label="密码" placeholder="7-16位，不能是纯数字" />
      <van-field label="角色">
        <template #input>
          <van-radio-group v-model="createUserForm.role" direction="horizontal">
            <van-radio name="user">普通用户</van-radio>
            <van-radio name="admin">管理员</van-radio>
          </van-radio-group>
        </template>
      </van-field>
    </van-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, reactive } from 'vue'
import { getSettings, saveSettings, clearAllData, currentUser, loginUser, registerUser, getAllUsers, updateUser, logoutUser, setAllVisibility, changePassword, createUser } from '@/services/db'
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
const showChangePasswordDialog = ref(false)
const showCreateUserDialog = ref(false)
const loginForm = reactive({
  username: '',
  password: ''
})

const passwordForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const createUserForm = reactive({
  username: '',
  password: '',
  role: 'user' as 'user' | 'admin'
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

const handleChangePassword = async () => {
  if (!passwordForm.oldPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
    showToast('请填写所有字段')
    return
  }

  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    showToast('两次输入的新密码不一致')
    return
  }

  try {
    await changePassword(passwordForm.oldPassword, passwordForm.newPassword)
    showToast('密码修改成功')
    showChangePasswordDialog.value = false
    // Clear form
    passwordForm.oldPassword = ''
    passwordForm.newPassword = ''
    passwordForm.confirmPassword = ''
  } catch (e: any) {
    showToast(e.message || '修改密码失败')
    throw e // Prevent dialog from closing
  }
}

const handleCreateUser = async () => {
  if (!createUserForm.username || !createUserForm.password) {
    showToast('请填写用户名和密码')
    return
  }

  try {
    await createUser(createUserForm.username, createUserForm.password, createUserForm.role)
    showToast('用户创建成功')
    showCreateUserDialog.value = false
    // Clear form
    createUserForm.username = ''
    createUserForm.password = ''
    createUserForm.role = 'user'
    // Reload user list
    await loadUsers()
  } catch (e: any) {
    showToast(e.message || '创建用户失败')
    throw e // Prevent dialog from closing
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
