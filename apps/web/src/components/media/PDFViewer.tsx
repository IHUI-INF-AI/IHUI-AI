// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Loader2,
  AlertCircle,
  Type,
  MessageSquare,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/feedback'
import { toast } from '@/components/common'
import type { PreviewAnnotationPin } from '@/lib/document-annotations'
import { reviewDocumentFragment, saveAiFindings } from '@/lib/document-annotations'
import { AnnotationAnchorCapture } from '@/components/chat/annotation-anchor'
import { PDFTextLayer } from './PDFTextLayer'

interface PDFViewerProps {
  url: string
  className?: string
  initialScale?: number
  /** 文档中心下发的 PDF 页级批注 pin */
  annotationPins?: readonly PreviewAnnotationPin[]
  focusedAnnotationId?: string | null
  onAnnotationSelect?: (id: string) => void
  /** 文档中心场景才有 documentId;聊天附件不传,不出现 AI 预审入口 */
  documentId?: string
  documentName?: string
  onAnnotationsMutated?: () => void
}

/* eslint-disable @typescript-eslint/no-explicit-any -- PDF.js API 类型定义不完整,用 any 简化集成 */
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
      // public/ 静态资源默认带 7 天缓存;每次 pdfjs 升级后浏览器仍可能拿旧 worker,
      // 与主线程版本不一致会报 `Unknown action from worker: test` 并永久转圈。
      // 把主线程自己的版本作为查询参数,既复用同版本缓存,又天然绕开旧版本缓存。
      const workerVersion = typeof pdfjs.version === 'string' ? pdfjs.version : ''
      pdfjs.GlobalWorkerOptions.workerSrc = `/pdfjs/pdf.worker.min.mjs${
        workerVersion ? `?v=${encodeURIComponent(workerVersion)}` : ''
      }`
      return pdfjs
    })()
  }
  return pdfjsPromise
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function PDFViewer({
  url,
  className,
  initialScale = 1.2,
  annotationPins = [],
  focusedAnnotationId = null,
  onAnnotationSelect,
  documentId,
  documentName,
  onAnnotationsMutated,
}: PDFViewerProps) {
  const t = useTranslations('a11y')
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const pageRef = React.useRef<HTMLDivElement>(null)
  const docRef = React.useRef<AnyPdfDoc | null>(null)
  const [numPages, setNumPages] = React.useState(0)
  const [page, setPage] = React.useState(1)
  const [scale, setScale] = React.useState(initialScale)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [rendering, setRendering] = React.useState(false)
  const [aiReviewBusy, setAiReviewBusy] = React.useState(false)
  const [textSelectable, setTextSelectable] = React.useState(true)
  const [pdfjsState, setPdfjsState] = React.useState<AnyPdfLib | null>(null)
  const [pdfSelection, setPdfSelection] = React.useState<{
    readonly page: number
    readonly excerpt: string
  } | null>(null)
  const [pageState, setPageState] = React.useState<{
    pdfPage: AnyPdfPage | null
    viewport: AnyViewport | null
  }>({ pdfPage: null, viewport: null })
  const pagePins = React.useMemo(
    () => annotationPins.filter((pin) => pin.kind === 'pdf' && pin.page === page),
    [annotationPins, page],
  )

  const runAiReview = React.useCallback(async () => {
    if (!documentId || !pageState.pdfPage || aiReviewBusy) return
    setAiReviewBusy(true)
    try {
      const content = await pageState.pdfPage.getTextContent()
      const text = (content?.items ?? [])
        .map((item: { str?: string }) => (typeof item.str === 'string' ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
      if (text.length < 20) {
        toast.error('本页没有可审阅的文字（可能是扫描页）')
        return
      }
      const findings = await reviewDocumentFragment({
        title: documentName || 'PDF 文档',
        anchor: { kind: 'pdf', page },
        text: text.slice(0, 12_000),
      })
      if (findings.length === 0) {
        toast.success('AI 预审完成：本页没有发现需要标注的问题')
        return
      }
      const saved = await saveAiFindings({
        documentId,
        label: `PDF 第 ${page} 页 · AI 预审`,
        anchorKind: 'pdf',
        anchor: { kind: 'pdf', page },
        findings,
      })
      onAnnotationsMutated?.()
      if (saved.created.length === 0) {
        toast.success('AI 预审没有新增意见（同一位置已去重）')
      } else {
        toast.success(`AI 预审发现 ${saved.created.length} 条新意见`)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'AI 预审失败，请稍后重试')
    } finally {
      setAiReviewBusy(false)
    }
  }, [aiReviewBusy, documentId, documentName, onAnnotationsMutated, page, pageState.pdfPage])

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
        setError(t('pdfLoadFailed', { message: e?.message ?? t('unknownError') }))
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // t 来自 use-intl 的 React.useMemo 翻译器,重渲染间引用稳定,本 effect 不会因此多跑;
    // 仅当 locale/messages 真变化时重载文档,错误文案随之取新词。
  }, [url, t])

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
            setError(t('renderFailed', { message: e?.message ?? t('unknownError') }))
          }
        }
      })

    return () => {
      cancelled = true
      renderTask?.cancel()
    }
    // t 引用稳定(见上方同一说明),本 effect 不会因加入依赖而多跑;
    // 换语言时重渲染当前页,失败文案取新词。
    // loading/url 必须在依赖里:loading 期间组件在下面早退,canvas 根本不在树上,
    // 这一格 effect 会命中 `!canvasRef.current` 直接 return;文档加载完 page/scale 并未变
    // ⇒ 原实现不再重跑,用户看到**只有工具条与页码、正文整片空白**,必须手动翻页才出画面。
  }, [page, scale, t, loading, url])

  // D91 补口(2026-11-27):PDF 透明文本层已有真实选区能力，翻页/换文件时清掉旧页锚，
  // mouseup 只在页面容器内采锚，避免把工具栏点击误判成选区。
  React.useEffect(() => {
    setPdfSelection(null)
  }, [page, url])

  React.useEffect(() => {
    const container = pageRef.current
    if (!container || !textSelectable) return
    const handlePdfMouseUp = (): void => {
      const sel = document.getSelection()
      const text = sel?.toString().trim() ?? ''
      if (!sel || sel.isCollapsed || !text) {
        setPdfSelection(null)
        return
      }
      const anchorNode = sel.anchorNode
      if (!anchorNode || !container.contains(anchorNode)) {
        setPdfSelection(null)
        return
      }
      setPdfSelection({ page, excerpt: text.slice(0, 200) })
    }
    container.addEventListener('mouseup', handlePdfMouseUp)
    return () => {
      container.removeEventListener('mouseup', handlePdfMouseUp)
    }
  }, [page, pageState.viewport, textSelectable])

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
        <p className="text-body">{error}</p>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col bg-muted/30', className)}>
      <div className="flex items-center justify-between bg-background px-3 py-1.5">
        <div className="flex items-center gap-2">
          <Tooltip content={t('prevPage')}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              aria-label={t('previous')}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </Tooltip>
          <span className="text-label">
            {page} / {numPages}
          </span>
          <Tooltip content={t('nextPage')}>
            <button
              onClick={() => setPage((p) => Math.min(numPages, p + 1))}
              disabled={page >= numPages}
              aria-label={t('next')}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </Tooltip>
        </div>
        <div className="flex items-center gap-1">
          <Tooltip content={t('zoomOut')}>
            <button
              onClick={() => setScale((s) => Math.max(0.5, s - 0.2))}
              aria-label={t('zoomOut')}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
          </Tooltip>
          <span className="w-12 text-center text-label">{Math.round(scale * 100)}%</span>
          <Tooltip content={t('zoomIn')}>
            <button
              onClick={() => setScale((s) => Math.min(3, s + 0.2))}
              aria-label={t('zoomIn')}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
          </Tooltip>
          {documentId ? (
            <Tooltip content="AI 预审本页">
              <button
                type="button"
                onClick={() => void runAiReview()}
                disabled={aiReviewBusy || !pageState.pdfPage}
                aria-label="AI 预审本页"
                className="flex items-center gap-1 rounded-md bg-violet-600 px-2 py-1 text-[11px] font-medium text-white transition-colors hover:bg-violet-700 disabled:opacity-60"
              >
                {aiReviewBusy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                AI 预审
              </button>
            </Tooltip>
          ) : null}
          <Tooltip content={textSelectable ? t('textSelectionOff') : t('textSelectionOn')}>
            <button
              onClick={() => setTextSelectable((v) => !v)}
              className={cn(
                'rounded-md p-1 transition-colors hover:bg-accent',
                textSelectable ? 'bg-primary/10 text-primary' : 'text-muted-foreground',
              )}
            >
              <Type className="h-4 w-4" />
            </button>
          </Tooltip>
        </div>
      </div>
      {pdfSelection ? (
        <div className="border-y bg-background p-2" data-testid="pdf-anchor-capture">
          <AnnotationAnchorCapture
            anchor={{ kind: 'pdf', page: pdfSelection.page }}
            initialNote={pdfSelection.excerpt}
            source="pdf-selection"
            onDispose={() => setPdfSelection(null)}
          />
        </div>
      ) : null}
      <div className="relative flex-1 overflow-auto">
        {rendering && (
          <div className="absolute right-3 top-3 z-10 rounded bg-black/60 px-2 py-1 text-label text-white">
            {t('rendering')}
          </div>
        )}
        <div
          ref={pageRef}
          data-testid="pdf-page"
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
          {pagePins.length > 0 ? (
            <div
              className="pointer-events-none absolute right-2 top-2 z-40 flex flex-col items-end gap-1.5"
              data-testid="pdf-annotation-pins"
            >
              {pagePins.map((pin, index) => (
                <Tooltip key={pin.id} content={pin.label}>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      onAnnotationSelect?.(pin.id)
                    }}
                    aria-label={`${pin.label}: ${pin.body}`}
                    title={pin.body}
                    data-testid="pdf-annotation-pin"
                    data-annotation-id={pin.id}
                    data-annotation-status={pin.status}
                    data-annotation-focused={focusedAnnotationId === pin.id ? 'true' : undefined}
                    className={cn(
                      'pointer-events-auto flex h-7 min-w-7 items-center justify-center gap-1 rounded-full px-1.5 text-[10px] font-semibold text-white shadow-md ring-2 ring-white/80 transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500',
                      pin.status === 'resolved' ? 'bg-emerald-600' : 'bg-violet-600',
                      focusedAnnotationId === pin.id && 'ring-4 ring-violet-300',
                    )}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span className="tabular-nums">{index + 1}</span>
                  </button>
                </Tooltip>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
