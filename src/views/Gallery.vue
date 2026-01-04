<template>
  <div class="gallery-page container">
    <div class="header">
      <h1 class="page-title">作品集</h1>
      <van-button icon="plus" type="primary" size="small" @click="createWork">新建作品</van-button>
    </div>

    <van-sticky>
      <div style="background: var(--bg-color)">
        <van-search v-model="searchText" placeholder="搜索作品标题或作者" background="transparent" />
        <div class="filter-bar" v-if="!isAdmin" style="padding: 0 16px 10px;">
          <van-radio-group v-model="filterType" direction="horizontal">
            <van-radio name="refined" style="margin-right: 20px">已精修</van-radio>
            <van-radio name="unrefined">未精修</van-radio>
          </van-radio-group>
        </div>
      </div>
    </van-sticky>

    <div class="works-list" v-if="!isAdmin">
      <div
        v-for="work in filteredWorks"
        :key="work.id"
        class="work-item card"
        @click="editWork(work)"
      >
        <div class="work-header">
          <div class="work-title-row">
            <div class="title-author-container">
              <div class="title-display">
                <GridDisplay
                  v-for="(char, idx) in work.title"
                  :key="'t'+idx"
                  :size="24"
                  :content="getMetaCharContent(char)"
                  :viewBox="getMetaCharViewBox(char)"
                  :type="getMetaCharType(char)"
                />
              </div>
              <div class="author-display" v-if="work.author">
                <GridDisplay
                  v-for="(char, idx) in work.author"
                  :key="'a'+idx"
                  :size="16"
                  :content="getMetaCharContent(char)"
                  :viewBox="getMetaCharViewBox(char)"
                  :type="getMetaCharType(char)"
                  style="color: #666;"
                />
              </div>
            </div>
            <div class="work-meta">
              <span class="stats" v-if="work.userId === currentUser?.id">总字数: {{ getWorkTotalCount(work) }} / 自写: {{ workStats[work.id] || 0 }}</span>
              <span class="author-tag" v-if="work.userId !== currentUser?.id">上传人: {{ getUsername(work.userId) }}</span>

              <!-- 状态标签 -->
              <van-tag v-if="work.isRefined" type="success" style="margin-left: 5px">已精修</van-tag>
              <van-tag v-else type="default" style="margin-left: 5px">未精修</van-tag>

              <!-- 可见性标签 -->
              <van-tag v-if="work.status === 'pending'" type="warning" style="margin-left: 5px">审核中</van-tag>
              <van-tag v-else-if="work.status === 'rejected'" type="danger" style="margin-left: 5px">已驳回</van-tag>
              <van-tag v-else-if="isWorkPublic(work)" type="primary" style="margin-left: 5px">公开</van-tag>
              <van-tag v-else type="default" style="margin-left: 5px">私有</van-tag>

              <van-tag v-if="work.userId !== currentUser?.id && myTitles.has(work.title)" type="primary" plain style="margin-left: 5px">已收集</van-tag>
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
           <van-button v-if="work.userId === currentUser?.id && (work.visibility === 'private' || work.status !== 'published')" size="small" type="danger" plain @click.stop="handleRemove(work)">
               删除
           </van-button>
        </div>
      </div>
      <div v-if="filteredWorks.length === 0" class="empty-tip">
        暂无作品
      </div>
    </div>

    <van-tabs v-model:active="activeTab" sticky :offset-top="54" v-else>
      <van-tab title="公开作品集">
        <div class="works-list">
          <div
            v-for="work in publicWorks"
            :key="work.id"
            class="work-item card"
            @click="editWork(work)"
          >
            <div class="work-header">
              <div class="work-title-row">
                <div class="title-author-container">
                  <div class="title-display">
                    <GridDisplay
                      v-for="(char, idx) in work.title"
                      :key="'t'+idx"
                      :size="24"
                      :content="getMetaCharContent(char)"
                      :viewBox="getMetaCharViewBox(char)"
                      :type="getMetaCharType(char)"
                    />
                  </div>
                  <div class="author-display" v-if="work.author">
                    <GridDisplay
                      v-for="(char, idx) in work.author"
                      :key="'a'+idx"
                      :size="16"
                      :content="getMetaCharContent(char)"
                      :viewBox="getMetaCharViewBox(char)"
                      :type="getMetaCharType(char)"
                      style="color: #666;"
                    />
                  </div>
                </div>
                <div class="work-meta">
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

            <div class="work-actions" style="margin-top: 10px; display: flex; justify-content: flex-end;">
               <van-button size="small" type="danger" plain @click.stop="handleRemove(work)">
                   删除
               </van-button>
            </div>
          </div>
          <div v-if="publicWorks.length === 0" class="empty-tip">
            暂无公开作品
          </div>
        </div>
      </van-tab>
      <van-tab title="待审核">
        <div class="works-list">
          <div
            v-for="work in pendingWorks"
            :key="work.id"
            class="work-item card"
          >
            <div class="work-header" @click="editWork(work)">
              <div class="work-title-row">
                <div class="title-author-container">
                  <div class="title-display">
                    <GridDisplay
                      v-for="(char, idx) in work.title"
                      :key="'t'+idx"
                      :size="24"
                      :content="getMetaCharContent(char)"
                      :viewBox="getMetaCharViewBox(char)"
                      :type="getMetaCharType(char)"
                    />
                  </div>
                  <div class="author-display" v-if="work.author">
                    <GridDisplay
                      v-for="(char, idx) in work.author"
                      :key="'a'+idx"
                      :size="16"
                      :content="getMetaCharContent(char)"
                      :viewBox="getMetaCharViewBox(char)"
                      :type="getMetaCharType(char)"
                      style="color: #666;"
                    />
                  </div>
                </div>
                <div class="work-meta">
                  <span class="author-tag" v-if="work.userId">上传人: {{ getUsername(work.userId) }}</span>

                  <!-- 状态标签 -->
                  <van-tag v-if="work.isRefined" type="success" style="margin-left: 5px">已精修</van-tag>
                  <van-tag v-else type="default" style="margin-left: 5px">未精修</van-tag>

                  <!-- 可见性标签 -->
                  <van-tag v-if="work.status === 'pending'" type="warning" style="margin-left: 5px">审核中</van-tag>
                  <van-tag v-else-if="work.status === 'rejected'" type="danger" style="margin-left: 5px">已驳回</van-tag>
                  <van-tag v-else-if="work.visibility === 'public'" type="primary" style="margin-left: 5px">作品公开</van-tag>
                  <van-tag v-else-if="work.isRefined && work.userId !== currentUser?.id" type="success" plain style="margin-left: 5px">书写公开</van-tag>
                  <van-tag v-else type="default" style="margin-left: 5px">私有</van-tag>
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
               <van-button size="small" type="danger" plain @click.stop="handleRemove(work)">删除</van-button>
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
import { ref, onMounted, onActivated, computed } from 'vue'
import { useRouter } from 'vue-router'
import { getWorks, getCollectedSamplesMap, currentUser, approveWork, getUsername, deleteWork, getWorkStats } from '@/services/db'
import GridDisplay from '@/components/GridDisplay.vue'
import type { Work, CharacterSample } from '@/types'
import { showToast, showNotify, showConfirmDialog } from 'vant'

const router = useRouter()
const works = ref<Work[]>([])
const samplesMap = ref<Record<string, CharacterSample>>({})
const workStats = ref<Record<string, number>>({})
const activeTab = ref(0)
const searchText = ref('')
const filterType = ref('refined')

const isAdmin = computed(() => currentUser.value?.role === 'admin')

const filterWork = (w: Work) => {
  if (!searchText.value) return true
  const text = searchText.value.toLowerCase()
  return w.title.toLowerCase().includes(text) ||
         (w.author && w.author.toLowerCase().includes(text))
}

const myWorks = computed(() => works.value.filter(w => {
  const isMine = w.userId === currentUser.value?.id
  if (!isMine || w.authorDeleted) return false

  // Show private instances
  if (w.visibility === 'private') return filterWork(w)

  // Show my public works
  if (w.visibility === 'public') {
    // Show if not published (Pending/Rejected)
    if (w.status !== 'published') return filterWork(w)
    // ALWAYS show my public works, even if published
    return filterWork(w)
  }

  return false
}))

const publicWorks = computed(() => works.value.filter(w => {
  const isMine = w.userId === currentUser.value?.id
  return !isMine && filterWork(w)
}))

const pendingWorks = computed(() => works.value.filter(w => w.status === 'pending' && filterWork(w)))

const myRefinedWorks = computed(() => myWorks.value.filter(w => w.isRefined))
const myTitles = computed(() => new Set(myWorks.value.map(w => w.title)))
const myUnrefinedWorks = computed(() => {
  // My unrefined works
  const mine = myWorks.value.filter(w => !w.isRefined)
  // Public works that I haven't "collected" (cloned) yet
  // They are automatically available for me to adjust
  // Use originWorkId to check if I already have it
  const myOriginIds = new Set(myWorks.value.map(w => w.originWorkId).filter(Boolean))

  // Find ALL published public templates that I don't have a private instance of
  // (Including my own published templates if I deleted the private instance)
  const availableTemplates = works.value.filter(w => {
      if (w.visibility !== 'public' || w.status !== 'published') return false
      if (!filterWork(w)) return false

      // If I already have a clone of this work, don't show it again
      if (myOriginIds.has(w.id)) return false
      // Also check by title as fallback for old data
      if (myTitles.value.has(w.title)) return false
      return true
  })
  return [...mine, ...availableTemplates]
})

const filteredWorks = computed(() => {
  let result: Work[] = []
  if (filterType.value === 'refined') {
    result = [...myRefinedWorks.value]
  } else {
    result = [...myUnrefinedWorks.value]
  }
  // Sort by updated time desc
  return result.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
})

const allWorks = computed(() => works.value.filter(w => {
  // Show my works (private/public) AND other's public works
  if (w.userId === currentUser.value?.id && w.authorDeleted) return false
  return filterWork(w)
}))

const handleRemove = async (work: Work) => {
  if (!isAdmin.value && work.visibility === 'public' && work.status === 'published') {
    showToast('已公开的作品无法删除')
    return
  }
  showConfirmDialog({
    title: '提示',
    message: '确定要删除这个作品吗？',
  })
    .then(async () => {
      try {
        await deleteWork(work.id)
        works.value = await getWorks() // Refresh list
        showToast('已删除')
      } catch (e: any) {
        showToast(e.message)
      }
    })
    .catch(() => {
      // cancel
    })
}

const isWorkPublic = (work: Work) => {
  // If it's someone else's work, it must be public (unless I'm admin viewing private, but let's assume public for now as per getWorks filter)
  if (work.userId !== currentUser.value?.id) {
    if (isAdmin.value) {
       return work.visibility === 'public' && work.status === 'published'
    }
    return true
  }

  // My work
  return work.visibility === 'public' && work.status === 'published'
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

const loadData = async () => {
  const [w, s] = await Promise.all([getWorks(), getCollectedSamplesMap()])
  works.value = w
  samplesMap.value = s
  workStats.value = await getWorkStats(w)

  // Auto-switch to unrefined if refined is empty
  if (myRefinedWorks.value.length === 0 && myUnrefinedWorks.value.length > 0) {
    filterType.value = 'unrefined'
  }

  // Check for rejected works
  if (!isAdmin.value) {
    const rejectedCount = myWorks.value.filter(w => w.status === 'rejected').length
    if (rejectedCount > 0) {
      showNotify({ type: 'danger', message: `您有 ${rejectedCount} 个作品被驳回，请查看我的作品列表。` })
    }
  }
}

onMounted(loadData)
onActivated(loadData)

const createWork = () => {
  router.push('/work/new')
}

const editWork = (work: Work) => {
  router.push(`/work/${work.id}`)
}

const getWorkTotalCount = (work: Work) => {
  const fullText = (work.title || '') + (work.author || '') + work.content
  return fullText.replace(/\s/g, '').length
}

const getPreviewChars = (work: Work) => {
  return work.content.split('')
}

const getCharContent = (work: Work, index: number, char: string) => {
  // 1. 优先使用作品中指定的样式
  const sampleId = work.charStyles?.[index]
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
  const sample = samplesMap.value[char]
  return sample ? sample.svgViewBox : undefined
}

const getMetaCharContent = (char: string) => {
  const sample = samplesMap.value[char]
  return sample ? sample.svgPath : char
}

const getMetaCharViewBox = (char: string) => {
  const sample = samplesMap.value[char]
  return sample ? sample.svgViewBox : undefined
}

const getMetaCharType = (char: string) => {
  return samplesMap.value[char] ? 'none' : 'text'
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

.title-author-container {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 4px;
}

.title-display {
  display: flex;
  gap: 2px;
}

.author-display {
  display: flex;
  gap: 2px;
}

.work-meta {
  display: flex;
  align-items: center;
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
