<template>
  <div class="character-detail container">
    <van-nav-bar
      :title="char"
      left-text="返回"
      left-arrow
      @click-left="$router.back()"
    />

    <div class="main-display card">
      <GridDisplay
        :type="settings.gridType"
        :size="280"
        :content="currentSample?.svgPath || char"
        :viewBox="currentSample?.svgViewBox"
      />
      <div class="actions" v-if="currentSample">
        <van-button size="small" icon="edit" @click="openEdit" v-if="canEdit">调整</van-button>
        <van-button
          size="small"
          icon="star-o"
          @click="openRating"
          v-if="!canEdit"
        >
          {{ myCurrentRating ? `评分 (${myCurrentRating})` : '评分' }}
        </van-button>
      </div>
      <div class="sample-info-extra" v-if="currentSample && !canEdit">
        书写者: {{ getUsername(currentSample.userId) }}
      </div>
    </div>

    <div class="info-section card">
      <div class="info-row">
        <span class="label">拼音：</span>
        <span class="value">{{ charInfo?.pinyin }}</span>
      </div>
      <div class="info-row">
        <span class="label">部首：</span>
        <span class="value">{{ charInfo?.radical }}</span>
      </div>
      <div class="info-row">
        <span class="label">笔画：</span>
        <span class="value">{{ charInfo?.strokes }}</span>
      </div>
    </div>

    <div class="samples-section">
      <div v-if="mySamples.length > 0 || currentUser?.role !== 'admin'">
        <h3>我的书写 ({{ mySamples.length }})</h3>
        <div class="samples-list">
          <div
            v-for="sample in mySamples"
            :key="sample.id"
            class="sample-item"
            :class="{ active: currentSample?.id === sample.id }"
            @click="currentSample = sample"
          >
            <GridDisplay :size="60" :content="sample.svgPath" :viewBox="sample.svgViewBox" />
            <div class="sample-score" v-if="sample.score">{{ sample.score }}</div>
            <van-icon name="lock" v-if="sample.visibility === 'private'" class="private-icon" />
            <van-icon
              name="cross"
              class="delete-btn"
              @click.stop="handleDelete(sample)"
              v-if="canDelete(sample)"
            />
          </div>

          <div class="add-btn" @click="$router.push('/capture')" v-if="currentUser?.role !== 'admin'">
            <van-icon name="plus" />
          </div>
        </div>
      </div>

      <div v-if="otherSamples.length > 0" style="margin-top: 24px;">
        <h3>公开书写 ({{ otherSamples.length }})</h3>
        <div class="samples-list">
          <div
            v-for="sample in otherSamples"
            :key="sample.id"
            class="sample-item"
            :class="{ active: currentSample?.id === sample.id }"
            @click="currentSample = sample"
          >
            <GridDisplay :size="60" :content="sample.svgPath" :viewBox="sample.svgViewBox" />
            <div class="sample-score" v-if="sample.score">{{ sample.score }}</div>
            <div class="sample-author">{{ getUsername(sample.userId) }}</div>
            <van-icon name="lock" v-if="sample.visibility === 'private'" class="private-icon" />
            <van-icon
              name="cross"
              class="delete-btn"
              @click.stop="handleDelete(sample)"
              v-if="canDelete(sample)"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 编辑弹窗 -->
    <CharacterAdjustmentDialog
      v-model:show="showEdit"
      :content="currentSample?.svgPath || ''"
      :char="char"
      :grid-type="settings.gridType"
      :initial-data="editForm"
      @save="saveEdit"
    />

    <van-dialog v-model:show="showRatingDialog" title="评分" show-cancel-button @confirm="submitRating">
      <div style="display: flex; justify-content: center; padding: 20px;">
        <van-rate v-model="ratingScore" :count="5" allow-half size="30" />
      </div>
      <div style="text-align: center; color: #666;">{{ ratingScore * 2 }} 分</div>
    </van-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { getSamplesByChar, deleteSample, getSettings, saveSample, saveRating, getMyRating, currentUser, getUsername } from '@/services/db'
import { getPinyin, getRadical, getStrokes, getGB2312Code } from '@/data/gb2312-generator'
import GridDisplay from '@/components/GridDisplay.vue'
import CharacterAdjustmentDialog from '@/components/CharacterAdjustmentDialog.vue'
import type { CharacterSample, AppSettings } from '@/types'
import { showDialog, showToast } from 'vant'
import { toRaw } from 'vue'

const props = defineProps<{
  char: string
}>()

const samples = ref<CharacterSample[]>([])
const currentSample = ref<CharacterSample | null>(null)

const mySamples = computed(() => samples.value.filter(s => s.userId === currentUser.value?.id))
const otherSamples = computed(() => samples.value.filter(s => s.userId !== currentUser.value?.id))

const settings = ref<AppSettings>({
  gridType: 'mi',
  gridSize: 100,
  autoRecognize: true,
  compressionLevel: 5,
  theme: 'light'
})

const showEdit = ref(false)
const editForm = ref({
  scale: 1.0,
  offsetX: 0,
  offsetY: 0,
  isAdjusted: false
})

const showRatingDialog = ref(false)
const ratingScore = ref(0)

const myCurrentRating = computed(() => {
  if (!currentSample.value) return 0
  // Force reactivity by depending on showRatingDialog (hacky but works if we reload)
  // Better: getMyRating should be reactive if store is reactive.
  // Let's assume getMyRating is reactive because it accesses store.ratings
  return getMyRating(currentSample.value.id, 'sample')
})

const canEdit = computed(() => {
  if (!currentSample.value) return false
  if (currentUser.value?.role === 'admin') {
    return currentSample.value.visibility === 'public'
  }
  return currentSample.value.userId === currentUser.value?.id
})

const canDelete = (sample: CharacterSample) => {
  return sample.userId === currentUser.value?.id || currentUser.value?.role === 'admin'
}

const openRating = () => {
  if (!currentSample.value) return
  const myRating = getMyRating(currentSample.value.id, 'sample')
  ratingScore.value = myRating ? myRating / 2 : 0
  showRatingDialog.value = true
}

const submitRating = async () => {
  if (!currentSample.value) return
  await saveRating(currentSample.value.id, 'sample', ratingScore.value * 2)
  showToast('评分成功')
  await loadSamples()
}

const openEdit = () => {
  if (!currentSample.value) return

  const viewBox = currentSample.value.svgViewBox || '0 0 100 100'
  const [minX, minY, width, height] = viewBox.split(' ').map(Number)

  // 反向计算
  const scale = 100 / width
  const offsetX = 50 - width / 2 - minX
  const offsetY = 50 - height / 2 - minY

  editForm.value = {
    scale: Number(scale.toFixed(2)),
    offsetX: Number(offsetX.toFixed(2)),
    offsetY: Number(offsetY.toFixed(2)),
    isAdjusted: !!currentSample.value.isAdjusted
  }
  showEdit.value = true
}

const saveEdit = async (data: { scale: number; offsetX: number; offsetY: number; isAdjusted: boolean }) => {
  if (!currentSample.value) return

  const { scale, offsetX, offsetY, isAdjusted } = data
  const width = 100 / scale
  const height = 100 / scale
  const minX = 50 - offsetX - width / 2
  const minY = 50 - offsetY - height / 2
  const newViewBox = `${minX} ${minY} ${width} ${height}`

  const updatedSample = {
    ...toRaw(currentSample.value),
    svgViewBox: newViewBox,
    isAdjusted: isAdjusted
  }

  await saveSample(updatedSample)

  // 更新本地数据
  const index = samples.value.findIndex(s => s.id === updatedSample.id)
  if (index !== -1) {
    samples.value[index] = updatedSample
  }
  currentSample.value = updatedSample
  showToast('保存成功')
}

const charInfo = computed(() => {
  if (!props.char) return null
  return {
    char: props.char,
    code: getGB2312Code(props.char),
    pinyin: getPinyin(props.char),
    radical: getRadical(props.char),
    strokes: getStrokes(props.char)
  }
})

onMounted(async () => {
  const s = await getSettings()
  if (s) settings.value = s

  await loadSamples()
})

watch(() => props.char, () => {
  loadSamples()
})

const loadSamples = async () => {
  samples.value = await getSamplesByChar(props.char)
  if (samples.value.length > 0) {
    currentSample.value = samples.value[0]
  } else {
    currentSample.value = null
  }
}

const handleDelete = (sample: CharacterSample) => {
  showDialog({
    title: '确认删除',
    message: '确定要删除这个样本吗？',
    showCancelButton: true
  }).then(async (action) => {
    if (action === 'confirm') {
      await deleteSample(sample.id)
      await loadSamples()
      showToast('已删除')
    }
  })
}
</script>

<style scoped>
.main-display {
  display: flex;
  justify-content: center;
  padding: 20px;
  margin-top: 16px;
}

.info-section {
  display: flex;
  justify-content: space-around;
}

.info-row {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.label {
  font-size: 12px;
  color: #999;
}

.value {
  font-size: 16px;
  font-weight: 500;
}

.samples-section {
  margin-top: 24px;
}

.samples-section h3 {
  margin-bottom: 12px;
  font-size: 16px;
  color: #666;
}

.samples-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.sample-item {
  position: relative;
  border: 2px solid transparent;
  border-radius: 4px;
  cursor: pointer;
}

.sample-item.active {
  border-color: var(--primary-color);
}

.private-icon {
  position: absolute;
  top: 2px;
  right: 2px;
  font-size: 12px;
  color: #999;
}

.delete-btn {
  position: absolute;
  top: -6px;
  right: -6px;
  background: #fff;
  border-radius: 50%;
  color: #999;
  font-size: 14px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.2);
}

.sample-score {
  position: absolute;
  bottom: 0;
  right: 0;
  background: rgba(0,0,0,0.5);
  color: #fff;
  font-size: 10px;
  padding: 1px 3px;
  border-radius: 2px 0 0 0;
}

.sample-author {
  position: absolute;
  top: 0;
  left: 0;
  background: rgba(0,0,0,0.5);
  color: #fff;
  font-size: 10px;
  padding: 1px 3px;
  border-radius: 0 0 2px 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.add-btn {
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px dashed #ccc;
  border-radius: 4px;
  color: #ccc;
  cursor: pointer;
}

.actions {
  margin-top: 16px;
  display: flex;
  justify-content: center;
}

.sample-info-extra {
  margin-top: 8px;
  text-align: center;
  font-size: 12px;
  color: #999;
}
</style>
