<template>
  <div class="gallery-page container">
    <div class="header">
      <h1 class="page-title">我的作品</h1>
      <van-button icon="plus" type="primary" size="small" @click="createWork">新建作品</van-button>
    </div>

    <div class="works-list">
      <div
        v-for="work in works"
        :key="work.id"
        class="work-item card"
        @click="editWork(work)"
      >
        <div class="work-header">
          <div class="work-title-row">
            <h3>{{ work.title }} <span v-if="work.author" class="author">{{ work.author }}</span></h3>
            <div class="work-meta">
              <span class="stats">总字数: {{ work.content.length }} / 自写: {{ getOwnCount(work) }}</span>
            </div>
          </div>
          <van-icon name="arrow" color="#ccc" />
        </div>

        <div class="work-preview-line">
          <GridDisplay
            v-for="(char, idx) in getPreviewChars(work)"
            :key="idx"
            :size="32"
            :content="getCharContent(work, idx, char)"
            :viewBox="getCharViewBox(work, idx, char)"
            :type="'none'"
          />
        </div>
      </div>
    </div>

    <div v-if="works.length === 0" class="empty-tip">
      暂无作品，点击右上角新建
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getWorks, getCollectedSamplesMap } from '@/services/db'
import GridDisplay from '@/components/GridDisplay.vue'
import type { Work, CharacterSample } from '@/types'

const router = useRouter()
const works = ref<Work[]>([])
const samplesMap = ref<Record<string, CharacterSample>>({})

onMounted(async () => {
  const [w, s] = await Promise.all([getWorks(), getCollectedSamplesMap()])
  works.value = w
  samplesMap.value = s
})

const createWork = () => {
  router.push('/work/new')
}

const editWork = (work: Work) => {
  router.push(`/work/${work.id}`)
}

const getPreviewChars = (work: Work) => {
  return work.content.split('')
}

const getCharContent = (work: Work, index: number, char: string) => {
  // 1. 优先使用作品中指定的样式
  const sampleId = work.charStyles[index]
  if (sampleId) {
    // 这里我们没有加载所有sample的详情，只加载了最新的map
    // 如果作品里选的不是最新的，这里可能显示不出来，或者显示最新的
    // 为了简化，这里如果找不到指定ID的，就尝试用最新的
    // 实际应该在列表页也加载必要的数据，或者存缩略图
    // 暂时用最新的样本代替
  }

  const sample = samplesMap.value[char]
  return sample ? sample.svgPath : char
}

const getCharViewBox = (work: Work, index: number, char: string) => {
  // 1. 优先使用作品特定的调整
  const adjustment = work.charAdjustments?.[index]
  if (adjustment) {
    const { scale, offsetX, offsetY } = adjustment
    const width = 100 / scale
    const height = 100 / scale
    const minX = 50 - offsetX - width / 2
    const minY = 50 - offsetY - height / 2
    return `${minX} ${minY} ${width} ${height}`
  }

  const sample = samplesMap.value[char]
  return sample ? sample.svgViewBox : undefined
}

const getOwnCount = (work: Work) => {
  if (!work.content) return 0
  let count = 0
  for (const char of work.content) {
    if (samplesMap.value[char]) {
      count++
    }
  }
  return count
}
</script>

<style scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.page-title {
  margin-bottom: 0;
}

.works-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.work-item {
  display: flex;
  flex-direction: column;
  cursor: pointer;
  gap: 12px;
}

.work-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.work-title-row {
  flex: 1;
}

.work-title-row h3 {
  font-size: 16px;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.work-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #999;
}

.work-preview-line {
  display: flex;
  gap: 4px;
  overflow: hidden;
  padding-bottom: 4px;
  width: 100%;
}

.work-preview-line > * {
  flex-shrink: 0;
}

.author {
  font-size: 12px;
  color: #888;
  font-weight: normal;
}

.author {
  font-size: 12px;
  color: #888;
  font-weight: normal;
}

.date {
  font-size: 12px;
  color: #999;
}

.empty-tip {
  text-align: center;
  padding: 40px;
  color: #999;
}
</style>
