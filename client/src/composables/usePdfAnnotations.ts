import { ref, computed } from 'vue'

export interface Annotation {
  id: string
  type: 'highlight' | 'underline' | 'text' | 'note'
  page: number
  x: number
  y: number
  width?: number
  height?: number
  content?: string
  color: string
  createdAt: number
  updatedAt: number
}

export interface AnnotationState {
  annotations: Annotation[]
  selectedId: string | null
  mode: 'select' | 'highlight' | 'underline' | 'text' | 'note'
  color: string
}

const STORAGE_KEY = 'pdf_annotations'

const defaultColors = {
  highlight: 'var(--el-text-color-primary)',
  underline: 'var(--el-text-color-primary)',
  text: 'var(--el-text-color-primary)',
  note: 'var(--color-orange-ff9800)'
}

const generateId = () => `ann_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

export const usePdfAnnotations = () => {
  const annotations = ref<Annotation[]>([])
  const selectedId = ref<string | null>(null)
  const mode = ref<'select' | 'highlight' | 'underline' | 'text' | 'note'>('select')
  const color = ref<string>(defaultColors.highlight)
  const isDrawing = ref(false)
  const drawStart = ref<{ x: number; y: number } | null>(null)

  const selectedAnnotation = computed(() => 
    annotations.value.find(a => a.id === selectedId.value) || null
  )

  const pageAnnotations = computed(() => (page: number) => 
    annotations.value.filter(a => a.page === page)
  )

  const loadAnnotations = (docId: string) => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_${docId}`)
      if (saved) {
        annotations.value = JSON.parse(saved)
      }
    } catch {
      annotations.value = []
    }
  }

  const saveAnnotations = (docId: string) => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_${docId}`, JSON.stringify(annotations.value))
    } catch {
      // ignore
    }
  }

  const addAnnotation = (annotation: Omit<Annotation, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newAnnotation: Annotation = {
      ...annotation,
      id: generateId(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    annotations.value.push(newAnnotation)
    return newAnnotation
  }

  const updateAnnotation = (id: string, updates: Partial<Annotation>) => {
    const index = annotations.value.findIndex(a => a.id === id)
    if (index > -1) {
      annotations.value[index] = {
        ...annotations.value[index],
        ...updates,
        updatedAt: Date.now()
      }
    }
  }

  const deleteAnnotation = (id: string) => {
    const index = annotations.value.findIndex(a => a.id === id)
    if (index > -1) {
      annotations.value.splice(index, 1)
    }
    if (selectedId.value === id) {
      selectedId.value = null
    }
  }

  const selectAnnotation = (id: string | null) => {
    selectedId.value = id
  }

  const setMode = (newMode: 'select' | 'highlight' | 'underline' | 'text' | 'note') => {
    mode.value = newMode
    if (newMode !== 'select') {
      color.value = defaultColors[newMode]
    }
  }

  const setColor = (newColor: string) => {
    color.value = newColor
  }

  const clearAllAnnotations = () => {
    annotations.value = []
    selectedId.value = null
  }

  const exportAnnotations = () => {
    return JSON.stringify(annotations.value, null, 2)
  }

  const importAnnotations = (json: string) => {
    try {
      const imported = JSON.parse(json)
      if (Array.isArray(imported)) {
        annotations.value = imported.map(a => ({
          ...a,
          id: a.id || generateId(),
          createdAt: a.createdAt || Date.now(),
          updatedAt: Date.now()
        }))
        return true
      }
    } catch {
      return false
    }
    return false
  }

  const startDrawing = (x: number, y: number) => {
    isDrawing.value = true
    drawStart.value = { x, y }
  }

  const endDrawing = (page: number, endX: number, endY: number) => {
    if (!isDrawing.value || !drawStart.value) return null
    
    const startX = drawStart.value.x
    const startY = drawStart.value.y
    
    isDrawing.value = false
    drawStart.value = null

    if (mode.value === 'select') return null

    const annotation = addAnnotation({
      type: mode.value as 'highlight' | 'underline' | 'text' | 'note',
      page,
      x: Math.min(startX, endX),
      y: Math.min(startY, endY),
      width: Math.abs(endX - startX),
      height: Math.abs(endY - startY),
      color: color.value,
      content: mode.value === 'text' || mode.value === 'note' ? '' : undefined
    })

    return annotation
  }

  const cancelDrawing = () => {
    isDrawing.value = false
    drawStart.value = null
  }

  return {
    annotations,
    selectedId,
    mode,
    color,
    isDrawing,
    drawStart,
    selectedAnnotation,
    pageAnnotations,
    loadAnnotations,
    saveAnnotations,
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
    selectAnnotation,
    setMode,
    setColor,
    clearAllAnnotations,
    exportAnnotations,
    importAnnotations,
    startDrawing,
    endDrawing,
    cancelDrawing,
    defaultColors
  }
}
