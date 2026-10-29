// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// D124 / G-238(2026-10-23):位图标注编辑器 —— 发送前的截图/图片圈选、箭头、画笔、文字。
//
// 边界(票面明写):D42 是浏览器 DOM 批注(点选元素/区域回传),本件是**位图画布**标注,
// 两者不可互替。本件为独立纯前端组件:只在 canvas 上画,零新依赖,不碰上传链路;
// 回填走宿主传入的 onApply(dataURL),宿主再复用既有附件上传/引用通道。
//
// 实现要点:
// - 标注只存矢量形态(AnnotationShape),撤销/重做 = 形状栈进出,不存整张位图快照;
// - 每次状态变化重绘:底图 + 已提交形状 + 正在拖拽的草稿,导出时再同步重绘一次;
// - 文字工具不用原生 prompt(AGENTS §4 禁用),文本在工具条输入框里先写、再点图落位;
// - 工具条/配色/线宽全部 lucide 图标 + 项目 Tooltip/Button/Dialog,无原生 dialog/title。

import * as React from 'react'
import { ArrowUpRight, Loader2, Pencil, Redo2, Square, Type, Undo2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from '@ihui/ui-react'
import { Tooltip } from '@/components/feedback'
import { cn } from '@/lib/utils'

export type AnnotationTool = 'rect' | 'arrow' | 'pen' | 'text'

export interface AnnotationPoint {
  x: number
  y: number
}

export interface AnnotationShape {
  tool: AnnotationTool
  color: string
  lineWidth: number
  /** rect/arrow = [起点, 终点];pen = 折线点列;text = [落点] */
  points: AnnotationPoint[]
  text?: string
}

/** 标注配色(画布值 + 调色板色块 class;色块不用 inline style,保持单一视觉源头) */
const ANNOTATION_COLORS = [
  { value: '#ef4444', className: 'bg-red-500' },
  { value: '#f59e0b', className: 'bg-amber-500' },
  { value: '#22c55e', className: 'bg-emerald-500' },
  { value: '#3b82f6', className: 'bg-blue-500' },
  { value: '#111827', className: 'bg-neutral-900' },
] as const

const ANNOTATION_LINE_WIDTHS = [2, 4, 8] as const

const DEFAULT_COLOR = '#ef4444'
const DEFAULT_LINE_WIDTH = 4

/** 画布最长边上限:大截图按比例缩到该值内,导出即为该分辨率,避免一次标注撑爆内存 */
const MAX_CANVAS_EDGE = 1600
/** 拖拽小于该距离(px)不落形状,过滤误点 */
const MIN_SHAPE_SIZE = 3

type AnnotatorStatus = 'loading' | 'ready' | 'error'

/**
 * 把底图 + 形状栈画到 canvas(纯函数,导出供测试/宿主复用)。
 * 坐标一律按 canvas 内部像素,不做 DPR 缩放 —— 导出 PNG 尺寸与 canvas 一致。
 */
export function renderAnnotations(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | null,
  width: number,
  height: number,
  shapes: readonly AnnotationShape[],
): void {
  ctx.clearRect(0, 0, width, height)
  if (image) ctx.drawImage(image, 0, 0, width, height)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  for (const shape of shapes) {
    ctx.strokeStyle = shape.color
    ctx.fillStyle = shape.color
    ctx.lineWidth = shape.lineWidth
    const start = shape.points[0]
    if (!start) continue
    const end = shape.points[shape.points.length - 1] ?? start

    if (shape.tool === 'rect') {
      ctx.strokeRect(
        Math.min(start.x, end.x),
        Math.min(start.y, end.y),
        Math.abs(end.x - start.x),
        Math.abs(end.y - start.y),
      )
      continue
    }

    if (shape.tool === 'arrow') {
      ctx.beginPath()
      ctx.moveTo(start.x, start.y)
      ctx.lineTo(end.x, end.y)
      ctx.stroke()
      const angle = Math.atan2(end.y - start.y, end.x - start.x)
      const head = Math.max(8, shape.lineWidth * 4)
      ctx.beginPath()
      ctx.moveTo(end.x, end.y)
      ctx.lineTo(
        end.x - head * Math.cos(angle - Math.PI / 6),
        end.y - head * Math.sin(angle - Math.PI / 6),
      )
      ctx.moveTo(end.x, end.y)
      ctx.lineTo(
        end.x - head * Math.cos(angle + Math.PI / 6),
        end.y - head * Math.sin(angle + Math.PI / 6),
      )
      ctx.stroke()
      continue
    }

    if (shape.tool === 'pen') {
      if (shape.points.length === 1) {
        ctx.beginPath()
        ctx.arc(start.x, start.y, shape.lineWidth / 2, 0, Math.PI * 2)
        ctx.fill()
        continue
      }
      ctx.beginPath()
      ctx.moveTo(start.x, start.y)
      for (let i = 1; i < shape.points.length; i += 1) {
        const point = shape.points[i]
        if (point) ctx.lineTo(point.x, point.y)
      }
      ctx.stroke()
      continue
    }

    if (shape.text) {
      ctx.font = `${Math.max(16, shape.lineWidth * 4)}px sans-serif`
      ctx.fillText(shape.text, start.x, start.y)
    }
  }
}

/** dataURL → File:回填复用既有附件上传通道时转成浏览器 File,不另造上传逻辑。 */
export function dataUrlToFile(dataUrl: string, fileName: string): File {
  const comma = dataUrl.indexOf(',')
  const header = comma >= 0 ? dataUrl.slice(0, comma) : ''
  const body = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
  const mime = /data:([^;]+)/.exec(header)?.[1] ?? 'image/png'
  const binary = atob(body)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return new File([bytes], fileName, { type: mime })
}

export interface ImageAnnotatorProps {
  open: boolean
  /** 待标注图片(本地 objectURL / 服务端 URL 均可) */
  imageUrl: string | null
  onClose: () => void
  /** 应用标注:回传 PNG dataURL,由宿主回填为发送附件 */
  onApply: (dataUrl: string) => void
}

interface ToolButtonProps {
  active: boolean
  label: string
  testId: string
  onClick: () => void
  children: React.ReactNode
}

function ToolButton({ active, label, testId, onClick, children }: ToolButtonProps) {
  return (
    <Tooltip content={label}>
      <Button
        type="button"
        variant={active ? 'secondary' : 'ghost'}
        size="icon-sm"
        aria-label={label}
        aria-pressed={active}
        onClick={onClick}
        data-testid={testId}
      >
        {children}
      </Button>
    </Tooltip>
  )
}

export function ImageAnnotator({ open, imageUrl, onClose, onApply }: ImageAnnotatorProps) {
  const t = useTranslations('chat')
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const imageRef = React.useRef<HTMLImageElement | null>(null)
  const [status, setStatus] = React.useState<AnnotatorStatus>('loading')
  const [canvasSize, setCanvasSize] = React.useState({ width: 0, height: 0 })
  const [tool, setTool] = React.useState<AnnotationTool>('rect')
  const [color, setColor] = React.useState<string>(DEFAULT_COLOR)
  const [lineWidth, setLineWidth] = React.useState<number>(DEFAULT_LINE_WIDTH)
  const [shapes, setShapes] = React.useState<AnnotationShape[]>([])
  const [redoStack, setRedoStack] = React.useState<AnnotationShape[]>([])
  const [draft, setDraft] = React.useState<AnnotationShape | null>(null)
  const [textDraft, setTextDraft] = React.useState('')

  // 打开(或换图)时重置画布:形状栈清空、图片重新加载,失败态显式呈现而不是空白画布。
  React.useEffect(() => {
    if (!open) return
    setShapes([])
    setRedoStack([])
    setDraft(null)
    setTextDraft('')
    setStatus('loading')
    setCanvasSize({ width: 0, height: 0 })
    imageRef.current = null
    if (!imageUrl) {
      setStatus('error')
      return
    }
    let cancelled = false
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      if (cancelled) return
      imageRef.current = image
      const naturalWidth = image.naturalWidth || image.width || MAX_CANVAS_EDGE
      const naturalHeight = image.naturalHeight || image.height || MAX_CANVAS_EDGE
      const scale = Math.min(1, MAX_CANVAS_EDGE / Math.max(naturalWidth, naturalHeight))
      setCanvasSize({
        width: Math.max(1, Math.round(naturalWidth * scale)),
        height: Math.max(1, Math.round(naturalHeight * scale)),
      })
      setStatus('ready')
    }
    image.onerror = () => {
      if (!cancelled) setStatus('error')
    }
    image.src = imageUrl
    return () => {
      cancelled = true
      image.onload = null
      image.onerror = null
    }
  }, [open, imageUrl])

  // 状态变化即重绘:己提交形状 + 正在拖拽的草稿都在这一处叠加,保证所见即导出。
  React.useEffect(() => {
    if (status !== 'ready') return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const scene = draft ? [...shapes, draft] : shapes
    renderAnnotations(ctx, imageRef.current, canvas.width, canvas.height, scene)
  }, [status, canvasSize, shapes, draft])

  const pointFromEvent = (e: React.PointerEvent<HTMLCanvasElement>): AnnotationPoint => {
    const canvas = e.currentTarget
    const rect = canvas.getBoundingClientRect()
    const scaleX = rect.width > 0 ? canvas.width / rect.width : 1
    const scaleY = rect.height > 0 ? canvas.height / rect.height : 1
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (status !== 'ready') return
    e.preventDefault()
    const canvas = e.currentTarget
    // happy-dom 未实现 setPointerCapture:拿不到捕获只影响拖出画布的手感,不得抛错
    if (typeof canvas.setPointerCapture === 'function') canvas.setPointerCapture(e.pointerId)
    const point = pointFromEvent(e)
    if (tool === 'text') {
      const text = textDraft.trim()
      if (!text) return
      setShapes((prev) => [...prev, { tool: 'text', color, lineWidth, points: [point], text }])
      setRedoStack([])
      return
    }
    setDraft({ tool, color, lineWidth, points: [point, point] })
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!draft) return
    const point = pointFromEvent(e)
    setDraft((prev) => {
      if (!prev) return prev
      if (prev.tool === 'pen') return { ...prev, points: [...prev.points, point] }
      const start = prev.points[0] ?? point
      return { ...prev, points: [start, point] }
    })
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget
    if (typeof canvas.releasePointerCapture === 'function') {
      try {
        canvas.releasePointerCapture(e.pointerId)
      } catch {
        // 指针已释放(浏览器自行取消捕获)时 release 会抛,忽略
      }
    }
    if (!draft) return
    const start = draft.points[0]
    const end = draft.points[draft.points.length - 1] ?? start
    const distance = start && end ? Math.hypot(end.x - start.x, end.y - start.y) : 0
    const meaningful = draft.tool === 'pen' ? draft.points.length > 1 : distance >= MIN_SHAPE_SIZE
    if (meaningful) {
      setShapes((prev) => [...prev, draft])
      setRedoStack([])
    }
    setDraft(null)
  }

  const handleUndo = () => {
    const last = shapes[shapes.length - 1]
    if (!last) return
    setShapes(shapes.slice(0, -1))
    setRedoStack([...redoStack, last])
  }

  const handleRedo = () => {
    const last = redoStack[redoStack.length - 1]
    if (!last) return
    setRedoStack(redoStack.slice(0, -1))
    setShapes([...shapes, last])
  }

  const handleApply = () => {
    const canvas = canvasRef.current
    if (!canvas || status !== 'ready') return
    // 同步重绘一次再导出,不依赖 React effect 的调用时机(避免最后一次笔划未落盘)
    const ctx = canvas.getContext('2d')
    if (ctx) renderAnnotations(ctx, imageRef.current, canvas.width, canvas.height, shapes)
    const dataUrl = canvas.toDataURL('image/png')
    if (!dataUrl) return
    onApply(dataUrl)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent className="min-[640px]:max-w-3xl" data-testid="image-annotator">
        <DialogHeader>
          <DialogTitle>{t('contextUsage.annotator.title')}</DialogTitle>
          <DialogDescription>{t('contextUsage.annotator.hint')}</DialogDescription>
        </DialogHeader>

        {/* 工具栏:工具 / 撤销重做 / 配色 / 线宽(文字工具激活时补文本输入框) */}
        <div className="flex flex-wrap items-center gap-1.5">
          <ToolButton
            active={tool === 'rect'}
            label={t('contextUsage.annotator.rect')}
            testId="image-annotator-tool-rect"
            onClick={() => setTool('rect')}
          >
            <Square />
          </ToolButton>
          <ToolButton
            active={tool === 'arrow'}
            label={t('contextUsage.annotator.arrow')}
            testId="image-annotator-tool-arrow"
            onClick={() => setTool('arrow')}
          >
            <ArrowUpRight />
          </ToolButton>
          <ToolButton
            active={tool === 'pen'}
            label={t('contextUsage.annotator.pen')}
            testId="image-annotator-tool-pen"
            onClick={() => setTool('pen')}
          >
            <Pencil />
          </ToolButton>
          <ToolButton
            active={tool === 'text'}
            label={t('contextUsage.annotator.text')}
            testId="image-annotator-tool-text"
            onClick={() => setTool('text')}
          >
            <Type />
          </ToolButton>

          {tool === 'text' && (
            <Input
              value={textDraft}
              onChange={(e) => setTextDraft(e.target.value)}
              placeholder={t('contextUsage.annotator.textPlaceholder')}
              aria-label={t('contextUsage.annotator.textPlaceholder')}
              data-testid="image-annotator-text-input"
              className="w-48"
            />
          )}

          <span className="ml-1 flex items-center gap-1">
            <Tooltip content={t('contextUsage.annotator.undo')}>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t('contextUsage.annotator.undo')}
                disabled={shapes.length === 0}
                onClick={handleUndo}
                data-testid="image-annotator-undo"
              >
                <Undo2 />
              </Button>
            </Tooltip>
            <Tooltip content={t('contextUsage.annotator.redo')}>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t('contextUsage.annotator.redo')}
                disabled={redoStack.length === 0}
                onClick={handleRedo}
                data-testid="image-annotator-redo"
              >
                <Redo2 />
              </Button>
            </Tooltip>
          </span>

          <div
            className="ml-1 flex items-center gap-1.5"
            role="group"
            aria-label={t('contextUsage.annotator.color')}
          >
            {ANNOTATION_COLORS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-label={option.value}
                aria-pressed={color === option.value}
                onClick={() => setColor(option.value)}
                data-testid={`image-annotator-color-${option.value.slice(1)}`}
                className={cn(
                  'h-5 w-5 rounded-sm border transition-shadow',
                  option.className,
                  color === option.value && 'ring-2 ring-ring ring-offset-1',
                )}
              />
            ))}
          </div>

          <div
            className="ml-1 flex items-center gap-0.5"
            role="group"
            aria-label={t('contextUsage.annotator.lineWidth')}
          >
            {ANNOTATION_LINE_WIDTHS.map((width, index) => {
              const label = [
                t('contextUsage.annotator.widthThin'),
                t('contextUsage.annotator.widthMedium'),
                t('contextUsage.annotator.widthThick'),
              ][index]
              return (
                <Tooltip key={width} content={label ?? String(width)}>
                  <Button
                    type="button"
                    variant={lineWidth === width ? 'secondary' : 'ghost'}
                    size="icon-sm"
                    aria-label={label ?? String(width)}
                    aria-pressed={lineWidth === width}
                    onClick={() => setLineWidth(width)}
                    data-testid={`image-annotator-width-${width}`}
                  >
                    <span
                      className={cn(
                        'w-4 rounded-sm bg-current',
                        index === 0 ? 'h-px' : index === 1 ? 'h-0.5' : 'h-1',
                      )}
                    />
                  </Button>
                </Tooltip>
              )
            })}
          </div>
        </div>

        <div
          data-testid="image-annotator-surface"
          data-status={status}
          data-annotation-count={shapes.length}
          className="flex min-h-40 items-center justify-center overflow-auto rounded-lg border bg-muted/40 p-2"
        >
          {status === 'loading' && (
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {t('contextUsage.annotator.loading')}
            </span>
          )}
          {status === 'error' && (
            <span role="alert" className="text-sm text-destructive">
              {t('contextUsage.annotator.loadFailed')}
            </span>
          )}
          <canvas
            ref={canvasRef}
            width={canvasSize.width || 300}
            height={canvasSize.height || 150}
            aria-label={t('contextUsage.annotator.title')}
            data-testid="image-annotator-canvas"
            className={cn(
              'touch-none rounded-md bg-background',
              status === 'ready' ? 'max-h-[60vh] max-w-full' : 'hidden',
            )}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={() => setDraft(null)}
          />
        </div>

        <DialogFooter className="flex-row justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            data-testid="image-annotator-cancel"
          >
            {t('contextUsage.annotator.cancel')}
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            disabled={status !== 'ready'}
            onClick={handleApply}
            data-testid="image-annotator-apply"
          >
            {t('contextUsage.annotator.apply')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ImageAnnotator
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
