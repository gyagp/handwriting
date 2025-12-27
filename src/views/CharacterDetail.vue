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
      <h3>我的收集 ({{ samples.length }})</h3>
      <div class="samples-list">
        <div
          v-for="sample in samples"
          :key="sample.id"
          class="sample-item"
          :class="{ active: currentSample?.id === sample.id }"
          @click="currentSample = sample"
        >
          <GridDisplay :size="60" :content="sample.svgPath" :viewBox="sample.svgViewBox" />
          <van-icon name="cross" class="delete-btn" @click.stop="handleDelete(sample)" />
        </div>

        <div class="add-btn" @click="$router.push('/capture')">
          <van-icon name="plus" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { getSamplesByChar, deleteSample, getSettings } from '@/services/db'
import { gb2312Level1Chars, getPinyin, getRadical, getStrokes, getGB2312Code } from '@/data/gb2312-generator'
import GridDisplay from '@/components/GridDisplay.vue'
import type { CharacterSample, AppSettings } from '@/types'
import { showDialog, showToast } from 'vant'

const props = defineProps<{
  char: string
}>()

const samples = ref<CharacterSample[]>([])
const currentSample = ref<CharacterSample | null>(null)
const settings = ref<AppSettings>({
  gridType: 'mi',
  gridSize: 100,
  autoRecognize: true,
  compressionLevel: 5,
  theme: 'light'
})

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
</style>
