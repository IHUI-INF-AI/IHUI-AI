import { ref, computed } from 'vue'

export interface WatermarkConfig {
  id: string
  type: 'text' | 'image'
  content: string
  imageUrl?: string
  fontSize: number
  fontFamily: string
  color: string
  opacity: number
  rotation: number
  position: 'center' | 'tile' | 'diagonal'
  pages: 'all' | number[]
  x: number
  y: number
  width?: number
  height?: number
  zIndex: number
}

export interface WatermarkPreset {
  id: string
  name: string
  config: Omit<WatermarkConfig, 'id'>
}

const STORAGE_KEY = 'pdf_watermarks'

const defaultPresets: WatermarkPreset[] = [
  {
    id: 'confidential',
    name: '机密',
    config: {
      type: 'text',
      content: '机密',
      fontSize: 72,
      fontFamily: 'Microsoft YaHei',
      color: 'var(--el-text-color-primary)',
      opacity: 0.3,
      rotation: -45,
      position: 'diagonal',
      pages: 'all',
      x: 0,
      y: 0,
      zIndex: 1
    }
  },
  {
    id: 'draft',
    name: '草稿',
    config: {
      type: 'text',
      content: '草稿',
      fontSize: 72,
      fontFamily: 'Microsoft YaHei',
      color: 'var(--el-text-color-primary)',
      opacity: 0.3,
      rotation: -45,
      position: 'diagonal',
      pages: 'all',
      x: 0,
      y: 0,
      zIndex: 1
    }
  },
  {
    id: 'sample',
    name: '样本',
    config: {
      type: 'text',
      content: '样本',
      fontSize: 72,
      fontFamily: 'Microsoft YaHei',
      color: 'var(--el-text-color-primary)',
      opacity: 0.3,
      rotation: -45,
      position: 'diagonal',
      pages: 'all',
      x: 0,
      y: 0,
      zIndex: 1
    }
  },
  {
    id: 'copy',
    name: '复印件',
    config: {
      type: 'text',
      content: '复印件',
      fontSize: 60,
      fontFamily: 'Microsoft YaHei',
      color: 'var(--color-gray-666)',
      opacity: 0.25,
      rotation: -45,
      position: 'diagonal',
      pages: 'all',
      x: 0,
      y: 0,
      zIndex: 1
    }
  }
]

const generateId = () => `wm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

export const usePdfWatermark = () => {
  const watermarks = ref<WatermarkConfig[]>([])
  const presets = ref<WatermarkPreset[]>(defaultPresets)
  const selectedWatermarkId = ref<string | null>(null)
  const previewWatermark = ref<WatermarkConfig | null>(null)

  const hasWatermarks = computed(() => watermarks.value.length > 0)

  const selectedWatermark = computed(() =>
    watermarks.value.find(w => w.id === selectedWatermarkId.value) || null
  )

  const loadWatermarks = (docId: string) => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_${docId}`)
      if (saved) {
        watermarks.value = JSON.parse(saved)
      }
    } catch {
      watermarks.value = []
    }
  }

  const saveWatermarks = (docId: string) => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_${docId}`, JSON.stringify(watermarks.value))
    } catch {
      // ignore
    }
  }

  const addWatermark = (config: Omit<WatermarkConfig, 'id'>) => {
    const watermark: WatermarkConfig = {
      ...config,
      id: generateId()
    }
    watermarks.value.push(watermark)
    return watermark
  }

  const updateWatermark = (id: string, updates: Partial<WatermarkConfig>) => {
    const index = watermarks.value.findIndex(w => w.id === id)
    if (index > -1) {
      watermarks.value[index] = {
        ...watermarks.value[index],
        ...updates
      }
    }
  }

  const deleteWatermark = (id: string) => {
    const index = watermarks.value.findIndex(w => w.id === id)
    if (index > -1) {
      watermarks.value.splice(index, 1)
    }
    if (selectedWatermarkId.value === id) {
      selectedWatermarkId.value = null
    }
  }

  const selectWatermark = (id: string | null) => {
    selectedWatermarkId.value = id
  }

  const applyPreset = (presetId: string) => {
    const preset = presets.value.find(p => p.id === presetId)
    if (preset) {
      return addWatermark(preset.config)
    }
    return null
  }

  const addCustomPreset = (name: string, config: Omit<WatermarkConfig, 'id'>) => {
    const preset: WatermarkPreset = {
      id: `custom_${generateId()}`,
      name,
      config
    }
    presets.value.push(preset)
    return preset
  }

  const deletePreset = (id: string) => {
    const index = presets.value.findIndex(p => p.id === id)
    if (index > -1 && !id.startsWith('preset_')) {
      presets.value.splice(index, 1)
    }
  }

  const setPreviewWatermark = (config: WatermarkConfig | null) => {
    previewWatermark.value = config
  }

  const createTextWatermark = (
    content: string,
    options: Partial<WatermarkConfig> = {}
  ) => {
    return addWatermark({
      type: 'text',
      content,
      fontSize: options.fontSize || 48,
      fontFamily: options.fontFamily || 'Microsoft YaHei',
      color: options.color || 'var(--el-text-color-primary)',
      opacity: options.opacity || 0.3,
      rotation: options.rotation ?? -45,
      position: options.position || 'diagonal',
      pages: options.pages || 'all',
      x: options.x || 0,
      y: options.y || 0,
      zIndex: options.zIndex || 1
    })
  }

  const createImageWatermark = (
    imageUrl: string,
    options: Partial<WatermarkConfig> = {}
  ) => {
    return addWatermark({
      type: 'image',
      content: '',
      imageUrl,
      opacity: options.opacity || 0.3,
      rotation: options.rotation ?? 0,
      position: options.position || 'center',
      pages: options.pages || 'all',
      x: options.x || 0,
      y: options.y || 0,
      width: options.width,
      height: options.height,
      zIndex: options.zIndex || 1,
      color: options.color || 'var(--el-text-color-primary)',
      fontSize: options.fontSize || 16,
      fontFamily: options.fontFamily || 'Arial'
    })
  }

  const getWatermarksForPage = (pageNumber: number) => {
    return watermarks.value.filter(w => {
      if (w.pages === 'all') return true
      if (Array.isArray(w.pages)) {
        return w.pages.includes(pageNumber)
      }
      return false
    })
  }

  const renderWatermarkToCanvas = (
    watermark: WatermarkConfig,
    canvasWidth: number,
    canvasHeight: number
  ): HTMLCanvasElement => {
    const canvas = document.createElement('canvas')
    canvas.width = canvasWidth
    canvas.height = canvasHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return canvas

    ctx.globalAlpha = watermark.opacity

    if (watermark.type === 'text') {
      ctx.font = `${watermark.fontSize}px ${watermark.fontFamily}`
      ctx.fillStyle = watermark.color
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      const centerX = canvasWidth / 2
      const centerY = canvasHeight / 2

      if (watermark.position === 'diagonal') {
        ctx.save()
        ctx.translate(centerX, centerY)
        ctx.rotate((watermark.rotation * Math.PI) / 180)
        ctx.fillText(watermark.content, 0, 0)
        ctx.restore()
      } else if (watermark.position === 'tile') {
        const textWidth = ctx.measureText(watermark.content).width
        const spacingX = textWidth + 100
        const spacingY = watermark.fontSize * 3

        ctx.save()
        ctx.translate(centerX, centerY)
        ctx.rotate((watermark.rotation * Math.PI) / 180)

        for (let x = -canvasWidth; x < canvasWidth * 2; x += spacingX) {
          for (let y = -canvasHeight; y < canvasHeight * 2; y += spacingY) {
            ctx.fillText(watermark.content, x, y)
          }
        }
        ctx.restore()
      } else {
        ctx.fillText(watermark.content, centerX, centerY)
      }
    } else if (watermark.type === 'image' && watermark.imageUrl) {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.src = watermark.imageUrl

      const width = watermark.width || canvasWidth * 0.5
      const height = watermark.height || canvasHeight * 0.5
      const x = watermark.x || (canvasWidth - width) / 2
      const y = watermark.y || (canvasHeight - height) / 2

      ctx.save()
      if (watermark.rotation) {
        ctx.translate(canvasWidth / 2, canvasHeight / 2)
        ctx.rotate((watermark.rotation * Math.PI) / 180)
        ctx.translate(-canvasWidth / 2, -canvasHeight / 2)
      }
      ctx.drawImage(img, x, y, width, height)
      ctx.restore()
    }

    return canvas
  }

  const exportWatermarks = () => {
    return JSON.stringify({
      watermarks: watermarks.value,
      presets: presets.value.filter(p => p.id.startsWith('custom_')),
      exportedAt: new Date().toISOString()
    }, null, 2)
  }

  const importWatermarks = (json: string) => {
    try {
      const data = JSON.parse(json)
      if (Array.isArray(data.watermarks)) {
        watermarks.value = data.watermarks.map((w: { id?: string }) => ({
          ...w,
          id: w.id || generateId()
        }))
      }
      if (Array.isArray(data.presets)) {
        data.presets.forEach((p: WatermarkPreset) => {
          if (!presets.value.some(existing => existing.id === p.id)) {
            presets.value.push(p)
          }
        })
      }
      return true
    } catch {
      return false
    }
  }

  const clearAllWatermarks = () => {
    watermarks.value = []
    selectedWatermarkId.value = null
    previewWatermark.value = null
  }

  return {
    watermarks,
    presets,
    selectedWatermarkId,
    previewWatermark,
    hasWatermarks,
    selectedWatermark,
    loadWatermarks,
    saveWatermarks,
    addWatermark,
    updateWatermark,
    deleteWatermark,
    selectWatermark,
    applyPreset,
    addCustomPreset,
    deletePreset,
    setPreviewWatermark,
    createTextWatermark,
    createImageWatermark,
    getWatermarksForPage,
    renderWatermarkToCanvas,
    exportWatermarks,
    importWatermarks,
    clearAllWatermarks
  }
}
