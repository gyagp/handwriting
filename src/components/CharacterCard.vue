<template>
  <div
    class="character-card"
    :class="{ 'is-complete': collected && (adjustedCount || 0) === (totalCount || 0) && (totalCount || 0) > 0 }"
    @click="$emit('click')"
  >
    <div class="card-header">
      <span class="pinyin">{{ info.pinyin || '&nbsp;' }}</span>
    </div>
    <div class="card-body">
      <GridDisplay
        :type="gridType"
        :size="sample ? 34 : 60"
        :content="info.char"
        class="kaiti-char"
      />
      <GridDisplay
        v-if="sample"
        :type="gridType"
        :size="34"
        :content="sample"
        :viewBox="sampleViewBox"
      />
    </div>
    <div class="card-footer">
      <span class="char-code">{{ info.code }}</span>
      <div class="status-icons">
        <span
          v-if="collected && totalCount"
          class="count-badge"
          :class="{ 'fully-adjusted': (adjustedCount || 0) === totalCount && totalCount > 0 }"
        >
          {{ adjustedCount || 0 }}/{{ totalCount }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CharacterInfo, GridType } from '@/types'
import GridDisplay from './GridDisplay.vue'

const props = defineProps<{
  info: CharacterInfo
  collected?: boolean
  sample?: string // 收集到的样本缩略图或SVG路径
  sampleViewBox?: string
  isAdjusted?: boolean
  totalCount?: number
  adjustedCount?: number
  gridType?: GridType
}>()

defineEmits(['click'])
</script>

<style scoped>
.character-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #fff;
  border-radius: 8px;
  padding: 8px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.1);
  cursor: pointer;
  transition: transform 0.2s;
}

.character-card.is-complete {
  background: #e8f5e9;
}

.character-card:active {
  transform: scale(0.98);
}

.card-header {
  width: 100%;
  text-align: center;
  margin-bottom: 4px;
}

.pinyin {
  font-size: 12px;
  color: #666;
}

.card-body {
  margin-bottom: 4px;
  display: flex;
  gap: 4px;
}

.kaiti-char :deep(.text-content) {
  font-family: "KaiTi", "STKaiti", "楷体", serif;
}

.card-footer {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 10px;
  color: #999;
}

.status-icons {
  display: flex;
  align-items: center;
}

.count-badge {
  font-size: 9px;
  color: #999;
  margin-right: 4px;
  background: #f5f5f5;
  padding: 1px 4px;
  border-radius: 4px;
}

.count-badge.fully-adjusted {
  background: #e8f5e9; /* 浅绿色背景 */
  color: #07c160;      /* 绿色文字 */
}
</style>
