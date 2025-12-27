<template>
  <div class="home-page container">
    <h1 class="page-title">书法集字</h1>

    <div class="stats-card card">
      <div class="stat-item">
        <span class="number">{{ collectedCount }}</span>
        <span class="label">已收集</span>
      </div>
      <div class="stat-item">
        <span class="number">{{ totalCount }}</span>
        <span class="label">总字数</span>
      </div>
      <div class="stat-item">
        <span class="number">{{ progress }}%</span>
        <span class="label">进度</span>
      </div>
    </div>

    <div class="action-grid">
      <div class="action-card card" @click="$router.push('/capture')">
        <van-icon name="photograph" size="32" color="#8B4513" />
        <span>拍照集字</span>
      </div>
      <div class="action-card card" @click="$router.push('/library')">
        <van-icon name="apps-o" size="32" color="#8B4513" />
        <span>浏览字库</span>
      </div>
    </div>

    <div class="recent-section">
      <h3>最近收集</h3>
      <div class="recent-list" v-if="recentSamples.length">
        <div
          v-for="sample in recentSamples"
          :key="sample.id"
          class="recent-item"
          @click="$router.push(`/character/${sample.char}`)"
        >
          <GridDisplay :size="60" :content="sample.svgPath" :viewBox="sample.svgViewBox" />
          <span>{{ sample.char }}</span>
        </div>
      </div>
      <div v-else class="empty-tip">
        暂无收集，快去拍照吧！
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { getCollectedChars, db } from '@/services/db'
import GridDisplay from '@/components/GridDisplay.vue'
import type { CharacterSample } from '@/types'

const collectedCount = ref(0)
const totalCount = 3755
const recentSamples = ref<CharacterSample[]>([])

const progress = computed(() => ((collectedCount.value / totalCount) * 100).toFixed(1))

onMounted(async () => {
  const chars = await getCollectedChars()
  collectedCount.value = chars.length

  // 获取最近的样本
  recentSamples.value = await db.samples
    .orderBy('createdAt')
    .reverse()
    .limit(5)
    .toArray()
})
</script>

<style scoped>
.stats-card {
  display: flex;
  justify-content: space-around;
  background: linear-gradient(135deg, #8B4513, #D2691E);
  color: #fff;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.number {
  font-size: 24px;
  font-weight: bold;
}

.label {
  font-size: 12px;
  opacity: 0.9;
}

.action-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 24px;
}

.action-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100px;
  cursor: pointer;
}

.action-card span {
  margin-top: 8px;
  font-weight: 500;
}

.recent-section h3 {
  margin-bottom: 12px;
  font-size: 16px;
  color: #666;
}

.recent-list {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 8px;
}

.recent-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 60px;
  cursor: pointer;
}

.recent-item span {
  margin-top: 4px;
  font-size: 12px;
}

.empty-tip {
  text-align: center;
  color: #999;
  padding: 20px;
}
</style>
