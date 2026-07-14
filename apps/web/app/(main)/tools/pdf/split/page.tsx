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

type SplitMode = 'range' | 'every' | 'bookmarks'

export default function PdfSplitPage() {
  const [file, setFile] = React.useState<File | null>(null)
  const [mode, setMode] = React.useState<SplitMode>('range')
  const [ranges, setRanges] = React.useState('1-3,5,7-10')
  const [every, setEvery] = React.useState(1)
  const { loading, progress, result, error, run } = useProcessApi('/api/tools/pdf/split')

  const handleSubmit = () => {
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    fd.append('mode', mode)
    if (mode === 'range') fd.append('ranges', ranges)
    if (mode === 'every') fd.append('every', String(every))
    run(fd)
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <ToolHeader
        title="PDF 拆分"
        description="将一个 PDF 按页码范围、固定页数或书签拆分为多个文件"
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
      <div className="space-y-2">
        <Label>拆分模式</Label>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { key: 'range', label: '按页码范围' },
              { key: 'every', label: '每 N 页一份' },
              { key: 'bookmarks', label: '按书签' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setMode(opt.key)}
              className={cn(
                'rounded-md border px-3 py-2 text-sm transition-colors',
                mode === opt.key ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-accent',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      {mode === 'range' && (
        <div className="space-y-2">
          <Label htmlFor="ranges">页码范围（用逗号分隔，例如 1-3,5,7-10）</Label>
          <Input
            id="ranges"
            value={ranges}
            onChange={(e) => setRanges(e.target.value)}
            placeholder="1-3,5,7-10"
          />
        </div>
      )}
      {mode === 'every' && (
        <div className="space-y-2">
          <Label htmlFor="every">每份页数</Label>
          <Input
            id="every"
            type="number"
            min={1}
            value={every}
            onChange={(e) => setEvery(Math.max(1, Number(e.target.value) || 1))}
          />
        </div>
      )}
      {mode === 'bookmarks' && (
        <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          将按 PDF 内置书签（一级）自动拆分为多个文件。
        </p>
      )}
      <div className="flex items-center gap-3">
        <Button onClick={handleSubmit} disabled={loading || !file}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? '拆分中...' : '拆分'}
        </Button>
      </div>
      {(loading || progress > 0) && <ProgressBar value={progress} />}
      {error && <NotAvailableAlert />}
      {result && (
        <div className="space-y-1 rounded-lg border bg-card p-3">
          <p className="text-sm text-muted-foreground">拆分完成，结果已打包为 ZIP：</p>
          <DownloadLink url={result.url} filename={result.filename} />
        </div>
      )}
    </div>
  )
}
