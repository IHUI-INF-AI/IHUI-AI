'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { RotateCcw, RotateCw } from 'lucide-react'
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
const MIN_SCALE = 0.5
const MAX_SCALE = 3
const SCALE_STEP = 0.05

type DrawInfo = { dx: number; dy: number; dw: number; dh: number; iw: number; ih: number }
type CropInfo = { x: number; y: number; size: number }

export function AvatarCropper({ open, src, onConfirm, onCancel }: Props) {
  const t = useTranslations('user.profile')
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const previewRef = React.useRef<HTMLCanvasElement | null>(null)
  const imgRef = React.useRef<HTMLImageElement | null>(null)
  const rotatedRef = React.useRef<HTMLCanvasElement | null>(null)
  const drawRef = React.useRef<DrawInfo>({ dx: 0, dy: 0, dw: 0, dh: 0, iw: 0, ih: 0 })
  const cropRef = React.useRef<CropInfo>({ x: 0, y: 0, size: 0 })
  const dragRef = React.useRef<{ sx: number; sy: number; bx: number; by: number } | null>(null)
  const prevRotRef = React.useRef(0)
  const [loaded, setLoaded] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)
  const [rotation, setRotation] = React.useState(0)
  const [userScale, setUserScale] = React.useState(1)

  React.useEffect(() => {
    if (!open || !src) return
    setLoaded(false)
    setErr(null)
    setRotation(0)
    setUserScale(1)
    prevRotRef.current = 0
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      setLoaded(true)
    }
    img.onerror = () => setErr('load error')
    img.src = src
  }, [open, src])

  React.useEffect(() => {
    if (!loaded || !imgRef.current) return
    const img = imgRef.current
    const iw = img.naturalWidth || img.width
    const ih = img.naturalHeight || img.height
    const swap = rotation === 90 || rotation === 270
    const rw = swap ? ih : iw
    const rh = swap ? iw : ih
    const rc = document.createElement('canvas')
    rc.width = Math.max(1, rw)
    rc.height = Math.max(1, rh)
    const rctx = rc.getContext('2d')
    if (!rctx) return
    rctx.translate(rc.width / 2, rc.height / 2)
    rctx.rotate((rotation * Math.PI) / 180)
    rctx.drawImage(img, -iw / 2, -ih / 2)
    rotatedRef.current = rc
    const totalScale = Math.min(CANVAS_SIZE / rw, CANVAS_SIZE / rh) * userScale
    const dw = Math.max(1, rw * totalScale)
    const dh = Math.max(1, rh * totalScale)
    const dx = (CANVAS_SIZE - dw) / 2
    const dy = (CANVAS_SIZE - dh) / 2
    drawRef.current = { dx, dy, dw, dh, iw: rw, ih: rh }
    if (rotation !== prevRotRef.current) {
      const size = Math.min(dw, dh) * 0.9
      cropRef.current = { x: dx + (dw - size) / 2, y: dy + (dh - size) / 2, size }
    } else {
      const c = cropRef.current
      cropRef.current = {
        x: Math.max(dx, Math.min(dx + dw - c.size, c.x)),
        y: Math.max(dy, Math.min(dy + dh - c.size, c.y)),
        size: c.size,
      }
    }
    prevRotRef.current = rotation
    redraw()
  }, [loaded, rotation, userScale])

  function redraw() {
    const canvas = canvasRef.current
    const src = rotatedRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !src || !ctx) return
    const draw = drawRef.current
    const crop = cropRef.current
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
    ctx.drawImage(src, draw.dx, draw.dy, draw.dw, draw.dh)
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(0, 0, CANVAS_SIZE, draw.dy)
    ctx.fillRect(0, draw.dy, draw.dx, draw.dh)
    ctx.fillRect(draw.dx + draw.dw, draw.dy, CANVAS_SIZE - draw.dx - draw.dw, draw.dh)
    ctx.fillRect(0, draw.dy + draw.dh, CANVAS_SIZE, CANVAS_SIZE - draw.dy - draw.dh)
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'
    ctx.lineWidth = 2
    ctx.strokeRect(crop.x, crop.y, crop.size, crop.size)
    const pctx = previewRef.current?.getContext('2d')
    if (!pctx) return
    const scaleX = draw.iw / draw.dw
    const scaleY = draw.ih / draw.dh
    pctx.clearRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE)
    pctx.drawImage(
      src,
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
    crop.x = Math.max(draw.dx, Math.min(draw.dx + draw.dw - crop.size, drag.bx + (x - drag.sx)))
    crop.y = Math.max(draw.dy, Math.min(draw.dy + draw.dh - crop.size, drag.by + (y - drag.sy)))
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
    setRotation(0)
    setUserScale(1)
    const draw = drawRef.current
    const size = Math.min(draw.dw, draw.dh) * 0.9
    cropRef.current = { x: draw.dx + (draw.dw - size) / 2, y: draw.dy + (draw.dh - size) / 2, size }
    redraw()
  }

  function confirm() {
    const src = rotatedRef.current
    if (!src) return
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
    ctx.drawImage(src, sx, sy, sw, sh, 0, 0, EXPORT_SIZE, EXPORT_SIZE)
    out.toBlob((blob) => blob && onConfirm(blob), 'image/png')
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
          <div className="flex w-full items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => setRotation((r) => (r + 270) % 360)}
              disabled={!loaded}
              title={t('cropRotateLeft')}
              aria-label={t('cropRotateLeft')}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs text-muted-foreground">{t('cropScale')}</span>
            <input
              type="range"
              min={MIN_SCALE}
              max={MAX_SCALE}
              step={SCALE_STEP}
              value={userScale}
              onChange={(e) => setUserScale(Number(e.target.value))}
              disabled={!loaded}
              aria-label={t('cropScale')}
              className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary disabled:opacity-50"
            />
            <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
              {userScale.toFixed(2)}x
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => setRotation((r) => (r + 90) % 360)}
              disabled={!loaded}
              title={t('cropRotateRight')}
              aria-label={t('cropRotateRight')}
            >
              <RotateCw className="h-3.5 w-3.5" />
            </Button>
          </div>
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
