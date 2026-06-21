<template>
  <div class="pdf-tools-panel">
    <div class="tools-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="tab-btn"
        :class="{ active: activeTab === tab.id }"
        @click="activeTab = tab.id"
      >
        <span class="tab-icon">{{ tab.icon }}</span>
        <span class="tab-label">{{ tab.label }}</span>
      </button>
    </div>

    <div class="tools-content">
      <div v-show="activeTab === 'signature'" class="tool-panel signature-panel">
        <div class="panel-header">
          <h3>{{ t('pdf.signature') }}</h3>
          <span class="badge">{{ signatures.length }}</span>
        </div>
        <div class="signature-draw">
          <canvas ref="signatureCanvasRef" class="signature-canvas" @mousedown="startDrawing" @mousemove="draw" @mouseup="stopDrawing" @mouseleave="stopDrawing"></canvas>
          <div class="signature-actions">
            <button @click="clearCanvas">{{ t('pdfTools.clear') }}</button>
            <button @click="undoStroke">{{ t('pdfTools.undo') }}</button>
          </div>
        </div>
        <div class="signature-info">
          <input v-model="signatureName" type="text" :placeholder="t('pdfTools.signerName')" class="input-field" />
          <input v-model="signatureReason" type="text" :placeholder="t('pdfTools.signReason')" class="input-field" />
          <input v-model="signatureLocation" type="text" :placeholder="t('pdfTools.signLocation')" class="input-field" />
        </div>
        <div class="signature-list">
          <div v-for="sig in signatures" :key="sig.id" class="signature-item" :class="{ selected: sig.id === selectedSignatureId }" @click="selectSignature(sig.id)">
            <div class="sig-info">
              <span class="sig-name">{{ sig.name }}</span>
              <span class="sig-date">{{ formatDate(sig.date) }}</span>
            </div>
            <div class="sig-status" :class="{ verified: sig.verified }">
              {{ sig.verified ? t('pdfTools.verified') : t('pdfTools.notVerified') }}
            </div>
            <button class="delete-btn" @click.stop="deleteSignature(sig.id)" aria-label="删除签名">×</button>
          </div>
        </div>
        <div class="panel-actions">
          <button class="primary-btn" @click="addSignatureToDocument">{{ t('pdfToolsPanel.addSignature') }}</button>
          <button @click="verifyAllSignatures">{{ t('pdfToolsPanel.verifyAll') }}</button>
        </div>
      </div>

      <div v-show="activeTab === 'watermark'" class="tool-panel watermark-panel">
        <div class="panel-header">
          <h3>{{ t('pdf.watermark') }}</h3>
          <span class="badge">{{ watermarks.length }}</span>
        </div>
        <div class="watermark-type">
          <button :class="{ active: watermarkType === 'text' }" @click="watermarkType = 'text'">{{ t('pdfTools.textWatermark') }}</button>
          <button :class="{ active: watermarkType === 'image' }" @click="watermarkType = 'image'">{{ t('pdfTools.imageWatermark') }}</button>
        </div>
        <div v-if="watermarkType === 'text'" class="text-watermark">
          <input v-model="watermarkText" type="text" :placeholder="t('pdfTools.watermarkTextPlaceholder')" class="input-field" />
          <div class="watermark-options">
            <div class="option-row">
              <label>{{ t('pdf.fontSize') }}</label>
              <input v-model.number="watermarkFontSize" type="range" min="12" max="120" />
              <span>{{ watermarkFontSize }}px</span>
            </div>
            <div class="option-row">
              <label>{{ t('pdf.opacity') }}</label>
              <input v-model.number="watermarkOpacity" type="range" min="0" max="100" />
              <span>{{ watermarkOpacity }}%</span>
            </div>
            <div class="option-row">
              <label>{{ t('pdf.rotation') }}</label>
              <input v-model.number="watermarkRotation" type="range" min="-90" max="90" />
              <span>{{ watermarkRotation }}°</span>
            </div>
            <div class="option-row">
              <label>{{ t('pdf.color') }}</label>
              <input v-model="watermarkColor" type="color" />
            </div>
          </div>
        </div>
        <div v-else class="image-watermark">
          <input type="file" accept="image/*" @change="handleWatermarkImage" ref="watermarkImageInput" />
          <div v-if="watermarkImageUrl" class="image-preview">
            <img :src="watermarkImageUrl" :alt="t('pdfTools.watermarkPreview')" />
          </div>
        </div>
        <div class="preset-watermarks">
          <h4>{{ t('pdfTools.presetWatermark') }}</h4>
          <div class="preset-list">
            <button v-for="preset in presets" :key="preset.id" @click="applyPreset(preset.id)">{{ preset.name }}</button>
          </div>
        </div>
        <div class="watermark-list">
          <div v-for="wm in watermarks" :key="wm.id" class="watermark-item" :class="{ selected: wm.id === selectedWatermarkId }" @click="selectWatermark(wm.id)">
            <span class="wm-type">{{ wm.type === 'text' ? t('pdfTools.text') : t('pdfTools.image') }}</span>
            <span class="wm-content">{{ wm.type === 'text' ? wm.content : t('pdfTools.imageWatermark') }}</span>
            <button class="delete-btn" @click.stop="deleteWatermark(wm.id)" aria-label="删除水印">×</button>
          </div>
        </div>
        <div class="panel-actions">
          <button class="primary-btn" @click="applyWatermark">{{ t('pdfToolsPanel.applyWatermark') }}</button>
          <button @click="clearAllWatermarks">{{ t('pdfToolsPanel.clearAll') }}</button>
        </div>
      </div>

      <div v-show="activeTab === 'merge'" class="tool-panel merge-panel">
        <div class="panel-header">
          <h3>{{ t('pdf.mergeSplit') }}</h3>
        </div>
        <div class="file-upload">
          <input type="file" accept=".pdf" multiple @change="handleFileUpload" ref="fileInput" />
          <div class="upload-area" @click="() => fileInput?.click()">
            <span class="upload-icon">📁</span>
            <span>{{ t('pdf.dropFileHere') }}</span>
          </div>
        </div>
        <div class="file-list">
          <div v-for="(file, index) in pdfFiles" :key="file.id" class="file-item" draggable="true" @dragstart="dragStart(index)" @dragover.prevent @drop="drop(index)">
            <img v-if="file.thumbnail" :src="file.thumbnail" class="file-thumbnail" :alt="file.name || '文件缩略图'" loading="lazy" />
            <div class="file-info">
              <span class="file-name">{{ file.name }}</span>
              <span class="file-pages">{{ file.pageCount }} {{ t('pdfToolsPanel.page') }} · {{ formatSize(file.size) }}</span>
            </div>
            <button class="delete-btn" @click="removeFile(file.id)" aria-label="删除文件">×</button>
          </div>
        </div>
        <div class="split-options" v-if="pdfFiles.length === 1">
          <h4>{{ t('pdfTools.splitOption') }}</h4>
          <div class="range-input">
            <input v-model="splitRange" type="text" :placeholder="t('pdfTools.pageRangePlaceholder')" />
          </div>
        </div>
        <div class="panel-actions">
          <button class="primary-btn" @click="mergeFiles" :disabled="pdfFiles.length < 2">{{ t('pdfTools.mergePdf') }}</button>
          <button @click="splitFile" :disabled="pdfFiles.length !== 1">{{ t('pdfTools.splitPdf') }}</button>
          <button @click="clearFiles">{{ t('pdfTools.clearList') }}</button>
        </div>
        <div v-if="isProcessing" class="progress-bar">
          <div class="progress-fill" :style="{ width: `${currentProgress}%` }"></div>
          <span>{{ currentProgress }}%</span>
        </div>
      </div>

      <div v-show="activeTab === 'print'" class="tool-panel print-panel">
        <div class="panel-header">
          <h3>{{ t('pdf.printSettings') }}</h3>
        </div>
        <div class="print-options">
          <div class="option-group">
            <label>{{ t('pdf.paperSize') }}</label>
            <select v-model="printSettings.paperSize">
              <option value="a4">A4</option>
              <option value="a3">A3</option>
              <option value="letter">Letter</option>
              <option value="legal">Legal</option>
            </select>
          </div>
          <div class="option-group">
            <label>{{ t('pdf.orientation') }}</label>
            <div class="radio-group">
              <label><input type="radio" v-model="printSettings.orientation" value="portrait" /> {{ t('pdfToolsPanel.portrait') }}</label>
              <label><input type="radio" v-model="printSettings.orientation" value="landscape" /> {{ t('pdfToolsPanel.landscape') }}</label>
            </div>
          </div>
          <div class="option-group">
            <label>{{ t('pdf.scale') }}</label>
            <select v-model="printSettings.scale">
              <option value="fit">{{ t('pdf.fitPage') }}</option>
              <option value="actual">{{ t('pdf.actualSize') }}</option>
              <option value="custom">{{ t('pdfTools.custom') }}</option>
            </select>
            <input v-if="printSettings.scale === 'custom'" v-model.number="printSettings.customScale" type="number" min="10" max="200" />
          </div>
          <div class="option-group">
            <label>{{ t('pdf.pageRange') }}</label>
            <select v-model="printSettings.pages">
              <option value="all">{{ t('pdfTools.allPages') }}</option>
              <option value="current">{{ t('pdfTools.currentPage') }}</option>
            </select>
          </div>
          <div class="option-group">
            <label>{{ t('pdf.copies') }}</label>
            <input v-model.number="printSettings.copies" type="number" min="1" max="99" />
          </div>
          <div class="option-group">
            <label>{{ t('pdf.duplex') }}</label>
            <input type="checkbox" v-model="printSettings.duplex" />
          </div>
          <div class="option-group">
            <label>{{ t('pdf.header') }}</label>
            <input v-model="printSettings.header" type="text" :placeholder="t('pdfTools.customHeader')" />
          </div>
          <div class="option-group">
            <label>{{ t('pdf.footer') }}</label>
            <input v-model="printSettings.footer" type="text" :placeholder="t('pdfTools.customFooter')" />
          </div>
          <div class="option-group">
            <label>{{ t('pdfTools.showPageNum') }}</label>
            <input type="checkbox" v-model="printSettings.showPageNumbers" />
          </div>
        </div>
        <div class="print-preview" v-if="printPreview">
          <img :src="printPreview.url" :alt="t('pdfTools.printPreview')" loading="lazy" />
        </div>
        <div class="panel-actions">
          <button class="primary-btn" @click="printDocument">{{ t('pdfToolsPanel.print') }}</button>
          <button @click="quickPrintDocument">{{ t('pdfToolsPanel.quickPrint') }}</button>
          <button @click="resetPrintSettings">{{ t('pdfToolsPanel.resetSettings') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">

import { useI18n } from 'vue-i18n'

const { t } = useI18n()
import { ref } from 'vue'
import { usePdfSignature, type Signature } from '@/composables/usePdfSignature'
import { usePdfWatermark, type WatermarkConfig } from '@/composables/usePdfWatermark'
import { usePdfMergeSplit } from '@/composables/usePdfMergeSplit'
import { usePdfPrint, type PrintSettings } from '@/composables/usePdfPrint'
import { formatTime } from '@/utils/format'

const emit = defineEmits<{
  (e: 'signatureAdded', signature: Signature): void
  (e: 'watermarkAdded', watermark: WatermarkConfig): void
  (e: 'mergeCompleted', url: string): void
  (e: 'splitCompleted', urls: string[]): void
  (e: 'printStarted', settings: PrintSettings): void
}>()

const tabs = [
  { id: 'signature', icon: '✍️', label: t('pdfTools.tabSignature') },
  { id: 'watermark', icon: '💧', label: t('pdfTools.tabWatermark') },
  { id: 'merge', icon: '📄', label: t('pdfTools.tabMerge') },
  { id: 'print', icon: '🖨️', label: t('pdfTools.tabPrint') }
]

const activeTab = ref('signature')

const {
  signatures,
  selectedSignatureId,
  signatureName,
  signatureReason,
  signatureLocation,
  addSignature,
  deleteSignature,
  selectSignature,
  verifyAllSignatures
} = usePdfSignature()

const {
  watermarks,
  presets,
  selectedWatermarkId,
  addWatermark: _addWatermark,
  deleteWatermark,
  selectWatermark,
  applyPreset,
  clearAllWatermarks,
  createTextWatermark,
  createImageWatermark
} = usePdfWatermark()

const {
  files: pdfFiles,
  isProcessing,
  currentProgress,
  addFiles,
  removeFile,
  clearFiles,
  mergePdfs,
  splitPdf
} = usePdfMergeSplit()

const {
  settings: printSettings,
  preview: printPreview,
  resetSettings: resetPrintSettings,
  generatePreview: _generatePreview,
  print: _print,
  quickPrint: _quickPrint
} = usePdfPrint()

const signatureCanvasRef = ref<HTMLCanvasElement | null>(null)
const isDrawingSignature = ref(false)
const signatureCtx = ref<CanvasRenderingContext2D | null>(null)
const signatureStrokes = ref<Array<Array<{ x: number; y: number }>>>([])
const currentStroke = ref<Array<{ x: number; y: number }>>([])

const watermarkType = ref<'text' | 'image'>('text')
const watermarkText = ref(t('pdfTools.confidential'))
const watermarkFontSize = ref(48)
const watermarkOpacity = ref(30)
const watermarkRotation = ref(-45)
const watermarkColor = ref('var(--el-text-color-placeholder)')
const watermarkImageUrl = ref('')
const watermarkImageInput = ref<HTMLInputElement | null>(null)

const fileInput = ref<HTMLInputElement | null>(null)
const splitRange = ref('')
const draggedIndex = ref<number | null>(null)

const formatDate = (dateStr: string) => formatTime(dateStr, 'YYYY-MM-DD')

const formatSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

const initSignatureCanvas = () => {
  if (!signatureCanvasRef.value) return
  const canvas = signatureCanvasRef.value
  canvas.width = 300
  canvas.height = 150
  signatureCtx.value = canvas.getContext('2d')
  if (signatureCtx.value) {
    signatureCtx.value.strokeStyle = 'var(--el-text-color-primary)'
    signatureCtx.value.lineWidth = 2
    signatureCtx.value.lineCap = 'round'
  }
}

const startDrawing = (e: MouseEvent) => {
  if (!signatureCanvasRef.value) return
  isDrawingSignature.value = true
  const rect = signatureCanvasRef.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  currentStroke.value = [{ x, y }]
  if (signatureCtx.value) {
    signatureCtx.value.beginPath()
    signatureCtx.value.moveTo(x, y)
  }
}

const draw = (e: MouseEvent) => {
  if (!isDrawingSignature.value || !signatureCtx.value || !signatureCanvasRef.value) return
  const rect = signatureCanvasRef.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  currentStroke.value.push({ x, y })
  signatureCtx.value.lineTo(x, y)
  signatureCtx.value.stroke()
}

const stopDrawing = () => {
  if (isDrawingSignature.value && currentStroke.value.length > 0) {
    signatureStrokes.value.push([...currentStroke.value])
  }
  isDrawingSignature.value = false
  currentStroke.value = []
}

const clearCanvas = () => {
  if (!signatureCanvasRef.value || !signatureCtx.value) return
  signatureCtx.value.clearRect(0, 0, signatureCanvasRef.value.width, signatureCanvasRef.value.height)
  signatureStrokes.value = []
}

const undoStroke = () => {
  if (signatureStrokes.value.length === 0 || !signatureCtx.value || !signatureCanvasRef.value) return
  signatureStrokes.value.pop()
  signatureCtx.value.clearRect(0, 0, signatureCanvasRef.value.width, signatureCanvasRef.value.height)
  signatureStrokes.value.forEach(stroke => {
    if (stroke.length === 0) return
    signatureCtx.value!.beginPath()
    signatureCtx.value!.moveTo(stroke[0].x, stroke[0].y)
    stroke.forEach(point => {
      signatureCtx.value!.lineTo(point.x, point.y)
    })
    signatureCtx.value!.stroke()
  })
}

const addSignatureToDocument = () => {
  if (!signatureCanvasRef.value || signatureStrokes.value.length === 0) return
  const imageData = signatureCanvasRef.value.toDataURL('image/png')
  const signature = addSignature({
    name: signatureName.value || t('pdfTools.unnamedSignature'),
    date: new Date().toISOString(),
    location: signatureLocation.value,
    reason: signatureReason.value,
    pageNumber: 1,
    x: 0,
    y: 0,
    width: 150,
    height: 75,
    imageData,
    verified: false
  })
  emit('signatureAdded', signature)
  clearCanvas()
}

const handleWatermarkImage = (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (event) => {
      watermarkImageUrl.value = event.target?.result as string
    }
    reader.readAsDataURL(file)
  }
}

const applyWatermark = () => {
  let watermark: WatermarkConfig | null = null
  if (watermarkType.value === 'text') {
    watermark = createTextWatermark(watermarkText.value, {
      fontSize: watermarkFontSize.value,
      opacity: watermarkOpacity.value / 100,
      rotation: watermarkRotation.value,
      color: watermarkColor.value
    })
  } else if (watermarkImageUrl.value) {
    watermark = createImageWatermark(watermarkImageUrl.value, {
      opacity: watermarkOpacity.value / 100
    })
  }
  if (watermark) {
    emit('watermarkAdded', watermark)
  }
}

const handleFileUpload = async (e: Event) => {
  const input = e.target as HTMLInputElement
  if (input.files) {
    await addFiles(input.files)
  }
}

const dragStart = (index: number) => {
  draggedIndex.value = index
}

const drop = (index: number) => {
  if (draggedIndex.value === null || draggedIndex.value === index) return
  const files = [...pdfFiles.value]
  const [draggedFile] = files.splice(draggedIndex.value, 1)
  files.splice(index, 0, draggedFile)
  draggedIndex.value = null
}

const mergeFiles = async () => {
  if (pdfFiles.value.length < 2) return
  const task = await mergePdfs(pdfFiles.value)
  if (task.resultUrl) {
    emit('mergeCompleted', task.resultUrl)
  }
}

const splitFile = async () => {
  if (pdfFiles.value.length !== 1 || !splitRange.value) return
  const ranges = parsePageRange(splitRange.value, pdfFiles.value[0].pageCount)
  if (ranges.length === 0) return
  const task = await splitPdf(pdfFiles.value[0], ranges)
  if (task.resultUrls) {
    emit('splitCompleted', task.resultUrls)
  }
}

const parsePageRange = (input: string, maxPages: number): Array<{ start: number; end: number }> => {
  const ranges: Array<{ start: number; end: number }> = []
  const parts = input.split(',').map(p => p.trim())
  
  for (const part of parts) {
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(n => parseInt(n.trim()))
      if (!isNaN(start) && !isNaN(end) && start <= end && start >= 1 && end <= maxPages) {
        ranges.push({ start, end })
      }
    } else {
      const page = parseInt(part)
      if (!isNaN(page) && page >= 1 && page <= maxPages) {
        ranges.push({ start: page, end: page })
      }
    }
  }
  
  return ranges
}

const printDocument = () => {
  emit('printStarted', printSettings.value)
}

const quickPrintDocument = () => {
  resetPrintSettings()
  emit('printStarted', printSettings.value)
}

defineExpose({
  initSignatureCanvas,
  activeTab
})
</script>

<style scoped>
.pdf-tools-panel {
  width: 320px;
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  box-shadow: var(--global-box-shadow);
  overflow: hidden;
}

.tools-tabs {
  display: flex;
  background: var(--color-neutral-f7f8fa);
  border-bottom: var(--unified-border-bottom);
}

.tab-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 8px;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn.active {
  background: var(--el-bg-color);
  color: var(--color-brand-blue-2);
}

.tab-icon {
  font-size: 20px;
  margin-bottom: 4px;
}

.tab-label {
  font-size: 12px;
}

.tools-content {
  padding: 16px;
  max-height: 500px;
  overflow-y: auto;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.panel-header h3 {
  margin: 0;
  font-size: 16px;
  color: var(--color-gray-1d2129);
}

.badge {
  padding: 2px 8px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  border-radius: var(--global-border-radius);
  font-size: 12px;
}

.signature-canvas {
  width: 100%;
  height: 150px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  cursor: crosshair;
}

.signature-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.signature-actions button {
  flex: 1;
  padding: 6px 12px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  background: var(--el-bg-color);
  cursor: pointer;
}

.signature-info {
  margin-top: 12px;
}

.input-field {
  width: 100%;
  padding: 8px 12px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  margin-bottom: 8px;
  font-size: 13px;
}

.signature-list,
.watermark-list,
.file-list {
  margin-top: 12px;
  max-height: 150px;
  overflow-y: auto;
}

.signature-item,
.watermark-item,
.file-item {
  display: flex;
  align-items: center;
  padding: 8px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  margin-bottom: 4px;
  cursor: pointer;
}

.signature-item.selected,
.watermark-item.selected {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.sig-info,
.file-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.sig-name,
.file-name {
  font-size: 13px;
  color: var(--color-gray-1d2129);
}

.sig-date,
.file-pages {
  font-size: 11px;
  color: var(--color-gray-86909c);
}

.sig-status {
  padding: 2px 6px;
  border-radius: var(--global-border-radius);
  font-size: 11px;
  background: var(--color-gray-f2f3f5);
  color: var(--color-gray-86909c);
}

.sig-status.verified {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
}

.delete-btn {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--color-gray-86909c);
  cursor: pointer;
  font-size: 16px;
}

.delete-btn:hover {
  color: var(--el-color-danger);
}

.panel-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.panel-actions button {
  flex: 1;
  padding: 8px 12px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  background: var(--el-bg-color);
  cursor: pointer;
}

.panel-actions button.primary-btn {
  background: var(--color-primary);
  color: var(--el-bg-color);
  border-color: var(--color-primary);
}

.primary-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.watermark-type {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.watermark-type button {
  flex: 1;
  padding: 8px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  background: var(--el-bg-color);
  cursor: pointer;
}

.watermark-type button.active {
  border-color: var(--color-brand-blue-2);
  color: var(--color-brand-blue-2);
}

.watermark-options {
  margin-top: 12px;
}

.option-row {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.option-row label {
  width: 70px;
  font-size: 12px;
  color: var(--color-gray-4e5969);
}

.option-row input[type="range"] {
  flex: 1;
  margin: 0 8px;
}

.option-row span {
  width: 50px;
  text-align: right;
  font-size: 12px;
  color: var(--color-gray-86909c);
}

.preset-watermarks {
  margin-top: 16px;
}

.preset-watermarks h4 {
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--color-gray-4e5969);
}

.preset-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.preset-list button {
  padding: 4px 12px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  background: var(--el-bg-color);
  cursor: pointer;
  font-size: 12px;
}

.preset-list button:hover {
  border-color: var(--color-brand-blue-2);
  color: var(--color-brand-blue-2);
}

.upload-area {
  border: 2px dashed var(--color-gray-e8e9eb);
  border-radius: var(--global-border-radius);
  padding: 24px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
}

.upload-area:hover {
  border-color: var(--color-brand-blue-2);
}

.upload-icon {
  font-size: 32px;
  display: block;
  margin-bottom: 8px;
}

.file-thumbnail {
  width: 40px;
  height: 50px;
  object-fit: cover;
  border-radius: var(--global-border-radius);
  margin-right: 8px;
}

.split-options {
  margin-top: 16px;
}

.split-options h4 {
  margin: 0 0 8px;
  font-size: 13px;
}

.range-input input {
  width: 100%;
  padding: 8px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
}

.progress-bar {
  position: relative;
  height: 24px;
  background: var(--color-gray-f2f3f5);
  border-radius: var(--global-border-radius);
  margin-top: 12px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--color-brand-blue-2);
  transition: width 0.3s;
}

.progress-bar span {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  font-size: 12px;
  color: var(--el-bg-color);
}

.print-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.option-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.option-group label {
  width: 80px;
  font-size: 12px;
  color: var(--color-gray-4e5969);
}

.option-group select,
.option-group input[type="text"],
.option-group input[type="number"] {
  flex: 1;
  padding: 6px 8px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  font-size: 12px;
}

.radio-group {
  display: flex;
  gap: 12px;
}

.radio-group label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
}

.print-preview {
  margin-top: 16px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  overflow: hidden;
}

.print-preview img {
  width: 100%;
  display: block;
}
</style>
