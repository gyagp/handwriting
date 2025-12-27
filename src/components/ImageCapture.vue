<template>
  <div class="image-capture">
    <div class="capture-area" @click="triggerInput" v-if="!previewImage">
      <van-icon name="photograph" size="40" color="#ccc" />
      <span class="tip">点击拍照或上传图片</span>
    </div>

    <div class="preview-area" v-else>
      <img :src="previewImage" alt="preview" />
      <div class="actions">
        <van-button icon="replay" size="small" @click="reset">重选</van-button>
        <van-button icon="revoke" size="small" @click="rotate(-90)">左转</van-button>
        <van-button icon="play" size="small" @click="rotate(90)" style="transform: rotate(90deg)">右转</van-button>
        <van-button type="primary" icon="success" size="small" @click="confirm">使用</van-button>
      </div>
    </div>

    <input
      type="file"
      ref="fileInput"
      accept="image/*"
      capture="environment"
      style="display: none"
      @change="handleFileChange"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits(['capture'])

const fileInput = ref<HTMLInputElement | null>(null)
const previewImage = ref<string | null>(null)
const selectedFile = ref<File | null>(null)

const triggerInput = () => {
  fileInput.value?.click()
}

const handleFileChange = (event: Event) => {
  const input = event.target as HTMLInputElement
  if (input.files && input.files[0]) {
    const file = input.files[0]
    selectedFile.value = file

    const reader = new FileReader()
    reader.onload = (e) => {
      previewImage.value = e.target?.result as string
    }
    reader.readAsDataURL(file)
  }
}

const reset = () => {
  previewImage.value = null
  selectedFile.value = null
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

const rotate = async (degree: number) => {
  if (!previewImage.value) return

  const img = new Image()
  img.src = previewImage.value
  await new Promise(resolve => img.onload = resolve)

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // 交换宽高（如果是90或270度）
  if (Math.abs(degree) % 180 !== 0) {
    canvas.width = img.height
    canvas.height = img.width
  } else {
    canvas.width = img.width
    canvas.height = img.height
  }

  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate(degree * Math.PI / 180)
  ctx.drawImage(img, -img.width / 2, -img.height / 2)

  const newDataUrl = canvas.toDataURL('image/jpeg', 0.9)
  previewImage.value = newDataUrl

  // 更新 selectedFile
  const blob = await (await fetch(newDataUrl)).blob()
  selectedFile.value = new File([blob], "rotated.jpg", { type: "image/jpeg" })
}

const confirm = () => {
  if (selectedFile.value) {
    emit('capture', selectedFile.value)
  }
}
</script>

<style scoped>
.image-capture {
  width: 100%;
  margin-bottom: 16px;
}

.capture-area {
  width: 100%;
  height: 200px;
  border: 2px dashed #ccc;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: #f9f9f9;
  cursor: pointer;
}

.tip {
  margin-top: 8px;
  color: #999;
  font-size: 14px;
}

.preview-area {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.preview-area img {
  max-width: 100%;
  max-height: 300px;
  border-radius: 8px;
  margin-bottom: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.actions {
  display: flex;
  gap: 16px;
}
</style>
