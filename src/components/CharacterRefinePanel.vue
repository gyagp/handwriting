<template>
  <div class="character-refine-panel">
    <!-- Unrefined Queue -->
    <div class="unrefined-queue card" v-if="unrefinedList.length > 0">
      <div class="queue-header">待精修 ({{ unrefinedList.length }})</div>
      <div class="queue-list">
        <div
          v-for="c in unrefinedList"
          :key="c"
          class="queue-item"
          :class="{ active: c === char }"
          @click="$emit('select-char', c)"
        >
          {{ c }}
        </div>
      </div>
    </div>

    <div class="main-display card">
      <div class="adjustment-panel">
        <div class="grid-selector">
          <van-radio-group v-model="currentGridType" direction="horizontal">
            <van-radio name="mi">米字</van-radio>
            <van-radio name="tian">田字</van-radio>
            <van-radio name="hui">回字</van-radio>
            <van-radio name="none">无</van-radio>
          </van-radio-group>
        </div>

        <div
          class="preview-box"
          @mousedown="startDrag"
          @touchstart="startDrag"
          @wheel.prevent="handleWheel"
        >
          <div v-if="editForm.char || char" class="background-char">
            <GridDisplay
              type="none"
              :size="280"
              :content="editForm.char || char"
            />
          </div>
          <GridDisplay
            class="foreground-char"
            :type="currentGridType"
            :size="280"
            :content="currentSample?.svgPath || ''"
            :viewBox="previewViewBox"
          />
        </div>

        <div class="controls">
          <div class="control-item">
            <span>汉字</span>
            <van-field v-model="editForm.char" maxlength="1" input-align="center" style="width: 60px; padding: 5px; border: 1px solid #eee; border-radius: 4px;" />
          </div>
          <div class="control-item">
            <span>缩放</span>
            <van-slider v-model="editForm.scale" :min="0.05" :max="2.0" :step="0.01" />
            <van-stepper v-model="editForm.scale" :min="0.05" :max="2.0" :step="0.01" button-size="22px" input-width="40px" />
          </div>
          <div class="control-item">
            <span>左右</span>
            <van-slider v-model="editForm.offsetX" :min="-200" :max="200" :step="0.1" />
            <van-stepper v-model="editForm.offsetX" :min="-200" :max="200" :step="0.1" button-size="22px" input-width="40px" />
          </div>
          <div class="control-item">
            <span>上下</span>
            <van-slider v-model="editForm.offsetY" :min="-200" :max="200" :step="0.1" />
            <van-stepper v-model="editForm.offsetY" :min="-200" :max="200" :step="0.1" button-size="22px" input-width="40px" />
          </div>
          <div class="control-item" style="justify-content: flex-end; gap: 12px;">
             <van-checkbox v-model="editForm.isAdjusted">已精修</van-checkbox>
             <van-button type="primary" size="small" @click="saveAdjustment">保存</van-button>
          </div>
        </div>
      </div>
    </div>

    <div class="samples-section">
      <div v-if="mySamples.length > 0">
        <h3>我的书写 ({{ mySamples.length }})</h3>
        <div>
          <h4 class="sub-title" v-if="myRefinedSamples.length > 0">未精修</h4>
          <div class="samples-list">
            <div
              v-for="sample in myUnrefinedSamples"
              :key="sample.id"
              class="sample-item"
              :class="{ active: currentSample?.id === sample.id }"
              @click="onSelectSample(sample)"
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
          </div>
        </div>

        <div v-if="myRefinedSamples.length > 0">
          <h4 class="sub-title">已精修</h4>
          <div class="samples-list">
            <div
              v-for="sample in myRefinedSamples"
              :key="sample.id"
              class="sample-item"
              :class="{ active: currentSample?.id === sample.id }"
              @click="onSelectSample(sample)"
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
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { getSamplesByChar, deleteSample, saveSample, currentUser, getUnrefinedChars } from '@/services/db'
import GridDisplay from '@/components/GridDisplay.vue'
import type { CharacterSample, GridType } from '@/types'
import { showDialog, showToast } from 'vant'
import { toRaw } from 'vue'

const props = defineProps<{
  char: string
}>()

const emit = defineEmits<{
  (e: 'select-char', char: string): void
}>()

const samples = ref<CharacterSample[]>([])
const currentSample = ref<CharacterSample | null>(null)
const unrefinedList = ref<string[]>([])
const currentGridType = ref<GridType>('mi')

const editForm = ref({
  scale: 1.0,
  offsetX: 0,
  offsetY: 0,
  isAdjusted: false,
  char: ''
})

const mySamples = computed(() => samples.value.filter(s => s.userId === currentUser.value?.id))
const myRefinedSamples = computed(() => mySamples.value.filter(s => s.isAdjusted))
const myUnrefinedSamples = computed(() => mySamples.value.filter(s => !s.isAdjusted))

const loadSamples = async () => {
  if (!props.char) return
  samples.value = await getSamplesByChar(props.char)
  if (samples.value.length > 0) {
    const myUnrefined = samples.value.find(s => s.userId === currentUser.value?.id && !s.isAdjusted)
    if (myUnrefined) {
      currentSample.value = myUnrefined
    } else {
      currentSample.value = samples.value[0]
    }
  } else {
    currentSample.value = null
  }
}

const loadUnrefined = async () => {
    unrefinedList.value = await getUnrefinedChars()
}

watch(() => props.char, async () => {
  await loadSamples()
  // Also reload unrefined list to keep it fresh?
  // Maybe not every time, but good for sync.
  await loadUnrefined()
}, { immediate: true })

const previewViewBox = computed(() => {
  const { scale, offsetX, offsetY } = editForm.value
  const width = 100 / scale
  const height = 100 / scale
  const minX = 50 - offsetX - width / 2
  const minY = 50 - offsetY - height / 2
  return `${minX} ${minY} ${width} ${height}`
})

watch(currentSample, (newSample) => {
  if (newSample) {
      const viewBox = newSample.svgViewBox || '0 0 100 100'
      const [minX, minY, width, height] = viewBox.split(' ').map(Number)
      const scale = 100 / width
      const offsetX = 50 - width / 2 - minX
      const offsetY = 50 - height / 2 - minY

      editForm.value = {
        scale: Number(scale.toFixed(2)),
        offsetX: Number(offsetX.toFixed(2)),
        offsetY: Number(offsetY.toFixed(2)),
        isAdjusted: !!newSample.isAdjusted,
        char: newSample.char
      }
  }
}, { immediate: true })

const saveAdjustment = async () => {
  if (!currentSample.value) return

  const { scale, offsetX, offsetY, isAdjusted, char } = editForm.value
  const width = 100 / scale
  const height = 100 / scale
  const minX = 50 - offsetX - width / 2
  const minY = 50 - offsetY - height / 2
  const newViewBox = `${minX} ${minY} ${width} ${height}`

  const updatedSample = {
    ...toRaw(currentSample.value),
    svgViewBox: newViewBox,
    isAdjusted: isAdjusted,
    char: char
  }

  await saveSample(updatedSample)
  showToast('保存成功')

  await loadSamples()
  await loadUnrefined()
}

const onSelectSample = (sample: CharacterSample) => {
  currentSample.value = sample
}

const canDelete = (sample: CharacterSample) => {
  return sample.userId === currentUser.value?.id || currentUser.value?.role === 'admin'
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
      await loadUnrefined()
      showToast('已删除')
    }
  })
}

// Drag Logic
const isDragging = ref(false)
const startPos = ref({ x: 0, y: 0 })
const startOffset = ref({ x: 0, y: 0 })

const startDrag = (e: MouseEvent | TouchEvent) => {
  isDragging.value = true
  const clientX = 'touches' in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX
  const clientY = 'touches' in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY

  startPos.value = { x: clientX, y: clientY }
  startOffset.value = { x: editForm.value.offsetX, y: editForm.value.offsetY }

  window.addEventListener('mousemove', onDrag)
  window.addEventListener('touchmove', onDrag, { passive: false })
  window.addEventListener('mouseup', stopDrag)
  window.addEventListener('touchend', stopDrag)
}

const onDrag = (e: MouseEvent | TouchEvent) => {
  if (!isDragging.value) return
  if (e.cancelable) e.preventDefault()

  const clientX = 'touches' in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX
  const clientY = 'touches' in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY

  const deltaX = clientX - startPos.value.x
  const deltaY = clientY - startPos.value.y

  const scale = editForm.value.scale
  const svgDeltaX = deltaX * (100 / 280) / scale
  const svgDeltaY = deltaY * (100 / 280) / scale

  let newOffsetX = startOffset.value.x + svgDeltaX
  let newOffsetY = startOffset.value.y + svgDeltaY

  newOffsetX = Math.max(-200, Math.min(200, newOffsetX))
  newOffsetY = Math.max(-200, Math.min(200, newOffsetY))

  editForm.value.offsetX = Number(newOffsetX.toFixed(2))
  editForm.value.offsetY = Number(newOffsetY.toFixed(2))
}

const stopDrag = () => {
  isDragging.value = false
  window.removeEventListener('mousemove', onDrag)
  window.removeEventListener('touchmove', onDrag)
  window.removeEventListener('mouseup', stopDrag)
  window.removeEventListener('touchend', stopDrag)
}

const handleWheel = (e: WheelEvent) => {
  const delta = e.deltaY > 0 ? -0.05 : 0.05
  let newScale = editForm.value.scale + delta
  newScale = Math.max(0.2, Math.min(2.0, newScale))
  editForm.value.scale = Number(newScale.toFixed(2))
}
</script>

<style scoped>
.unrefined-queue {
  padding: 12px;
  margin-bottom: 12px;
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
  max-height: 80px;
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
  width: 100%;
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

.samples-section {
  margin-top: 16px;
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
</style>