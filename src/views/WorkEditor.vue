<template>
  <div class="work-editor container">
    <van-nav-bar
      :title="isEdit ? '作品' : '新建作品'"
      left-text="返回"
      left-arrow
      @click-left="$router.back()"
      @click-right="save"
    >
      <template #right>
        <van-button
          v-if="!isReadOnly && isEdit"
          type="primary"
          size="small"
          @click="save"
        >
          {{ (work.visibility === 'public' && work.status === 'rejected') ? '重新提交' : '保存' }}
        </van-button>

        <van-button
          v-if="!isReadOnly && !isEdit"
          type="primary"
          size="small"
          @click="save"
        >
          保存
        </van-button>

        <van-button
          v-if="isReadOnly && work.userId !== currentUser?.id && currentUser?.role !== 'guest'"
          size="small"
          icon="star-o"
          @click="showRating = true"
        >
          评分
        </van-button>
      </template>
    </van-nav-bar>

    <div class="editor-content">
      <van-cell-group inset>
        <van-field v-if="!isReadOnly" v-model="work.title" label="标题" placeholder="请输入作品标题" />
        <van-field v-if="!isReadOnly" v-model="work.author" label="作者" placeholder="请输入作者姓名" />
        <van-field :model-value="getUsername(work.userId)" label="书写者" readonly v-if="isReadOnly && work.userId && work.userId !== currentUser?.id" />
        <van-field :model-value="getUsername(work.userId)" label="上传人" readonly v-if="currentUser?.role === 'admin' && work.userId && work.userId === currentUser?.id" />
        <van-cell title="评分" v-if="work.score">
          <template #right-icon>
            <span style="color: #f7b500; font-weight: bold;">{{ work.score }}</span>
          </template>
        </van-cell>
        <van-field
          v-model="work.content"
          rows="3"
          autosize
          label="内容"
          type="textarea"
          placeholder="请输入诗词或文章内容"
          :readonly="isReadOnly"
          @update:model-value="handleContentChange"
        />
        <van-cell title="排版方向">
          <template #right-icon>
            <van-radio-group v-model="work.layout" direction="horizontal">
              <van-radio name="horizontal">横排</van-radio>
              <van-radio name="vertical">竖排</van-radio>
            </van-radio-group>
          </template>
        </van-cell>
        <van-cell title="格子样式">
          <template #right-icon>
            <van-radio-group v-model="work.gridType" direction="horizontal">
              <van-radio name="mi">米字</van-radio>
              <van-radio name="tian">田字</van-radio>
              <van-radio name="hui">回字</van-radio>
              <van-radio name="none">无</van-radio>
            </van-radio-group>
          </template>
        </van-cell>
        <van-cell>
           <van-button size="small" block plain type="primary" @click="saveAsDefaultStyle">保存为默认样式</van-button>
        </van-cell>
        <van-cell title="显示大小">
          <template #right-icon>
            <div style="width: 150px; display: flex; align-items: center;">
              <van-slider v-model="zoomLevel" :min="20" :max="150" />
              <span style="margin-left: 10px; font-size: 12px; color: #999">{{ zoomLevel }}</span>
            </div>
          </template>
        </van-cell>
        <van-cell title="已精修" v-if="!isReadOnly">
          <template #right-icon>
            <van-switch v-model="isRefined" size="20" />
          </template>
        </van-cell>
        <van-cell title="公开作品" v-if="!isReadOnly && canChangeVisibility">
          <template #label>
             <span v-if="work.visibility === 'public'">公开作品需审核，审核通过后所有人可见</span>
             <span v-else>私有作品仅自己可见</span>
          </template>
          <template #right-icon>
            <van-switch :model-value="work.visibility === 'public'" @update:model-value="val => work.visibility = val ? 'public' : 'private'" size="20" />
          </template>
        </van-cell>
        <van-cell title="状态" v-if="isEdit">
           <template #right-icon>
              <div style="display: flex; gap: 5px;">
                <van-tag v-if="work.status === 'pending'" type="warning">审核中</van-tag>
                <van-tag v-else-if="work.status === 'rejected'" type="danger">已驳回</van-tag>
                <van-tag v-else-if="work.visibility === 'public'" type="primary">公开</van-tag>
                <van-tag v-else type="default">私有</van-tag>

                <van-tag v-if="work.isRefined" type="success">已精修</van-tag>
                <van-tag v-else type="default">未精修</van-tag>
              </div>
           </template>
        </van-cell>
        <van-cell title="字数统计" v-if="isEdit">
           <template #right-icon>
              <div style="text-align: right;">
                  <div style="font-size: 12px; color: #666;">
                    总字数: {{ totalCharCount }} / 自写: {{ selfWrittenCount }}
                  </div>
                  <div v-if="missingChars.length > 0" style="font-size: 12px; color: #999; margin-top: 4px; word-break: break-all;">
                    缺字: {{ missingChars.join(' ') }}
                  </div>
              </div>
           </template>
        </van-cell>
      </van-cell-group>

      <div class="preview-area" :class="work.layout">
        <!-- Title Display -->
        <div v-if="isReadOnly && work.title" class="meta-display title-display">
           <div v-for="(char, idx) in work.title" :key="'t'+idx" class="meta-char">
              <GridDisplay
                :size="zoomLevel * 1.2"
                :content="getMetaDisplayContent(char)"
                :viewBox="getMetaDisplayViewBox(char)"
                :type="getMetaDisplayType(char)"
              />
           </div>
        </div>

        <!-- Author Display -->
        <div v-if="isReadOnly && work.author" class="meta-display author-display">
           <div v-for="(char, idx) in work.author" :key="'a'+idx" class="meta-char">
              <GridDisplay
                :size="zoomLevel * 0.8"
                :content="getMetaDisplayContent(char)"
                :viewBox="getMetaDisplayViewBox(char)"
                :type="getMetaDisplayType(char)"
              />
           </div>
        </div>

        <div
          v-for="(item) in charList"
          :key="item.index"
          class="char-box"
          @click="openSelector(item.index, item.char)"
        >
          <GridDisplay
            :size="zoomLevel"
            :content="getDisplayContent(item.index, item.char)"
            :viewBox="getDisplayViewBox(item.index)"
            :type="work.gridType || settings.gridType"
          />
          <!-- 如果没有收集该字，显示提示 -->
          <div v-if="!hasSample(item.char) && !isReadOnly && currentUser?.role !== 'admin'" class="missing-mark"></div>
        </div>
      </div>
    </div>

    <!-- 选字弹窗 -->
    <van-action-sheet v-model:show="showSelector" :title="`选择 '${selectedChar}' 的样式`" v-if="!isReadOnly">
      <div class="selector-content">
        <div class="selector-actions" style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">
             <van-button size="small" icon="edit" @click="openAdjustment">调整位置/大小</van-button>
        </div>

        <div
          class="sample-option"
          @click="selectSample(null)"
          :class="{ active: !work.charStyles[selectedIndex] }"
        >
          <div class="option-preview">标准</div>
          <span>默认</span>
        </div>

        <div
          v-for="sample in currentSamples"
          :key="sample.id"
          class="sample-option"
          :class="{ active: work.charStyles[selectedIndex] === sample.id }"
          @click="selectSample(sample.id)"
        >
          <GridDisplay :size="50" :content="sample.svgPath" :viewBox="sample.svgViewBox" />
          <van-rate :model-value="sample.rating" readonly size="10" count="1" />
        </div>

        <div v-if="currentSamples.length === 0" class="empty-samples">
          暂无该字的收集样本
        </div>
      </div>
    </van-action-sheet>

    <CharacterAdjustmentDialog
      v-model:show="showAdjustment"
      :content="getDisplayContent(selectedIndex, selectedChar)"
      :char="selectedChar"
      :grid-type="work.gridType === 'none' ? 'mi' : (work.gridType || settings.gridType)"
      :initial-data="adjustmentInitialData"
      @save="saveAdjustment"
    />

    <van-dialog v-model:show="showRating" title="评分" show-cancel-button @confirm="submitRating">
      <div style="display: flex; justify-content: center; padding: 20px;">
        <van-rate v-model="ratingScore" :count="5" allow-half size="30" />
      </div>
      <div style="text-align: center; color: #666;">{{ ratingScore * 2 }} 分</div>
    </van-dialog>

    <!-- My Related Work Section -->
    <div v-if="myRelatedWorks.length > 0" class="related-works-section">
      <div class="section-title">我的作品</div>
      <div class="related-list">
        <div
          v-for="myWork in myRelatedWorks"
          :key="myWork.id"
          class="related-item card"
          @click="viewRelatedWork(myWork)"
        >
          <div class="related-header">
            <span class="author-name">
              {{ myWork.userId === currentUser?.id ? '我' : (myWork.author || getUsername(myWork.userId)) }}
              <span v-if="currentUser?.collectedWorkIds?.includes(myWork.id)" style="font-weight: normal; color: #999; font-size: 12px;">(已收藏)</span>
            </span>
            <span class="score" v-if="myWork.score">★ {{ myWork.score }}</span>
          </div>
          <div class="related-preview">
             <div v-if="!myWork.content" style="color: #999; font-size: 12px; padding: 4px;">无内容</div>
             <template v-else>
               <GridDisplay
                  v-for="(char, idx) in myWork.content.split('').slice(0, 8)"
                  :key="idx"
                  :size="24"
                  :content="getMyWorkPreviewContent(myWork, idx, char)"
                  :viewBox="getMyWorkPreviewViewBox(myWork, idx)"
                  :type="'none'"
                />
                <span v-if="myWork.content.length > 8" style="align-self: flex-end; color: #999;">...</span>
             </template>
          </div>
        </div>
      </div>
    </div>

    <!-- Related Public Works Section -->
    <div v-if="relatedWorks.length > 0" class="related-works-section">
      <div class="section-title">其他人的公开作品 ({{ relatedWorks.length }})</div>
      <div class="related-list">
        <div
          v-for="rWork in relatedWorks"
          :key="rWork.id"
          class="related-item card"
          @click="viewRelatedWork(rWork)"
          :class="{ 'current-viewing': rWork.id === work.id }"
        >
          <div class="related-header">
            <span class="author-name">
               {{ getUsername(rWork.userId) }}
               <span v-if="rWork.id === work.id" style="font-weight: normal; color: #999; font-size: 12px;">(当前查看)</span>
            </span>
            <span class="score" v-if="rWork.score">★ {{ rWork.score }}</span>
          </div>
          <div class="related-preview">
             <GridDisplay
                v-for="(char, idx) in rWork.content.split('').slice(0, 8)"
                :key="idx"
                :size="24"
                :content="getRelatedCharContent(rWork, idx, char)"
                :viewBox="getRelatedCharViewBox(rWork, idx)"
                :type="'none'"
              />
              <span v-if="rWork.content.length > 8" style="align-self: flex-end; color: #999;">...</span>
          </div>
          <div class="related-footer" v-if="currentUser?.role !== 'guest'" @click.stop style="margin-top: 8px; display: flex; align-items: center; justify-content: space-between; border-top: 1px solid #eee; padding-top: 8px;">
             <span style="font-size: 12px; color: #666;">我的评分:</span>
             <van-rate
                v-model="myRatings[rWork.id]"
                :count="5"
                allow-half
                size="14"
                @change="(val) => onRateWork(rWork, val)"
             />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, toRaw } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getWork, saveWork, getSamplesByChar, getSettings, saveSettings, saveSample, currentUser, saveRating, getMyRating, getUsername, getSamplesForWork, getRelatedPublicWorks, getWorks } from '@/services/db'
import GridDisplay from '@/components/GridDisplay.vue'
import CharacterAdjustmentDialog from '@/components/CharacterAdjustmentDialog.vue'
import type { Work, CharacterSample, AppSettings } from '@/types'
import { showToast } from 'vant'

const route = useRoute()
const router = useRouter()
const isEdit = computed(() => !!route.params.id)

const zoomLevel = ref(40)
const isRefined = ref(false)
const isReadOnly = ref(false)
const showRating = ref(false)
const ratingScore = ref(0)
const relatedWorks = ref<Work[]>([])
const myRelatedWorks = ref<Work[]>([])
const myRatings = ref<Record<string, number>>({})
// Cache for related works samples to display previews
const relatedSamplesCache = ref<Record<string, CharacterSample[]>>({})

const canChangeVisibility = computed(() => {
  if (currentUser.value?.role === 'admin') return true
  return false // Ordinary users cannot change visibility manually
})

const work = ref<Work>({
  id: crypto.randomUUID(),
  userId: '', // Will be set by saveWork
  visibility: 'public', // Default to public (Template)
  status: 'pending',
  title: '',
  author: '',
  content: '',
  charStyles: {},
  charAdjustments: {},
  layout: 'horizontal',
  gridType: 'none',
  createdAt: Date.now(),
  updatedAt: Date.now()
})

const settings = ref<AppSettings>({
  gridType: 'none',
  gridSize: 100,
  compressionLevel: 5,
  theme: 'light'
})

// 缓存已加载的样本，避免重复查询
const samplesCache = ref<Record<string, CharacterSample[]>>({})

const charList = computed(() => {
  return work.value.content.split('').map((c, i) => ({ char: c, index: i })).filter(item => item.char.trim())
})

const titleCharList = computed(() => (work.value.title || '').split('').filter(c => c.trim()))
const authorCharList = computed(() => (work.value.author || '').split('').filter(c => c.trim()))

const totalCharCount = computed(() => {
    return titleCharList.value.length + authorCharList.value.length + charList.value.length
})

const selfWrittenCount = computed(() => {
  if (!work.value.userId) return 0

  const checkChar = (char: string) => {
      const samples = samplesCache.value[char]
      if (!samples) return false
      return samples.some(s => s.userId === work.value.userId)
  }

  const titleCount = titleCharList.value.filter(checkChar).length
  const authorCount = authorCharList.value.filter(checkChar).length

  const contentCount = charList.value.filter(item => {
    const samples = samplesCache.value[item.char]
    if (!samples) return false

    // If a specific style is selected
    const selectedId = work.value.charStyles?.[item.index]
    if (selectedId) {
        const s = samples.find(sample => sample.id === selectedId)
        return s && s.userId === work.value.userId
    }

    return samples.some(s => s.userId === work.value.userId)
  }).length

  return titleCount + authorCount + contentCount
})

const missingChars = computed(() => {
  if (!work.value.userId) return []
  const missing = new Set<string>()

  const checkChar = (char: string) => {
      const samples = samplesCache.value[char]
      if (!samples) return false
      return samples.some(s => s.userId === work.value.userId)
  }

  // Check Title
  titleCharList.value.forEach(char => {
      if (!checkChar(char)) missing.add(char)
  })

  // Check Author
  authorCharList.value.forEach(char => {
      if (!checkChar(char)) missing.add(char)
  })

  // Check Content
  charList.value.forEach(item => {
    const char = item.char
    const samples = samplesCache.value[char]
    let isSelf = false

    if (samples) {
        // If a specific style is selected
        const selectedId = work.value.charStyles[item.index]
        if (selectedId) {
            const s = samples.find(sample => sample.id === selectedId)
            if (s && s.userId === work.value.userId) isSelf = true
        } else {
            if (samples.some(s => s.userId === work.value.userId)) isSelf = true
        }
    }

    if (!isSelf) missing.add(char)
  })

  return Array.from(missing).sort()
})

// Save current settings as default
const saveAsDefaultStyle = async () => {
  try {
    await saveSettings({
      gridType: work.value.gridType || 'mi',
      defaultLayout: work.value.layout || 'horizontal'
    })
    showToast('已保存为默认样式')
  } catch (e: any) {
    showToast('保存失败: ' + e.message)
  }
}

onMounted(async () => {
  const s = await getSettings()
  if (s) {
    settings.value = s
    if (!isEdit.value) {
      if (s.defaultLayout) work.value.layout = s.defaultLayout
      if (s.gridType) work.value.gridType = s.gridType
    }
  }

  if (isEdit.value) {
    const w = await getWork(route.params.id as string)
    if (w) {
      if (!w.charStyles) w.charStyles = {}
      if (!w.charAdjustments) w.charAdjustments = {}
      work.value = w

      // If it's not my work, start as unrefined (it's a new draft for me)
      if (w.userId !== currentUser.value?.id) {
          isRefined.value = false
      } else {
          isRefined.value = !!w.isRefined
      }

      // Force update layout for unrefined works to match user preference
      if (!isRefined.value) {
          if (settings.value.defaultLayout) work.value.layout = settings.value.defaultLayout
          if (settings.value.gridType) work.value.gridType = settings.value.gridType
      }

      if (!work.value.gridType) {
        work.value.gridType = settings.value.gridType
      }
      if (!work.value.layout) {
        work.value.layout = settings.value.defaultLayout || 'horizontal'
      }

      // Check permissions
      if (currentUser.value?.role !== 'admin') {
        if (w.userId !== currentUser.value?.id) {
           // If it's not my work, I can still edit it (as a template/clone)
           // But I cannot save OVER it.
           // isReadOnly.value = true // Allow editing
        }
        // Author can always edit their own work, even if published
      }

      // Load samples used in the work (especially if it's not mine, or read only)
      // We need this to ensure we have the author's samples for title/author/content
      if (w.userId !== currentUser.value?.id || isReadOnly.value) {
         if (isReadOnly.value) {
             // Apply viewer preferences only in read-only mode
             if (settings.value.defaultLayout) work.value.layout = settings.value.defaultLayout
             if (settings.value.gridType) work.value.gridType = settings.value.gridType

             // Load my rating
             const myScore = getMyRating(w.id, 'work')
             if (myScore) ratingScore.value = myScore / 2
         }

         // Load samples used in the work (even if private)
         const workSamples = await getSamplesForWork(w)
         for (const s of workSamples) {
            if (!samplesCache.value[s.char]) {
               samplesCache.value[s.char] = []
            }
            if (!samplesCache.value[s.char].some(existing => existing.id === s.id)) {
               samplesCache.value[s.char].push(s)
            }
         }
      }

      // 预加载所有字符的样本
      preloadSamples(w.content)

      // Load related public works
      loadRelatedWorks(w)
    } else {
      showToast('作品不存在或无权访问')
      router.back()
    }
  }
})

const loadRelatedWorks = async (currentWork: Work) => {
  if (!currentWork.title) return
  const related = await getRelatedPublicWorks(currentWork.title, currentWork.id)

  // If I am viewing someone else's work (e.g. collected), add it to the related list
  // so I can see the original author's version in the list below
  if (currentWork.userId !== currentUser.value?.id) {
      // Check if it's already in related (unlikely due to excludeId)
      if (!related.some(w => w.id === currentWork.id)) {
          related.unshift(currentWork)
      }
  }

  relatedWorks.value = related

  // Load my ratings for related works
  for (const rWork of related) {
      const rating = getMyRating(rWork.id, 'work')
      if (rating) {
          myRatings.value[rWork.id] = rating / 2
      } else {
          myRatings.value[rWork.id] = 0
      }
  }

  // Find my works with same title
  const allWorks = await getWorks()
  const currentUserId = currentUser.value?.id
  const collectedIds = currentUser.value?.collectedWorkIds || []

  const myWorks = allWorks.filter(w => {
      if (w.title.trim() !== currentWork.title.trim()) return false

      const isMine = w.userId === currentUserId
      const isCollected = collectedIds.includes(w.id)

      return isMine || isCollected
  })

  myRelatedWorks.value = myWorks.filter(w => w.id !== currentWork.id)

  // Preload samples for my works preview
  for (const w of myRelatedWorks.value) {
     if (w.userId === currentUserId) {
         // My own work: load used samples
         const samples = await getSamplesForWork(w)
         if (!relatedSamplesCache.value[w.id]) relatedSamplesCache.value[w.id] = []
         relatedSamplesCache.value[w.id].push(...samples)
     } else {
         // Collected work: load MY samples for the content
         const chars = w.content.split('').slice(0, 8)
         for (const char of chars) {
             const charSamples = await getSamplesByChar(char)
             const mySample = charSamples.find(s => s.userId === currentUserId)
             if (mySample) {
                 if (!relatedSamplesCache.value[w.id]) relatedSamplesCache.value[w.id] = []
                 // Avoid duplicates
                 if (!relatedSamplesCache.value[w.id].some(s => s.id === mySample.id)) {
                     relatedSamplesCache.value[w.id].push(mySample)
                 }
             }
         }
     }
  }

  // Preload samples for previews (first 8 chars of each)
  for (const rWork of related) {
     // We need to load samples for these chars if we want to show them
     // But getRelatedPublicWorks doesn't return samples.
     // We can use getSamplesForWork for each related work
     const samples = await getSamplesForWork(rWork)
     // Store in a separate cache or the main one?
     // Let's use a separate one to avoid polluting the main editor state
     for (const s of samples) {
        if (!relatedSamplesCache.value[rWork.id]) {
           relatedSamplesCache.value[rWork.id] = []
        }
        // Avoid duplicates
        if (!relatedSamplesCache.value[rWork.id].some(existing => existing.id === s.id)) {
            relatedSamplesCache.value[rWork.id].push(s)
        }
     }
  }
}

const viewRelatedWork = (rWork: Work) => {
  // Navigate to the related work
  // Since we are already in WorkEditor, we can just push the new ID
  // But we need to force a reload of the component
  router.push(`/work/${rWork.id}`).then(() => {
     // Force reload if same component
     window.location.reload()
  })
}
const onRateWork = async (rWork: Work, value: number) => {
  try {
    await saveRating(rWork.id, 'work', value * 2)
    showToast('评分成功')
    // Update the work's average score locally if needed, or reload
    // For now just update my rating display
  } catch (e: any) {
    showToast('评分失败: ' + e.message)
  }
}
const getMyWorkPreviewContent = (work: Work, index: number, char: string) => {
  // If it's my own work, respect my choices
  if (work.userId === currentUser.value?.id) {
      const sampleId = work.charStyles?.[index]
      if (sampleId && relatedSamplesCache.value[work.id]) {
        const sample = relatedSamplesCache.value[work.id].find(s => s.id === sampleId)
        if (sample) return sample.svgPath
      }
  } else {
      // If it's a collected work, use MY sample from cache
      if (relatedSamplesCache.value[work.id]) {
          // We stored my samples in the cache for this work ID
          const sample = relatedSamplesCache.value[work.id].find(s => s.char === char && s.userId === currentUser.value?.id)
          if (sample) return sample.svgPath
      }
  }
  return char
}

const getMyWorkPreviewViewBox = (work: Work, index: number) => {
  // If it's my own work, respect my adjustments
  if (work.userId === currentUser.value?.id) {
      const adjustment = work.charAdjustments?.[index]
      if (adjustment) {
        const { scale, offsetX, offsetY } = adjustment
        const width = 100 / scale
        const height = 100 / scale
        const minX = 50 - offsetX - width / 2
        const minY = 50 - offsetY - height / 2
        return `${minX} ${minY} ${width} ${height}`
      }

      // Or sample viewBox
      const sampleId = work.charStyles?.[index]
      if (sampleId && relatedSamplesCache.value[work.id]) {
        const sample = relatedSamplesCache.value[work.id].find(s => s.id === sampleId)
        return sample?.svgViewBox
      }
  } else {
      // Collected work: use MY sample viewBox
      const char = work.content[index]
      if (relatedSamplesCache.value[work.id]) {
          const sample = relatedSamplesCache.value[work.id].find(s => s.char === char && s.userId === currentUser.value?.id)
          return sample?.svgViewBox
      }
  }
  return undefined
}

const getRelatedCharContent = (rWork: Work, index: number, char: string) => {
  const sampleId = rWork.charStyles?.[index]
  if (sampleId && relatedSamplesCache.value[rWork.id]) {
    const sample = relatedSamplesCache.value[rWork.id].find(s => s.id === sampleId)
    if (sample) return sample.svgPath
  }
  return char
}

const getRelatedCharViewBox = (rWork: Work, index: number) => {
  // Check adjustments first
  const adjustment = rWork.charAdjustments?.[index]
  if (adjustment) {
    const { scale, offsetX, offsetY } = adjustment
    const width = 100 / scale
    const height = 100 / scale
    const minX = 50 - offsetX - width / 2
    const minY = 50 - offsetY - height / 2
    return `${minX} ${minY} ${width} ${height}`
  }

  const sampleId = rWork.charStyles?.[index]
  if (sampleId && relatedSamplesCache.value[rWork.id]) {
    const sample = relatedSamplesCache.value[rWork.id].find(s => s.id === sampleId)
    if (sample) return sample.svgViewBox
  }
  return undefined
}

const preloadSamples = async (text: string) => {
  // Include title and author in preload
  const fullText = text + (work.value.title || '') + (work.value.author || '')
  const chars = new Set(fullText.split('').filter(c => c.trim()))
  for (const char of chars) {
    if (!samplesCache.value[char]) {
      samplesCache.value[char] = await getSamplesByChar(char)
    }
  }
  // 随机分配样式
  if (!isReadOnly.value) {
     randomizeStyles(text)
  }
}

const getMetaDisplayContent = (char: string) => {
  const samples = samplesCache.value[char] || []

  // 1. Try to find author's sample
  if (work.value.userId) {
    // Find a sample by the author.
    // Ideally we'd pick the "best" one (highest score or refined), but finding ANY is a good start.
    // If we have multiple, maybe pick the one with `isRefined`?
    const authorSamples = samples.filter(s => s.userId === work.value.userId)
    if (authorSamples.length > 0) {
        // Sort by refined, then score
        authorSamples.sort((a, b) => {
            if (a.isRefined !== b.isRefined) return a.isRefined ? -1 : 1
            return (b.score || 0) - (a.score || 0)
        })
        return authorSamples[0].svgPath
    }
  }

  // 2. Fallback to my best sample (viewer's sample)
  const mySamples = getUsableSamples(char)
  if (mySamples && mySamples.length > 0) {
    return mySamples[0].svgPath
  }
  return char
}

const getMetaDisplayViewBox = (char: string) => {
  const samples = samplesCache.value[char] || []

  // 1. Try to find author's sample
  if (work.value.userId) {
    const authorSamples = samples.filter(s => s.userId === work.value.userId)
    if (authorSamples.length > 0) {
        // Sort by refined, then score
        authorSamples.sort((a, b) => {
            if (a.isRefined !== b.isRefined) return a.isRefined ? -1 : 1
            return (b.score || 0) - (a.score || 0)
        })
        return authorSamples[0].svgViewBox
    }
  }

  // 2. Fallback to my best sample
  const mySamples = getUsableSamples(char)
  if (mySamples && mySamples.length > 0) {
    return mySamples[0].svgViewBox
  }
  return undefined
}

const getMetaDisplayType = (char: string) => {
  // Check if we have ANY sample to display (Author's or Mine)
  const content = getMetaDisplayContent(char)
  // If content is the char itself (and length is 1), it's text.
  // SVG path is usually much longer.
  return (content && content.length > 10) ? 'none' : 'text'
}

const submitRating = async () => {
  try {
    await saveRating(work.value.id, 'work', ratingScore.value * 2)
    showToast('评分成功')
  } catch (e: any) {
    showToast('评分失败: ' + e.message)
  }
}

const handleContentChange = (val: string) => {
  preloadSamples(val)
}

const getUsableSamples = (char: string) => {
  const samples = samplesCache.value[char] || []
  if (currentUser.value?.role === 'admin') return samples
  return samples.filter(s => s.userId === currentUser.value?.id)
}

const randomizeStyles = (text: string) => {
  // 只有在新建作品或内容变化时，且没有手动指定样式时，才进行随机分配
  // 这里简单处理：如果某个位置没有指定样式，且该字有多个样本，则随机选择一个
  text.split('').forEach((char, index) => {
    if (!char.trim()) return

    // 如果该位置已经有样式了，跳过（保留用户选择）
    if (work.value.charStyles[index]) return

    const samples = getUsableSamples(char)
    if (samples && samples.length > 0) {
      // If only 1 sample, use it. If multiple, random.
      const randomIndex = Math.floor(Math.random() * samples.length)
      work.value.charStyles[index] = samples[randomIndex].id
    }
  })
}

const getDisplayContent = (index: number, char: string) => {
  // 1. If it's my work, respect my choices
  if (work.value.userId === currentUser.value?.id) {
    const sampleId = work.value.charStyles[index]
    if (sampleId) {
      const samples = samplesCache.value[char]
      const sample = samples?.find(s => s.id === sampleId)
      if (sample) return sample.svgPath
    }
  }

  // 2. Otherwise (not my work, or no style selected), find MY best sample
  const samples = getUsableSamples(char)
  if (samples && samples.length > 0) {
    return samples[0].svgPath
  }

  return char
}

const getDisplayViewBox = (index: number) => {
  // 1. 优先使用作品特定的调整
  // Only use adjustments if it's my work (since adjustments are visual tweaks)
  // Or should we apply author's adjustments to my characters? Probably not, as adjustments are often specific to the stroke.
  if (work.value.userId === currentUser.value?.id) {
    const adjustment = work.value.charAdjustments?.[index]
    if (adjustment) {
      const { scale, offsetX, offsetY } = adjustment
      const width = 100 / scale
      const height = 100 / scale
      const minX = 50 - offsetX - width / 2
      const minY = 50 - offsetY - height / 2
      return `${minX} ${minY} ${width} ${height}`
    }
  }

  const char = work.value.content[index]

  // If it's my work, check selected style
  if (work.value.userId === currentUser.value?.id) {
    const sampleId = work.value.charStyles[index]
    if (sampleId) {
      const sample = samplesCache.value[char]?.find(s => s.id === sampleId)
      return sample?.svgViewBox
    }
  }

  // Fallback to my best sample
  const samples = getUsableSamples(char)
  if (samples && samples.length > 0) {
    return samples[0].svgViewBox
  }

  return undefined
}

const hasSample = (char: string) => {
  return getUsableSamples(char).length > 0
}

// 选字逻辑
const showSelector = ref(false)
const selectedIndex = ref(-1)
const selectedChar = ref('')
const currentSamples = computed(() => getUsableSamples(selectedChar.value))

// 调整相关
const showAdjustment = ref(false)
const adjustmentInitialData = ref({ scale: 1.0, offsetX: 0, offsetY: 0, isAdjusted: false })

const openSelector = (index: number, char: string) => {
  if (isReadOnly.value) return
  selectedIndex.value = index
  selectedChar.value = char
  showSelector.value = true
}

const openAdjustment = () => {
  // 1. 优先使用作品特定的调整
  const adjustment = work.value.charAdjustments?.[selectedIndex.value]
  if (adjustment) {
    adjustmentInitialData.value = { ...adjustment, isAdjusted: false } // 作品调整暂不涉及字库标记
  } else {
    // 2. 如果没有作品特定调整，尝试从当前选中的样本中解析调整参数
    const sampleId = work.value.charStyles[selectedIndex.value]
    let sample: CharacterSample | undefined

    if (sampleId) {
      sample = samplesCache.value[selectedChar.value]?.find(s => s.id === sampleId)
    } else {
      // 兜底：使用默认样本
      const samples = getUsableSamples(selectedChar.value)
      if (samples && samples.length > 0) {
        sample = samples[0]
      }
    }

    if (sample && sample.svgViewBox) {
      const [minX, minY, width, height] = sample.svgViewBox.split(' ').map(Number)
      // 反向计算
      const scale = 100 / width
      const offsetX = 50 - width / 2 - minX
      const offsetY = 50 - height / 2 - minY

      adjustmentInitialData.value = {
        scale: Number(scale.toFixed(2)),
        offsetX: Number(offsetX.toFixed(2)),
        offsetY: Number(offsetY.toFixed(2)),
        isAdjusted: !!sample.isAdjusted
      }
    } else {
      adjustmentInitialData.value = { scale: 1.0, offsetX: 0, offsetY: 0, isAdjusted: false }
    }
  }
  showSelector.value = false
  showAdjustment.value = true
}

const saveAdjustment = async (data: { scale: number, offsetX: number, offsetY: number, isAdjusted: boolean }) => {
  // 用户要求：直接调用字库的调整，调整后的结果也保存到字库
  // 这意味着我们不再保存到 work.charAdjustments，而是直接更新 CharacterSample

  // 1. 找到当前使用的样本
  const sampleId = work.value.charStyles[selectedIndex.value]
  let sample: CharacterSample | undefined

  if (sampleId) {
    sample = samplesCache.value[selectedChar.value]?.find(s => s.id === sampleId)
  } else {
    const samples = getUsableSamples(selectedChar.value)
    if (samples && samples.length > 0) {
      sample = samples[0]
    }
  }

  if (sample) {
    // 2. 计算新的 viewBox
    const { scale, offsetX, offsetY, isAdjusted } = data
    const width = 100 / scale
    const height = 100 / scale
    const minX = 50 - offsetX - width / 2
    const minY = 50 - offsetY - height / 2
    const newViewBox = `${minX} ${minY} ${width} ${height}`

    // 3. 更新样本
    const updatedSample = {
      ...toRaw(sample),
      svgViewBox: newViewBox,
      isAdjusted: isAdjusted
    }

    await saveSample(updatedSample)

    // 4. 更新本地缓存
    const samples = samplesCache.value[selectedChar.value]
    if (samples) {
      const index = samples.findIndex(s => s.id === updatedSample.id)
      if (index !== -1) {
        samples[index] = updatedSample
      }
    }

    // 5. 清除可能存在的作品级调整（因为我们已经更新了源头，不需要覆盖了）
    if (work.value.charAdjustments && work.value.charAdjustments[selectedIndex.value]) {
      delete work.value.charAdjustments[selectedIndex.value]
    }

    showToast('已保存到字库')
  } else {
    // 如果没有样本（理论上不应该发生，除非是空字），则回退到保存到作品
    if (!work.value.charAdjustments) {
      work.value.charAdjustments = {}
    }
    work.value.charAdjustments[selectedIndex.value] = data
  }
}

const selectSample = (sampleId: string | null) => {
  if (sampleId) {
    work.value.charStyles[selectedIndex.value] = sampleId
  } else {
    delete work.value.charStyles[selectedIndex.value]
  }
  showSelector.value = false
}

const save = async () => {
  if (!work.value.title) {
    showToast('请输入标题')
    return
  }

  if (!work.value.content) {
    showToast('请输入内容')
    return
  }

  // 验证：只有所有字都有自己的书写，才能标记为已精修
  if (isRefined.value) {
    // 确保样本已加载
    await preloadSamples(work.value.content)

    const validChars = work.value.content.split('').filter(c => /[a-zA-Z0-9\u4e00-\u9fa5]/.test(c))
    const missingChars = validChars.filter(char => {
      const samples = samplesCache.value[char]
      // 检查是否有属于当前用户的样本
      return !samples || !samples.some(s => s.userId === currentUser.value?.id)
    })

    if (missingChars.length > 0) {
      const uniqueMissing = [...new Set(missingChars)]
      const displayMissing = uniqueMissing.slice(0, 5).join('，')
      const more = uniqueMissing.length > 5 ? ' 等' : ''
      showToast(`无法标记为已精修：缺少以下字的个人书写：${displayMissing}${more}`)
      return
    }
  }

  work.value.isRefined = isRefined.value

  try {
    // If I am editing someone else's work, save as a new work (Clone)
    if (work.value.userId !== currentUser.value?.id) {
        work.value.originWorkId = work.value.id
        work.value.id = crypto.randomUUID()
        work.value.userId = currentUser.value?.id || ''
        work.value.createdAt = Date.now()
        work.value.updatedAt = Date.now()
        work.value.visibility = 'private' // Default to private
        // work.value.isRefined is already set from isRefined.value, which defaults to false for clones in onMounted
        // Keep content, title, author, layout, gridType
        // Keep charStyles? Yes, keep them as starting point.
        // Keep charAdjustments? Yes.
    } else if (!isEdit.value && currentUser.value?.role !== 'admin') {
        // New Work by Ordinary User:
        // 1. Create Public Template (Pending)
        // 2. Create Private Instance (Clone)

        // 1. Template
        const templateId = work.value.id
        const templateWork = { ...toRaw(work.value) }
        templateWork.visibility = 'public'
        templateWork.status = 'pending'
        templateWork.charStyles = {} // Template has no styles
        templateWork.charAdjustments = {}
        templateWork.isRefined = false

        await saveWork(templateWork)

        // 2. Instance
        work.value.originWorkId = templateId
        work.value.id = crypto.randomUUID()
        work.value.userId = currentUser.value?.id || ''
        work.value.createdAt = Date.now()
        work.value.updatedAt = Date.now()
        work.value.visibility = 'private'
        work.value.status = 'published' // Private instance is always active
        // Keep styles/adjustments if user added any during creation (though unlikely if we strip them, but let's keep them for the instance)
    }

    await saveWork(toRaw(work.value))
    showToast('保存成功')
    // Use replace to avoid history stack issues, or push to gallery
    router.replace('/gallery')
  } catch (e: any) {
    showToast('保存失败: ' + e.message)
    console.error(e)
  }
}
</script>

<style scoped>
.editor-content {
  margin-top: 16px;
}

.preview-area {
  margin-top: 24px;
  padding: 16px;
  background: #fff;
  min-height: 300px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-content: flex-start;
  justify-content: center;
}

.preview-area.vertical {
  writing-mode: vertical-rl;
  height: 500px; /* 竖排需要固定高度或自动撑开 */
  overflow-x: auto;
  align-content: center;
  justify-content: flex-start;
}

.char-box {
  position: relative;
  cursor: pointer;
}

.missing-mark {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 6px;
  height: 6px;
  background-color: #1989fa;
  border-radius: 50%;
}

.selector-content {
  padding: 16px;
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  justify-content: center;
}

.sample-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px;
  border: 2px solid transparent;
  border-radius: 8px;
  cursor: pointer;
}

.sample-option.active {
  border-color: var(--primary-color);
  background-color: rgba(139, 69, 19, 0.05);
}

.option-preview {
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  background: #f5f5f5;
  border-radius: 4px;
  margin-bottom: 4px;
}

.empty-samples {
  color: #999;
  padding: 20px;
}

.related-works-section {
  margin-top: 24px;
  padding-bottom: 40px;
}

.section-title {
  font-size: 16px;
  font-weight: bold;
  margin: 0 16px 12px;
  padding-left: 8px;
  border-left: 4px solid var(--primary-color);
}

.related-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0 16px;
}

.related-item {
  padding: 12px;
  cursor: pointer;
  border: 1px solid transparent;
}

.related-item.current-viewing {
  border-color: var(--primary-color);
  background-color: #f0f9ff;
}

.related-header {
  display: flex;

.meta-display {
  display: flex;
  gap: 4px;
  padding: 8px;
  justify-content: center;
  align-items: center;
}

/* Horizontal Layout */
.preview-area:not(.vertical) .meta-display {
  width: 100%;
}

.preview-area:not(.vertical) .title-display {
  margin-bottom: 8px;
}

.preview-area:not(.vertical) .author-display {
  justify-content: flex-end;
  margin-bottom: 16px;
  padding-right: 20px;
}

/* Vertical Layout */
.preview-area.vertical .meta-display {
  height: 100%;
  flex-direction: column;
  width: auto;
  padding: 0 16px;
}

.preview-area.vertical .title-display {
  order: -2; /* Rightmost in vertical-rl */
}

.preview-area.vertical .author-display {
  order: -1;
  justify-content: flex-end; /* Bottom align author name */
  padding-bottom: 40px;
}
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 14px;
}

.author-name {
  font-weight: bold;
  color: #333;
}

.score {
  color: #f7b500;
}

.related-preview {
  display: flex;
  gap: 4px;
  overflow: hidden;
}
</style>
