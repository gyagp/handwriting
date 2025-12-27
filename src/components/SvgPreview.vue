<template>
  <div class="svg-preview" :style="{ width: size + 'px', height: size + 'px' }">
    <svg :viewBox="viewBox" width="100%" height="100%">
      <path :d="path" fill="currentColor" />
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  path: string
  viewBox?: string
  size?: number
}>()

const viewBox = computed(() => props.viewBox || '0 0 100 100')
const size = computed(() => props.size || 100)
</script>

<style scoped>
.svg-preview {
  display: inline-block;
  color: #000;
}
</style>
