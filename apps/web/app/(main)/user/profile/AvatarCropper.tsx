'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Button } from '@ihui/ui'

interface Props {
  open: boolean
  src: string
  onConfirm: (blob: Blob) => void
  onCancel: () => void
}

const EXPORT_SIZE = 200
const CANVAS_SIZE = 320
const PREVIEW_SIZE = 80

// TODO(后续任务): 实现 changeScale / rotateLeft / rotateRight(放大缩小 / 左旋 / 右旋)

type DrawInfo = { dx: number; dy: number; dw: number; dh: number; iw: number; ih: number }
type CropInfo = { x: number; y: number; size: number }

export function AvatarCropper({ open, src, onConfirm, onCancel }: Props) {
  const t = useTranslations('user.profile')
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const previewRef = React.useRef<HTMLCanvasElement | null>(null)
  const imgRef = React.useRef<HTMLImageElement | null>(null)
  const drawRef = React.useRef<DrawInfo>({ dx: 0, dy: 0, dw: 0, dh: 0, iw: 0, ih: 0 })
  const cropRef = React.useRef<CropInfo>({ x: 0, y: 0, size: 0 })
  const dragRef = React.useRef<{ sx: number; sy: number; bx: number; by: number } | null>(null)
  const [loaded, setLoaded] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open || !src) return
    setLoaded(false)
    setErr(null)
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      const iw = img.naturalWidth || img.width
      const ih = img.naturalHeight || img.height
      const scale = Math.min(CANVAS_SIZE / iw, CANVAS_SIZE / ih)
      const dw = Math.max(1, iw * scale)
      const dh = Math.max(1, ih * scale)
      const dx = (CANVAS_SIZE - dw) / 2
      const dy = (CANVAS_SIZE - dh) / 2
      drawRef.current = { dx, dy, dw, dh, iw, ih }
      const size = Math.min(dw, dh) * 0.9
      cropRef.current = {
        x: dx + (dw - size) / 2,
        y: dy + (dh - size) / 2,
        size,
      }
      redraw()
      setLoaded(true)
    }
    img.onerror = () => setErr('load error')
    img.src = src
  }, [open, src])

  function redraw() {
    const canvas = canvasRef.current
    const preview = previewRef.current
    const img = imgRef.current
    if (!canvas || !img) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const draw = drawRef.current
    const crop = cropRef.current
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
    ctx.drawImage(img, draw.dx, draw.dy, draw.dw, draw.dh)
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(0, 0, CANVAS_SIZE, draw.dy)
    ctx.fillRect(0, draw.dy, draw.dx, draw.dh)
    ctx.fillRect(draw.dx + draw.dw, draw.dy, CANVAS_SIZE - draw.dx - draw.dw, draw.dh)
    ctx.fillRect(0, draw.dy + draw.dh, CANVAS_SIZE, CANVAS_SIZE - draw.dy - draw.dh)
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'
    ctx.lineWidth = 2
    ctx.strokeRect(crop.x, crop.y, crop.size, crop.size)
    if (preview) {
      const pctx = preview.getContext('2d')
      if (pctx) {
        pctx.clearRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE)
        const scaleX = draw.iw / draw.dw
        const scaleY = draw.ih / draw.dh
        pctx.drawImage(
          img,
          (crop.x - draw.dx) * scaleX,
          (crop.y - draw.dy) * scaleY,
          crop.size * scaleX,
          crop.size * scaleY,
          0,
          0,
          PREVIEW_SIZE,
          PREVIEW_SIZE,
        )
      }
    }
  }

  function toCanvasCoord(clientX: number, clientY: number) {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: (clientX - rect.left) * (CANVAS_SIZE / rect.width),
      y: (clientY - rect.top) * (CANVAS_SIZE / rect.height),
    }
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const { x, y } = toCanvasCoord(e.clientX, e.clientY)
    const crop = cropRef.current
    if (x >= crop.x && x <= crop.x + crop.size && y >= crop.y && y <= crop.y + crop.size) {
      dragRef.current = { sx: x, sy: y, bx: crop.x, by: crop.y }
      e.currentTarget.setPointerCapture(e.pointerId)
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dragRef.current) return
    const { x, y } = toCanvasCoord(e.clientX, e.clientY)
    const drag = dragRef.current
    const draw = drawRef.current
    const crop = cropRef.current
    const nx = drag.bx + (x - drag.sx)
    const ny = drag.by + (y - drag.sy)
    const maxX = draw.dx + draw.dw - crop.size
    const maxY = draw.dy + draw.dh - crop.size
    crop.x = Math.max(draw.dx, Math.min(maxX, nx))
    crop.y = Math.max(draw.dy, Math.min(maxY, ny))
    redraw()
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    dragRef.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // noop
    }
  }

  function reset() {
    const draw = drawRef.current
    const size = Math.min(draw.dw, draw.dh) * 0.9
    cropRef.current = {
      x: draw.dx + (draw.dw - size) / 2,
      y: draw.dy + (draw.dh - size) / 2,
      size,
    }
    redraw()
  }

  function confirm() {
    const img = imgRef.current
    if (!img) return
    const draw = drawRef.current
    const crop = cropRef.current
    const scaleX = draw.iw / draw.dw
    const scaleY = draw.ih / draw.dh
    const sx = Math.max(0, (crop.x - draw.dx) * scaleX)
    const sy = Math.max(0, (crop.y - draw.dy) * scaleY)
    const sw = Math.max(1, crop.size * scaleX)
    const sh = Math.max(1, crop.size * scaleY)
    const out = document.createElement('canvas')
    out.width = EXPORT_SIZE
    out.height = EXPORT_SIZE
    const ctx = out.getContext('2d')
    if (!ctx) return
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, EXPORT_SIZE, EXPORT_SIZE)
    out.toBlob((blob) => {
      if (blob) onConfirm(blob)
    }, 'image/png')
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onCancel() : null)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('cropTitle')}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">{t('cropDesc')}</p>
        {err && <div className="text-sm text-destructive">{err}</div>}
        <div className="flex flex-col items-center gap-3">
          <canvas
            ref={canvasRef}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className="max-w-full cursor-move touch-none rounded-md border bg-muted"
          />
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{t('cropPreview')}</span>
            <canvas
              ref={previewRef}
              width={PREVIEW_SIZE}
              height={PREVIEW_SIZE}
              className="rounded-full border bg-muted"
            />
          </div>
          <p className="text-xs text-muted-foreground">{t('cropHint')}</p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            {t('cropCancel')}
          </Button>
          <Button type="button" variant="outline" onClick={reset} disabled={!loaded}>
            {t('cropReset')}
          </Button>
          <Button type="button" onClick={confirm} disabled={!loaded}>
            {t('cropConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
