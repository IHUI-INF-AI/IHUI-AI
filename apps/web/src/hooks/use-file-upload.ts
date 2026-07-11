'use client'

import * as React from 'react'

import { fetchApi } from '@/lib/api'

export interface UploadProgress {
  fileId: string
  loaded: number
  total: number
  percent: number
}

export interface UploadedFile {
  id: string
  name: string
  url: string
  size: number
  mimeType: string
}

export interface UseFileUploadReturn {
  uploads: UploadProgress[]
  completed: UploadedFile[]
  uploading: boolean
  error: string | null
  upload: (file: File, onProgress?: (p: UploadProgress) => void) => Promise<UploadedFile | null>
  uploadChunked: (file: File, chunkSize?: number) => Promise<UploadedFile | null>
  clear: () => void
}

const DEFAULT_CHUNK = 5 * 1024 * 1024 // 5MB

/** 文件上传 Hook，支持普通上传与分块上传 */
export function useFileUpload(): UseFileUploadReturn {
  const [uploads, setUploads] = React.useState<UploadProgress[]>([])
  const [completed, setCompleted] = React.useState<UploadedFile[]>([])
  const [uploading, setUploading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const upload = React.useCallback(async (file: File, onProgress?: (p: UploadProgress) => void) => {
    setUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const xhr = new XMLHttpRequest()
      const result = await new Promise<UploadedFile>((resolve, reject) => {
        xhr.open('POST', '/api/files/upload')
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const p: UploadProgress = {
              fileId: file.name,
              loaded: e.loaded,
              total: e.total,
              percent: Math.round((e.loaded / e.total) * 100),
            }
            onProgress?.(p)
          }
        }
        xhr.onload = () => {
          try {
            const json = JSON.parse(xhr.responseText) as { code: number; data: UploadedFile }
            if (json.code === 0) resolve(json.data)
            else reject(new Error('上传失败'))
          } catch {
            reject(new Error('解析响应失败'))
          }
        }
        xhr.onerror = () => reject(new Error('网络异常'))
        xhr.send(formData)
      })
      setCompleted((prev) => [...prev, result])
      return result
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败')
      return null
    } finally {
      setUploading(false)
    }
  }, [])

  const uploadChunked = React.useCallback(async (file: File, chunkSize = DEFAULT_CHUNK) => {
    setUploading(true)
    setError(null)
    try {
      const totalChunks = Math.ceil(file.size / chunkSize)
      const uploadId = `${file.name}-${Date.now()}`
      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize
        const end = Math.min(start + chunkSize, file.size)
        const chunk = file.slice(start, end)
        const formData = new FormData()
        formData.append('chunk', chunk)
        formData.append('index', String(i))
        formData.append('total', String(totalChunks))
        formData.append('uploadId', uploadId)
        formData.append('fileName', file.name)
        const res = await fetchApi<UploadedFile>('/api/files/upload-chunk', {
          method: 'POST',
          body: formData,
        })
        if (!res.success) throw new Error(res.error)
        if (res.data?.url) {
          setCompleted((prev) => [...prev, res.data])
          return res.data
        }
      }
      return null
    } catch (err) {
      setError(err instanceof Error ? err.message : '分块上传失败')
      return null
    } finally {
      setUploading(false)
    }
  }, [])

  const clear = React.useCallback(() => {
    setUploads([])
    setCompleted([])
    setError(null)
  }, [])

  return { uploads, completed, uploading, error, upload, uploadChunked, clear }
}
