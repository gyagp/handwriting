<template>
  <div
    class="grid-display"
    :class="[`grid-${type}`]"
    :style="{ width: size + 'px', height: size + 'px' }"
  >
    <!-- 对角线 (仅米字格) -->
    <template v-if="type === 'mi'">
      <svg class="diagonal-1" viewBox="0 0 100 100" preserveAspectRatio="none">
        <line x1="0" y1="0" x2="100" y2="100" vector-effect="non-scaling-stroke" stroke="rgba(231, 76, 60, 0.3)" stroke-width="1" />
      </svg>
      <svg class="diagonal-2" viewBox="0 0 100 100" preserveAspectRatio="none">
        <line x1="100" y1="0" x2="0" y2="100" vector-effect="non-scaling-stroke" stroke="rgba(231, 76, 60, 0.3)" stroke-width="1" />
      </svg>
    </template>

    <!-- 内容区域 -->
    <div class="grid-content" v-if="content || $slots.default">
      <slot>
        <img v-if="isImage" :src="content" alt="character" />
        <svg v-else-if="isSvg" :viewBox="viewBox" class="character-svg">
          <path :d="content" fill="currentColor" />
        </svg>
        <span v-else class="text-content" :style="{ fontSize: size * 0.8 + 'px' }">{{ content }}</span>
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { GridType } from '@/types'

const props = defineProps<{
  type?: GridType
  size?: number
  content?: string
  viewBox?: string
}>()

const type = computed(() => props.type || 'mi')
const size = computed(() => props.size || 100)
const viewBox = computed(() => props.viewBox || '0 0 100 100')

const isImage = computed(() => {
  return props.content?.startsWith('data:image') || props.content?.startsWith('http') || props.content?.startsWith('blob')
})

const isSvg = computed(() => {
  // 简单的判断，如果不是图片且包含路径数据的特征（通常是M开头）
  return props.content && !isImage.value && props.content.length > 10 && /[MmLlHhVvCcSsQqTtAaZz]/.test(props.content)
})
</script>

<style scoped>
.grid-display {
  position: relative;
  box-sizing: border-box;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.grid-content {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}

.grid-content img {
  max-width: 90%;
  max-height: 90%;
  object-fit: contain;
}

.character-svg {
  width: 80%;
  height: 80%;
  color: #000;
}

.text-content {
  font-family: "KaiTi", "STKaiti", serif;
  line-height: 1;
}
</style>
