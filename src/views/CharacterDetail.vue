<template>
  <div class="character-detail container">
    <van-nav-bar
      :title="char"
      left-text="返回"
      left-arrow
      @click-left="$router.back()"
    />

    <!-- Unrefined Queue -->
    <!-- Moved to CharacterRefinePanel -->

    <div class="main-display card" v-if="!canEdit">
      <!-- Read-only View -->
      <div>
        <GridDisplay
          :type="settings.gridType"
          :size="280"
          :content="currentSample?.svgPath || char"
          :viewBox="currentSample?.svgViewBox"
        />
        <div class="actions" v-if="currentSample">
          <van-button
            size="small"
            icon="star-o"
            @click="openRating"
            v-if="currentUser?.role !== 'guest'"
          >
            {{ myCurrentRating ? `评分 (${myCurrentRating})` : '评分' }}
          </van-button>
        </div>
        <div class="sample-info-extra" v-if="currentSample">
          书写者: {{ getUsername(currentSample.userId) }}
        </div>
      </div>
    </div>

    <!-- Adjustment View -->
    <CharacterRefinePanel
      v-else
      :char="char"
      @select-char="(c: string) => $router.replace(`/character/${c}`)"
    />

    <div class="samples-section" v-if="!canEdit">
      <div v-if="mySamples.length > 0 || currentUser?.role !== 'admin'">
        <h3>我的书写 ({{ mySamples.length }})</h3>
        <!-- Read-only view of my samples if for some reason I can't edit (e.g. admin viewing user?) -->
        <!-- Actually if I have samples, canEdit is true. So this block is mostly for admin viewing others or guest -->
        <div class="samples-list">
            <div
              v-for="sample in mySamples"
              :key="sample.id"
              class="sample-item"
              :class="{ active: currentSample?.id === sample.id }"
              @click="onSelectSample(sample)"
            >
              <GridDisplay :size="60" :content="sample.svgPath" :viewBox="sample.svgViewBox" />
              <div class="sample-score" v-if="sample.score">{{ sample.score }}</div>
            </div>
        </div>
      </div>
    </div>

    <div class="samples-section" v-if="!canEdit && otherSamples.length > 0">
      <div style="margin-top: 24px;">
        <h3>公开书写 ({{ otherSamples.length }})</h3>
        <div class="samples-list">
          <div
            v-for="sample in otherSamples"
            :key="sample.id"
            class="sample-item"
            :class="{ active: currentSample?.id === sample.id }"
            @click="onSelectSample(sample)"
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
import { getSamplesByChar, deleteSample, getSettings, saveRating, getMyRating, currentUser, getUsername, getUnrefinedChars } from '@/services/db'
import GridDisplay from '@/components/GridDisplay.vue'
import type { CharacterSample, AppSettings } from '@/types'
import { showDialog, showToast } from 'vant'

const props = defineProps<{
  char: string
}>()

const samples = ref<CharacterSample[]>([])
const currentSample = ref<CharacterSample | null>(null)
const unrefinedList = ref<string[]>([])

const mySamples = computed(() => samples.value.filter(s => s.userId === currentUser.value?.id))
const otherSamples = computed(() => samples.value.filter(s => s.userId !== currentUser.value?.id))

const settings = ref<AppSettings>({
  gridType: 'mi',
  gridSize: 100,
  compressionLevel: 5,
  theme: 'light'
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

watch(() => props.char, () => {
  loadSamples()
})

const onSelectSample = (sample: CharacterSample) => {
  currentSample.value = sample
}

const loadSamples = async () => {
  samples.value = await getSamplesByChar(props.char)
  if (samples.value.length > 0) {
    // 优先选中未精修的样本
    const myUnrefined = samples.value.find(s => s.userId === currentUser.value?.id && !s.isAdjusted)
    if (myUnrefined) {
      currentSample.value = myUnrefined
    } else {
      currentSample.value = samples.value[0]
    }
  } else {
    currentSample.value = null
  }
  // Refresh unrefined list when samples change (e.g. after save)
  unrefinedList.value = await getUnrefinedChars()
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

onMounted(async () => {
  const s = await getSettings()
  if (s) settings.value = s

  await loadSamples()
  unrefinedList.value = await getUnrefinedChars()
})
</script>

<style scoped>
.unrefined-queue {
  padding: 12px;
}

.queue-header {
  font-size: 14px;
  color: #666;
  margin-bottom: 8px;
}

.queue-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  max-height: 80px; /* Approx 2 rows */
  overflow-y: auto;
}

.queue-item {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
  border-radius: 4px;
  font-size: 16px;
  cursor: pointer;
  border: 1px solid transparent;
}

.queue-item.active {
  background: var(--primary-color);
  color: #fff;
}

.main-display {
  display: flex;
  justify-content: center;
  padding: 20px;
  margin-top: 16px;
  background: #f8f8f8;
}

.adjustment-panel {
  padding: 16px;
  background: #fff;
  border-top: 1px solid #eee;
}

.control-group {
  margin-bottom: 16px;
}

.control-label {
  font-size: 14px;
  color: #666;
  margin-bottom: 8px;
  display: block;
}

.action-buttons {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

.grid-selector {
  margin-bottom: 16px;
  display: flex;
  justify-content: center;
}

.preview-box {
  position: relative;
  width: 280px;
  height: 280px;
  margin: 0 auto 20px;
  border: 1px solid #eee;
  overflow: hidden;
  cursor: move;
}

.background-char {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0.3;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.background-char :deep(.text-content) {
  font-family: "KaiTi", "STKaiti", "楷体", serif;
}

.foreground-char {
  position: relative;
  z-index: 1;
  background-color: transparent !important;
}

.controls {
  padding: 0 16px;
}

.control-item {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
  gap: 12px;
}

.control-item span {
  width: 40px;
  font-size: 14px;
  color: #666;
}

.control-item .van-slider {
  flex: 1;
  margin: 0 12px;
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

.sub-title {
  margin: 10px 0 8px;
  font-size: 14px;
  color: #888;
  font-weight: normal;
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
