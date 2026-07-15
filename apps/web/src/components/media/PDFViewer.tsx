'use client'

import * as React from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Loader2,
  AlertCircle,
  Type,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PDFTextLayer } from './PDFTextLayer'

interface PDFViewerProps {
  url: string
  className?: string
  initialScale?: number
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyPdfLib = any
type AnyPdfDoc = any
type AnyPdfPage = any
type AnyViewport = any

let pdfjsPromise: Promise<AnyPdfLib> | null = null

async function loadPdfjs(): Promise<AnyPdfLib> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const mod = await import('pdfjs-dist')
      const pdfjs = mod as AnyPdfLib
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs'
      return pdfjs
    })()
  }
  return pdfjsPromise
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function PDFViewer({ url, className, initialScale = 1.2 }: PDFViewerProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const docRef = React.useRef<AnyPdfDoc | null>(null)
  const [numPages, setNumPages] = React.useState(0)
  const [page, setPage] = React.useState(1)
  const [scale, setScale] = React.useState(initialScale)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [rendering, setRendering] = React.useState(false)
  const [textSelectable, setTextSelectable] = React.useState(true)
  const [pdfjsState, setPdfjsState] = React.useState<AnyPdfLib | null>(null)
  const [pageState, setPageState] = React.useState<{
    pdfPage: AnyPdfPage | null
    viewport: AnyViewport | null
  }>({ pdfPage: null, viewport: null })

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setNumPages(0)
    setPage(1)
    setPageState({ pdfPage: null, viewport: null })

    loadPdfjs()
      .then((pdfjs) => {
        if (cancelled) return
        setPdfjsState(pdfjs)
        return pdfjs.getDocument({ url }).promise
      })
      .then((doc: AnyPdfDoc) => {
        if (cancelled) return
        docRef.current = doc
        setNumPages(doc.numPages)
        setLoading(false)
      })
      .catch((e: Error) => {
        if (cancelled) return
        setError(`PDF 加载失败: ${e?.message ?? '未知错误'}`)
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [url])

  React.useEffect(() => {
    if (!docRef.current || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let cancelled = false
    let renderTask: { cancel: () => void; promise: Promise<void> } | null = null
    setRendering(true)
    setPageState({ pdfPage: null, viewport: null })

    docRef.current
      .getPage(page)
      .then((pdfPage: AnyPdfPage) => {
        if (cancelled) return
        const viewport = pdfPage.getViewport({ scale })
        canvas.height = viewport.height
        canvas.width = viewport.width
        renderTask = pdfPage.render({ canvasContext: ctx, viewport })
        return renderTask?.promise.then(() => {
          if (cancelled) return
          setPageState({ pdfPage, viewport })
        })
      })
      .then(() => {
        if (!cancelled) setRendering(false)
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setRendering(false)
          if (e?.name !== 'RenderingCancelledException') {
            setError(`渲染失败: ${e?.message ?? '未知错误'}`)
          }
        }
      })

    return () => {
      cancelled = true
      renderTask?.cancel()
    }
  }, [page, scale])

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center bg-muted', className)}>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-2 bg-muted text-muted-foreground',
          className,
        )}
      >
        <AlertCircle className="h-8 w-8" />
        <p className="text-sm">{error}</p>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col bg-muted/30', className)}>
      <div className="flex items-center justify-between border-b bg-background px-3 py-1.5">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent disabled:opacity-30"
            title="上一页"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs">
            {page} / {numPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(numPages, p + 1))}
            disabled={page >= numPages}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent disabled:opacity-30"
            title="下一页"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setScale((s) => Math.max(0.5, s - 0.2))}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent"
            title="缩小"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="w-12 text-center text-xs">{Math.round(scale * 100)}%</span>
          <button
            onClick={() => setScale((s) => Math.min(3, s + 0.2))}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent"
            title="放大"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            onClick={() => setTextSelectable((v) => !v)}
            className={cn(
              'rounded p-1 transition-colors hover:bg-accent',
              textSelectable ? 'bg-primary/10 text-primary' : 'text-muted-foreground',
            )}
            title={textSelectable ? '关闭文本选择' : '开启文本选择'}
          >
            <Type className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="relative flex-1 overflow-auto">
        {rendering && (
          <div className="absolute right-3 top-3 z-10 rounded bg-black/60 px-2 py-1 text-xs text-white">
            渲染中...
          </div>
        )}
        <div
          className="relative mx-auto"
          style={{
            width: pageState.viewport ? pageState.viewport.width : undefined,
            height: pageState.viewport ? pageState.viewport.height : undefined,
          }}
        >
          <canvas ref={canvasRef} className="block" />
          {pdfjsState && pageState.pdfPage && pageState.viewport && (
            <PDFTextLayer
              pdfPage={pageState.pdfPage}
              pdfjs={pdfjsState}
              viewportWidth={pageState.viewport.width}
              viewportHeight={pageState.viewport.height}
              viewportTransform={pageState.viewport.transform}
              scale={scale}
              visible={textSelectable}
            />
          )}
        </div>
      </div>
    </div>
  )
}
