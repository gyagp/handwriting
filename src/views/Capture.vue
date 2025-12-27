<template>
  <div class="capture-page container">
    <h1 class="page-title">拍照集字</h1>

    <!-- 步骤1: 拍照/上传 -->
    <div v-if="step === 1">
      <ImageCapture @capture="handleCapture" />
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
        <span>检测到 {{ extractedChars.length }} 个字符</span>
        <van-button type="primary" size="small" @click="saveSelected" :disabled="selectedIds.size === 0">
          保存选中 ({{ selectedIds.size }})
        </van-button>
      </div>

      <div class="extracted-grid">
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
    </div>

    <!-- 步骤3: 确认与编辑 -->
    <div v-else-if="step === 3" class="saving-step">
      <div class="toolbar">
        <van-button size="small" @click="step = 2">返回</van-button>
        <span>确认信息</span>
        <van-button type="primary" size="small" @click="confirmSave" :loading="saving">
          完成
        </van-button>
      </div>

      <div class="batch-input card" style="margin-bottom: 16px;">
        <van-field
          v-model="batchText"
          label="批量填字"
          placeholder="按顺序输入汉字，自动填充下方"
          @update:model-value="handleBatchInput"
        />
        <div style="font-size: 12px; color: #999; padding: 0 16px 8px;">提示：识别出的字符顺序可能需要核对</div>
      </div>

      <div class="edit-list">
        <div v-for="(item, index) in selectedItems" :key="item.id" class="edit-item card">
          <div class="preview">
            <GridDisplay :size="80" :content="item.svgPath" :viewBox="item.svgViewBox" />
          </div>
          <div class="form">
            <van-field v-model="item.char" label="汉字" placeholder="请输入汉字" />
            <van-rate v-model="item.rating" :count="5" />
          </div>
        </div>
      </div>
    </div>

    <van-overlay :show="processing">
      <div class="loading-wrapper">
        <van-loading type="spinner" color="#fff" vertical>处理中...</van-loading>
      </div>
    </van-overlay>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, shallowRef, toRaw } from 'vue'
import { useRouter } from 'vue-router'
import ImageCapture from '@/components/ImageCapture.vue'
import GridDisplay from '@/components/GridDisplay.vue'
import { processImage } from '@/services/opencv'
import { vectorizeImage } from '@/services/vectorize'
import { saveSample } from '@/services/db'
import type { ExtractedCharacter, CharacterSample } from '@/types'
import { showToast } from 'vant'

const router = useRouter()
const step = ref(1)
const processing = ref(false)
const saving = ref(false)
const extractedChars = shallowRef<ExtractedCharacter[]>([])
const selectedIds = ref<Set<string>>(new Set())
const batchText = ref('')

// 临时存储待保存的数据
interface PendingSaveItem extends CharacterSample {
  tempId: string
}
const pendingSaveItems = ref<PendingSaveItem[]>([])

const handleCapture = async (file: File) => {
  processing.value = true
  try {
    const img = new Image()
    img.src = URL.createObjectURL(file)
    await new Promise((resolve) => (img.onload = resolve))

    const results = await processImage(img)

    extractedChars.value = results.map((r, index) => ({
      id: `temp_${Date.now()}_${index}`,
      imageData: r.image,
      boundingBox: { x: r.x, y: r.y, width: r.width, height: r.height }
    }))

    step.value = 2
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

const selectedItems = computed(() => pendingSaveItems.value)

const handleBatchInput = (val: string) => {
  const chars = val.split('').filter(c => c.trim())
  pendingSaveItems.value.forEach((item, index) => {
    if (index < chars.length) {
      item.char = chars[index]
    }
  })
}

const saveSelected = async () => {
  processing.value = true
  try {
    const items: PendingSaveItem[] = []

    for (const char of extractedChars.value) {
      if (selectedIds.value.has(char.id)) {
        // 矢量化
        const { path, viewBox } = await vectorizeImage(char.imageData)

        items.push({
          tempId: char.id,
          id: crypto.randomUUID(),
          char: '', // 待用户输入
          svgPath: path,
          svgViewBox: viewBox,
          thumbnail: '', // 可选：生成缩略图
          rating: 3,
          createdAt: Date.now(),
          tags: []
        })
      }
    }

    pendingSaveItems.value = items
    batchText.value = ''
    step.value = 3
  } catch (error) {
    console.error(error)
    showToast('矢量化失败')
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
      await saveSample(sample)
    }
    showToast('保存成功')
    router.push('/')
  } catch (error) {
    console.error(error)
    showToast('保存失败')
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
</style>
