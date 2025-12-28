<template>
  <div class="work-editor container">
    <van-nav-bar
      :title="isEdit ? '编辑作品' : '新建作品'"
      left-text="返回"
      left-arrow
      @click-left="$router.back()"
      @click-right="save"
    >
      <template #right>
        <van-button type="primary" size="small" @click="save">保存</van-button>
        <van-button size="small" icon="replay" @click="refreshRandom" style="margin-left: 8px">随机</van-button>
      </template>
    </van-nav-bar>

    <div class="editor-content">
      <van-cell-group inset>
        <van-field v-model="work.title" label="标题" placeholder="请输入作品标题" />
        <van-field v-model="work.author" label="作者" placeholder="请输入作者姓名" />
        <van-field
          v-model="work.content"
          rows="3"
          autosize
          label="内容"
          type="textarea"
          placeholder="请输入诗词或文章内容"
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
      </van-cell-group>

      <div class="preview-area" :class="work.layout">
        <div
          v-for="(char, index) in charList"
          :key="index"
          class="char-box"
          @click="openSelector(index, char)"
        >
          <GridDisplay
            :size="40"
            :content="getDisplayContent(index, char)"
            :viewBox="getDisplayViewBox(index)"
            :type="work.gridType || settings.gridType"
          />
          <!-- 如果没有收集该字，显示提示 -->
          <div v-if="!hasSample(char)" class="missing-mark"></div>
        </div>
      </div>
    </div>

    <!-- 选字弹窗 -->
    <van-action-sheet v-model:show="showSelector" :title="`选择 '${selectedChar}' 的样式`">
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, toRaw } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getWork, saveWork, getSamplesByChar, getSettings, saveSample } from '@/services/db'
import GridDisplay from '@/components/GridDisplay.vue'
import CharacterAdjustmentDialog from '@/components/CharacterAdjustmentDialog.vue'
import type { Work, CharacterSample, AppSettings } from '@/types'
import { showToast } from 'vant'

const route = useRoute()
const router = useRouter()
const isEdit = computed(() => !!route.params.id)

const work = ref<Work>({
  id: crypto.randomUUID(),
  title: '',
  author: '',
  content: '',
  charStyles: {},
  charAdjustments: {},
  layout: 'horizontal',
  gridType: 'mi',
  createdAt: Date.now(),
  updatedAt: Date.now()
})

const settings = ref<AppSettings>({
  gridType: 'mi',
  gridSize: 100,
  autoRecognize: true,
  compressionLevel: 5,
  theme: 'light'
})

// 缓存已加载的样本，避免重复查询
const samplesCache = ref<Record<string, CharacterSample[]>>({})

const charList = computed(() => {
  return work.value.content.split('').filter(c => c.trim())
})

onMounted(async () => {
  const s = await getSettings()
  if (s) settings.value = s

  if (isEdit.value) {
    const w = await getWork(route.params.id as string)
    if (w) {
      work.value = w
      if (!work.value.gridType) {
        work.value.gridType = settings.value.gridType
      }
      // 预加载所有字符的样本
      preloadSamples(w.content)
    }
  }
})

const handleContentChange = (val: string) => {
  preloadSamples(val)
}

const preloadSamples = async (text: string) => {
  const chars = new Set(text.split('').filter(c => c.trim()))
  for (const char of chars) {
    if (!samplesCache.value[char]) {
      samplesCache.value[char] = await getSamplesByChar(char)
    }
  }
  // 随机分配样式
  randomizeStyles(text)
}

const randomizeStyles = (text: string) => {
  // 只有在新建作品或内容变化时，且没有手动指定样式时，才进行随机分配
  // 这里简单处理：如果某个位置没有指定样式，且该字有多个样本，则随机选择一个
  text.split('').forEach((char, index) => {
    if (!char.trim()) return

    // 如果该位置已经有样式了，跳过（保留用户选择）
    if (work.value.charStyles[index]) return

    const samples = samplesCache.value[char]
    if (samples && samples.length > 1) {
      const randomIndex = Math.floor(Math.random() * samples.length)
      work.value.charStyles[index] = samples[randomIndex].id
    }
  })
}

const getDisplayContent = (index: number, char: string) => {
  const sampleId = work.value.charStyles[index]
  if (sampleId) {
    const samples = samplesCache.value[char]
    const sample = samples?.find(s => s.id === sampleId)
    if (sample) return sample.svgPath
  }

  // 如果没有指定样式，尝试使用最新的一个样本（默认）
  // 修改逻辑：如果没有指定样式，且有样本，随机选一个（实际上在preloadSamples里已经分配了，这里是兜底）
  const samples = samplesCache.value[char]
  if (samples && samples.length > 0) {
    return samples[0].svgPath
  }

  return char
}

const getDisplayViewBox = (index: number) => {
  // 1. 优先使用作品特定的调整
  const adjustment = work.value.charAdjustments?.[index]
  if (adjustment) {
    const { scale, offsetX, offsetY } = adjustment
    const width = 100 / scale
    const height = 100 / scale
    const minX = 50 - offsetX - width / 2
    const minY = 50 - offsetY - height / 2
    return `${minX} ${minY} ${width} ${height}`
  }

  const char = charList.value[index]
  const sampleId = work.value.charStyles[index]
  let sample: CharacterSample | undefined

  if (sampleId) {
    sample = samplesCache.value[char]?.find(s => s.id === sampleId)
  } else {
    // 兜底
    const samples = samplesCache.value[char]
    if (samples && samples.length > 0) {
      sample = samples[0]
    }
  }

  return sample?.svgViewBox
}

const hasSample = (char: string) => {
  return samplesCache.value[char]?.length > 0
}

// 选字逻辑
const showSelector = ref(false)
const selectedIndex = ref(-1)
const selectedChar = ref('')
const currentSamples = computed(() => samplesCache.value[selectedChar.value] || [])

// 调整相关
const showAdjustment = ref(false)
const adjustmentInitialData = ref({ scale: 1.0, offsetX: 0, offsetY: 0, isAdjusted: false })

const openSelector = (index: number, char: string) => {
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
      const samples = samplesCache.value[selectedChar.value]
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
    const samples = samplesCache.value[selectedChar.value]
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

const refreshRandom = () => {
  work.value.charStyles = {} // 清空当前选择
  randomizeStyles(work.value.content)
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

  await saveWork(toRaw(work.value))
  showToast('保存成功')
  router.back()
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
  background-color: #ccc;
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
</style>
