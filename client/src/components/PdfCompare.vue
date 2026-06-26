<template>
  <div class="pdf-compare">
    <div class="compare-toolbar">
      <div class="file-select">
        <label>
          <span>{{ t('pdfCompare.fileA') }}</span>
          <input type="file" accept=".pdf" @change="onFileASelect" ref="fileAInput" />
          <span class="file-name">{{ fileAName || t('pdfCompare.selectFile') }}</span>
        </label>
      </div>
      <div class="file-select">
        <label>
          <span>{{ t('pdfCompare.fileB') }}</span>
          <input type="file" accept=".pdf" @change="onFileBSelect" ref="fileBInput" />
          <span class="file-name">{{ fileBName || t('pdfCompare.selectFile') }}</span>
        </label>
      </div>
      <div class="compare-controls">
        <button class="compare-btn" @click="toggleViewMode" :title="viewMode === 'side' ? '切换到覆盖模式' : '切换到并排模式'">
          {{ viewMode === 'side' ? '覆盖模式' : '并排模式' }}
        </button>
        <button v-if="viewMode === 'overlay'" class="compare-btn slider-btn" @click="toggleSlider">
          {{ showSlider ? '隐藏滑块' : '显示滑块' }}
        </button>
        <div class="sync-controls">
          <label class="sync-label">
            <input type="checkbox" v-model="syncScroll" />
            <span>{{ t('cmpPdfCompare.syncScroll') }}</span>
          </label>
          <label class="sync-label">
            <input type="checkbox" v-model="syncZoom" />
            <span>{{ t('cmpPdfCompare.syncZoom') }}</span>
          </label>
        </div>
      </div>
    </div>
    
    <div class="compare-content" :class="viewMode">
      <div class="compare-panel" :class="{ 'with-slider': viewMode === 'overlay' && showSlider }">
        <div class="panel-header">
          <span class="panel-title">{{ fileAName || t('pdfCompare.fileA') }}</span>
          <span v-if="pageInfoA" class="page-info">{{ pageInfoA }}</span>
        </div>
        <div class="panel-content" ref="panelARef" @scroll="onPanelAScroll">
          <PdfViewer
            v-if="fileAUrl"
            ref="viewerARef"
            :src="fileAUrl"
            @pageChange="onPageAChange"
            @rendered="onViewerARendered"
          />
          <div v-else class="placeholder">
            <span>{{ t('cmpPdfCompare.selectPdfA') }}</span>
          </div>
        </div>
      </div>
      
      <div 
        v-if="viewMode === 'overlay' && showSlider"
        class="compare-slider"
        @mousedown="startSliderDrag"
        :style="{ left: sliderPosition + '%' }"
      >
        <div class="slider-handle"></div>
      </div>
      
      <div class="compare-panel">
        <div class="panel-header">
          <span class="panel-title">{{ fileBName || t('pdfCompare.fileB') }}</span>
          <span v-if="pageInfoB" class="page-info">{{ pageInfoB }}</span>
        </div>
        <div class="panel-content" ref="panelBRef" @scroll="onPanelBScroll">
          <PdfViewer
            v-if="fileBUrl"
            ref="viewerBRef"
            :src="fileBUrl"
            @pageChange="onPageBChange"
            @rendered="onViewerBRendered"
          />
          <div v-else class="placeholder">
            <span>{{ t('cmpPdfCompare.selectPdfB') }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { useI18n } from 'vue-i18n'
import PdfViewer from './PdfViewer.vue'

const { t } = useI18n()

const fileAInput = ref<HTMLInputElement | null>(null)
const fileBInput = ref<HTMLInputElement | null>(null)
const fileAUrl = ref('')
const fileBUrl = ref('')
const fileAName = ref('')
const fileBName = ref('')
const viewMode = ref<'side' | 'overlay'>('side')
const showSlider = ref(true)
const sliderPosition = ref(50)
const syncScroll = ref(true)
const syncZoom = ref(true)
const panelARef = ref<HTMLElement | null>(null)
const panelBRef = ref<HTMLElement | null>(null)
const viewerARef = ref<{ scrollToPage: (page: number) => void; currentPage: number; totalPages: number } | null>(null)
const viewerBRef = ref<{ scrollToPage: (page: number) => void; currentPage: number; totalPages: number } | null>(null)
const currentPageA = ref(1)
const currentPageB = ref(1)
const totalPagesA = ref(0)
const totalPagesB = ref(0)
const isDragging = ref(false)
const isScrollingA = ref(false)
const isScrollingB = ref(false)

const pageInfoA = computed(() => 
  totalPagesA.value > 0 ? `${currentPageA.value} / ${totalPagesA.value}` : ''
)

const pageInfoB = computed(() => 
  totalPagesB.value > 0 ? `${currentPageB.value} / ${totalPagesB.value}` : ''
)

const onFileASelect = (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    if (fileAUrl.value) {
      URL.revokeObjectURL(fileAUrl.value)
    }
    fileAUrl.value = URL.createObjectURL(file)
    fileAName.value = file.name
  }
}

const onFileBSelect = (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    if (fileBUrl.value) {
      URL.revokeObjectURL(fileBUrl.value)
    }
    fileBUrl.value = URL.createObjectURL(file)
    fileBName.value = file.name
  }
}

const toggleViewMode = () => {
  viewMode.value = viewMode.value === 'side' ? 'overlay' : 'side'
}

const toggleSlider = () => {
  showSlider.value = !showSlider.value
}

const startSliderDrag = (e: MouseEvent) => {
  e.preventDefault()
  isDragging.value = true
  document.addEventListener('mousemove', onSliderDrag)
  document.addEventListener('mouseup', stopSliderDrag)
}

// mousemove 节流 rAF ID
let sliderDragRafId: number | null = null

const onSliderDrag = (e: MouseEvent) => {
  if (sliderDragRafId !== null) return
  // rAF 是异步的，先把 clientX 存起来
  const clientX = e.clientX
  sliderDragRafId = requestAnimationFrame(() => {
    sliderDragRafId = null
    if (!isDragging.value || !panelARef.value?.parentElement) return

    const container = panelARef.value.parentElement
    const rect = container.getBoundingClientRect()
    const newPosition = ((clientX - rect.left) / rect.width) * 100
    sliderPosition.value = Math.max(10, Math.min(90, newPosition))
  })
}

const stopSliderDrag = () => {
  isDragging.value = false
  document.removeEventListener('mousemove', onSliderDrag)
  document.removeEventListener('mouseup', stopSliderDrag)
}

const onPanelAScroll = () => {
  if (!syncScroll.value || isScrollingB.value || !panelARef.value || !panelBRef.value) return
  
  isScrollingA.value = true
  const scrollRatio = panelARef.value.scrollTop / (panelARef.value.scrollHeight - panelARef.value.clientHeight)
  panelBRef.value.scrollTop = scrollRatio * (panelBRef.value.scrollHeight - panelBRef.value.clientHeight)
  
  setTimeout(() => {
    isScrollingA.value = false
  }, 50)
}

const onPanelBScroll = () => {
  if (!syncScroll.value || isScrollingA.value || !panelARef.value || !panelBRef.value) return
  
  isScrollingB.value = true
  const scrollRatio = panelBRef.value.scrollTop / (panelBRef.value.scrollHeight - panelBRef.value.clientHeight)
  panelARef.value.scrollTop = scrollRatio * (panelARef.value.scrollHeight - panelARef.value.clientHeight)
  
  setTimeout(() => {
    isScrollingB.value = false
  }, 50)
}

const onPageAChange = (page: number) => {
  currentPageA.value = page
  if (syncScroll.value && viewerBRef.value) {
    viewerBRef.value.scrollToPage(page)
  }
}

const onPageBChange = (page: number) => {
  currentPageB.value = page
  if (syncScroll.value && viewerARef.value) {
    viewerARef.value.scrollToPage(page)
  }
}

const onViewerARendered = () => {
  if (viewerARef.value) {
    totalPagesA.value = viewerARef.value.totalPages
  }
}

const onViewerBRendered = () => {
  if (viewerBRef.value) {
    totalPagesB.value = viewerBRef.value.totalPages
  }
}

watch(syncZoom, (newVal) => {
  if (newVal && viewerARef.value && viewerBRef.value) {
    // 同步缩放逻辑
  }
})

const cleanup = useCleanup()
cleanup.add(() => {
  if (fileAUrl.value) {
    URL.revokeObjectURL(fileAUrl.value)
  }
  if (fileBUrl.value) {
    URL.revokeObjectURL(fileBUrl.value)
  }
  if (sliderDragRafId !== null) {
    cancelAnimationFrame(sliderDragRafId)
    sliderDragRafId = null
  }
  if (isDragging.value) stopSliderDrag()
})
</script>

<style scoped>
.pdf-compare {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-gray-f5f6f7);
}

.compare-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  background: var(--el-bg-color);
  border-bottom: var(--unified-border-bottom);
  flex-wrap: wrap;
}

.file-select {
  display: flex;
  align-items: center;
}

.file-select label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.file-select input[type="file"] {
  display: none;
}

.file-select span:first-child {
  font-size: 13px;
  color: var(--color-gray-4e5969);
  font-weight: 500;
}

.file-name {
  padding: 4px 12px;
  background: var(--color-gray-f2f3f5);
  border-radius: var(--global-border-radius);
  font-size: 12px;
  color: var(--color-gray-1d2129);
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.compare-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
}

.compare-btn {
  padding: 6px 12px;
  background: var(--color-brand-blue-2);
  color: var(--el-bg-color);
  border: none;
  border-radius: var(--global-border-radius);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;
}

.compare-btn:hover {
  background: var(--el-color-primary);
}

.sync-controls {
  display: flex;
  gap: 12px;
}

.sync-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--color-gray-4e5969);
  cursor: pointer;
}

.sync-label input {
  accent-color: var(--color-brand-blue-2);
}

.compare-content {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
}

.compare-content.side .compare-panel {
  width: 50%;
  border-right: var(--unified-border);
}

.compare-content.overlay {
  position: relative;
}

.compare-content.overlay .compare-panel {
  position: absolute;
  inset: 0;
}

.compare-content.overlay .compare-panel:first-child {
  clip-path: inset(0 50% 0 0);
  z-index: var(--z-base);
}

.compare-content.overlay .compare-panel:last-child {
  z-index: var(--z-0);
}

.compare-content.overlay .compare-panel.with-slider:first-child {
  clip-path: inset(0 calc(100% - var(--slider-pos)) 0 0);
}

.compare-panel {
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--color-neutral-f7f8fa);
  border-bottom: var(--unified-border-bottom);
}

.panel-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-gray-1d2129);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.page-info {
  font-size: 12px;
  color: var(--color-gray-86909c);
  padding: 2px 8px;
  background: var(--color-gray-e8e9eb);
  border-radius: var(--global-border-radius);
}

.panel-content {
  flex: 1;
  overflow: auto;
  position: relative;
}

.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-gray-86909c);
  font-size: 14px;
}

.compare-slider {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 4px;
  background: var(--color-brand-blue-2);
  cursor: ew-resize;
  z-index: var(--z-header);
  transform: translateX(-50%);
}

.slider-handle {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 20px;
  height: 40px;
  background: var(--color-brand-blue-2);
  border-radius: var(--global-border-radius);
  display: flex;
  align-items: center;
  justify-content: center;
}

.slider-handle::before,
.slider-handle::after {
  content: '';
  width: 2px;
  height: 12px;
  background: var(--el-bg-color);
  margin: 0 2px;
  border-radius: var(--global-border-radius);
}

@media (width <= 768px) {
  .compare-toolbar {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .compare-controls {
    margin-left: 0;
    width: 100%;
    justify-content: space-between;
  }
  
  .compare-content.side {
    flex-direction: column;
  }
  
  .compare-content.side .compare-panel {
    width: 100%;
    height: 50%;
    border-right: none;
    border-bottom: var(--unified-border-bottom);
  }
}
</style>
