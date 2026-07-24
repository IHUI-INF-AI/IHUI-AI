'use client'

import * as React from 'react'
import { Loader2, FileText, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button, Input, Label } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import {
  ToolHeader,
  UploadArea,
  ProgressBar,
  DownloadLink,
  NotAvailableAlert,
  useProcessApi,
} from '../_components/shared'

const POSITIONS = [
  { key: 'top-left', labelKey: 'positions.topLeft', class: 'items-start justify-start' },
  { key: 'top-center', labelKey: 'positions.topCenter', class: 'items-start justify-center' },
  { key: 'top-right', labelKey: 'positions.topRight', class: 'items-start justify-end' },
  { key: 'middle-left', labelKey: 'positions.middleLeft', class: 'items-center justify-start' },
  { key: 'middle-center', labelKey: 'positions.middleCenter', class: 'items-center justify-center' },
  { key: 'middle-right', labelKey: 'positions.middleRight', class: 'items-center justify-end' },
  { key: 'bottom-left', labelKey: 'positions.bottomLeft', class: 'items-end justify-start' },
  { key: 'bottom-center', labelKey: 'positions.bottomCenter', class: 'items-end justify-center' },
  { key: 'bottom-right', labelKey: 'positions.bottomRight', class: 'items-end justify-end' },
]

export default function PdfWatermarkPage() {
  const t = useTranslations('pdfWatermarkPage')
  const [file, setFile] = React.useState<File | null>(null)
  const [text, setText] = React.useState(t('defaultText'))
  const [fontSize, setFontSize] = React.useState(48)
  const [color, setColor] = React.useState('#888888')
  const [opacity, setOpacity] = React.useState(20)
  const [position, setPosition] = React.useState('middle-center')
  const [rotation, setRotation] = React.useState(-30)
  const { loading, progress, result, error, run } = useProcessApi('/api/pdf-service/watermark')

  const handleSubmit = () => {
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    fd.append('text', text)
    fd.append('fontSize', String(fontSize))
    fd.append('color', color)
    fd.append('opacity', String(opacity))
    fd.append('position', position)
    fd.append('rotation', String(rotation))
    run(fd)
  }

  const posClass = POSITIONS.find((p) => p.key === position)?.class ?? 'items-center justify-center'

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <ToolHeader title={t('title')} description={t('description')} />
      {!file ? (
        <UploadArea
          accept="application/pdf"
          onFiles={(fs) => setFile(fs[0] ?? null)}
          label={t('uploadLabel')}
        />
      ) : (
        <div className="flex items-center gap-3 rounded-lg border bg-card p-3 text-sm">
          <FileText className="h-4 w-4 shrink-0 text-primary" />
          <span className="flex-1 truncate">{file.name}</span>
          <span className="text-xs text-muted-foreground">
            {(file.size / 1024).toFixed(1)} {t('fileSizeUnit')}
          </span>
          <Button variant="ghost" size="icon" onClick={() => setFile(null)} aria-label={t('remove')}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="wm-text">{t('text')}</Label>
          <Input id="wm-text" value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="wm-size">
            {t('fontSize')}：{fontSize}
          </Label>
          <Input
            id="wm-size"
            type="range"
            min={12}
            max={120}
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="wm-color">{t('color')}</Label>
          <Input
            id="wm-color"
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-9 w-full p-1"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="wm-opacity">
            {t('opacity')}：{opacity}%
          </Label>
          <Input
            id="wm-opacity"
            type="range"
            min={5}
            max={100}
            value={opacity}
            onChange={(e) => setOpacity(Number(e.target.value))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="wm-rotation">
            {t('rotation')}：{rotation}°
          </Label>
          <Input
            id="wm-rotation"
            type="range"
            min={-90}
            max={90}
            value={rotation}
            onChange={(e) => setRotation(Number(e.target.value))}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>{t('position')}</Label>
        <div className="grid grid-cols-3 gap-2">
          {POSITIONS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPosition(p.key)}
              className={cn(
                'rounded-md border px-3 py-2 text-sm transition-colors',
                position === p.key
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'hover:bg-accent',
              )}
            >
              {t(p.labelKey)}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label>{t('preview')}</Label>
        <div className="flex h-40 rounded-lg border bg-card p-4">
          <div className={cn('flex w-full', posClass)}>
            <span
              className="font-medium"
              style={{
                fontSize: `${Math.min(fontSize, 48)}px`,
                color,
                opacity: opacity / 100,
                transform: `rotate(${rotation}deg)`,
              }}
            >
              {text || t('placeholder')}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={handleSubmit} disabled={loading || !file}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? t('submitting') : t('submit')}
        </Button>
      </div>
      {(loading || progress > 0) && <ProgressBar value={progress} />}
      {error && <NotAvailableAlert />}
      {result && (
        <div className="rounded-lg border bg-card p-3">
          <DownloadLink url={result.url} filename={result.filename} />
        </div>
      )}
    </div>
  )
}
