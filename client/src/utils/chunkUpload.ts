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
    const response = await fetch(`${url}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.getAuthHeaders() },
      body: JSON.stringify({ fileId, uploadId })
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
