<template>
  <div class="doc-viewer">
    <div class="viewer-toolbar">
      <div class="toolbar-left">
        <span class="file-icon">{{ fileTypeInfo.icon }}</span>
        <span class="file-name">{{ displayTitle }}</span>
        <span class="file-type" :class="fileTypeInfo.category">{{ categoryLabel }}</span>
      </div>
      <div class="toolbar-right">
        <button v-if="fileType === 'pdf'" class="toolbar-btn" @click="toggleToolsPanel" :title="t('cmpDocViewer.pdfTools')" :aria-label="t('cmpDocViewer.pdfTools')" :class="{ active: showToolsPanel }">🔧</button>
        <button class="toolbar-btn" @click="zoomIn" :title="t('cmpDocViewer.zoomIn')" :aria-label="t('cmpDocViewer.zoomIn')">+</button>
        <span class="zoom-display">{{ Math.round(zoom * 100) }}%</span>
        <button class="toolbar-btn" @click="zoomOut" :title="t('cmpDocViewer.zoomOut')" :aria-label="t('cmpDocViewer.zoomOut')">−</button>
        <button class="toolbar-btn" @click="resetZoom" :title="t('cmpDocViewer.reset')" :aria-label="t('cmpDocViewer.reset')">⟲</button>
        <button class="toolbar-btn" @click="toggleFullscreen" :title="t('cmpDocViewer.fullscreen')" :aria-label="t('cmpDocViewer.fullscreen')">⛶</button>
        <a :href="documentUrl" :download="title" class="toolbar-btn download-btn" :title="t('cmpDocViewer.download')">⬇</a>
      </div>
    </div>
    
    <div class="viewer-main">
      <div class="document-container" ref="containerRef" :style="containerStyle">
        <div v-if="loading" class="loading-overlay">
          <div class="loading-spinner"></div>
          <span class="loading-text">{{ t('cmpDocViewer.loadingDoc') }}</span>
        </div>
        
        <div v-else-if="error" class="error-overlay">
          <span class="error-icon">⚠️</span>
          <span class="error-text">{{ error }}</span>
          <button class="retry-btn" @click="loadDocument">{{ t('common.retry') }}</button>
        </div>
        
        <template v-else>
          <UnifiedViewer
            v-if="fileType !== 'pdf'"
            :src="documentUrl"
            :title="title"
            @loaded="onDocumentLoaded"
            @error="onDocumentError"
          />
          
          <template v-else>
            <canvas ref="pdfCanvasRef" class="pdf-canvas"></canvas>
            <div class="pdf-controls" v-if="totalPages > 1">
              <button class="page-btn" @click="prevPage" :disabled="currentPage <= 1" :aria-label="t('cmpDocViewer.prevPage')">◀</button>
              <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
              <button class="page-btn" @click="nextPage" :disabled="currentPage >= totalPages" :aria-label="t('cmpDocViewer.nextPage')">▶</button>
            </div>
          </template>
        </template>
      </div>
      
      <transition name="slide">
        <div v-if="showToolsPanel && fileType === 'pdf'" class="tools-panel">
          <PdfToolsPanel
            @close="showToolsPanel = false"
            @signature-add="handleSignatureAdd"
            @watermark-add="handleWatermarkAdd"
            @merge="handleMerge"
            @print="handlePrint"
          />
        </div>
      </transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ref, computed, watch } from 'vue'
import * as pdfjsLib from 'pdfjs-dist'
import { getFileType, type FileCategory } from '@/utils/fileTypes'
import { UnifiedViewer } from '@/components/viewers'
import PdfToolsPanel from './PdfToolsPanel.vue'

const { t } = useI18n()

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'

const props = withDefaults(
  defineProps<{
    documentUrl?: string
    /** @deprecated 使用 document-url，与 documentUrl 二选一 */
    url?: string
    title?: string
  }>(),
  { documentUrl: '', url: '' }
)

/** 实际文档 URL：优先 documentUrl，兼容旧用法 url */
const documentUrl = computed(() => (props.documentUrl ?? props.url) || '')

const emit = defineEmits<{
  (e: 'loaded'): void
  (e: 'error', message: string): void
}>()

const containerRef = ref<HTMLElement | null>(null)
const pdfCanvasRef = ref<HTMLCanvasElement | null>(null)
const loading = ref(true)
const error = ref('')
const zoom = ref(1)
const currentPage = ref(1)
const totalPages = ref(0)
const showToolsPanel = ref(false)
const pdfDoc = ref<pdfjsLib.PDFDocumentProxy | null>(null)

const fileTypeInfo = computed(() => getFileType(props.title || documentUrl.value))

const fileType = computed(() => {
  const category = fileTypeInfo.value.category
  if (category === 'pdf') return 'pdf'
  return category
})

const displayTitle = computed(() => {
  return props.title || documentUrl.value.split('/').pop() || t('cmpDocViewer.defaultTitle')
})

const categoryLabel = computed(() => {
  const labels: Record<FileCategory, string> = {
    pdf: t('cmpDocViewer.categoryPdf'),
    document: t('cmpDocViewer.categoryDocument'),
    spreadsheet: t('cmpDocViewer.categorySpreadsheet'),
    presentation: t('cmpDocViewer.categoryPresentation'),
    image: t('cmpDocViewer.categoryImage'),
    video: t('cmpDocViewer.categoryVideo'),
    audio: t('cmpDocViewer.categoryAudio'),
    code: t('cmpDocViewer.categoryCode'),
    markdown: t('cmpDocViewer.categoryMarkdown'),
    text: t('cmpDocViewer.categoryText'),
    archive: t('cmpDocViewer.categoryArchive'),
    model3d: t('cmpDocViewer.categoryModel3d'),
    cad: t('cmpDocViewer.categoryCad'),
    unknown: t('cmpDocViewer.categoryUnknown')
  }
  return labels[fileTypeInfo.value.category]
})

const containerStyle = computed(() => ({
  transform: `scale(${zoom.value})`,
  transformOrigin: 'top center'
}))

const toggleToolsPanel = () => {
  showToolsPanel.value = !showToolsPanel.value
}

const zoomIn = () => {
  zoom.value = Math.min(3, zoom.value + 0.1)
}

const zoomOut = () => {
  zoom.value = Math.max(0.3, zoom.value - 0.1)
}

const resetZoom = () => {
  zoom.value = 1
}

const toggleFullscreen = () => {
  if (!document.fullscreenElement) {
    containerRef.value?.requestFullscreen()
  } else {
    document.exitFullscreen()
  }
}

const loadPdf = async () => {
  if (fileType.value !== 'pdf' || !documentUrl.value) return

  try {
    loading.value = true
    error.value = ''
    
    const loadingTask = pdfjsLib.getDocument(documentUrl.value)
    pdfDoc.value = await loadingTask.promise
    totalPages.value = pdfDoc.value.numPages
    
    await renderPage(currentPage.value)
    
    loading.value = false
    emit('loaded')
  } catch (_e) {
    loading.value = false
    error.value = t('cmpDocViewer.pdfLoadFailed')
    emit('error', error.value)
  }
}

const renderPage = async (pageNum: number) => {
  if (!pdfDoc.value || !pdfCanvasRef.value) return
  
  const page = await pdfDoc.value.getPage(pageNum)
  const canvas = pdfCanvasRef.value
  const context = canvas.getContext('2d')
  
  if (!context) return
  
  const viewport = page.getViewport({ scale: 1.5 * zoom.value })
  
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

const onDocumentLoaded = () => {
  loading.value = false
  emit('loaded')
}

const onDocumentError = (e: Error) => {
  loading.value = false
  error.value = e.message
  emit('error', e.message)
}

const handleSignatureAdd = (_signature: any) => {
  // 签名添加处理
}

const handleWatermarkAdd = (_watermark: any) => {
  // 水印添加处理
}

const handleMerge = (_files: any) => {
  // 文件合并处理
}

const handlePrint = (_settings: any) => {
  // 打印处理
}

watch(documentUrl, () => {
  if (fileType.value === 'pdf') {
    loadPdf()
  }
}, { immediate: true })

watch(zoom, () => {
  if (fileType.value === 'pdf' && pdfDoc.value) {
    renderPage(currentPage.value)
  }
})
</script>

<style scoped>
.doc-viewer {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--el-fill-color-light);
}

.viewer-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: var(--el-bg-color);
  border-bottom: var(--unified-border-bottom);
  flex-shrink: 0;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.file-icon {
  font-size: 20px;
}

.file-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-type {
  padding: 2px 8px;
  border-radius: var(--global-border-radius);
  font-size: 12px;
}

.file-type.pdf { background: var(--el-color-danger-light-9); color: var(--el-color-danger); }
.file-type.image { background: var(--el-color-danger-light-9); color: var(--el-color-danger); }
.file-type.video { background: var(--el-color-primary-light-9); color: var(--el-color-primary); }
.file-type.audio { background: var(--el-color-info-light-9); color: var(--el-color-info); }
.file-type.code { background: var(--el-color-warning-light-9); color: var(--el-color-warning); }
.file-type.document { background: var(--el-color-primary-light-9); color: var(--el-color-primary); }
.file-type.spreadsheet { background: var(--el-color-success-light-9); color: var(--el-color-success); }
.file-type.presentation { background: var(--el-color-warning-light-9); color: var(--el-color-warning); }

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: var(--global-border-radius);
  cursor: pointer;
  font-size: 14px;
  color: var(--el-text-color-secondary);
  transition: all 0.2s;
}

.toolbar-btn:hover {
  background: var(--el-fill-color-light);
}

.toolbar-btn.active {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.zoom-display {
  min-width: 50px;
  text-align: center;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.download-btn {
  text-decoration: none;
}

.viewer-main {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
}

.document-container {
  flex: 1;
  overflow: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
}

.loading-overlay,
.error-overlay {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  height: 100%;
  color: var(--el-text-color-secondary);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--el-border-color-lighter);
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
  font-size: 14px;
}

.pdf-canvas {
  max-width: 100%;
  box-shadow: var(--el-box-shadow-light);
}

.pdf-controls {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 16px;
  padding: 12px 24px;
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  box-shadow: var(--el-box-shadow-light);
}

.page-btn {
  width: 36px;
  height: 36px;
  border: none;
  background: var(--el-fill-color-light);
  border-radius: 50%;
  cursor: pointer;
  font-size: 16px;
  color: var(--el-text-color-secondary);
  transition: all 0.2s;
}

.page-btn:hover:not(:disabled) {
  background: var(--el-fill-color);
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

.tools-panel {
  width: 320px;
  background: var(--el-bg-color);
  border-left: var(--unified-border);
  overflow-y: auto;
  flex-shrink: 0;
}

.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
}

@media (width <= 768px) {
  .viewer-toolbar {
    flex-direction: column;
    gap: 8px;
    padding: 8px;
  }
  
  .toolbar-left,
  .toolbar-right {
    flex-wrap: wrap;
    justify-content: center;
  }
  
  .tools-panel {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 100%;
    max-width: 320px;
    z-index: calc(var(--z-base) + 9);
  }
}
</style>
