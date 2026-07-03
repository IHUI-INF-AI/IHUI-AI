<template>
  <div class="image-viewer">
    <div class="image-container" ref="containerRef">
      <img
        ref="imageRef"
        :src="src"
        :alt="title || t('imageViewer.image')"
        class="preview-image"
        :style="imageStyle"
        @load="onLoad"
        @error="onError"
        @mousedown="onMouseDown"
        @mousemove="onMouseMove"
        @mouseup="onMouseUp"
        @mouseleave="onMouseUp"
        @dblclick="toggleFullscreen"
      />
    </div>
    
    <div class="image-toolbar">
      <button class="tool-btn" @click="zoomOut" :disabled="scale <= 0.1" title="缩小" aria-label="缩小">−</button>
      <span class="scale-display">{{ Math.round(scale * 100) }}%</span>
      <button class="tool-btn" @click="zoomIn" :disabled="scale >= 10" :title="t('imageViewer.zoomIn')" :aria-label="t('imageViewer.zoomIn')">+</button>
      <button class="tool-btn" @click="resetZoom" title="重置" aria-label="重置">⟲</button>
      <button class="tool-btn" @click="rotateLeft" title="左旋转" aria-label="左旋转">↺</button>
      <button class="tool-btn" @click="rotateRight" title="右旋转" aria-label="右旋转">↻</button>
      <button class="tool-btn" @click="fitToScreen" title="适应屏幕" aria-label="适应屏幕">⊡</button>
      <button class="tool-btn" @click="toggleFullscreen" title="全屏" aria-label="全屏">⛶</button>
      <a :href="src" download class="tool-btn download-btn" title="下载">⬇</a>
    </div>
    
    <div v-if="loading" class="loading-overlay">
      <div class="loading-spinner"></div>
      <span>{ t('viewerImageViewer.loading') }</span>
    </div>
    
    <div v-if="error" class="error-overlay">
      <span class="error-icon">⚠️</span>
      <span>{ t('viewerImageViewer.imageLoadFailed') }</span>
      <a :href="src" download class="download-link">{{ t('imageViewer.downloadToView') }}</a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ref, computed, onMounted } from 'vue'
import { useCleanup } from '@/composables/useCleanup'

const { t } = useI18n()
const _props = defineProps<{
  src: string
  title?: string
}>()

const emit = defineEmits<{
  (e: 'loaded'): void
  (e: 'error', error: Error): void
}>()

const containerRef = ref<HTMLElement | null>(null)
const imageRef = ref<HTMLImageElement | null>(null)
const loading = ref(true)
const error = ref(false)
const scale = ref(1)
const rotation = ref(0)
const translateX = ref(0)
const translateY = ref(0)
const isDragging = ref(false)
const dragStartX = ref(0)
const dragStartY = ref(0)
const dragStartTranslateX = ref(0)
const dragStartTranslateY = ref(0)

const imageStyle = computed(() => ({
  transform: `translate(${translateX.value}px, ${translateY.value}px) scale(${scale.value}) rotate(${rotation.value}deg)`,
  transition: isDragging.value ? 'none' : 'transform 0.2s ease'
}))

const onLoad = () => {
  loading.value = false
  error.value = false
  fitToScreen()
  emit('loaded')
}

const onError = () => {
  loading.value = false
  error.value = true
  emit('error', new Error('图片加载失败'))
}

const zoomIn = () => {
  scale.value = Math.min(10, scale.value * 1.2)
}

const zoomOut = () => {
  scale.value = Math.max(0.1, scale.value / 1.2)
}

const resetZoom = () => {
  scale.value = 1
  rotation.value = 0
  translateX.value = 0
  translateY.value = 0
}

const rotateLeft = () => {
  rotation.value -= 90
}

const rotateRight = () => {
  rotation.value += 90
}

const fitToScreen = () => {
  if (!containerRef.value || !imageRef.value) return
  
  const container = containerRef.value
  const img = imageRef.value
  
  const containerWidth = container.clientWidth
  const containerHeight = container.clientHeight
  const imgWidth = img.naturalWidth
  const imgHeight = img.naturalHeight
  
  const scaleX = containerWidth / imgWidth
  const scaleY = containerHeight / imgHeight
  
  scale.value = Math.min(scaleX, scaleY, 1) * 0.9
  translateX.value = 0
  translateY.value = 0
}

const toggleFullscreen = () => {
  if (!document.fullscreenElement) {
    containerRef.value?.requestFullscreen()
  } else {
    document.exitFullscreen()
  }
}

const onMouseDown = (e: MouseEvent) => {
  if (e.button !== 0) return
  isDragging.value = true
  dragStartX.value = e.clientX
  dragStartY.value = e.clientY
  dragStartTranslateX.value = translateX.value
  dragStartTranslateY.value = translateY.value
  e.preventDefault()
}

const onMouseMove = (e: MouseEvent) => {
  if (!isDragging.value) return
  
  const deltaX = e.clientX - dragStartX.value
  const deltaY = e.clientY - dragStartY.value
  
  translateX.value = dragStartTranslateX.value + deltaX
  translateY.value = dragStartTranslateY.value + deltaY
}

const onMouseUp = () => {
  isDragging.value = false
}

const handleKeydown = (e: KeyboardEvent) => {
  switch (e.key) {
    case '+':
    case '=':
      zoomIn()
      break
    case '-':
      zoomOut()
      break
    case '0':
      resetZoom()
      break
    case 'ArrowLeft':
      rotateLeft()
      break
    case 'ArrowRight':
      rotateRight()
      break
    case 'f':
    case 'F':
      toggleFullscreen()
      break
  }
}

const cleanup = useCleanup()

onMounted(() => {
  cleanup.addEventListener(document, 'keydown', handleKeydown)
})
</script>

<style scoped>
.image-viewer {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-dark-bg-3);
  position: relative;
}

.image-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: grab;
}

.image-container:active {
  cursor: grabbing;
}

.preview-image {
  max-width: none;
  max-height: none;
  user-select: none;
  -webkit-user-drag: none;
}

.image-toolbar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  background: var(--color-black-80);
  flex-shrink: 0;
}

.tool-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  background: var(--color-white-10);
  border-radius: var(--global-border-radius);
  cursor: pointer;
  color: var(--app-button-text-on-primary);
  font-size: 16px;
  transition: all 0.2s;
}

.tool-btn:hover:not(:disabled) {
  background: var(--color-white-20);
}

.tool-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.download-btn {
  text-decoration: none;
}

.scale-display {
  min-width: 60px;
  text-align: center;
  color: var(--app-button-text-on-primary);
  font-size: 14px;
}

.loading-overlay,
.error-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background: var(--color-black-90);
  color: var(--app-button-text-on-primary);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--color-white-20);
  border-top-color: var(--el-bg-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-icon {
  font-size: 48px;
}

.download-link {
  padding: 10px 24px;
  background: var(--color-brand-blue-2);
  border-radius: var(--global-border-radius);
  color: var(--app-button-text-on-primary);
  text-decoration: none;
  font-size: 14px;
  transition: background 0.2s;
}

.download-link:hover {
  background: var(--color-blue-245bdb);
}
</style>
