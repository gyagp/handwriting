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
        <div class="work-preview-mini">
          <GridDisplay
            v-for="(char, idx) in getPreviewChars(work)"
            :key="idx"
            :size="24"
            :content="getCharContent(work, idx, char)"
            :viewBox="getCharViewBox(work, idx, char)"
            :type="'none'"
          />
        </div>
        <div class="work-info">
          <h3>{{ work.title }} <span v-if="work.author" class="author">by {{ work.author }}</span></h3>
          <span class="date">{{ new Date(work.updatedAt).toLocaleDateString() }}</span>
        </div>
        <van-icon name="arrow" color="#ccc" />
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
  return work.content.slice(0, 6).split('')
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
  // 同样，优先使用作品调整，但列表页为了性能可能不应用调整
  // 或者简单应用最新的样本viewBox
  const sample = samplesMap.value[char]
  return sample ? sample.svgViewBox : undefined
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
  align-items: center;
  cursor: pointer;
  gap: 12px;
}

.work-preview-mini {
  display: flex;
  flex-wrap: wrap;
  width: 80px; /* 3 * 24 + gap */
  gap: 2px;
  background: #f9f9f9;
  padding: 2px;
  border-radius: 4px;
}

.work-info {
  flex: 1;
}

.work-info h3 {
  font-size: 16px;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
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
