<template>
  <van-dialog
    :show="show"
    title="调整字形"
    show-cancel-button
    @confirm="handleConfirm"
    @cancel="handleCancel"
    @update:show="$emit('update:show', $event)"
  >
    <div class="edit-container">
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
        <div v-if="char" class="background-char">
          <GridDisplay
            type="none"
            :size="200"
            :content="char"
          />
        </div>
        <GridDisplay
          class="foreground-char"
          :type="currentGridType"
          :size="200"
          :content="content"
          :viewBox="previewViewBox"
        />
      </div>
      <div class="controls">
        <div class="control-item">
          <span>缩放</span>
          <van-slider v-model="form.scale" :min="0.05" :max="2.0" :step="0.01" />
          <van-stepper v-model="form.scale" :min="0.05" :max="2.0" :step="0.01" button-size="22px" input-width="40px" />
        </div>
        <div class="control-item">
          <span>左右</span>
          <van-slider v-model="form.offsetX" :min="-200" :max="200" :step="0.1" />
          <van-stepper v-model="form.offsetX" :min="-200" :max="200" :step="0.1" button-size="22px" input-width="40px" />
        </div>
        <div class="control-item">
          <span>上下</span>
          <van-slider v-model="form.offsetY" :min="-200" :max="200" :step="0.1" />
          <van-stepper v-model="form.offsetY" :min="-200" :max="200" :step="0.1" button-size="22px" input-width="40px" />
        </div>
        <div class="control-item" style="justify-content: flex-end;">
          <van-checkbox v-model="form.isAdjusted">已精修</van-checkbox>
        </div>
      </div>
    </div>
  </van-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import GridDisplay from '@/components/GridDisplay.vue'
import type { GridType } from '@/types'

const props = defineProps<{
  show: boolean
  content: string
  char?: string
  gridType?: GridType
  initialData?: { scale: number; offsetX: number; offsetY: number; isAdjusted?: boolean }
}>()

const emit = defineEmits<{
  (e: 'update:show', val: boolean): void
  (e: 'save', val: { scale: number; offsetX: number; offsetY: number; isAdjusted: boolean }): void
}>()

const form = ref({
  scale: 1.0,
  offsetX: 0,
  offsetY: 0,
  isAdjusted: false
})

const currentGridType = ref<GridType>('mi')

watch(
  () => props.show,
  (val) => {
    if (val) {
      currentGridType.value = props.gridType || 'mi'
      if (props.initialData) {
        form.value = {
          scale: props.initialData.scale,
          offsetX: props.initialData.offsetX,
          offsetY: props.initialData.offsetY,
          isAdjusted: props.initialData.isAdjusted ?? true // 默认打开弹窗就是为了调整，所以默认勾选
        }
      } else {
        form.value = { scale: 1.0, offsetX: 0, offsetY: 0, isAdjusted: true }
      }
    }
  }
)

const previewViewBox = computed(() => {
  const { scale, offsetX, offsetY } = form.value
  const width = 100 / scale
  const height = 100 / scale
  const minX = 50 - offsetX - width / 2
  const minY = 50 - offsetY - height / 2
  return `${minX} ${minY} ${width} ${height}`
})

const handleConfirm = () => {
  emit('save', { ...form.value })
  emit('update:show', false)
}

const handleCancel = () => {
  emit('update:show', false)
}

// 交互逻辑
const isDragging = ref(false)
const startPos = ref({ x: 0, y: 0 })
const startOffset = ref({ x: 0, y: 0 })

const startDrag = (e: MouseEvent | TouchEvent) => {
  isDragging.value = true
  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

  startPos.value = { x: clientX, y: clientY }
  startOffset.value = { x: form.value.offsetX, y: form.value.offsetY }

  window.addEventListener('mousemove', onDrag)
  window.addEventListener('touchmove', onDrag, { passive: false })
  window.addEventListener('mouseup', stopDrag)
  window.addEventListener('touchend', stopDrag)
}

const onDrag = (e: MouseEvent | TouchEvent) => {
  if (!isDragging.value) return
  if (e.cancelable) e.preventDefault()

  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

  const deltaX = clientX - startPos.value.x
  const deltaY = clientY - startPos.value.y

  const scale = form.value.scale
  const svgDeltaX = deltaX / (2 * scale)
  const svgDeltaY = deltaY / (2 * scale)

  let newOffsetX = startOffset.value.x + svgDeltaX
  let newOffsetY = startOffset.value.y + svgDeltaY

  newOffsetX = Math.max(-200, Math.min(200, newOffsetX))
  newOffsetY = Math.max(-200, Math.min(200, newOffsetY))

  form.value.offsetX = Number(newOffsetX.toFixed(2))
  form.value.offsetY = Number(newOffsetY.toFixed(2))
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
  let newScale = form.value.scale + delta
  newScale = Math.max(0.2, Math.min(2.0, newScale))
  form.value.scale = Number(newScale.toFixed(2))
}
</script>

<style scoped>
.edit-container {
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.grid-selector {
  margin-bottom: 10px;
}

.preview-box {
  position: relative;
  border: 1px solid #eee;
  cursor: move;
  touch-action: none;
}

.background-char {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0.3;
  pointer-events: none;
  z-index: 0;
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
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.control-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.control-item span {
  width: 40px;
  font-size: 14px;
  color: #666;
}

.van-slider {
  flex: 1;
}
</style>
