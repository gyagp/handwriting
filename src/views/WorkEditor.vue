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
        <van-button type="primary" size="small">保存</van-button>
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
      </van-cell-group>

      <div class="preview-area" :class="work.layout">
        <div
          v-for="(char, index) in charList"
          :key="index"
          class="char-box"
          @click="openSelector(index, char)"
        >
          <GridDisplay
            :size="60"
            :content="getDisplayContent(index, char)"
            :viewBox="getDisplayViewBox(index)"
            :type="settings.gridType"
          />
          <!-- 如果没有收集该字，显示提示 -->
          <div v-if="!hasSample(char)" class="missing-mark"></div>
        </div>
      </div>
    </div>

    <!-- 选字弹窗 -->
    <van-action-sheet v-model:show="showSelector" :title="`选择 '${selectedChar}' 的样式`">
      <div class="selector-content">
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, toRaw } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getWork, saveWork, getSamplesByChar, getSettings } from '@/services/db'
import GridDisplay from '@/components/GridDisplay.vue'
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
  layout: 'horizontal',
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
}

const getDisplayContent = (index: number, char: string) => {
  const sampleId = work.value.charStyles[index]
  if (sampleId) {
    const samples = samplesCache.value[char]
    const sample = samples?.find(s => s.id === sampleId)
    if (sample) return sample.svgPath
  }

  // 如果没有指定样式，尝试使用最新的一个样本（默认）
  const samples = samplesCache.value[char]
  if (samples && samples.length > 0) {
    return samples[0].svgPath
  }

  return char
}

const getDisplayViewBox = (index: number) => {
  const char = charList.value[index]
  const sampleId = work.value.charStyles[index]
  let sample: CharacterSample | undefined

  if (sampleId) {
    sample = samplesCache.value[char]?.find(s => s.id === sampleId)
  } else {
    sample = samplesCache.value[char]?.[0]
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

const openSelector = (index: number, char: string) => {
  selectedIndex.value = index
  selectedChar.value = char
  showSelector.value = true
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
}

.preview-area.vertical {
  flex-direction: row-reverse;
  writing-mode: vertical-rl;
  height: 500px; /* 竖排需要固定高度或自动撑开 */
  overflow-x: auto;
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
