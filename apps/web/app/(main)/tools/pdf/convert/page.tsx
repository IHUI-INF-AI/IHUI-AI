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

type Direction =
  'pdf-to-word' | 'pdf-to-excel' | 'pdf-to-image' | 'word-to-pdf' | 'excel-to-pdf' | 'image-to-pdf'

const DIRECTIONS: { key: Direction; label: string; accept: string }[] = [
  { key: 'pdf-to-word', label: 'PDF → Word', accept: '.pdf' },
  { key: 'pdf-to-excel', label: 'PDF → Excel', accept: '.pdf' },
  { key: 'pdf-to-image', label: 'PDF → 图片', accept: '.pdf' },
  { key: 'word-to-pdf', label: 'Word → PDF', accept: '.doc,.docx' },
  { key: 'excel-to-pdf', label: 'Excel → PDF', accept: '.xls,.xlsx' },
  { key: 'image-to-pdf', label: '图片 → PDF', accept: 'image/*' },
]

export default function PdfConvertPage() {
  const [direction, setDirection] = React.useState<Direction>('pdf-to-word')
  const [file, setFile] = React.useState<File | null>(null)
  const [imageFormat, setImageFormat] = React.useState('png')
  const [dpi, setDpi] = React.useState(150)
  const { loading, progress, result, error, run } = useProcessApi('/api/tools/pdf/convert')

  const current = DIRECTIONS.find((d) => d.key === direction)!

  const handleSubmit = () => {
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    fd.append('direction', direction)
    if (direction === 'pdf-to-image') {
      fd.append('format', imageFormat)
      fd.append('dpi', String(dpi))
    }
    run(fd)
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <ToolHeader title="PDF 转换" description="PDF 与 Word / Excel / 图片 之间相互转换" />
      <div className="space-y-2">
        <Label>转换方向</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {DIRECTIONS.map((d) => (
            <button
              key={d.key}
              type="button"
              onClick={() => {
                setDirection(d.key)
                setFile(null)
              }}
              className={cn(
                'rounded-md border px-3 py-2 text-sm transition-colors',
                direction === d.key
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'hover:bg-accent',
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>
      {!file ? (
        <UploadArea
          accept={current.accept}
          onFiles={(fs) => setFile(fs[0] ?? null)}
          label={`点击或拖拽文件到此处上传（${current.label}）`}
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
      {direction === 'pdf-to-image' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>图片格式</Label>
            <div className="flex gap-2">
              {(['png', 'jpg'] as const).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setImageFormat(fmt)}
                  className={cn(
                    'rounded-md border px-4 py-2 text-sm uppercase transition-colors',
                    imageFormat === fmt
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'hover:bg-accent',
                  )}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dpi">DPI：{dpi}</Label>
            <Input
              id="dpi"
              type="range"
              min={72}
              max={600}
              step={1}
              value={dpi}
              onChange={(e) => setDpi(Number(e.target.value))}
            />
          </div>
        </div>
      )}
      <div className="flex items-center gap-3">
        <Button onClick={handleSubmit} disabled={loading || !file}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? '转换中...' : '转换'}
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
