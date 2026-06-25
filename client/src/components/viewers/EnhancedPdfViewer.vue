<template>
  <div class="enhanced-pdf-viewer">
    <div class="pdf-toolbar">
      <div class="toolbar-group">
        <button class="tool-btn" @click="prevPage" :disabled="currentPage <= 1" :title="t('viewerEnhancedPdfViewer.prevPage')" :aria-label="t('viewerEnhancedPdfViewer.prevPage')">◀</button>
        <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
        <button class="tool-btn" @click="nextPage" :disabled="currentPage >= totalPages" :title="t('enhancedPdfViewer.nextPage')" :aria-label="t('enhancedPdfViewer.nextPage')">▶</button>
      </div>
      
      <div class="toolbar-group">
        <button class="tool-btn" @click="zoomOut" :disabled="scale <= 0.5" :title="t('viewerEnhancedPdfViewer.zoomOut')" :aria-label="t('viewerEnhancedPdfViewer.zoomOut')">−</button>
        <span class="scale-display">{{ Math.round(scale * 100) }}%</span>
        <button class="tool-btn" @click="zoomIn" :disabled="scale >= 3" :title="t('enhancedPdfViewer.zoomIn')" :aria-label="t('enhancedPdfViewer.zoomIn')">+</button>
      </div>
      
      <div class="toolbar-group search-group">
        <input
          type="text"
          v-model="searchQuery"
          :placeholder="t('enhancedPdfViewer.search')"
          class="search-input"
          @keyup.enter="search"
        >
        <button class="tool-btn" @click="search" :title="t('viewerEnhancedPdfViewer.search')" :aria-label="t('viewerEnhancedPdfViewer.search')">🔍</button>
        <span v-if="searchResults.length > 0" class="search-info">
          {{ currentSearchIndex + 1 }} / {{ searchResults.length }}
        </span>
      </div>
      
      <div class="toolbar-group">
        <button class="tool-btn" @click="toggleFullscreen" :title="t('enhancedPdfViewer.fullscreen')" :aria-label="t('viewerEnhancedPdfViewer.fullscreen')">⛶</button>
        <a :href="src" download class="tool-btn" :title="t('viewerEnhancedPdfViewer.download')">⬇</a>
      </div>
    </div>
    
    <div class="pdf-main">
      <div class="pdf-container" ref="containerRef">
        <div v-if="loading" class="loading-overlay">
          <div class="loading-spinner"></div>
          <span>{{ t('viewerEnhancedPdfViewer.loadingPdf') }}</span>
        </div>
        
        <div v-else-if="error" class="error-overlay">
          <span class="error-icon">⚠️</span>
          <span>{{ error }}</span>
          <button class="retry-btn" @click="loadPdf">{{ t('common.retry') }}</button>
        </div>
        
        <canvas
          v-show="!loading && !error"
          ref="canvasRef"
          class="pdf-canvas"
        ></canvas>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ref, watch } from 'vue'
import * as pdfjsLib from 'pdfjs-dist'

const { t } = useI18n()

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

const props = defineProps<{
  src: string
  title?: string
}>()

const emit = defineEmits<{
  (e: 'loaded', info: { pages: number; title: string }): void
  (e: 'error', error: Error): void
}>()

const containerRef = ref<HTMLElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)

const loading = ref(true)
const error = ref('')
const pdfDoc = ref<pdfjsLib.PDFDocumentProxy | null>(null)
const currentPage = ref(1)
const totalPages = ref(0)
const scale = ref(1.5)
const searchQuery = ref('')
const searchResults = ref<{ page: number; index: number }[]>([])
const currentSearchIndex = ref(0)

const loadPdf = async () => {
  loading.value = true
  error.value = ''
  
  try {
    const loadingTask = pdfjsLib.getDocument(props.src)
    pdfDoc.value = await loadingTask.promise
    totalPages.value = pdfDoc.value.numPages
    
    await renderPage(currentPage.value)
    
    loading.value = false
    emit('loaded', { pages: totalPages.value, title: props.title || '' })
  } catch (e) {
    loading.value = false
    error.value = t('viewerEnhancedPdfViewer.pdfLoadFailed')
    emit('error', e as Error)
  }
}

const renderPage = async (pageNum: number) => {
  if (!pdfDoc.value || !canvasRef.value) return
  
  const page = await pdfDoc.value.getPage(pageNum)
  const canvas = canvasRef.value
  const context = canvas.getContext('2d')
  
  if (!context) return
  
  const viewport = page.getViewport({ scale: scale.value })
  
  canvas.width = viewport.width
  canvas.height = viewport.height
  
  await page.render({
    canvasContext: context,
    viewport: viewport,
    canvas: canvas
  }).promise
}

const prevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
    renderPage(currentPage.value)
  }
}

const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
    renderPage(currentPage.value)
  }
}

const zoomIn = () => {
  scale.value = Math.min(3, scale.value + 0.25)
  renderPage(currentPage.value)
}

const zoomOut = () => {
  scale.value = Math.max(0.5, scale.value - 0.25)
  renderPage(currentPage.value)
}

const search = async () => {
  if (!searchQuery.value || !pdfDoc.value) return
  
  searchResults.value = []
  
  for (let i = 1; i <= totalPages.value; i++) {
    const page = await pdfDoc.value.getPage(i)
    const textContent = await page.getTextContent()
    const text = textContent.items
      .map((item) => ('str' in item ? item.str : '') || '')
      .join(' ')
    
    let index = text.toLowerCase().indexOf(searchQuery.value.toLowerCase())
    while (index !== -1) {
      searchResults.value.push({ page: i, index })
      index = text.toLowerCase().indexOf(searchQuery.value.toLowerCase(), index + 1)
    }
  }
  
  currentSearchIndex.value = 0
  if (searchResults.value.length > 0) {
    currentPage.value = searchResults.value[0].page
    renderPage(currentPage.value)
  }
}

const toggleFullscreen = () => {
  if (!document.fullscreenElement) {
    containerRef.value?.requestFullscreen()
  } else {
    document.exitFullscreen()
  }
}

watch(() => props.src, loadPdf, { immediate: true })
</script>

<style scoped>
.enhanced-pdf-viewer {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--el-fill-color-dark);
}

.pdf-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 16px;
  background: var(--el-fill-color);
  border-bottom: var(--unified-border-bottom);
  flex-shrink: 0;
  flex-wrap: wrap;
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.tool-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 32px;
  padding: 0 8px;
  border: none;
  background: transparent;
  border-radius: var(--global-border-radius);
  cursor: pointer;
  color: var(--el-text-color-primary);
  font-size: 14px;
  transition: all 0.2s;
  text-decoration: none;
}

.tool-btn:hover:not(:disabled) {
  background: var(--el-fill-color);
}

.tool-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  color: var(--el-text-color-primary);
  font-size: 13px;
}

.scale-display {
  min-width: 50px;
  text-align: center;
  color: var(--el-text-color-primary);
  font-size: 13px;
}

.search-input {
  width: 200px;
  padding: 6px 12px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
  font-size: 13px;
}

.search-info {
  color: var(--el-text-color-placeholder);
  font-size: 12px;
}

.pdf-main {
  flex: 1;
  overflow: hidden;
}

.pdf-container {
  width: 100%;
  height: 100%;
  overflow: auto;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 20px;
}

.pdf-canvas {
  display: block;
  }

.loading-overlay,
.error-overlay {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 40px;
  color: var(--el-text-color-primary);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--el-border-color);
  border-top-color: var(--el-color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-icon {
  font-size: 48px;
}

.retry-btn {
  padding: 10px 24px;
  background: var(--el-color-primary);
  color: var(--el-button-text-color);
  border: none;
  border-radius: var(--global-border-radius);
  cursor: pointer;
}
</style>
