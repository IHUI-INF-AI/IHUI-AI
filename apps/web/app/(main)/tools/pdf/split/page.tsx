'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
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

const MODE_KEYS: SplitMode[] = ['range', 'every', 'bookmarks']

export default function PdfSplitPage() {
  const t = useTranslations('toolsPdfSplitPage')
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
        title={t('title')}
        description={t('description')}
      />
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
          <span className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</span>
          <Button variant="ghost" size="icon" onClick={() => setFile(null)} aria-label={t('removeFile')}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      <div className="space-y-2">
        <Label>{t('modeLabel')}</Label>
        <div className="grid grid-cols-3 gap-2">
          {MODE_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              className={cn(
                'rounded-md border px-3 py-2 text-sm transition-colors',
                mode === key ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-accent',
              )}
            >
              {t(`mode.${key}`)}
            </button>
          ))}
        </div>
      </div>
      {mode === 'range' && (
        <div className="space-y-2">
          <Label htmlFor="ranges">{t('rangesLabel')}</Label>
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
          <Label htmlFor="every">{t('everyLabel')}</Label>
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
          {t('bookmarksHint')}
        </p>
      )}
      <div className="flex items-center gap-3">
        <Button onClick={handleSubmit} disabled={loading || !file}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? t('submitting') : t('submit')}
        </Button>
      </div>
      {(loading || progress > 0) && <ProgressBar value={progress} />}
      {error && <NotAvailableAlert />}
      {result && (
        <div className="space-y-1 rounded-lg border bg-card p-3">
          <p className="text-sm text-muted-foreground">{t('resultHint')}</p>
          <DownloadLink url={result.url} filename={result.filename} />
        </div>
      )}
    </div>
  )
}
