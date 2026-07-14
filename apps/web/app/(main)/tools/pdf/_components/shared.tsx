'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowLeft, Upload, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Alert } from '@/components/feedback'
import { fetchApi } from '@/lib/api'

export function ToolHeader({ title, description }: { title: string; description: string }) {
  return (
    <header className="space-y-2">
      <Link
        href="/tools/pdf"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        PDF 工具
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">{description}</p>
    </header>
  )
}

interface UploadAreaProps {
  multiple?: boolean
  accept?: string
  onFiles: (files: File[]) => void
  label?: string
}

export function UploadArea({
  multiple = false,
  accept,
  onFiles,
  label = '点击或拖拽文件到此处上传',
}: UploadAreaProps) {
  const [dragging, setDragging] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const handle = (list: FileList | null) => {
    if (!list || list.length === 0) return
    onFiles(Array.from(list))
  }
  return (
    <div
      role="button"
      tabIndex={0}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        handle(e.dataTransfer.files)
      }}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          inputRef.current?.click()
        }
      }}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground transition-colors hover:bg-accent/50',
        dragging && 'border-primary bg-primary/5 text-primary',
      )}
    >
      <Upload className="h-8 w-8" />
      <span>{label}</span>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => handle(e.target.files)}
      />
    </div>
  )
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div className="h-full bg-primary transition-all" style={{ width: `${value}%` }} />
    </div>
  )
}

export function DownloadLink({ url, filename }: { url: string; filename?: string }) {
  return (
    <a
      href={url}
      download={filename}
      className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
    >
      <Download className="h-4 w-4" />
      下载{filename ? `：${filename}` : '结果'}
    </a>
  )
}

export function NotAvailableAlert() {
  return (
    <Alert
      variant="warning"
      title="功能开发中"
      description="该工具的后端服务尚未实现，暂时无法使用，请稍后再试。"
    />
  )
}

export interface ProcessResult {
  url: string
  filename: string
}

export function useProcessApi(endpoint: string) {
  const [loading, setLoading] = React.useState(false)
  const [progress, setProgress] = React.useState(0)
  const [result, setResult] = React.useState<ProcessResult | null>(null)
  const [error, setError] = React.useState(false)
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null)

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  React.useEffect(() => clearTimer, [])

  const run = React.useCallback(
    async (body: FormData) => {
      setLoading(true)
      setError(false)
      setResult(null)
      setProgress(5)
      clearTimer()
      timerRef.current = setInterval(() => {
        setProgress((p) => (p < 90 ? p + 5 : p))
      }, 150)
      try {
        const r = await fetchApi<ProcessResult>(endpoint, { method: 'POST', body })
        clearTimer()
        if (r.success && r.data) {
          setProgress(100)
          setResult(r.data)
        } else {
          setProgress(0)
          setError(true)
        }
      } catch {
        clearTimer()
        setProgress(0)
        setError(true)
      } finally {
        setLoading(false)
      }
    },
    [endpoint],
  )

  return { loading, progress, result, error, run }
}
