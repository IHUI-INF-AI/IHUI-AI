'use client'

import * as React from 'react'
import Image from 'next/image'
import { FileText, File } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FilePreviewProps {
  url: string
  type?: 'pdf' | 'office' | 'image' | 'text' | 'auto'
  name?: string
  className?: string
}

export function FilePreview({ url, type = 'auto', name, className }: FilePreviewProps) {
  const detectedType = React.useMemo(() => {
    if (type !== 'auto') return type
    const ext = url.split('.').pop()?.toLowerCase()
    if (ext === 'pdf') return 'pdf'
    if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext ?? '')) return 'office'
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext ?? '')) return 'image'
    if (['txt', 'md', 'json', 'csv', 'log'].includes(ext ?? '')) return 'text'
    return 'text'
  }, [url, type])

  if (detectedType === 'image') {
    return (
      <Image
        src={url}
        alt={name ?? 'preview'}
        width={800}
        height={600}
        unoptimized
        className={cn('h-auto w-auto max-h-full max-w-full object-contain', className)}
      />
    )
  }

  if (detectedType === 'pdf') {
    return (
      <iframe
        src={url}
        title={name ?? 'PDF preview'}
        className={cn('h-full w-full border-0', className)}
      />
    )
  }

  if (detectedType === 'office') {
    const encoded = encodeURIComponent(url)
    return (
      <div className="flex flex-col h-full">
        <div className="px-3 py-1.5 text-xs text-muted-foreground bg-muted border-b">
          Office 文件预览由微软在线服务提供，文件 URL 将发送至 view.officeapps.live.com
        </div>
        <iframe
          src={`https://view.officeapps.live.com/op/embed.aspx?src=${encoded}`}
          title={name ?? 'Office preview'}
          className={cn('h-full w-full border-0 flex-1', className)}
        />
      </div>
    )
  }

  return <TextPreview url={url} name={name} className={className} />
}

function TextPreview({ url, name, className }: { url: string; name?: string; className?: string }) {
  const [content, setContent] = React.useState<string>('')
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState(false)

  React.useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(false)
    fetch(url, { signal: controller.signal })
      .then((res) => res.text())
      .then((text) => {
        setContent(text)
        setLoading(false)
      })
      .catch(() => {
        if (controller.signal.aborted) return
        setError(true)
        setLoading(false)
      })
    return () => controller.abort()
  }, [url])

  if (loading) return <div className="p-4 text-sm text-muted-foreground">加载中...</div>
  if (error)
    return (
      <div className="flex flex-col items-center gap-2 p-8 text-muted-foreground">
        <File className="h-10 w-10" />
        <p className="text-sm">无法预览此文件</p>
        {name && <FileText className="h-4 w-4" />}
      </div>
    )

  return (
    <pre className={cn('overflow-auto rounded-md bg-muted p-4 text-sm', className)}>
      <code>{content}</code>
    </pre>
  )
}
