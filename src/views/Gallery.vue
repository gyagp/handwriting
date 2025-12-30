<template>
  <div class="gallery-page container">
    <div class="header">
      <h1 class="page-title">作品集</h1>
      <van-button icon="plus" type="primary" size="small" @click="createWork">新建作品</van-button>
    </div>

    <van-sticky>
      <van-search v-model="searchText" placeholder="搜索作品标题或作者" background="var(--bg-color)" />
    </van-sticky>

    <van-tabs v-model:active="activeTab" sticky :offset-top="54">
      <van-tab title="我的作品集" v-if="currentUser?.role !== 'admin'">
        <div class="works-list">
          <div
            v-for="work in myWorks"
            :key="work.id"
            class="work-item card"
            @click="editWork(work)"
          >
            <div class="work-header">
              <div class="work-title-row">
                <h3>{{ work.title }} <span v-if="work.author" class="author">{{ work.author }}</span></h3>
                <div class="work-meta">
                  <span class="stats" v-if="currentUser?.role !== 'admin'">总字数: {{ work.content.length }} / 自写: {{ getOwnCount(work) }}</span>
                  <span class="author-tag" v-if="work.userId !== currentUser?.id" style="margin-left: 5px; color: #666;">上传人: {{ getUsername(work.userId) }}</span>
                  <van-tag v-if="work.status === 'published' && work.visibility === 'public'" type="success" size="mini" style="margin-left: 5px">已发布</van-tag>
                  <van-tag v-else-if="work.visibility === 'private'" type="primary" size="mini" style="margin-left: 5px">私有</van-tag>
                  <van-tag v-else-if="work.status === 'pending'" type="warning" size="mini" style="margin-left: 5px">审核中</van-tag>
                  <van-tag v-else-if="work.status === 'rejected'" type="danger" size="mini" style="margin-left: 5px">已驳回</van-tag>
                  <van-tag v-else type="default" size="mini" style="margin-left: 5px">草稿</van-tag>
                  <span v-if="work.score" style="margin-left: 8px; color: #f7b500; font-size: 12px;">★ {{ work.score }}</span>
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

            <div class="work-actions" style="margin-top: 10px; display: flex; justify-content: flex-end;">
               <van-button size="small" type="danger" plain @click.stop="handleRemove(work)">
                   删除
               </van-button>
            </div>
          </div>
          <div v-if="myWorks.length === 0" class="empty-tip">
            暂无作品，点击右上角新建
          </div>
        </div>
      </van-tab>
      <van-tab title="公共作品集">
        <div class="works-list">
          <div
            v-for="work in publicWorks"
            :key="work.id"
            class="work-item card"
            @click="editWork(work)"
          >
            <div class="work-header">
              <div class="work-title-row">
                <h3>{{ work.title }} <span v-if="work.author" class="author">{{ work.author }}</span></h3>
                <div class="work-meta">
                  <span class="stats" v-if="currentUser?.role !== 'admin'">总字数: {{ work.content.length }} / 自写: {{ getOwnCount(work) }}</span>
                  <span class="author-tag" v-if="work.userId">上传人: {{ getUsername(work.userId) }}</span>
                  <span v-if="work.score" style="margin-left: 8px; color: #f7b500; font-size: 12px;">★ {{ work.score }}</span>
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

            <div class="work-actions" style="margin-top: 10px; display: flex; justify-content: flex-end;" v-if="currentUser?.role !== 'admin'">
               <van-button size="small" type="primary" plain @click.stop="handleCollect(work)">加入作品集</van-button>
            </div>
          </div>
          <div v-if="publicWorks.length === 0" class="empty-tip">
            暂无公共作品
          </div>
        </div>
      </van-tab>
      <van-tab title="待审核" v-if="currentUser?.role === 'admin'">
        <div class="works-list">
          <div
            v-for="work in pendingWorks"
            :key="work.id"
            class="work-item card"
          >
            <div class="work-header" @click="editWork(work)">
              <div class="work-title-row">
                <h3>{{ work.title }} <span v-if="work.author" class="author">{{ work.author }}</span></h3>
                <div class="work-meta">
                  <span class="author-tag" v-if="work.userId">上传人: {{ getUsername(work.userId) }}</span>
                </div>
              </div>
              <van-icon name="arrow" color="#ccc" />
            </div>

            <div class="work-preview-line" @click="editWork(work)">
              <GridDisplay
                v-for="(char, idx) in getPreviewChars(work)"
                :key="idx"
                :size="32"
                :content="getCharContent(work, idx, char)"
                :viewBox="getCharViewBox(work, idx, char)"
                :type="'none'"
              />
            </div>

            <div class="admin-actions" style="margin-top: 10px; display: flex; gap: 10px; justify-content: flex-end;">
               <van-button size="small" type="success" @click.stop="handleApprove(work, true)">通过</van-button>
               <van-button size="small" type="danger" @click.stop="handleApprove(work, false)">驳回</van-button>
            </div>
          </div>
          <div v-if="pendingWorks.length === 0" class="empty-tip">
            暂无待审核作品
          </div>
        </div>
      </van-tab>
    </van-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { getWorks, getCollectedSamplesMap, currentUser, approveWork, getUsername, collectWork, uncollectWork, deleteWork } from '@/services/db'
import GridDisplay from '@/components/GridDisplay.vue'
import type { Work, CharacterSample } from '@/types'
import { showToast, showNotify, showConfirmDialog } from 'vant'

const router = useRouter()
const works = ref<Work[]>([])
const samplesMap = ref<Record<string, CharacterSample>>({})
const activeTab = ref(0)
const searchText = ref('')

const filterWork = (w: Work) => {
  if (!searchText.value) return true
  const text = searchText.value.toLowerCase()
  return w.title.toLowerCase().includes(text) ||
         (w.author && w.author.toLowerCase().includes(text))
}

const myWorks = computed(() => works.value.filter(w => {
  // If author deleted it, don't show in My Works (unless collected again, but author can't collect own work usually)
  // Actually if author deleted it, it becomes like a public work they don't own.
  // So if they collect it back, it should show up.
  const isMine = w.userId === currentUser.value?.id && !w.authorDeleted
  const isCollected = currentUser.value?.collectedWorkIds?.includes(w.id)
  return (isMine || isCollected) && filterWork(w)
}))

const publicWorks = computed(() => works.value.filter(w => {
  const isPublic = w.visibility === 'public' && w.status === 'published'
  // If author deleted it, it should appear in public works for them (so they can see it/collect it)
  const isMine = w.userId === currentUser.value?.id && !w.authorDeleted
  const isCollected = currentUser.value?.collectedWorkIds?.includes(w.id)
  return isPublic && !isMine && !isCollected && filterWork(w)
}))

const pendingWorks = computed(() => works.value.filter(w => w.status === 'pending' && filterWork(w)))

const handleCollect = async (work: Work) => {
  try {
    await collectWork(work.id)
    showToast('已加入作品集')
  } catch (e: any) {
    showToast(e.message)
  }
}

const handleRemove = async (work: Work) => {
  const isMine = work.userId === currentUser.value?.id && !work.authorDeleted
  let message = '确定要从作品集中移除吗？'

  if (isMine) {
    if (work.visibility === 'public' && work.status === 'published') {
      message = '该作品已发布到公共库，删除后仅从您的列表中移除，公共库中仍保留。确定要移除吗？'
    } else {
      message = '确定要永久删除这个作品吗？'
    }
  }

  showConfirmDialog({
    title: '提示',
    message,
  })
    .then(async () => {
      try {
        if (isMine) {
          await deleteWork(work.id)
          works.value = await getWorks() // Refresh list
          showToast('已删除')
        } else {
          await uncollectWork(work.id)
          // Force reactivity update by creating a new object reference for currentUser if needed,
          // or simply refresh the works list which might trigger re-evaluation.
          // But uncollectWork updates currentUser.value.collectedWorkIds.
          // Let's trigger a refresh of the list to be safe and ensure UI updates.
          works.value = await getWorks()
          showToast('已移除')
        }
      } catch (e: any) {
        showToast(e.message)
      }
    })
    .catch(() => {
      // cancel
    })
}

const handleApprove = async (work: Work, approved: boolean) => {
  try {
    await approveWork(work.id, approved)
    showToast(approved ? '已通过' : '已驳回')
    // Refresh
    works.value = await getWorks()
  } catch (e: any) {
    showToast('操作失败: ' + e.message)
  }
}

onMounted(async () => {
  const [w, s] = await Promise.all([getWorks(), getCollectedSamplesMap()])
  works.value = w
  samplesMap.value = s

  // Check for rejected works
  if (currentUser.value?.role !== 'admin') {
    const rejectedCount = myWorks.value.filter(w => w.status === 'rejected').length
    if (rejectedCount > 0) {
      showNotify({ type: 'danger', message: `您有 ${rejectedCount} 个作品被驳回，请查看我的作品列表。` })
    }
  }
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
