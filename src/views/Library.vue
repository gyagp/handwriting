<template>
  <div class="library-page">
    <van-sticky>
      <van-search v-model="searchText" placeholder="搜索汉字或拼音" />
      <van-tabs v-model:active="activeTab" v-if="currentUser?.role !== 'admin'">
        <van-tab :title="`全部 (${totalCount})`" name="all"></van-tab>
        <van-tab :title="`已收集 (${collectedCount})`" name="collected"></van-tab>
        <van-tab :title="`未收集 (${uncollectedCount})`" name="uncollected"></van-tab>
      </van-tabs>
      <div v-else class="admin-header">
        <span>汉字库 ({{ totalCount }})</span>
      </div>
    </van-sticky>

    <div class="char-grid container">
      <CharacterCard
        v-for="char in displayList"
        :key="char.code"
        :info="char"
        :collected="currentUser?.role !== 'admin' && !!collectedMap[char.char]"
        :sample="currentUser?.role !== 'admin' ? collectedMap[char.char]?.sample.svgPath : undefined"
        :sampleViewBox="currentUser?.role !== 'admin' ? collectedMap[char.char]?.sample.svgViewBox : undefined"
        @click="goToDetail(char)"
      />
    </div>

    <div v-if="displayList.length === 0" class="empty-tip">
      没有找到相关汉字
    </div>

    <!-- 虚拟列表优化：实际项目中应使用虚拟列表组件，这里简化处理 -->
    <div v-if="displayList.length < filteredList.length" class="load-more" @click="loadMore">
      加载更多...
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { gb2312AllChars, getPinyin, getGB2312Code, getStrokes, getRadical, punctuationChars } from '@/data/gb2312-generator'
import { getCollectedStatsMap, currentUser } from '@/services/db'
import CharacterCard from '@/components/CharacterCard.vue'
import type { CharacterInfo, CharacterStats } from '@/types'

const router = useRouter()
const searchText = ref('')
const activeTab = ref('all')
const collectedMap = ref<Record<string, CharacterStats>>({})
const pageSize = 50
const currentPage = ref(1)

// 构建完整数据列表
// 注意：gb2312Level1Chars 只是字符串数组，我们需要转换为 CharacterInfo 对象
// 为了性能，我们只在需要时转换，或者分批转换
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
const uncollectedCount = computed(() => totalCount.value - collectedCount.value)

onMounted(async () => {
  collectedMap.value = await getCollectedStatsMap()
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

  // Tab过滤 (Admin always sees all)
  if (currentUser.value?.role !== 'admin') {
    if (activeTab.value === 'collected') {
      list = list.filter(c => collectedMap.value[c.char])
    } else if (activeTab.value === 'uncollected') {
      list = list.filter(c => !collectedMap.value[c.char])
    }
  }

  return list
})

const displayList = computed(() => {
  return filteredList.value.slice(0, currentPage.value * pageSize)
})

const loadMore = () => {
  currentPage.value++
}

watch([searchText, activeTab], () => {
  currentPage.value = 1
})

const goToDetail = (char: CharacterInfo) => {
  router.push(`/character/${char.char}`)
}
</script>

<style scoped>
.admin-header {
  background: #fff;
  padding: 10px 16px;
  font-size: 14px;
  color: #666;
  border-bottom: 1px solid #eee;
}

.char-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
  padding-bottom: 60px;
}

.empty-tip {
  text-align: center;
  padding: 40px;
  color: #999;
}

.load-more {
  text-align: center;
  padding: 16px;
  color: #666;
  cursor: pointer;
}
</style>
