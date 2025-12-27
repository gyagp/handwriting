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
        <div class="work-info">
          <h3>{{ work.title }} <span v-if="work.author" class="author">by {{ work.author }}</span></h3>
          <p class="preview-text">{{ work.content }}</p>
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
import { getWorks } from '@/services/db'
import type { Work } from '@/types'

const router = useRouter()
const works = ref<Work[]>([])

onMounted(async () => {
  works.value = await getWorks()
})

const createWork = () => {
  router.push('/work/new')
}

const editWork = (work: Work) => {
  router.push(`/work/${work.id}`)
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
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
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

.preview-text {
  font-size: 14px;
  color: #666;
  margin-bottom: 8px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
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
