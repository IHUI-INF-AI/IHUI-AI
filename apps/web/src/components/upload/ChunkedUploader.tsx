'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { Upload, Loader2, X, CheckCircle, FileIcon } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { cn } from '@/lib/utils'
import { Button, Input } from '@ihui/ui'

type UploadStatus = 'idle' | 'uploading' | 'merging' | 'done' | 'error' | 'cancelled'

interface ChunkedUploaderProps {
  onUploadComplete?: (url: string, fileName: string) => void
  accept?: string
  maxSize?: number
}

const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024

interface InitResponse {
  uploadId: string
}

interface MergeResponse {
  url: string
}

export function ChunkedUploader({
  onUploadComplete,
  accept = '*/*',
  maxSize = 1024 * 1024 * 1024,
}: ChunkedUploaderProps) {
  const t = useTranslations('chunkedUploader')
  const [file, setFile] = React.useState<File | null>(null)
  const [uploadId, setUploadId] = React.useState<string | null>(null)
  const [uploadedChunks, setUploadedChunks] = React.useState(0)
  const [totalChunks, setTotalChunks] = React.useState(0)
  const [status, setStatus] = React.useState<UploadStatus>('idle')
  const [error, setError] = React.useState<string | null>(null)
  const [fileUrl, setFileUrl] = React.useState<string | null>(null)
  const [isDragging, setIsDragging] = React.useState(false)

  const abortControllerRef = React.useRef<AbortController | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)

  const percent = totalChunks > 0 ? Math.round((uploadedChunks / totalChunks) * 100) : 0
  const isUploading = status === 'uploading' || status === 'merging'

  function resetState() {
    setFile(null)
    setUploadId(null)
    setUploadedChunks(0)
    setTotalChunks(0)
    setStatus('idle')
    setError(null)
    setFileUrl(null)
  }

  async function cancelUpload(currentUploadId: string | null) {
    if (!currentUploadId) return
    try {
      await fetchApi(`/api/chunked-upload/cancel`, {
        method: 'DELETE',
        body: JSON.stringify({ uploadId: currentUploadId }),
      })
    } catch {
      // 忽略取消请求的错误
    }
  }

  function handleCancel() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    if (uploadId) {
      cancelUpload(uploadId)
    }
    setStatus('cancelled')
    toast.info(t('cancelledToast'))
  }

  async function startUpload(selectedFile: File) {
    if (selectedFile.size > maxSize) {
      toast.error(t('sizeExceeded', { size: Math.round(maxSize / 1024 / 1024) }))
      return
    }

    resetState()
    setFile(selectedFile)
    setStatus('uploading')
    setError(null)

    const controller = new AbortController()
    abortControllerRef.current = controller

    const chunkSize = DEFAULT_CHUNK_SIZE
    const chunks = Math.ceil(selectedFile.size / chunkSize)
    setTotalChunks(chunks)

    let currentUploadId: string | null = null

    try {
      // 1. 初始化上传
      const initRes = await fetchApi<InitResponse>('/api/chunked-upload/init', {
        method: 'POST',
        body: JSON.stringify({
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
          totalChunks: chunks,
          mimeType: selectedFile.type,
        }),
      })
      if (!initRes.success) throw new Error(initRes.error)
      currentUploadId = initRes.data.uploadId
      setUploadId(currentUploadId)

      // 2. 逐片上传
      const token = useAuthStore.getState().token
      for (let i = 0; i < chunks; i++) {
        if (controller.signal.aborted) return

        const start = i * chunkSize
        const end = Math.min(start + chunkSize, selectedFile.size)
        const chunk = selectedFile.slice(start, end)

        const headers: Record<string, string> = {
          'Content-Type': 'application/octet-stream',
          'x-upload-id': currentUploadId,
          'x-chunk-number': String(i + 1),
        }
        if (token) {
          headers['Authorization'] = `Bearer ${token}`
        }

        const response = await fetch('/api/chunked-upload/upload', {
          method: 'POST',
          headers,
          body: chunk,
          signal: controller.signal,
        })

        if (!response.ok) {
          const text = await response.text().catch(() => '')
          throw new Error(text || t('chunkFailed', { number: i + 1, status: response.status }))
        }

        const json = await response.json()
        if (json.code !== 0) {
          throw new Error(json.message || t('chunkFailed', { number: i + 1, status: json.code }))
        }

        setUploadedChunks(i + 1)
      }

      // 3. 合并
      setStatus('merging')
      const mergeRes = await fetchApi<MergeResponse>('/api/chunked-upload/merge', {
        method: 'POST',
        body: JSON.stringify({ uploadId: currentUploadId }),
        signal: controller.signal,
      })
      if (!mergeRes.success) throw new Error(mergeRes.error)

      setStatus('done')
      setFileUrl(mergeRes.data.url)
      toast.success(t('doneToast'))
      onUploadComplete?.(mergeRes.data.url, selectedFile.name)
    } catch (err) {
      if (controller.signal.aborted) return

      const message = err instanceof Error ? err.message : t('failed')
      setError(message)
      setStatus('error')
      toast.error(message)

      // 出错时取消上传
      if (currentUploadId) {
        await cancelUpload(currentUploadId)
      }
    } finally {
      abortControllerRef.current = null
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return
    startUpload(selectedFile)
    // 清空 input 值，允许重复选择同一文件
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(false)
    if (isUploading) return
    const selectedFile = e.dataTransfer.files?.[0]
    if (!selectedFile) return
    startUpload(selectedFile)
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    if (!isDragging) setIsDragging(true)
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(false)
  }

  function handleReset() {
    resetState()
  }

  return (
    <div className="space-y-4">
      {/* 拖拽区 / 文件信息 */}
      {file && isUploading ? (
        <div className="flex items-center gap-3 rounded-lg border p-4">
          <FileIcon className="h-8 w-8 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{file.name}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCancel}
            disabled={status === 'merging'}
          >
            <X className="h-4 w-4" />
            {t('cancel')}
          </Button>
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors',
            isDragging && 'border-blue-500 bg-blue-500/5',
            isUploading && 'pointer-events-none opacity-50',
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            onChange={handleFileSelect}
            className="hidden"
            disabled={isUploading}
          />
          <Upload className="mx-auto mb-2 h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-medium">{t('dragHint')}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('maxSizeHint', { size: Math.round(maxSize / 1024 / 1024) })}
          </p>
        </div>
      )}

      {/* 进度条 */}
      {isUploading && totalChunks > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              {status === 'merging' ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t('merging')}
                </>
              ) : (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t('uploading')}
                </>
              )}
            </span>
            <span className="font-medium">
              {t('chunks', { uploaded: uploadedChunks, total: totalChunks, percent })}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      )}

      {/* 上传完成 */}
      {status === 'done' && fileUrl && (
        <div className="space-y-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-500">
            <CheckCircle className="h-4 w-4" />
            {t('done')}
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">
              {t('fileName')}: {file?.name}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{t('fileUrl')}:</span>
              <Input readOnly value={fileUrl} className="h-7 flex-1 font-mono text-xs" />
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleReset}>
            {t('reupload')}
          </Button>
        </div>
      )}

      {/* 错误提示 */}
      {status === 'error' && error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-destructive">
            <X className="h-4 w-4" />
            {t('failed')}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={handleReset}>
            {t('reupload')}
          </Button>
        </div>
      )}

      {/* 取消提示 */}
      {status === 'cancelled' && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-600 dark:text-amber-500">
            <X className="h-4 w-4" />
            {t('cancelled')}
          </div>
          <Button variant="outline" size="sm" className="mt-3" onClick={handleReset}>
            {t('reupload')}
          </Button>
        </div>
      )}
    </div>
  )
}
