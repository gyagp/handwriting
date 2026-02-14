<template>
  <div class="capture-page container">
    <h1 class="page-title">拍照集字</h1>

    <!-- 步骤1: 拍照/上传 -->
    <div v-if="step === 1">
      <ImageCapture @capture="handleCapture">
        <template #extra-actions>
          <div style="display: flex; align-items: center; margin: 0 8px;">
             <van-radio-group v-model="captureMode" direction="horizontal" icon-size="14px">
                <van-radio name="auto" style="margin-right: 8px; font-size: 12px;">自动</van-radio>
                <van-radio name="manual" style="font-size: 12px;">手工</van-radio>
             </van-radio-group>
          </div>
        </template>
      </ImageCapture>
      <div class="tips">
        <p>提示：</p>
        <ul>
          <li>请在光线充足的环境下拍摄</li>
          <li>尽量保持纸张平整</li>
          <li>文字清晰，背景干净</li>
        </ul>
      </div>
    </div>

    <!-- 步骤2: 图像处理与选择 -->
    <div v-else-if="step === 2" class="processing-step">
      <div class="toolbar">
        <van-button size="small" @click="step = 1">返回</van-button>
        <span v-if="!isManualMode">检测到 {{ extractedChars.length }} 个字符</span>
        <span v-else>手工框选模式</span>

        <div v-if="!isManualMode" style="display: flex; gap: 8px;">
             <van-button size="small" @click="enterManualMode">手工模式</van-button>
             <van-button type="primary" size="small" @click="saveSelected" :disabled="selectedIds.size === 0">
               保存选中 ({{ selectedIds.size }})
             </van-button>
        </div>
        <div v-else>
             <van-button type="primary" size="small" @click="exitManualMode">完成</van-button>
        </div>
      </div>

      <div v-if="!isManualMode" class="extracted-grid">
        <div
          v-for="item in extractedChars"
          :key="item.id"
          class="extracted-item"
          :class="{ selected: selectedIds.has(item.id) }"
          @click="toggleSelect(item.id)"
        >
          <canvas :ref="el => setCanvasRef(el, item)" width="100" height="100"></canvas>
          <div class="checkbox">
            <van-icon name="success" v-if="selectedIds.has(item.id)" color="#fff" />
          </div>
        </div>
      </div>

      <div v-else class="manual-editor">
         <div class="editor-container" style="position: relative; overflow: hidden; touch-action: none;">
            <img :src="originalImageUrl" ref="editorImageRef" style="max-width: 100%; display: block;" @load="initCanvas" />
            <canvas ref="overlayCanvasRef"
                style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
                @mousedown="startDraw" @mousemove="drawing" @mouseup="endDraw"
                @touchstart="startDraw" @touchmove="drawing" @touchend="endDraw"
            ></canvas>
         </div>
         <div class="tips" style="padding: 10px; text-align: center; color: #666; font-size: 12px;">
            在图片上拖动框选文字，点击红框可删除
         </div>
      </div>
    </div>

    <!-- 步骤3: 确认与编辑 -->
    <div v-else-if="step === 3" class="saving-step">
      <van-sticky>
        <div class="sticky-header">
          <div class="toolbar">
            <van-button size="small" @click="step = 2">返回</van-button>
            <span>确认信息</span>
            <van-button type="primary" size="small" @click="confirmSave" :loading="saving">
              完成
            </van-button>
          </div>

          <div class="batch-input card">
            <van-field
              v-model="batchText"
              label="批量填字"
              placeholder="按顺序输入汉字，自动填充下方"
              @update:model-value="handleBatchInput"
            />
            <div style="font-size: 12px; color: #999; padding: 0 16px 8px;">提示：识别出的字符顺序可能需要核对</div>
          </div>
        </div>
      </van-sticky>

      <div class="edit-list">
        <div v-for="item in selectedItems" :key="item.id" class="edit-item card">
          <div class="preview">
            <GridDisplay :size="80" :content="item.svgPath" :viewBox="item.svgViewBox" />
          </div>
          <div class="form">
            <van-field v-model="item.char" label="汉字" placeholder="请输入汉字" />
          </div>
        </div>
      </div>
    </div>

    <van-overlay :show="processing">
      <div class="loading-wrapper">
        <van-loading type="spinner" color="#fff" vertical>{{ processingText }}</van-loading>
      </div>
    </van-overlay>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, shallowRef, toRaw } from 'vue'
import { useRouter } from 'vue-router'
import ImageCapture from '@/components/ImageCapture.vue'
import GridDisplay from '@/components/GridDisplay.vue'
import { processImage, processRegion } from '@/services/opencv'
import { vectorizeImage } from '@/services/vectorize'
import { saveSample, currentUser } from '@/services/db'
import type { ExtractedCharacter, CharacterSample } from '@/types'
import { showToast, showConfirmDialog } from 'vant'
import { nextTick } from 'vue'

const router = useRouter()
const step = ref(1)
const processing = ref(false)
const processingText = ref('处理中...')
const saving = ref(false)
const extractedChars = shallowRef<ExtractedCharacter[]>([])
const selectedIds = ref<Set<string>>(new Set())
const batchText = ref('')
const isPublic = ref(false)
const originalImageUrl = ref('')
const isManualMode = ref(false)
const editorImageRef = ref<HTMLImageElement | null>(null)
const overlayCanvasRef = ref<HTMLCanvasElement | null>(null)

const captureMode = ref<'auto' | 'manual'>('auto')

// 临时存储待保存的数据
interface PendingSaveItem extends CharacterSample {
  tempId: string
}
const pendingSaveItems = ref<PendingSaveItem[]>([])

const handleCapture = async (file: File) => {
  processing.value = true
  processingText.value = '图像处理中...'
  try {
    const url = URL.createObjectURL(file)
    originalImageUrl.value = url
    const img = new Image()
    img.src = url
    await new Promise((resolve) => (img.onload = resolve))

    if (captureMode.value === 'auto') {
        isManualMode.value = false
        const results = await processImage(img)
        extractedChars.value = results.map((r, index) => ({
          id: `temp_${Date.now()}_${index}`,
          imageData: r.image,
          boundingBox: { x: r.x, y: r.y, width: r.width, height: r.height }
        }))
    } else {
        isManualMode.value = true
        extractedChars.value = []
        selectedIds.value.clear()
    }

    step.value = 2

    if (captureMode.value === 'manual') {
        nextTick(() => {
            initCanvas()
        })
    }
  } catch (error: any) {
    console.error(error)
    showToast(`图像处理失败: ${error.message || '未知错误'}`)
  } finally {
    processing.value = false
  }
}

const setCanvasRef = (el: any, item: ExtractedCharacter) => {
  if (el && item.imageData) {
    const ctx = (el as HTMLCanvasElement).getContext('2d')
    if (ctx) {
      // 调整canvas大小以适应图像比例，但保持在容器内
      // 这里简单处理，直接绘制并缩放
      // 实际上应该保持宽高比
      const canvas = el as HTMLCanvasElement
      const imgData = item.imageData
      canvas.width = imgData.width
      canvas.height = imgData.height
      ctx.putImageData(imgData, 0, 0)
    }
  }
}

const toggleSelect = (id: string) => {
  if (selectedIds.value.has(id)) {
    selectedIds.value.delete(id)
  } else {
    selectedIds.value.add(id)
  }
}

// --- Manual Mode Logic ---
const isDrawing = ref(false)
const startPos = ref({ x: 0, y: 0 })
const currentBox = ref<{ x: number, y: number, w: number, h: number } | null>(null)

const enterManualMode = () => {
  showConfirmDialog({
    title: '手工模式',
    message: '进入手工模式将清空当前识别结果，由您重新框选。确定吗？',
  })
    .then(() => {
      extractedChars.value = []
      selectedIds.value.clear()
      isManualMode.value = true
      nextTick(() => {
        initCanvas()
      })
    })
    .catch(() => {
      // cancel
    })
}

const exitManualMode = () => {
  isManualMode.value = false
}

const initCanvas = () => {
  const img = editorImageRef.value
  const canvas = overlayCanvasRef.value
  if (!img || !canvas) return

  canvas.width = img.clientWidth
  canvas.height = img.clientHeight
  drawBoxes()
}

const getEventPos = (e: MouseEvent | TouchEvent) => {
  const canvas = overlayCanvasRef.value
  if (!canvas) return { x: 0, y: 0 }
  const rect = canvas.getBoundingClientRect()
  let clientX, clientY
  if ('touches' in e) {
    clientX = e.touches[0].clientX
    clientY = e.touches[0].clientY
  } else {
    clientX = (e as MouseEvent).clientX
    clientY = (e as MouseEvent).clientY
  }
  return {
    x: clientX - rect.left,
    y: clientY - rect.top
  }
}

const startDraw = (e: MouseEvent | TouchEvent) => {
  e.preventDefault()
  const { x, y } = getEventPos(e)

  // Check if clicked on existing box to delete
  const img = editorImageRef.value
  if (img) {
      const scaleX = img.clientWidth / img.naturalWidth
      const scaleY = img.clientHeight / img.naturalHeight

      // Check in reverse order (topmost first)
      for (let i = extractedChars.value.length - 1; i >= 0; i--) {
          const char = extractedChars.value[i]
          const bx = char.boundingBox.x * scaleX
          const by = char.boundingBox.y * scaleY
          const bw = char.boundingBox.width * scaleX
          const bh = char.boundingBox.height * scaleY

          if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) {
              // Delete this box
              showConfirmDialog({
                  title: '删除',
                  message: '确定要删除这个选区吗？'
              }).then(() => {
                  const newChars = [...extractedChars.value]
                  newChars.splice(i, 1)
                  extractedChars.value = newChars
                  selectedIds.value.delete(char.id)
                  drawBoxes()
              }).catch(() => {})
              return
          }
      }
  }

  isDrawing.value = true
  startPos.value = { x, y }
  currentBox.value = { x, y, w: 0, h: 0 }
}

const drawing = (e: MouseEvent | TouchEvent) => {
  if (!isDrawing.value) return
  e.preventDefault()
  const { x, y } = getEventPos(e)

  const w = x - startPos.value.x
  const h = y - startPos.value.y

  currentBox.value = {
    x: w > 0 ? startPos.value.x : x,
    y: h > 0 ? startPos.value.y : y,
    w: Math.abs(w),
    h: Math.abs(h)
  }
  drawBoxes()
}

const endDraw = async (_e: MouseEvent | TouchEvent) => {
  if (!isDrawing.value) return
  isDrawing.value = false

  if (!currentBox.value || currentBox.value.w < 5 || currentBox.value.h < 5) {
      currentBox.value = null
      drawBoxes()
      return
  }

  // Convert to image coordinates
  const img = editorImageRef.value
  if (!img) return

  const scaleX = img.naturalWidth / img.clientWidth
  const scaleY = img.naturalHeight / img.clientHeight

  const realX = Math.floor(currentBox.value.x * scaleX)
  const realY = Math.floor(currentBox.value.y * scaleY)
  const realW = Math.floor(currentBox.value.w * scaleX)
  const realH = Math.floor(currentBox.value.h * scaleY)

  currentBox.value = null

  // Process region
  processing.value = true
  try {
      const imageData = await processRegion(img, realX, realY, realW, realH)

      const newChar: ExtractedCharacter = {
          id: `manual_${Date.now()}`,
          imageData: imageData,
          boundingBox: { x: realX, y: realY, width: realW, height: realH }
      }

      extractedChars.value = [...extractedChars.value, newChar]
      selectedIds.value.add(newChar.id) // Auto select
      drawBoxes()
  } catch (e: any) {
      showToast('处理选区失败: ' + e.message)
  } finally {
      processing.value = false
  }
}

const drawBoxes = () => {
  const canvas = overlayCanvasRef.value
  const img = editorImageRef.value
  if (!canvas || !img) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const scaleX = img.clientWidth / img.naturalWidth
  const scaleY = img.clientHeight / img.naturalHeight

  extractedChars.value.forEach(char => {
    const { x, y, width, height } = char.boundingBox
    ctx.strokeStyle = 'red'
    ctx.lineWidth = 2
    ctx.strokeRect(x * scaleX, y * scaleY, width * scaleX, height * scaleY)
  })

  if (isDrawing.value && currentBox.value) {
     ctx.strokeStyle = 'blue'
     ctx.lineWidth = 2
     const { x, y, w, h } = currentBox.value
     ctx.strokeRect(x, y, w, h)
  }
}

const selectedItems = computed(() => pendingSaveItems.value)

const handleBatchInput = (val: string) => {
  const chars = val.split('').filter(c => c.trim())
  pendingSaveItems.value.forEach((item, index) => {
    if (index < chars.length) {
      item.char = chars[index]
    } else {
      item.char = ''
    }
  })
}

const saveSelected = async () => {
  processing.value = true
  processingText.value = '正在处理...'
  try {
    // Filter selected chars first
    const selectedChars = extractedChars.value.filter(c => selectedIds.value.has(c.id))

    // Process in parallel
    const promises = selectedChars.map(async (char, index) => {
      // Update progress text occasionally
      if (index % 5 === 0) {
         processingText.value = `正在处理 ${index + 1}/${selectedChars.length}...`
      }

      // 1. Vectorize
      const { path, viewBox } = await vectorizeImage(char.imageData)

      return {
          tempId: char.id,
          id: crypto.randomUUID(),
          userId: currentUser.value?.id || '',
          visibility: 'private',
          char: '',
          svgPath: path,
          svgViewBox: viewBox,
          thumbnail: '',
          rating: 0,
          createdAt: Date.now(),
          tags: []
      } as PendingSaveItem
    })

    const items = await Promise.all(promises)

    pendingSaveItems.value = items
    batchText.value = ''
    step.value = 3
  } catch (error) {
    console.error(error)
    showToast('处理失败')
  } finally {
    processing.value = false
  }
}

const confirmSave = async () => {
  // 验证是否都输入了汉字
  if (pendingSaveItems.value.some(item => !item.char)) {
    showToast('请为所有字符输入对应的汉字')
    return
  }

  saving.value = true
  try {
    for (const item of pendingSaveItems.value) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { tempId, ...sample } = toRaw(item)
      // 确保 tags 是普通数组
      if (sample.tags) {
        sample.tags = [...sample.tags]
      }
      sample.visibility = isPublic.value ? 'public' : 'private'
      await saveSample(sample)
    }
    showToast('保存成功')
    router.push('/')
  } catch (error: any) {
    console.error(error)
    showToast('保存失败: ' + error.message)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.tips {
  margin-top: 20px;
  color: #666;
  font-size: 14px;
}

.tips ul {
  padding-left: 20px;
  margin-top: 8px;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.extracted-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 12px;
}

.extracted-item {
  position: relative;
  border: 2px solid #eee;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.extracted-item canvas {
  max-width: 100%;
  max-height: 100%;
}

.extracted-item.selected {
  border-color: var(--primary-color);
}

.checkbox {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: rgba(0,0,0,0.3);
  display: flex;
  align-items: center;
  justify-content: center;
}

.extracted-item.selected .checkbox {
  background: var(--primary-color);
}

.edit-item {
  display: flex;
  gap: 16px;
  align-items: center;
}

.form {
  flex: 1;
}

.loading-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.sticky-header {
  background-color: var(--bg-color);
  padding-bottom: 8px;
  /* 稍微增加一点上边距，避免紧贴顶部 */
  padding-top: 8px;
}

.sticky-header .batch-input {
  margin-bottom: 0; /* 覆盖原来的 margin-bottom */
}
</style>
