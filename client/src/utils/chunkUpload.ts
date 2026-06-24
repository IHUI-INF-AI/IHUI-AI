import SparkMD5 from 'spark-md5'
import { getUserToken } from '@/utils/request'

const CHUNK_SIZE = 5 * 1024 * 1024

interface ChunkInfo {
  fileId: string
  fileName: string
  fileSize: number
  totalChunks: number
  uploadedChunks: number[]
  uploadId: string
}

interface UploadProgress {
  loaded: number
  total: number
  percentage: number
}

type ProgressCallback = (progress: UploadProgress) => void
type ChunkCompleteCallback = (chunkIndex: number, totalChunks: number) => void

class ChunkUploader {
  private uploads: Map<string, ChunkInfo> = new Map()
  private abortControllers: Map<string, AbortController> = new Map()
  private getAuthHeaders(): Record<string, string> {
    const token = getUserToken()
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  generateFileId(file: File): string {
    return `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).substr(2, 9)}`
  }

  async upload(
    file: File,
    uploadUrl: string,
    onProgress?: ProgressCallback,
    onChunkComplete?: ChunkCompleteCallback
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    const fileId = this.generateFileId(file)
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE)
    const uploadId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    this.uploads.set(fileId, {
      fileId,
      fileName: file.name,
      fileSize: file.size,
      totalChunks,
      uploadedChunks: [],
      uploadId
    })

    const abortController = new AbortController()
    this.abortControllers.set(fileId, abortController)

    try {
      await this.initUpload(uploadUrl, fileId, file.name, file.size, totalChunks, uploadId)

      let uploadedBytes = 0
      const chunkPromises: Promise<void>[] = []

      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        if (abortController.signal.aborted) {
          throw new Error('Upload aborted')
        }

        const start = chunkIndex * CHUNK_SIZE
        const end = Math.min(start + CHUNK_SIZE, file.size)
        const chunk = file.slice(start, end)

        const promise = this.uploadChunk(
          uploadUrl,
          fileId,
          chunk,
          chunkIndex,
          totalChunks,
          uploadId,
          abortController.signal
        ).then(() => {
          const chunkInfo = this.uploads.get(fileId)
          if (chunkInfo) {
            chunkInfo.uploadedChunks.push(chunkIndex)
            uploadedBytes += chunk.size

            onProgress?.({
              loaded: uploadedBytes,
              total: file.size,
              percentage: Math.round((uploadedBytes / file.size) * 100)
            })

            onChunkComplete?.(chunkIndex, totalChunks)
          }
        })

        chunkPromises.push(promise)

        if (chunkPromises.length >= 3) {
          await Promise.all(chunkPromises)
          chunkPromises.length = 0
        }
      }

      if (chunkPromises.length > 0) {
        await Promise.all(chunkPromises)
      }

      const result = await this.completeUpload(uploadUrl, fileId, uploadId)

      this.uploads.delete(fileId)
      this.abortControllers.delete(fileId)

      return { success: true, url: result.url }
    } catch (error) {
      this.uploads.delete(fileId)
      this.abortControllers.delete(fileId)

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      }
    }
  }

  private async initUpload(
    url: string,
    fileId: string,
    fileName: string,
    fileSize: number,
    totalChunks: number,
    uploadId: string
  ): Promise<void> {
    const response = await fetch(`${url}/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.getAuthHeaders() },
      body: JSON.stringify({
        fileId,
        fileName,
        fileSize,
        totalChunks,
        uploadId
      })
    })

    if (!response.ok) {
      throw new Error('Failed to initialize upload')
    }
  }

  private async uploadChunk(
    url: string,
    fileId: string,
    chunk: Blob,
    chunkIndex: number,
    totalChunks: number,
    uploadId: string,
    signal: AbortSignal
  ): Promise<void> {
    const formData = new FormData()
    formData.append('fileId', fileId)
    formData.append('chunkIndex', chunkIndex.toString())
    formData.append('totalChunks', totalChunks.toString())
    formData.append('uploadId', uploadId)
    formData.append('chunk', chunk)

    const response = await fetch(`${url}/chunk`, {
      method: 'POST',
      headers: { ...this.getAuthHeaders() },
      body: formData,
      signal
    })

    if (!response.ok) {
      throw new Error(`Failed to upload chunk ${chunkIndex}`)
    }
  }

  private async completeUpload(
    url: string,
    fileId: string,
    uploadId: string
  ): Promise<{ url: string }> {
    // 2026-06-24 修复: 后端 complete_upload 期望 fileName 字段, 前端发的是 fileId
    // 从 uploadId 中提取 fileName (uploadId 格式通常为 {fileName}_{timestamp})
    const fileName = fileId || uploadId
    const response = await fetch(`${url}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.getAuthHeaders() },
      body: JSON.stringify({ fileName, uploadId })
    })

    if (!response.ok) {
      throw new Error('Failed to complete upload')
    }

    return response.json()
  }

  abort(fileId: string): void {
    const controller = this.abortControllers.get(fileId)
    if (controller) {
      controller.abort()
      this.uploads.delete(fileId)
      this.abortControllers.delete(fileId)
    }
  }

  getUploadInfo(fileId: string): ChunkInfo | undefined {
    return this.uploads.get(fileId)
  }

  getActiveUploads(): ChunkInfo[] {
    return Array.from(this.uploads.values())
  }
}

export const chunkUploader = new ChunkUploader()

export function useChunkUploader() {
  return {
    upload: (
      file: File,
      url: string,
      onProgress?: ProgressCallback,
      onChunkComplete?: ChunkCompleteCallback
    ) => chunkUploader.upload(file, url, onProgress, onChunkComplete),
    abort: (fileId: string) => chunkUploader.abort(fileId),
    getUploadInfo: (fileId: string) => chunkUploader.getUploadInfo(fileId),
    getActiveUploads: () => chunkUploader.getActiveUploads(),
    generateFileId: (file: File) => chunkUploader.generateFileId(file)
  }
}

// ============================================================
// 基于 spark-md5 的分片上传工具函数
// 提供 calculateFileMd5 / createFileChunks / uploadFileInChunks
// ============================================================

/** 默认分片大小：2MB */
const DEFAULT_CHUNK_SIZE = 2 * 1024 * 1024

/** 文件分片信息 */
export interface FileChunk {
  /** 分片数据 */
  chunk: Blob
  /** 分片索引（从 0 开始） */
  index: number
  /** 分片起始字节 */
  start: number
  /** 分片结束字节 */
  end: number
  /** 分片大小（字节） */
  size: number
  /** 分片总数 */
  total: number
}

/** 分片上传进度信息 */
export interface ChunkUploadProgress {
  /** 已上传字节数 */
  loaded: number
  /** 文件总字节数 */
  total: number
  /** 进度百分比（0-100） */
  percentage: number
}

/** 分片上传选项 */
export interface UploadFileInChunksOptions {
  /** 分片大小（字节），默认 2MB */
  chunkSize?: number
  /** 并发上传数，默认 3 */
  concurrency?: number
  /** 自定义请求头 */
  headers?: Record<string, string>
  /** 进度回调 */
  onProgress?: (progress: ChunkUploadProgress) => void
  /** 单个分片上传完成回调 */
  onChunkComplete?: (index: number, total: number) => void
  /** AbortSignal，用于取消上传 */
  signal?: AbortSignal
  /** 文件 MD5（若已计算可传入，避免重复计算） */
  md5?: string
}

/** 分片上传结果 */
export interface UploadFileInChunksResult {
  /** 是否成功 */
  success: boolean
  /** 文件 MD5 */
  md5?: string
  /** 上传后文件 URL（若接口返回） */
  url?: string
  /** 分片总数 */
  totalChunks?: number
  /** 错误信息 */
  error?: string
}

/**
 * 计算文件 MD5
 * 使用 spark-md5 分片读取文件内容并计算哈希，避免大文件一次性加载到内存
 * @param file 文件对象
 * @param chunkSize 分片大小（字节），默认 2MB
 * @returns 文件 MD5 哈希值
 */
export async function calculateFileMd5(
  file: File,
  chunkSize: number = DEFAULT_CHUNK_SIZE
): Promise<string> {
  return new Promise<string>((resolveFn, rejectFn) => {
    const spark = new SparkMD5.ArrayBuffer()
    const reader = new FileReader()
    const totalChunks = Math.max(1, Math.ceil(file.size / chunkSize))
    let currentChunk = 0

    // 读取下一个分片
    const loadNext = () => {
      const start = currentChunk * chunkSize
      const end = Math.min(start + chunkSize, file.size)
      reader.readAsArrayBuffer(file.slice(start, end))
    }

    reader.onload = (e) => {
      if (e.target?.result) {
        spark.append(e.target.result as ArrayBuffer)
      }
      currentChunk++
      if (currentChunk < totalChunks) {
        loadNext()
      } else {
        // 全部分片读取完成，输出 MD5
        resolveFn(spark.end())
      }
    }

    reader.onerror = () => {
      rejectFn(new Error('读取文件失败，无法计算 MD5'))
    }

    loadNext()
  })
}

/**
 * 将文件切分为多个分片
 * @param file 文件对象
 * @param chunkSize 分片大小（字节），默认 2MB
 * @returns 分片信息数组
 */
export function createFileChunks(
  file: File,
  chunkSize: number = DEFAULT_CHUNK_SIZE
): FileChunk[] {
  const chunks: FileChunk[] = []
  const total = Math.max(1, Math.ceil(file.size / chunkSize))

  for (let index = 0; index < total; index++) {
    const start = index * chunkSize
    const end = Math.min(start + chunkSize, file.size)
    chunks.push({
      chunk: file.slice(start, end),
      index,
      start,
      end,
      size: end - start,
      total,
    })
  }

  return chunks
}

/**
 * 分片上传文件
 * 支持并发上传、进度回调、取消上传
 * @param file 文件对象
 * @param uploadUrl 上传接口地址
 * @param options 上传选项
 * @returns 上传结果
 */
export async function uploadFileInChunks(
  file: File,
  uploadUrl: string,
  options: UploadFileInChunksOptions = {}
): Promise<UploadFileInChunksResult> {
  const {
    chunkSize = DEFAULT_CHUNK_SIZE,
    concurrency = 3,
    headers = {},
    onProgress,
    onChunkComplete,
    signal,
    md5: providedMd5,
  } = options

  try {
    // 计算 MD5（若未提供则现场计算）
    const md5 = providedMd5 ?? await calculateFileMd5(file, chunkSize)
    const chunks = createFileChunks(file, chunkSize)
    const total = chunks.length

    let uploadedBytes = 0
    // 使用队列控制并发
    const queue: FileChunk[] = [...chunks]

    const runChunk = async (): Promise<void> => {
      while (queue.length > 0) {
        if (signal?.aborted) {
          throw new Error('上传已取消')
        }
        const chunkInfo = queue.shift()
        if (!chunkInfo) break

        const formData = new FormData()
        formData.append('md5', md5)
        formData.append('fileId', md5)
        formData.append('chunkIndex', String(chunkInfo.index))
        formData.append('totalChunks', String(total))
        formData.append('fileName', file.name)
        formData.append('chunk', chunkInfo.chunk, file.name)

        const response = await fetch(uploadUrl, {
          method: 'POST',
          headers,
          body: formData,
          signal,
        })

        if (!response.ok) {
          throw new Error(`分片 ${chunkInfo.index} 上传失败：HTTP ${response.status}`)
        }

        uploadedBytes += chunkInfo.size
        onProgress?.({
          loaded: uploadedBytes,
          total: file.size,
          percentage: Math.round((uploadedBytes / file.size) * 100),
        })
        onChunkComplete?.(chunkInfo.index, total)
      }
    }

    // 启动并发 worker
    const workers: Promise<void>[] = []
    const workerCount = Math.min(concurrency, total)
    for (let i = 0; i < workerCount; i++) {
      workers.push(runChunk())
    }
    await Promise.all(workers)

    return {
      success: true,
      md5,
      totalChunks: total,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '分片上传失败',
    }
  }
}
