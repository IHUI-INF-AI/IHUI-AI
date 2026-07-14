'use client'

import * as React from 'react'
import { Loader2, Download, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface OfficeViewerProps {
  url: string
  fileName?: string
  className?: string
}

export function OfficeViewer({ url, fileName, className }: OfficeViewerProps) {
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState(false)
  const src = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setLoading((prev) => {
        if (prev) setError(true)
        return prev
      })
    }, 12000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className={cn('relative flex h-full w-full flex-col', className)}>
      <div className="flex items-center justify-between border-b bg-muted/50 px-3 py-1.5">
        <span className="text-xs text-muted-foreground">Office 在线预览</span>
        <a
          href={url}
          download={fileName}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-primary"
        >
          <Download className="h-3 w-3" />
          下载
        </a>
      </div>
      <div className="relative flex-1">
        {loading && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <AlertCircle className="h-8 w-8" />
            <p className="text-sm">预览加载超时</p>
            <a
              href={url}
              download={fileName}
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <Download className="h-4 w-4" />
              下载文件
            </a>
          </div>
        ) : (
          <iframe
            src={src}
            title={fileName ?? 'Office preview'}
            onLoad={() => setLoading(false)}
            className="h-full w-full border-0"
          />
        )}
      </div>
    </div>
  )
}
