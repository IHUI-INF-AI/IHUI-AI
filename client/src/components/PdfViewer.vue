<template>
  <div class="pdf-viewer" ref="viewerRef" @touchstart="onTouchStart" @touchmove="onTouchMove" @touchend="onTouchEnd">
    <div ref="containerRef" class="pdf-container">
      <div
        v-for="page in totalPages"
        :key="page"
        :ref="(el: Element | null) => setPageRef(page, el as HTMLDivElement)"
        class="pdf-page"
        :data-page="page"
      >
        <canvas
          :ref="(el: Element | null) => setCanvasRef(page, el as HTMLCanvasElement)"
          :style="getPageStyle(page)"
        ></canvas>
        <div
          :ref="(el: Element | null) => setHighlightLayerRef(page, el as HTMLDivElement)"
          class="highlight-layer"
        ></div>
        <div
          :ref="(el: Element | null) => setAnnotationLayerRef(page, el as HTMLDivElement)"
          class="annotation-layer"
          @mousedown="(e) => onAnnotationMouseDown(e, page)"
          @mousemove="(e) => onAnnotationMouseMove(e, page)"
          @mouseup="(e) => onAnnotationMouseUp(e, page)"
        >
          <div
            v-for="ann in pageAnnotations(page)"
            :key="ann.id"
            class="annotation"
            :class="[`annotation-${ann.type}`, { selected: ann.id === selectedAnnotationId }]"
            :style="getAnnotationStyle(ann)"
            @mousedown.stop="selectAnnotation(ann.id)"
            @dblclick.stop="editAnnotation(ann.id)"
          >
            <span v-if="ann.type === 'note'" class="note-icon">📝</span>
            <span v-if="ann.type === 'text' && ann.content" class="text-content">{{ ann.content }}</span>
          </div>
        </div>
        <div
          :ref="(el: Element | null) => setFormLayerRef(page, el as HTMLDivElement)"
          class="form-layer"
        >
          <div
            v-for="field in pageFormFields(page)"
            :key="field.id"
            class="form-field"
            :class="`form-field-${field.type}`"
            :style="getFieldStyle(field)"
          >
            <input
              v-if="field.type === 'text'"
              type="text"
              v-model="fieldValues[field.id]"
              :placeholder="field.name"
              class="form-input"
              @change="onFieldChange(field)"
            />
            <textarea
              v-else-if="field.type === 'textarea'"
              v-model="fieldValues[field.id]"
              :placeholder="field.name"
              class="form-textarea"
              @change="onFieldChange(field)"
            ></textarea>
            <input
              v-else-if="field.type === 'checkbox'"
              type="checkbox"
              v-model="fieldValues[field.id]"
              class="form-checkbox"
              @change="onFieldChange(field)"
            />
            <select
              v-else-if="field.type === 'select'"
              v-model="fieldValues[field.id]"
              class="form-select"
              @change="onFieldChange(field)"
            >
              <option v-for="opt in field.options" :key="opt" :value="opt">{{ opt }}</option>
            </select>
            <input
              v-else-if="field.type === 'radio'"
              type="radio"
              :name="field.name"
              :value="field.value"
              v-model="fieldValues[field.name]"
              class="form-radio"
              @change="onFieldChange(field)"
            />
          </div>
        </div>
        <div v-if="!renderedPages.has(page)" class="page-placeholder">
          <span class="page-number">{{ page }}</span>
        </div>
      </div>
    </div>
    <div v-if="editingAnnotation" class="annotation-editor" :style="editorStyle">
      <textarea v-model="editingContent" placeholder="输入注释内容..." @blur="saveEditingContent" @keydown.enter.ctrl="saveEditingContent"></textarea>
      <div class="editor-actions">
        <button @click="saveEditingContent">{{ t('common.save') }}</button>
        <button @click="cancelEditing">{{ t('common.cancel') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, computed, watch, onMounted, nextTick } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { useI18n } from 'vue-i18n'
import * as pdfjsLib from 'pdfjs-dist'
import { logger } from '@/utils/logger'
import type { Annotation } from '@/composables/usePdfAnnotations'

const { t } = useI18n()

type TouchListLike = {
  length: number
  [index: number]: { clientX: number; clientY: number }
}

const props = defineProps<{
  src: string
  annotationMode?: 'select' | 'highlight' | 'underline' | 'text' | 'note'
  annotationColor?: string
}>()

const emit = defineEmits<{
  (e: 'rendered'): void
  (e: 'error', error: Error): void
  (e: 'pageChange', page: number): void
  (e: 'thumbnailsReady', thumbnails: Map<number, string>): void
  (e: 'searchResults', results: { page: number; matches: { index: number; text: string }[] }[]): void
  (e: 'annotationCreated', annotation: Annotation): void
  (e: 'annotationUpdated', annotation: Annotation): void
  (e: 'annotationDeleted', id: string): void
  (e: 'annotationSelected', id: string | null): void
  (e: 'formFieldChange', field: FormField, value: any): void
  (e: 'formFieldsReady', fields: FormField[]): void
}>()

interface FormField {
  id: string
  name: string
  type: 'text' | 'textarea' | 'checkbox' | 'select' | 'radio'
  page: number
  x: number
  y: number
  width: number
  height: number
  value: string | boolean
  options?: string[]
  required?: boolean
}

const containerRef = ref<HTMLElement | null>(null)
const canvasRefs = ref<Record<number, HTMLCanvasElement>>({})
const pageRefs = ref<Record<number, HTMLDivElement>>({})
const pdfDoc = shallowRef<pdfjsLib.PDFDocumentProxy | null>(null)
const scale = ref(1.5)
const isDestroyed = ref(false)
const totalPages = ref(0)
const renderedPages = ref<Set<number>>(new Set())
const pageHeights = ref<Record<number, number>>({})
const observer = shallowRef<IntersectionObserver | null>(null)
const pendingRenders = ref<Set<number>>(new Set())
const currentPage = ref(1)
const thumbnails = ref<Map<number, string>>(new Map())
const thumbnailScale = 0.2
const pageTextContents = ref<Map<number, string>>(new Map())
const pageTextItems = ref<Map<number, { str: string; transform: number[]; width: number; height: number; x: number; y: number }[]>>(new Map())
const highlightLayerRefs = ref<Record<number, HTMLDivElement>>({})
const annotationLayerRefs = ref<Record<number, HTMLDivElement>>({})
const searchResults = ref<{ page: number; matches: { index: number; text: string; rect?: { x: number; y: number; width: number; height: number } }[] }[]>([])
const currentSearchIndex = ref(-1)
const pageCache = ref<Map<number, ImageData>>(new Map())
const maxCacheSize = 20
const visiblePages = ref<Set<number>>(new Set())
const annotations = ref<Annotation[]>([])
const selectedAnnotationId = ref<string | null>(null)
const isDrawingAnnotation = ref(false)
const drawStartPos = ref<{ x: number; y: number } | null>(null)
const editingAnnotation = ref<Annotation | null>(null)
const editingContent = ref('')
const editorStyle = ref<Record<string, string>>({})
const formLayerRefs = ref<Record<number, HTMLDivElement>>({})
const formFields = ref<FormField[]>([])
const fieldValues = ref<Record<string, unknown>>({})
const hasFormFields = computed(() => formFields.value.length > 0)
const viewerRef = ref<HTMLElement | null>(null)
const touchStartDistance = ref(0)
const touchStartScale = ref(1)
const isPinching = ref(false)

const hasTextContent = computed(() => {
  let totalLength = 0
  pageTextContents.value.forEach(text => {
    totalLength += text.length
  })
  return totalLength > 0
})

const setCanvasRef = (page: number, el: HTMLCanvasElement | null) => {
  if (el) {
    canvasRefs.value[page] = el
  }
}

const setPageRef = (page: number, el: HTMLDivElement | null) => {
  if (el) {
    pageRefs.value[page] = el
  }
}

const setHighlightLayerRef = (page: number, el: HTMLDivElement | null) => {
  if (el) {
    highlightLayerRefs.value[page] = el
  }
}

const setAnnotationLayerRef = (page: number, el: HTMLDivElement | null) => {
  if (el) {
    annotationLayerRefs.value[page] = el
  }
}

const pageAnnotations = (page: number) => annotations.value.filter(a => a.page === page)

const getAnnotationStyle = (ann: Annotation) => {
  const baseStyle: Record<string, string> = {
    left: `${ann.x}px`,
    top: `${ann.y}px`
  }
  
  if (ann.width) baseStyle.width = `${ann.width}px`
  if (ann.height) baseStyle.height = `${ann.height}px`
  
  if (ann.type === 'highlight') {
    baseStyle.backgroundColor = ann.color + '40'
    baseStyle.borderBottom = `2px solid ${ann.color}`
  } else if (ann.type === 'underline') {
    baseStyle.borderBottom = `3px solid ${ann.color}`
  } else if (ann.type === 'text' || ann.type === 'note') {
    baseStyle.backgroundColor = ann.color + '20'
    baseStyle.border = `1px solid ${ann.color}`
    baseStyle.borderRadius = '4px'
    if (!ann.width) baseStyle.minWidth = '20px'
    if (!ann.height) baseStyle.minHeight = '20px'
  }
  
  return baseStyle
}

const onAnnotationMouseDown = (e: MouseEvent, page: number) => {
  if (props.annotationMode === 'select') return
  
  const layer = annotationLayerRefs.value[page]
  if (!layer) return
  
  const rect = layer.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  
  isDrawingAnnotation.value = true
  drawStartPos.value = { x, y }
}

const onAnnotationMouseMove = (e: MouseEvent, page: number) => {
  if (!isDrawingAnnotation.value || !drawStartPos.value) return
  
  const layer = annotationLayerRefs.value[page]
  if (!layer) return
}

const onAnnotationMouseUp = (e: MouseEvent, page: number) => {
  if (!isDrawingAnnotation.value || !drawStartPos.value) return
  
  const layer = annotationLayerRefs.value[page]
  if (!layer) return
  
  const rect = layer.getBoundingClientRect()
  const endX = e.clientX - rect.left
  const endY = e.clientY - rect.top
  
  const x = Math.min(drawStartPos.value.x, endX)
  const y = Math.min(drawStartPos.value.y, endY)
  const width = Math.abs(endX - drawStartPos.value.x)
  const height = Math.abs(endY - drawStartPos.value.y)
  
  isDrawingAnnotation.value = false
  drawStartPos.value = null
  
  if (width < 5 && height < 5 && props.annotationMode !== 'text' && props.annotationMode !== 'note') return
  
  const id = `ann_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const annotation: Annotation = {
    id,
    type: props.annotationMode as 'highlight' | 'underline' | 'text' | 'note',
    page,
    x,
    y,
    width: width > 5 ? width : undefined,
    height: height > 5 ? height : undefined,
    color: props.annotationColor || 'var(--el-color-warning)',
    content: '',
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
  
  annotations.value.push(annotation)
  emit('annotationCreated', annotation)
  
  if (annotation.type === 'text' || annotation.type === 'note') {
    editingAnnotation.value = annotation
    editingContent.value = annotation.content || ''
    editorStyle.value = {
      left: `${annotation.x}px`,
      top: `${annotation.y + (annotation.height || 20)}px`,
      position: 'absolute'
    }
  }
}

const selectAnnotation = (id: string | null) => {
  selectedAnnotationId.value = id
  emit('annotationSelected', id)
}

const editAnnotation = (id: string) => {
  const ann = annotations.value.find(a => a.id === id)
  if (!ann || (ann.type !== 'text' && ann.type !== 'note')) return
  
  editingAnnotation.value = ann
  editingContent.value = ann.content || ''
  editorStyle.value = {
    left: `${ann.x}px`,
    top: `${ann.y + (ann.height || 20)}px`,
    position: 'absolute'
  }
}

const saveEditingContent = () => {
  if (!editingAnnotation.value) return
  
  const ann = annotations.value.find(a => a.id === editingAnnotation.value!.id)
  if (ann) {
    ann.content = editingContent.value
    ann.updatedAt = Date.now()
    emit('annotationUpdated', ann)
  }
  
  editingAnnotation.value = null
  editingContent.value = ''
}

const cancelEditing = () => {
  editingAnnotation.value = null
  editingContent.value = ''
}

const deleteAnnotation = (id: string) => {
  const index = annotations.value.findIndex(a => a.id === id)
  if (index > -1) {
    annotations.value.splice(index, 1)
    emit('annotationDeleted', id)
  }
  if (selectedAnnotationId.value === id) {
    selectedAnnotationId.value = null
  }
}

const setAnnotations = (anns: Annotation[]) => {
  annotations.value = anns
}

const getAnnotations = () => annotations.value

const setFormLayerRef = (page: number, el: HTMLDivElement | null) => {
  if (el) {
    formLayerRefs.value[page] = el
  }
}

const pageFormFields = (page: number) => formFields.value.filter(f => f.page === page)

const getFieldStyle = (field: FormField) => ({
  left: `${field.x}px`,
  top: `${field.y}px`,
  width: `${field.width}px`,
  height: `${field.height}px`
})

const onFieldChange = (field: FormField) => {
  emit('formFieldChange', field, fieldValues.value[field.id] || fieldValues.value[field.name])
}

const extractFormFields = async () => {
  if (!pdfDoc.value) return
  
  const fields: FormField[] = []
  
  try {
    for (let pageNum = 1; pageNum <= totalPages.value; pageNum++) {
      const page = await pdfDoc.value.getPage(pageNum)
      const viewport = page.getViewport({ scale: scale.value })
      
      const annotations = await page.getAnnotations()
      
      for (const annot of annotations) {
        if (annot.subtype === 'Widget' || annot.fieldType) {
          const rect = annot.rect
          if (!rect) continue
          
          const x = rect[0] * scale.value
          const y = viewport.height - rect[3] * scale.value
          const width = (rect[2] - rect[0]) * scale.value
          const height = (rect[3] - rect[1]) * scale.value
          
          let fieldType: FormField['type'] = 'text'
          let options: string[] | undefined
          
          if (annot.fieldType === 'Btn') {
            fieldType = annot.flags && annot.flags & 65536 ? 'radio' : 'checkbox'
          } else if (annot.fieldType === 'Ch') {
            fieldType = 'select'
            if (annot.options) {
              options = annot.options.map((o: { value: string }) => o.value)
            }
          } else if (annot.fieldType === 'Tx') {
            fieldType = annot.flags && annot.flags & 4096 ? 'textarea' : 'text'
          }
          
          const field: FormField = {
            id: annot.id || `field_${pageNum}_${fields.length}`,
            name: annot.fieldName || `field_${fields.length}`,
            type: fieldType,
            page: pageNum,
            x,
            y,
            width,
            height,
            value: annot.fieldValue || (fieldType === 'checkbox' ? false : ''),
            options,
            required: annot.required || false
          }
          
          fields.push(field)
          fieldValues.value[field.id] = field.value
        }
      }
    }
    
    formFields.value = fields
    emit('formFieldsReady', fields)
  } catch (error) {
    logger.error('Error extracting form fields:', error)
  }
}

const getFormValues = () => ({ ...fieldValues.value })

const setFormValues = (values: Record<string, unknown>) => {
  Object.assign(fieldValues.value, values)
}

const clearForm = () => {
  formFields.value.forEach(field => {
    fieldValues.value[field.id] = field.type === 'checkbox' ? false : ''
  })
}

const getTouchDistance = (touches: TouchListLike): number => {
  if (touches.length < 2) return 0
  const touch0 = touches[0]
  const touch1 = touches[1]
  if (!touch0 || !touch1) return 0
  const dx = touch0.clientX - touch1.clientX
  const dy = touch0.clientY - touch1.clientY
  return Math.sqrt(dx * dx + dy * dy)
}

const onTouchStart = (e: TouchEvent) => {
  if (e.touches.length === 2) {
    isPinching.value = true
    touchStartDistance.value = getTouchDistance(Array.from(e.touches) as unknown as TouchListLike)
    touchStartScale.value = scale.value
  }
}

const onTouchMove = (e: TouchEvent) => {
  if (isPinching.value && e.touches.length === 2) {
    const currentDistance = getTouchDistance(Array.from(e.touches) as unknown as TouchListLike)
    const newScale = touchStartScale.value * (currentDistance / touchStartDistance.value)
    scale.value = Math.max(0.5, Math.min(3, newScale))
  }
}

const onTouchEnd = () => {
  isPinching.value = false
}

const getPageStyle = (page: number) => {
  const height = pageHeights.value[page]
  if (height && !renderedPages.value.has(page)) {
    return { height: `${height}px` }
  }
  return {}
}

const initWorker = () => {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString()
}

const initObserver = () => {
  if (observer.value) {
    observer.value.disconnect()
  }
  
  observer.value = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const pageEl = entry.target as HTMLDivElement
        const pageNum = parseInt(pageEl.dataset.page || '0', 10)
        
        if (entry.isIntersecting && pageNum > 0) {
          visiblePages.value.add(pageNum)
          
          if (!renderedPages.value.has(pageNum) && !pendingRenders.value.has(pageNum)) {
            renderPage(pageNum)
          }
          
          if (entry.intersectionRatio > 0.5) {
            currentPage.value = pageNum
            emit('pageChange', pageNum)
          }
        } else {
          visiblePages.value.delete(pageNum)
        }
      })
      
      cleanupPageCache()
    },
    {
      root: null,
      rootMargin: '200px',
      threshold: [0, 0.5, 1]
    }
  )
}

const cleanupPageCache = () => {
  if (pageCache.value.size <= maxCacheSize) return
  
  const pagesToKeep = new Set(visiblePages.value)
  pagesToKeep.add(currentPage.value)
  
  for (let i = 1; i <= 3; i++) {
    pagesToKeep.add(currentPage.value - i)
    pagesToKeep.add(currentPage.value + i)
  }
  
  const keysToDelete: number[] = []
  pageCache.value.forEach((_, key) => {
    if (!pagesToKeep.has(key)) {
      keysToDelete.push(key)
    }
  })
  
  keysToDelete.forEach(key => {
    pageCache.value.delete(key)
    renderedPages.value.delete(key)
    const canvas = canvasRefs.value[key]
    if (canvas) {
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
    }
  })
}

const loadPdf = async (url: string) => {
  if (isDestroyed.value) return
  
  try {
    initWorker()
    
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const arrayBuffer = await response.arrayBuffer()
    
    if (isDestroyed.value) return
    
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      cMapUrl: 'https://unpkg.com/pdfjs-dist@5.4.624/cmaps/',
      cMapPacked: true,
    })
    
    loadingTask.onProgress = (progressData: { loaded: number; total: number }) => {
      if (progressData.total > 0) {
        const percent = Math.round((progressData.loaded / progressData.total) * 100)
        logger.info(`PDF loading: ${percent}%`)
      }
    }
    
    pdfDoc.value = await loadingTask.promise
    
    if (isDestroyed.value) return
    
    totalPages.value = pdfDoc.value.numPages
    
    await calculatePageHeights()
    
    await extractTextContent()
    
    await extractFormFields()
    
    generateThumbnails()
    
    await nextTick()
    
    initObserver()
    
    observeAllPages()
    
    if (!isDestroyed.value) {
      emit('rendered')
    }
  } catch (error) {
    if (!isDestroyed.value) {
      logger.error('PDF loading error:', error)
      emit('error', error as Error)
    }
  }
}

const calculatePageHeights = async () => {
  if (!pdfDoc.value) return
  
  for (let pageNum = 1; pageNum <= totalPages.value; pageNum++) {
    if (isDestroyed.value) return
    
    const page = await pdfDoc.value.getPage(pageNum)
    const viewport = page.getViewport({ scale: scale.value })
    pageHeights.value[pageNum] = viewport.height
  }
}

const extractTextContent = async () => {
  if (!pdfDoc.value) return
  
  for (let pageNum = 1; pageNum <= totalPages.value; pageNum++) {
    if (isDestroyed.value) return
    
    const page = await pdfDoc.value.getPage(pageNum)
    const viewport = page.getViewport({ scale: scale.value })
    const textContent = await page.getTextContent()
    
    const items: { str: string; transform: number[]; width: number; height: number; x: number; y: number }[] = []
    const textParts: string[] = []
    
    textContent.items.forEach(item => {
      if ('str' in item && (item as { str: string }).str.trim()) {
        const textItem = item as { str: string; transform: number[]; width: number; height: number }
        const tx = textItem.transform[4]
        const ty = textItem.transform[5]
        const flippedY = viewport.height - ty
        
        items.push({
          str: textItem.str,
          transform: textItem.transform,
          width: textItem.width,
          height: textItem.height,
          x: tx,
          y: flippedY
        })
        textParts.push(textItem.str)
      }
    })
    
    pageTextItems.value.set(pageNum, items)
    pageTextContents.value.set(pageNum, textParts.join(' '))
  }
}

const generateThumbnails = async () => {
  if (!pdfDoc.value) return
  
  for (let pageNum = 1; pageNum <= totalPages.value; pageNum++) {
    if (isDestroyed.value) return
    
    const page = await pdfDoc.value.getPage(pageNum)
    const viewport = page.getViewport({ scale: thumbnailScale })
    
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) continue
    
    canvas.width = viewport.width
    canvas.height = viewport.height
    
    await page.render({
      canvasContext: context,
      viewport: viewport,
      canvas: canvas
    }).promise
    
    thumbnails.value.set(pageNum, canvas.toDataURL('image/jpeg', 0.5))
  }
  
  if (!isDestroyed.value) {
    emit('thumbnailsReady', thumbnails.value)
  }
}

const searchText = async (
  query: string,
  options: { caseSensitive?: boolean; wholeWord?: boolean; useRegex?: boolean } = {}
) => {
  if (!query || query.trim() === '') {
    searchResults.value = []
    currentSearchIndex.value = -1
    clearHighlights()
    return []
  }
  
  const { caseSensitive = false, wholeWord = false, useRegex = false } = options
  const results: { page: number; matches: { index: number; text: string; rect?: { x: number; y: number; width: number; height: number } }[] }[] = []
  
  let searchPattern: RegExp
  if (useRegex) {
    try {
      searchPattern = new RegExp(query, caseSensitive ? 'g' : 'gi')
    } catch {
      return []
    }
  } else {
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = wholeWord ? `\\b${escapedQuery}\\b` : escapedQuery
    searchPattern = new RegExp(pattern, caseSensitive ? 'g' : 'gi')
  }
  
  pageTextContents.value.forEach((text, pageNum) => {
    const matches: { index: number; text: string; rect?: { x: number; y: number; width: number; height: number } }[] = []
    const textItems = pageTextItems.value.get(pageNum) || []
    
    let match
    while ((match = searchPattern.exec(text)) !== null) {
      const matchText = match[0]
      const rect = calculateMatchRect(textItems, match.index, matchText.length, pageNum)
      
      matches.push({
        index: match.index,
        text: matchText,
        rect
      })
    }
    
    if (matches.length > 0) {
      results.push({ page: pageNum, matches })
    }
  })
  
  searchResults.value = results
  currentSearchIndex.value = results.length > 0 ? 0 : -1
  
  if (results.length > 0) {
    highlightSearchResults()
    scrollToSearchResult(0)
  } else {
    clearHighlights()
  }
  
  emit('searchResults', results)
  return results
}

const calculateMatchRect = (
  textItems: { str: string; transform: number[]; width: number; height: number; x: number; y: number }[],
  charIndex: number,
  matchLength: number,
  _pageNum: number
): { x: number; y: number; width: number; height: number } | undefined => {
  let currentIndex = 0
  let startX = 0
  let startY = 0
  let endX = 0
  let height = 0
  let found = false
  
  for (const item of textItems) {
    const itemLength = item.str.length
    const itemEndIndex = currentIndex + itemLength
    
    if (currentIndex <= charIndex && charIndex < itemEndIndex) {
      const charOffset = charIndex - currentIndex
      const charWidth = item.width / itemLength
      startX = item.x + charOffset * charWidth
      startY = item.y - item.height
      height = item.height
      found = true
    }
    
    const matchEndIndex = charIndex + matchLength
    if (currentIndex < matchEndIndex && matchEndIndex <= itemEndIndex + 1) {
      const endOffset = Math.min(matchEndIndex - currentIndex, itemLength)
      const charWidth = item.width / itemLength
      endX = item.x + endOffset * charWidth
      if (!found) {
        startX = item.x
        startY = item.y - item.height
        height = item.height
      }
      break
    }
    
    currentIndex += itemLength + 1
  }
  
  if (endX <= startX) {
    endX = startX + 100
  }
  
  return { x: startX, y: startY, width: endX - startX, height: Math.max(height, 12) }
}

const highlightSearchResults = () => {
  clearHighlights()
  
  searchResults.value.forEach(({ page, matches }) => {
    const layer = highlightLayerRefs.value[page]
    if (!layer) return
    
    const canvas = canvasRefs.value[page]
    if (!canvas) return
    
    const scaleX = canvas.width / canvas.offsetWidth
    const scaleY = canvas.height / canvas.offsetHeight
    
    matches.forEach((match, idx) => {
      const highlight = document.createElement('div')
      highlight.className = 'search-highlight'
      highlight.dataset.matchIndex = String((searchResults.value.findIndex(r => r.page === page) * 100) + idx)
      
      if (match.rect) {
        highlight.style.left = `${match.rect.x / scaleX}px`
        highlight.style.top = `${match.rect.y / scaleY}px`
        highlight.style.width = `${match.rect.width / scaleX}px`
        highlight.style.height = `${match.rect.height / scaleY}px`
      }
      
      layer.appendChild(highlight)
    })
  })
}

const clearHighlights = () => {
  Object.values(highlightLayerRefs.value).forEach(layer => {
    layer.innerHTML = ''
  })
}

const scrollToSearchResult = (index: number) => {
  if (searchResults.value.length === 0) return
  
  let matchIndex = 0
  for (const result of searchResults.value) {
    if (matchIndex + result.matches.length > index) {
      const localIndex = index - matchIndex
      scrollToPage(result.page)
      currentSearchIndex.value = index
      highlightCurrentResult(result.page, localIndex)
      return
    }
    matchIndex += result.matches.length
  }
}

const highlightCurrentResult = (pageNum: number, localIndex: number) => {
  document.querySelectorAll('.search-highlight.current').forEach(el => {
    el.classList.remove('current')
  })
  
  const layer = highlightLayerRefs.value[pageNum]
  if (!layer) return
  
  const highlights = layer.querySelectorAll('.search-highlight')
  if (highlights[localIndex]) {
    highlights[localIndex].classList.add('current')
  }
}

const nextSearchResult = () => {
  if (searchResults.value.length === 0) return
  
  const totalMatches = searchResults.value.reduce((sum, r) => sum + r.matches.length, 0)
  const nextIndex = (currentSearchIndex.value + 1) % totalMatches
  scrollToSearchResult(nextIndex)
}

const prevSearchResult = () => {
  if (searchResults.value.length === 0) return
  
  const totalMatches = searchResults.value.reduce((sum, r) => sum + r.matches.length, 0)
  const prevIndex = currentSearchIndex.value <= 0 ? totalMatches - 1 : currentSearchIndex.value - 1
  scrollToSearchResult(prevIndex)
}

const observeAllPages = () => {
  if (!observer.value) return
  
  Object.values(pageRefs.value).forEach((pageEl) => {
    if (pageEl) {
      observer.value!.observe(pageEl)
    }
  })
}

const renderPage = async (pageNum: number) => {
  if (!pdfDoc.value || isDestroyed.value) return
  if (renderedPages.value.has(pageNum)) return
  if (pendingRenders.value.has(pageNum)) return
  
  pendingRenders.value.add(pageNum)
  
  try {
    const page = await pdfDoc.value.getPage(pageNum)
    const viewport = page.getViewport({ scale: scale.value })
    
    const canvas = canvasRefs.value[pageNum]
    if (!canvas) {
      pendingRenders.value.delete(pageNum)
      return
    }
    
    const context = canvas.getContext('2d')
    if (!context) {
      pendingRenders.value.delete(pageNum)
      return
    }
    
    canvas.height = viewport.height
    canvas.width = viewport.width
    
    await page.render({
      canvasContext: context,
      viewport: viewport,
      canvas: canvas
    }).promise
    
    renderedPages.value.add(pageNum)
  } catch (error) {
    logger.error(`Error rendering page ${pageNum}:`, error)
  } finally {
    pendingRenders.value.delete(pageNum)
  }
}

const scrollToPage = (pageNum: number) => {
  const pageEl = pageRefs.value[pageNum]
  if (pageEl && containerRef.value) {
    pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

defineExpose({
  scrollToPage,
  currentPage: computed(() => currentPage.value),
  totalPages: computed(() => totalPages.value),
  thumbnails: computed(() => thumbnails.value),
  getThumbnail: (pageNum: number) => thumbnails.value.get(pageNum),
  searchText,
  nextSearchResult,
  prevSearchResult,
  searchResults: computed(() => searchResults.value),
  currentSearchIndex: computed(() => currentSearchIndex.value),
  hasTextContent,
  getPageText: (pageNum: number) => pageTextContents.value.get(pageNum) || '',
  setAnnotations,
  getAnnotations,
  deleteAnnotation,
  selectAnnotation,
  hasFormFields,
  getFormValues,
  setFormValues,
  clearForm,
  formFields: computed(() => formFields.value)
})

watch(() => props.src, (newSrc) => {
  if (newSrc) {
    renderedPages.value = new Set()
    pendingRenders.value = new Set()
    pageHeights.value = {}
    totalPages.value = 0
    loadPdf(newSrc)
  }
}, { immediate: true })

const cleanup = useCleanup()
cleanup.add(() => {
  isDestroyed.value = true

  if (observer.value) {
    observer.value.disconnect()
    observer.value = null
  }

  if (pdfDoc.value) {
    try {
      pdfDoc.value.destroy()
    } catch (_e) {
      // 忽略销毁时的错误
    }
  }
  pdfDoc.value = null
})

onMounted(() => {
  if (props.src) {
    loadPdf(props.src)
  }
})
</script>

<style scoped>
.pdf-viewer {
  width: 100%;
  height: 100%;
  overflow: auto;
  background: var(--el-fill-color-dark);
}

.pdf-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  gap: 20px;
}

.pdf-page {
  background: var(--el-bg-color);
  position: relative;
  min-height: 100px;
}

.pdf-page canvas {
  display: block;
}

.page-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-neutral-100);
}

.page-number {
  font-size: 24px;
  color: var(--el-text-color-placeholder);
  font-weight: 700;
}

.highlight-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.search-highlight {
  position: absolute;
  background: color-mix(in srgb, var(--el-color-warning) 40%, transparent);
  border: 2px solid color-mix(in srgb, var(--el-color-warning) 80%, transparent);
  border-radius: var(--global-border-radius);
  transition: background-color 0.2s ease, border-color 0.2s ease, z-index 0.2s ease;
  mix-blend-mode: multiply;
}

.search-highlight.current {
  background: color-mix(in srgb, var(--el-color-warning) 50%, transparent);
  border: 2px solid var(--el-color-warning);
  z-index: calc(var(--z-base) + 9);
}

.annotation-layer {
  position: absolute;
  inset: 0;
  pointer-events: auto;
}

.annotation {
  position: absolute;
  cursor: pointer;
  transition: outline-color 0.2s ease, outline-width 0.2s ease, outline-offset 0.2s ease;
}

.annotation.selected {
  outline: 2px solid color-mix(in srgb, var(--el-color-primary) 30%, transparent);
  outline-offset: -1px;
}

.annotation-highlight {
  mix-blend-mode: multiply;
}

:where(html.dark) .search-highlight {
  mix-blend-mode: normal;
}

:where(html.dark) .annotation-highlight {
  mix-blend-mode: normal;
}

.annotation-underline {
  background: transparent;
}

.annotation-text {
  padding: 4px 8px;
  font-size: 12px;
  line-height: 1.4;
  min-width: 50px;
  min-height: 24px;
}

.annotation-note {
  padding: 4px;
  min-width: 24px;
  min-height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.note-icon {
  font-size: 14px;
}

.text-content {
  color: var(--el-text-color-primary);
  word-break: break-word;
}

.annotation-editor {
  position: absolute;
  background: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  box-shadow: var(--el-box-shadow);
  padding: 8px;
  z-index: var(--z-header);
  min-width: 200px;
}

.annotation-editor textarea {
  width: 100%;
  min-height: 60px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  padding: 8px;
  font-size: 13px;
  resize: vertical;
  outline: none;
}

.annotation-editor textarea:focus {
  border-color: var(--el-color-primary);
}

.editor-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}

.editor-actions button {
  padding: 4px 12px;
  border: none;
  border-radius: var(--global-border-radius);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.2s;
}

.editor-actions button:first-child {
  background: var(--el-color-primary);
  color: var(--el-button-text-color);
}

.editor-actions button:last-child {
  background: var(--el-fill-color-light);
  color: var(--el-text-color-secondary);
}

.editor-actions button:hover {
  opacity: 0.9;
}

.form-layer {
  position: absolute;
  inset: 0;
  pointer-events: auto;
}

.form-field {
  position: absolute;
}

.form-input,
.form-textarea,
.form-select {
  width: 100%;
  height: 100%;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  background: var(--el-bg-color);
  font-size: 12px;
  padding: 2px 4px;
  outline: none;
  box-sizing: border-box;
}

.form-input:focus,
.form-textarea:focus,
.form-select:focus {
  border-color: var(--el-color-primary);
  outline: 2px solid color-mix(in srgb, var(--el-color-primary) 20%, transparent);
  outline-offset: -1px;
}

.form-textarea {
  resize: none;
}

.form-checkbox,
.form-radio {
  width: 14px;
  height: 14px;
  cursor: pointer;
  accent-color: var(--el-color-primary);
}

.form-field-checkbox,
.form-field-radio {
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
