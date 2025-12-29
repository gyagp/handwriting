<template>
  <div class="home-page">
    <div class="container">
      <h1 class="page-title">书法集字</h1>
    </div>

    <van-sticky>
      <div class="sticky-header">
        <van-search v-model="searchText" placeholder="搜索汉字或拼音" background="transparent" />
        <van-tabs v-model:active="activeTab" background="transparent">
          <van-tab :title="`全部 (${totalCount})`" name="all"></van-tab>
          <van-tab :title="`已精修 (${collectedAdjustedCount} - ${collectedAdjustedPercentage}%)`" name="collected-adjusted"></van-tab>
          <van-tab :title="`未精修 (${collectedUnadjustedCount} - ${collectedUnadjustedPercentage}%)`" name="collected-unadjusted"></van-tab>
          <van-tab :title="`未收集 (${uncollectedCount} - ${uncollectedPercentage}%)`" name="uncollected"></van-tab>
        </van-tabs>
      </div>
    </van-sticky>

    <div class="char-grid container">
      <CharacterCard
        v-for="char in displayList"
        :key="char.code"
        :info="char"
        :collected="!!collectedMap[char.char]"
        :sample="activeTab === 'all' ? undefined : collectedMap[char.char]?.sample.svgPath"
        :sampleViewBox="activeTab === 'all' ? undefined : collectedMap[char.char]?.sample.svgViewBox"
        :is-adjusted="!!collectedMap[char.char]?.sample.isAdjusted"
        :total-count="collectedMap[char.char]?.totalCount"
        :adjusted-count="collectedMap[char.char]?.adjustedCount"
        :grid-type="settings.gridType"
        @click="goToDetail(char)"
      />
    </div>

    <div v-if="displayList.length === 0" class="empty-tip">
      没有找到相关汉字
    </div>

    <div v-if="displayList.length < filteredList.length" class="load-more" @click="loadMore">
      加载更多...
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { getCollectedStatsMap, getSettings, type CharacterStats } from '@/services/db'
import { gb2312AllChars, getPinyin, getGB2312Code, getStrokes, getRadical, punctuationChars } from '@/data/gb2312-generator'
import CharacterCard from '@/components/CharacterCard.vue'
import type { CharacterInfo, AppSettings } from '@/types'

const router = useRouter()
const searchText = ref('')
const activeTab = ref('all')
const collectedMap = ref<Record<string, CharacterStats>>({})
const pageSize = 50
const currentPage = ref(1)

const settings = ref<AppSettings>({
  gridType: 'mi',
  gridSize: 100,
  autoRecognize: true,
  compressionLevel: 5,
  theme: 'light'
})

// 构建完整数据列表
const allChars = computed(() => {
  return gb2312AllChars.map(char => ({
    char,
    code: getGB2312Code(char),
    pinyin: punctuationChars.includes(char) ? '标点' : getPinyin(char),
    radical: punctuationChars.includes(char) ? '' : getRadical(char),
    strokes: punctuationChars.includes(char) ? 0 : getStrokes(char)
  }))
})

const totalCount = computed(() => allChars.value.length)
const collectedCount = computed(() => allChars.value.filter(c => collectedMap.value[c.char]).length)
const collectedAdjustedCount = computed(() => allChars.value.filter(c => {
  const stats = collectedMap.value[c.char]
  return stats && stats.adjustedCount === stats.totalCount && stats.totalCount > 0
}).length)
const collectedUnadjustedCount = computed(() => collectedCount.value - collectedAdjustedCount.value)
const uncollectedCount = computed(() => totalCount.value - collectedCount.value)

const collectedAdjustedPercentage = computed(() => totalCount.value ? ((collectedAdjustedCount.value / totalCount.value) * 100).toFixed(1) : '0.0')
const collectedUnadjustedPercentage = computed(() => totalCount.value ? ((collectedUnadjustedCount.value / totalCount.value) * 100).toFixed(1) : '0.0')
const uncollectedPercentage = computed(() => totalCount.value ? ((uncollectedCount.value / totalCount.value) * 100).toFixed(1) : '0.0')

onMounted(async () => {
  const [map, savedSettings] = await Promise.all([
    getCollectedStatsMap(),
    getSettings()
  ])
  collectedMap.value = map
  if (savedSettings) {
    settings.value = savedSettings
  }
})

const filteredList = computed(() => {
  let list = allChars.value

  // 搜索过滤
  if (searchText.value) {
    const key = searchText.value.toLowerCase()
    list = list.filter(c =>
      c.char.includes(key) ||
      (c.pinyin && c.pinyin.includes(key))
    )
  }

  // Tab过滤
  if (activeTab.value === 'collected-adjusted') {
    list = list.filter(c => {
      const stats = collectedMap.value[c.char]
      return stats && stats.adjustedCount === stats.totalCount && stats.totalCount > 0
    })
  } else if (activeTab.value === 'collected-unadjusted') {
    list = list.filter(c => {
      const stats = collectedMap.value[c.char]
      return stats && (stats.adjustedCount < stats.totalCount || stats.totalCount === 0)
    })
  } else if (activeTab.value === 'uncollected') {
    list = list.filter(c => !collectedMap.value[c.char])
  }

  return list
})

const displayList = computed(() => {
  return filteredList.value.slice(0, currentPage.value * pageSize)
})

const loadMore = () => {
  currentPage.value++
}

const goToDetail = (char: CharacterInfo) => {
  router.push(`/character/${char.char}`)
}
</script>

<style scoped>
.stats-card {
  display: flex;
  justify-content: space-around;
  background: linear-gradient(135deg, #8B4513, #D2691E);
  color: #fff;
  margin-bottom: 0; /* Remove margin as sticky header follows */
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

.sticky-header {
  background-color: var(--bg-color);
  padding-bottom: 10px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.char-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 12px;
  padding-top: 16px;
}

.empty-tip {
  text-align: center;
  color: #999;
  padding: 40px 0;
}

.load-more {
  text-align: center;
  padding: 20px;
  color: #666;
  cursor: pointer;
}
</style>
