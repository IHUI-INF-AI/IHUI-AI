'use client'

import * as React from 'react'
import { Loader2, FileText, X } from 'lucide-react'
import { Button, Input, Label } from '@ihui/ui'
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
  { key: 'top-left', label: '左上', class: 'items-start justify-start' },
  { key: 'top-center', label: '上中', class: 'items-start justify-center' },
  { key: 'top-right', label: '右上', class: 'items-start justify-end' },
  { key: 'middle-left', label: '左中', class: 'items-center justify-start' },
  { key: 'middle-center', label: '居中', class: 'items-center justify-center' },
  { key: 'middle-right', label: '右中', class: 'items-center justify-end' },
  { key: 'bottom-left', label: '左下', class: 'items-end justify-start' },
  { key: 'bottom-center', label: '下中', class: 'items-end justify-center' },
  { key: 'bottom-right', label: '右下', class: 'items-end justify-end' },
]

export default function PdfWatermarkPage() {
  const [file, setFile] = React.useState<File | null>(null)
  const [text, setText] = React.useState('机密')
  const [fontSize, setFontSize] = React.useState(48)
  const [color, setColor] = React.useState('#888888')
  const [opacity, setOpacity] = React.useState(20)
  const [position, setPosition] = React.useState('middle-center')
  const [rotation, setRotation] = React.useState(-30)
  const { loading, progress, result, error, run } = useProcessApi('/api/tools/pdf/watermark')

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
      <ToolHeader
        title="PDF 水印"
        description="为 PDF 添加文字水印，自定义文本、位置、颜色与旋转角度"
      />
      {!file ? (
        <UploadArea
          accept="application/pdf"
          onFiles={(fs) => setFile(fs[0] ?? null)}
          label="点击或拖拽一个 PDF 文件到此处上传"
        />
      ) : (
        <div className="flex items-center gap-3 rounded-lg border bg-card p-3 text-sm">
          <FileText className="h-4 w-4 shrink-0 text-primary" />
          <span className="flex-1 truncate">{file.name}</span>
          <span className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</span>
          <Button variant="ghost" size="icon" onClick={() => setFile(null)} aria-label="移除">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="wm-text">水印文本</Label>
          <Input id="wm-text" value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="wm-size">字体大小：{fontSize}</Label>
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
          <Label htmlFor="wm-color">颜色</Label>
          <Input
            id="wm-color"
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-9 w-full p-1"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="wm-opacity">透明度：{opacity}%</Label>
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
          <Label htmlFor="wm-rotation">旋转角度：{rotation}°</Label>
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
        <Label>位置</Label>
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
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label>预览</Label>
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
              {text || '水印'}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={handleSubmit} disabled={loading || !file}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? '添加中...' : '添加水印'}
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
