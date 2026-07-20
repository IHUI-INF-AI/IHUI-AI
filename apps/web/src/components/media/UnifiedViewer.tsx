'use client'

import * as React from 'react'
import Image from 'next/image'
import { Download, Maximize2, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/feedback'
import { OfficeViewer } from './OfficeViewer'
import { ThreeDViewer } from './ThreeDViewer'
import { PDFViewer } from './PDFViewer'

interface UnifiedViewerProps {
  url: string
  fileName: string
  className?: string
}

type ViewerKind = 'pdf' | 'office' | '3d' | 'image' | 'video' | 'text' | 'other'

function detectKind(fileName: string): ViewerKind {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'pdf') return 'pdf'
  if (['docx', 'xlsx', 'pptx'].includes(ext)) return 'office'
  if (['glb', 'gltf', 'obj', 'stl'].includes(ext)) return '3d'
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'image'
  if (['mp4', 'webm', 'mov'].includes(ext)) return 'video'
  if (['txt', 'md'].includes(ext)) return 'text'
  return 'other'
}

export function UnifiedViewer({ url, fileName, className }: UnifiedViewerProps) {
  const kind = React.useMemo(() => detectKind(fileName), [fileName])
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [textContent, setTextContent] = React.useState('')

  const toggleFullscreen = () => {
    const el = containerRef.current
    if (!el) return
    if (document.fullscreenElement) document.exitFullscreen()
    else el.requestFullscreen()
  }

  React.useEffect(() => {
    if (kind !== 'text') return
    let aborted = false
    fetch(url)
      .then((r) => r.text())
      .then((t) => !aborted && setTextContent(t))
      .catch(() => !aborted && setTextContent('无法加载文件内容'))
    return () => {
      aborted = true
    }
  }, [url, kind])

  const fmt = fileName.split('.').pop()?.toLowerCase() as 'glb' | 'gltf' | 'obj' | 'stl' | undefined

  return (
    <div
      ref={containerRef}
      className={cn('flex h-full w-full flex-col rounded-lg border', className)}
    >
      <div className="flex items-center justify-between border-b bg-muted/50 px-3 py-1.5">
        <span className="flex items-center gap-1.5 truncate text-sm font-medium">
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{fileName}</span>
        </span>
        <div className="flex items-center gap-1">
          <a
            href={url}
            download={fileName}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            title="下载"
          >
            <Download className="h-4 w-4" />
          </a>
          <Tooltip content="全屏">
            <button
              onClick={toggleFullscreen}
              className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </Tooltip>
        </div>
      </div>
      <div className="relative flex-1 overflow-hidden">
        {kind === 'pdf' && <PDFViewer url={url} className="h-full" />}
        {kind === 'office' && <OfficeViewer url={url} fileName={fileName} className="h-full" />}
        {kind === '3d' && <ThreeDViewer url={url} format={fmt ?? 'glb'} className="h-full" />}
        {kind === 'image' && (
          <Image
            src={url}
            alt={fileName}
            fill
            sizes="100vw"
            className="object-contain"
            unoptimized
          />
        )}
        {kind === 'video' && (
          <video src={url} controls className="h-full w-full">
            <track kind="captions" />
          </video>
        )}
        {kind === 'text' && (
          <pre className="h-full overflow-auto bg-muted p-3 text-sm">
            <code>{textContent}</code>
          </pre>
        )}
        {kind === 'other' && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <FileText className="h-8 w-8" />
            <p className="text-sm">不支持预览此文件格式</p>
            <a href={url} download={fileName} className="text-sm text-primary hover:underline">
              下载文件
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
