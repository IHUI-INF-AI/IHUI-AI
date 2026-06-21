import { ref, computed } from 'vue'
import * as pdfjsLib from 'pdfjs-dist'
import { logger } from '@/utils/logger'

export interface PdfFile {
  id: string
  name: string
  url: string
  pageCount: number
  size: number
  file: File
  thumbnail?: string
}

export interface MergeTask {
  id: string
  files: PdfFile[]
  status: 'pending' | 'processing' | 'completed' | 'error'
  progress: number
  resultUrl?: string
  error?: string
}

export interface SplitTask {
  id: string
  sourceFile: PdfFile
  ranges: { start: number; end: number }[]
  status: 'pending' | 'processing' | 'completed' | 'error'
  progress: number
  resultUrls?: string[]
  error?: string
}

export interface PageRange {
  start: number
  end: number
}

const generateId = () => `pdf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

export const usePdfMergeSplit = () => {
  const files = ref<PdfFile[]>([])
  const mergeTasks = ref<MergeTask[]>([])
  const splitTasks = ref<SplitTask[]>([])
  const isProcessing = ref(false)
  const currentProgress = ref(0)

  const totalFiles = computed(() => files.value.length)
  const totalMergeTasks = computed(() => mergeTasks.value.length)
  const totalSplitTasks = computed(() => splitTasks.value.length)

  const loadPdfFile = async (file: File): Promise<PdfFile> => {
    const url = URL.createObjectURL(file)
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    
    const thumbnail = await generateThumbnail(pdf)
    
    return {
      id: generateId(),
      name: file.name,
      url,
      pageCount: pdf.numPages,
      size: file.size,
      file,
      thumbnail
    }
  }

  const generateThumbnail = async (pdf: pdfjsLib.PDFDocumentProxy): Promise<string> => {
    const page = await pdf.getPage(1)
    const scale = 0.3
    const viewport = page.getViewport({ scale })
    
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')
    
    if (ctx) {
      await page.render({
        canvasContext: ctx,
        viewport,
        canvas
      } as unknown as Parameters<typeof page.render>[0]).promise
    }
    
    return canvas.toDataURL('image/jpeg', 0.7)
  }

  const addFiles = async (fileList: FileList | File[]): Promise<PdfFile[]> => {
    const newFiles: PdfFile[] = []
    
    for (const file of Array.from(fileList)) {
      if (file.type === 'application/pdf') {
        try {
          const pdfFile = await loadPdfFile(file)
          newFiles.push(pdfFile)
        } catch {
          logger.error(`Failed to load PDF: ${file.name}`)
        }
      }
    }
    
    files.value.push(...newFiles)
    return newFiles
  }

  const removeFile = (id: string) => {
    const index = files.value.findIndex(f => f.id === id)
    if (index > -1) {
      const file = files.value[index]
      URL.revokeObjectURL(file.url)
      files.value.splice(index, 1)
    }
  }

  const reorderFiles = (fromIndex: number, toIndex: number) => {
    const [moved] = files.value.splice(fromIndex, 1)
    files.value.splice(toIndex, 0, moved)
  }

  const clearFiles = () => {
    files.value.forEach(f => URL.revokeObjectURL(f.url))
    files.value = []
  }

  const mergePdfs = async (selectedFiles: PdfFile[]): Promise<MergeTask> => {
    const task: MergeTask = {
      id: generateId(),
      files: selectedFiles,
      status: 'processing',
      progress: 0
    }
    
    mergeTasks.value.push(task)
    isProcessing.value = true
    currentProgress.value = 0
    
    try {
      const mergedPdf = await createMergedPdf(selectedFiles, (progress) => {
        task.progress = progress
        currentProgress.value = progress
      })
      
      task.resultUrl = mergedPdf
      task.status = 'completed'
    } catch (error) {
      task.status = 'error'
      task.error = error instanceof Error ? error.message : '合并失败'
    } finally {
      isProcessing.value = false
    }
    
    return task
  }

  const createMergedPdf = async (
    pdfFiles: PdfFile[],
    onProgress: (progress: number) => void
  ): Promise<string> => {
    const _pdfDoc = await pdfjsLib.getDocument(pdfFiles[0].url).promise
    const totalPages = pdfFiles.reduce((sum, f) => sum + f.pageCount, 0)
    let processedPages = 0
    
    const mergedCanvas = document.createElement('canvas')
    const ctx = mergedCanvas.getContext('2d')
    
    const pageCanvases: HTMLCanvasElement[] = []
    
    for (const pdfFile of pdfFiles) {
      const pdf = await pdfjsLib.getDocument(pdfFile.url).promise
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const viewport = page.getViewport({ scale: 1.5 })
        
        const pageCanvas = document.createElement('canvas')
        pageCanvas.width = viewport.width
        pageCanvas.height = viewport.height
        const pageCtx = pageCanvas.getContext('2d')
        
        if (pageCtx) {
          await page.render({
            canvasContext: pageCtx,
            viewport,
            canvas: pageCanvas
          } as unknown as Parameters<typeof page.render>[0]).promise
        }
        
        pageCanvases.push(pageCanvas)
        processedPages++
        onProgress(Math.round((processedPages / totalPages) * 100))
      }
    }
    
    const maxWidth = Math.max(...pageCanvases.map(c => c.width))
    const totalHeight = pageCanvases.reduce((sum, c) => sum + c.height, 0)
    
    mergedCanvas.width = maxWidth
    mergedCanvas.height = totalHeight
    
    if (ctx) {
      let yOffset = 0
      for (const pageCanvas of pageCanvases) {
        ctx.drawImage(pageCanvas, 0, yOffset)
        yOffset += pageCanvas.height
      }
    }
    
    return new Promise((resolve) => {
      mergedCanvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob)
          resolve(url)
        }
      }, 'image/png')
    })
  }

  const splitPdf = async (
    sourceFile: PdfFile,
    ranges: PageRange[]
  ): Promise<SplitTask> => {
    const task: SplitTask = {
      id: generateId(),
      sourceFile,
      ranges,
      status: 'processing',
      progress: 0
    }
    
    splitTasks.value.push(task)
    isProcessing.value = true
    currentProgress.value = 0
    
    try {
      const resultUrls = await splitPdfByRanges(sourceFile, ranges, (progress) => {
        task.progress = progress
        currentProgress.value = progress
      })
      
      task.resultUrls = resultUrls
      task.status = 'completed'
    } catch (error) {
      task.status = 'error'
      task.error = error instanceof Error ? error.message : '拆分失败'
    } finally {
      isProcessing.value = false
    }
    
    return task
  }

  const splitPdfByRanges = async (
    sourceFile: PdfFile,
    ranges: PageRange[],
    onProgress: (progress: number) => void
  ): Promise<string[]> => {
    const pdf = await pdfjsLib.getDocument(sourceFile.url).promise
    const resultUrls: string[] = []
    let processedRanges = 0
    
    for (const range of ranges) {
      const pageCanvases: HTMLCanvasElement[] = []
      
      for (let i = range.start; i <= range.end && i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const viewport = page.getViewport({ scale: 1.5 })
        
        const pageCanvas = document.createElement('canvas')
        pageCanvas.width = viewport.width
        pageCanvas.height = viewport.height
        const ctx = pageCanvas.getContext('2d')
        
        if (ctx) {
          await page.render({
            canvasContext: ctx,
            viewport,
            canvas: pageCanvas
          } as unknown as Parameters<typeof page.render>[0]).promise
        }
        
        pageCanvases.push(pageCanvas)
      }
      
      const maxWidth = Math.max(...pageCanvases.map(c => c.width))
      const totalHeight = pageCanvases.reduce((sum, c) => sum + c.height, 0)
      
      const mergedCanvas = document.createElement('canvas')
      mergedCanvas.width = maxWidth
      mergedCanvas.height = totalHeight
      const ctx = mergedCanvas.getContext('2d')
      
      if (ctx) {
        let yOffset = 0
        for (const pageCanvas of pageCanvases) {
          ctx.drawImage(pageCanvas, 0, yOffset)
          yOffset += pageCanvas.height
        }
      }
      
      const url = await new Promise<string>((resolve) => {
        mergedCanvas.toBlob((blob) => {
          if (blob) {
            resolve(URL.createObjectURL(blob))
          }
        }, 'image/png')
      })
      
      resultUrls.push(url)
      processedRanges++
      onProgress(Math.round((processedRanges / ranges.length) * 100))
    }
    
    return resultUrls
  }

  const extractPages = async (
    sourceFile: PdfFile,
    pageNumbers: number[]
  ): Promise<string[]> => {
    const ranges: PageRange[] = pageNumbers
      .sort((a, b) => a - b)
      .map(page => ({ start: page, end: page }))
    
    const task = await splitPdf(sourceFile, ranges)
    return task.resultUrls || []
  }

  const deleteMergeTask = (id: string) => {
    const index = mergeTasks.value.findIndex(t => t.id === id)
    if (index > -1) {
      const task = mergeTasks.value[index]
      if (task.resultUrl) {
        URL.revokeObjectURL(task.resultUrl)
      }
      mergeTasks.value.splice(index, 1)
    }
  }

  const deleteSplitTask = (id: string) => {
    const index = splitTasks.value.findIndex(t => t.id === id)
    if (index > -1) {
      const task = splitTasks.value[index]
      if (task.resultUrls) {
        task.resultUrls.forEach(url => URL.revokeObjectURL(url))
      }
      splitTasks.value.splice(index, 1)
    }
  }

  const downloadResult = (url: string, filename: string) => {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const clearAllTasks = () => {
    mergeTasks.value.forEach(t => {
      if (t.resultUrl) URL.revokeObjectURL(t.resultUrl)
    })
    splitTasks.value.forEach(t => {
      if (t.resultUrls) t.resultUrls.forEach(url => URL.revokeObjectURL(url))
    })
    mergeTasks.value = []
    splitTasks.value = []
  }

  return {
    files,
    mergeTasks,
    splitTasks,
    isProcessing,
    currentProgress,
    totalFiles,
    totalMergeTasks,
    totalSplitTasks,
    addFiles,
    removeFile,
    reorderFiles,
    clearFiles,
    mergePdfs,
    splitPdf,
    extractPages,
    deleteMergeTask,
    deleteSplitTask,
    downloadResult,
    clearAllTasks
  }
}
