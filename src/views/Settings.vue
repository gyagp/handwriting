<template>
  <div class="settings-page container">
    <h1 class="page-title">设置</h1>

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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { getSettings, saveSettings, db } from '@/services/db'
import type { AppSettings } from '@/types'
import { showDialog, showToast } from 'vant'

const settings = ref<AppSettings>({
  gridType: 'mi',
  gridSize: 100,
  autoRecognize: true,
  compressionLevel: 5,
  theme: 'light'
})

onMounted(async () => {
  const saved = await getSettings()
  if (saved) {
    settings.value = saved
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
      await db.samples.clear()
      await db.characters.clear()
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
