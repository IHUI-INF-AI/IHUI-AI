import { ref, computed } from 'vue'

// 简单的 HTML 转义函数，防止用户输入的页眉页脚执行恶意代码
function escapeHtml(str: string): string {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c] as string))
}

export interface PrintSettings {
  paperSize: 'a4' | 'a3' | 'letter' | 'legal' | 'custom'
  customWidth: number
  customHeight: number
  orientation: 'portrait' | 'landscape'
  margins: {
    top: number
    right: number
    bottom: number
    left: number
  }
  scale: 'actual' | 'fit' | 'custom'
  customScale: number
  duplex: boolean
  color: 'color' | 'grayscale' | 'blackwhite'
  quality: 'draft' | 'normal' | 'high'
  pages: 'all' | 'current' | number[]
  copies: number
  collate: boolean
  pageOrder: 'normal' | 'reverse' | 'booklet'
  header: string
  footer: string
  showPageNumbers: boolean
  pageNumberFormat: 'page' | 'pageOfTotal'
  pageNumberPosition: 'left' | 'center' | 'right'
  background: boolean
}

export interface PrintPreview {
  url: string
  width: number
  height: number
  totalPages: number
  currentPage: number
}

export interface PrintJob {
  id: string
  status: 'pending' | 'previewing' | 'printing' | 'completed' | 'error'
  progress: number
  settings: PrintSettings
  error?: string
}

const defaultSettings: PrintSettings = {
  paperSize: 'a4',
  customWidth: 210,
  customHeight: 297,
  orientation: 'portrait',
  margins: {
    top: 10,
    right: 10,
    bottom: 10,
    left: 10
  },
  scale: 'fit',
  customScale: 100,
  duplex: false,
  color: 'color',
  quality: 'normal',
  pages: 'all',
  copies: 1,
  collate: true,
  pageOrder: 'normal',
  header: '',
  footer: '',
  showPageNumbers: true,
  pageNumberFormat: 'pageOfTotal',
  pageNumberPosition: 'center',
  background: false
}

const paperSizes: Record<string, { width: number; height: number }> = {
  a4: { width: 210, height: 297 },
  a3: { width: 297, height: 420 },
  letter: { width: 215.9, height: 279.4 },
  legal: { width: 215.9, height: 355.6 }
}

const generateId = () => `print_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

export const usePdfPrint = () => {
  const settings = ref<PrintSettings>({ ...defaultSettings })
  const preview = ref<PrintPreview | null>(null)
  const printJobs = ref<PrintJob[]>([])
  const isPreviewLoading = ref(false)
  const isPrinting = ref(false)

  const paperDimensions = computed(() => {
    if (settings.value.paperSize === 'custom') {
      return {
        width: settings.value.customWidth,
        height: settings.value.customHeight
      }
    }
    return paperSizes[settings.value.paperSize] || paperSizes.a4
  })

  const printableArea = computed(() => {
    const { width, height } = paperDimensions.value
    return {
      width: width - settings.value.margins.left - settings.value.margins.right,
      height: height - settings.value.margins.top - settings.value.margins.bottom
    }
  })

  const updateSettings = (updates: Partial<PrintSettings>) => {
    settings.value = { ...settings.value, ...updates }
  }

  const resetSettings = () => {
    settings.value = { ...defaultSettings }
  }

  const setPaperSize = (size: PrintSettings['paperSize']) => {
    settings.value.paperSize = size
  }

  const setOrientation = (orientation: PrintSettings['orientation']) => {
    settings.value.orientation = orientation
  }

  const setMargins = (margins: Partial<PrintSettings['margins']>) => {
    settings.value.margins = { ...settings.value.margins, ...margins }
  }

  const setPageRange = (pages: PrintSettings['pages']) => {
    settings.value.pages = pages
  }

  const generatePreview = async (
    pdfCanvas: HTMLCanvasElement,
    totalPages: number
  ): Promise<PrintPreview> => {
    isPreviewLoading.value = true
    
    try {
      const previewCanvas = document.createElement('canvas')
      const ctx = previewCanvas.getContext('2d')
      
      const { width, height } = paperDimensions.value
      const scale = 2
      previewCanvas.width = width * scale
      previewCanvas.height = height * scale
      
      if (ctx) {
        ctx.fillStyle = 'var(--el-bg-color)'
        ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height)
        
        const printableWidth = (width - settings.value.margins.left - settings.value.margins.right) * scale
        const printableHeight = (height - settings.value.margins.top - settings.value.margins.bottom) * scale
        
        const imgWidth = pdfCanvas.width
        const imgHeight = pdfCanvas.height
        const imgRatio = imgWidth / imgHeight
        const printableRatio = printableWidth / printableHeight
        
        let drawWidth: number
        let drawHeight: number
        
        if (settings.value.scale === 'fit') {
          if (imgRatio > printableRatio) {
            drawWidth = printableWidth
            drawHeight = printableWidth / imgRatio
          } else {
            drawHeight = printableHeight
            drawWidth = printableHeight * imgRatio
          }
        } else if (settings.value.scale === 'actual') {
          drawWidth = imgWidth
          drawHeight = imgHeight
        } else {
          const customScale = settings.value.customScale / 100
          drawWidth = imgWidth * customScale
          drawHeight = imgHeight * customScale
        }
        
        const offsetX = (previewCanvas.width - drawWidth) / 2
        const offsetY = (previewCanvas.height - drawHeight) / 2
        
        ctx.drawImage(pdfCanvas, offsetX, offsetY, drawWidth, drawHeight)
        
        if (settings.value.showPageNumbers) {
          ctx.font = '12px Arial'
          ctx.fillStyle = 'var(--el-text-color-primary)'
          ctx.textAlign = 'center'
          
          const pageText = settings.value.pageNumberFormat === 'pageOfTotal'
            ? `第 1 页 / 共 ${totalPages} 页`
            : '第 1 页'
          
          const footerY = previewCanvas.height - settings.value.margins.bottom * scale / 2
          
          if (settings.value.pageNumberPosition === 'center') {
            ctx.fillText(pageText, previewCanvas.width / 2, footerY)
          } else if (settings.value.pageNumberPosition === 'left') {
            ctx.textAlign = 'left'
            ctx.fillText(pageText, settings.value.margins.left * scale, footerY)
          } else {
            ctx.textAlign = 'right'
            ctx.fillText(pageText, previewCanvas.width - settings.value.margins.right * scale, footerY)
          }
        }
        
        if (settings.value.header) {
          ctx.font = '10px Arial'
          ctx.fillStyle = 'var(--color-gray-666)'
          ctx.textAlign = 'center'
          ctx.fillText(
            settings.value.header,
            previewCanvas.width / 2,
            settings.value.margins.top * scale / 2
          )
        }
        
        if (settings.value.footer) {
          ctx.font = '10px Arial'
          ctx.fillStyle = 'var(--color-gray-666)'
          ctx.textAlign = 'center'
          ctx.fillText(
            settings.value.footer,
            previewCanvas.width / 2,
            previewCanvas.height - settings.value.margins.bottom * scale / 2 - 20
          )
        }
      }
      
      const url = previewCanvas.toDataURL('image/png')
      
      preview.value = {
        url,
        width: paperDimensions.value.width,
        height: paperDimensions.value.height,
        totalPages,
        currentPage: 1
      }
      
      return preview.value
    } finally {
      isPreviewLoading.value = false
    }
  }

  const print = async (
    pdfCanvases: HTMLCanvasElement[],
    totalPages: number
  ): Promise<PrintJob> => {
    const job: PrintJob = {
      id: generateId(),
      status: 'printing',
      progress: 0,
      settings: { ...settings.value }
    }
    
    printJobs.value.push(job)
    isPrinting.value = true
    
    try {
      const printWindow = window.open('', '_blank')
      if (!printWindow) {
        throw new Error('无法打开打印窗口，请检查弹出窗口设置')
      }
      
      const pagesToPrint = getPagesToPrint(totalPages)
      const canvasesToPrint = pagesToPrint.map(p => pdfCanvases[p - 1]).filter(Boolean)
      
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>打印预览</title>
          <style>
            @page {
              size: ${settings.value.orientation === 'portrait' ? `${paperDimensions.value.width}mm ${paperDimensions.value.height}mm` : `${paperDimensions.value.height}mm ${paperDimensions.value.width}mm`};
              margin: ${settings.value.margins.top}mm ${settings.value.margins.right}mm ${settings.value.margins.bottom}mm ${settings.value.margins.left}mm;
            }
            body {
              margin: 0;
              padding: 0;
              background: var(--color-gray-light);
            }
            .page {
              width: ${paperDimensions.value.width}mm;
              height: ${paperDimensions.value.height}mm;
              background: white;
              margin: 10mm auto;
              border: 1px solid var(--border-unified-color);
              page-break-after: always;
              position: relative;
              overflow: hidden;
            }
            .page:last-child {
              page-break-after: auto;
            }
            .page img {
              max-width: 100%;
              max-height: 100%;
              object-fit: contain;
            }
            .page-number {
              position: absolute;
              bottom: ${settings.value.margins.bottom / 2}mm;
              font-size: 10pt;
              color: var(--el-text-color-primary);
              ${settings.value.pageNumberPosition === 'center' ? 'left: 50%; transform: translateX(-50%);' : settings.value.pageNumberPosition === 'left' ? `left: ${settings.value.margins.left}mm;` : `right: ${settings.value.margins.right}mm;`}
            }
            .header {
              position: absolute;
              top: ${settings.value.margins.top / 2}mm;
              left: 50%;
              transform: translateX(-50%);
              font-size: 9pt;
              color: var(--el-text-color-secondary);
            }
            .footer {
              position: absolute;
              bottom: ${settings.value.margins.bottom / 2 + 5}mm;
              left: 50%;
              transform: translateX(-50%);
              font-size: 9pt;
              color: var(--el-text-color-secondary);
            }
            @media print {
              body {
                background: white;
              }
              .page {
                margin: 0;
                box-shadow: none;
              }
            }
          </style>
        </head>
        <body>
      `)
      
      for (let i = 0; i < canvasesToPrint.length; i++) {
        const canvas = canvasesToPrint[i]
        const pageNumber = pagesToPrint[i]
        
        job.progress = Math.round(((i + 1) / canvasesToPrint.length) * 100)
        
        const imgData = canvas.toDataURL('image/png')
        const pageNumText = settings.value.pageNumberFormat === 'pageOfTotal'
          ? `第 ${pageNumber} 页 / 共 ${totalPages} 页`
          : `第 ${pageNumber} 页`
        
        printWindow.document.write(`
          <div class="page">
            ${settings.value.header ? `<div class="header">${escapeHtml(settings.value.header)}</div>` : ''}
            <img src="${imgData}" alt="Page ${pageNumber}" />
            ${settings.value.footer ? `<div class="footer">${escapeHtml(settings.value.footer)}</div>` : ''}
            ${settings.value.showPageNumbers ? `<div class="page-number">${pageNumText}</div>` : ''}
          </div>
        `)
      }
      
      printWindow.document.write('</body></html>')
      printWindow.document.close()
      
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print()
          job.status = 'completed'
          isPrinting.value = false
        }, 500)
      }
      
      return job
    } catch (error) {
      job.status = 'error'
      job.error = error instanceof Error ? error.message : '打印失败'
      isPrinting.value = false
      throw error
    }
  }

  const getPagesToPrint = (totalPages: number): number[] => {
    if (settings.value.pages === 'all') {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }
    if (settings.value.pages === 'current') {
      return [1]
    }
    if (Array.isArray(settings.value.pages)) {
      return settings.value.pages.filter(p => p >= 1 && p <= totalPages)
    }
    return []
  }

  const quickPrint = async (
    pdfCanvases: HTMLCanvasElement[],
    totalPages: number
  ) => {
    resetSettings()
    return print(pdfCanvases, totalPages)
  }

  const deletePrintJob = (id: string) => {
    const index = printJobs.value.findIndex(j => j.id === id)
    if (index > -1) {
      printJobs.value.splice(index, 1)
    }
  }

  const clearPrintJobs = () => {
    printJobs.value = []
  }

  const exportSettings = () => {
    return JSON.stringify(settings.value, null, 2)
  }

  const importSettings = (json: string) => {
    try {
      const imported = JSON.parse(json)
      settings.value = { ...defaultSettings, ...imported }
      return true
    } catch {
      return false
    }
  }

  return {
    settings,
    preview,
    printJobs,
    isPreviewLoading,
    isPrinting,
    paperDimensions,
    printableArea,
    updateSettings,
    resetSettings,
    setPaperSize,
    setOrientation,
    setMargins,
    setPageRange,
    generatePreview,
    print,
    quickPrint,
    deletePrintJob,
    clearPrintJobs,
    exportSettings,
    importSettings
  }
}
