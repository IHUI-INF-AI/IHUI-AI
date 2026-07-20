'use client'

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  CheckCircle2,
  FileUp,
  History,
  Loader2,
  PackagePlus,
  Upload,
  AlertTriangle,
} from 'lucide-react'

import { Button, Card, CardContent } from '@ihui/ui'
import { Container } from '@/components/layout'
import { Alert } from '@/components/feedback'
import {
  commitImport,
  fetchHistory,
  fetchSources,
  formatSize,
  parseFile,
  sourceLabelKey,
} from './helpers'
import type {
  CliConfigSource,
  ImportConflictStrategy,
  ImportHistoryItem,
  ImportPreview,
  SourceInfo,
} from './types'

const CONFLICT_STRATEGIES: ImportConflictStrategy[] = ['overwrite', 'skip', 'clone']

export default function CliImportPage() {
  const t = useTranslations('cliImport')
  const qc = useQueryClient()

  const [source, setSource] = React.useState<CliConfigSource | ''>('')
  const [file, setFile] = React.useState<File | null>(null)
  const [preview, setPreview] = React.useState<ImportPreview | null>(null)
  const [strategy, setStrategy] = React.useState<ImportConflictStrategy>('skip')
  const [selected, setSelected] = React.useState<Set<string>>(new Set())

  // 加载支持的来源
  const { data: sourcesData, isLoading: sourcesLoading } = useQuery({
    queryKey: ['cli-import-sources'],
    queryFn: () => fetchSources(),
    staleTime: 5 * 60_000,
  })
  const sources: SourceInfo[] = sourcesData?.sources ?? []

  // 加载历史
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['cli-import-history'],
    queryFn: () => fetchHistory(),
  })
  const history: ImportHistoryItem[] = historyData?.list ?? []

  // 解析
  const parseMut = useMutation({
    mutationFn: () => parseFile(source as CliConfigSource, file!),
    onSuccess: (res) => {
      setPreview(res.preview)
      setSelected(new Set(res.preview.providers.map((p) => p.sourceId)))
      toast.success(t('parseSuccess', { count: res.preview.providers.length }))
    },
    onError: (e: Error) => toast.error(t('parseFailed', { error: e.message })),
  })

  // 提交导入
  const commitMut = useMutation({
    mutationFn: () => commitImport(preview!.previewId, Array.from(selected), strategy),
    onSuccess: (res) => {
      toast.success(
        t('commitSuccess', { imported: res.imported, skipped: res.skipped, failed: res.failed }),
      )
      setPreview(null)
      setFile(null)
      setSource('')
      setSelected(new Set())
      qc.invalidateQueries({ queryKey: ['cli-import-history'] })
      qc.invalidateQueries({ queryKey: ['user-llm-configs'] })
    },
    onError: (e: Error) => toast.error(t('commitFailed', { error: e.message })),
  })

  function handleFileChange(f: File | null) {
    setFile(f)
    setPreview(null)
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (!preview) return
    if (selected.size === preview.providers.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(preview.providers.map((p) => p.sourceId)))
    }
  }

  function onParse(e: React.FormEvent) {
    e.preventDefault()
    if (!source) return toast.error(t('errorNoSource'))
    if (!file) return toast.error(t('errorNoFile'))
    parseMut.mutate()
  }

  return (
    <Container maxWidth="lg" padding={false} className="space-y-6 py-6">
      {/* Header */}
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <PackagePlus className="h-6 w-6 text-primary" />
          {t('title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('desc')}</p>
      </header>

      <Alert variant="info" title={t('title')} description={t('desc')} />

      {/* Step 1: 选择来源 */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <p className="text-sm font-medium">{t('sources')}</p>
          {sourcesLoading ? (
            <div className="flex items-center text-xs text-muted-foreground">
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              {t('parsing')}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {sources.map((s) => {
                const active = source === s.source
                return (
                  <button
                    key={s.source}
                    type="button"
                    onClick={() => setSource(s.source)}
                    className={`flex items-center gap-2 rounded-md border px-3 py-2 text-left text-xs transition-colors ${
                      active
                        ? 'border-primary bg-primary/5 text-foreground'
                        : 'border-border text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    <span className="flex-1 truncate">{t(sourceLabelKey(s.source) as never)}</span>
                    {active && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />}
                  </button>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2: 文件上传 */}
      {source && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <p className="text-sm font-medium">{t('upload')}</p>
            <p className="text-xs text-muted-foreground">{t('uploadHint')}</p>
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed border-border p-6 text-center transition-colors hover:bg-accent">
              <FileUp className="h-6 w-6 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{t('dragDrop')}</span>
              <input
                type="file"
                className="hidden"
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              />
            </label>
            {file && (
              <p className="text-xs text-muted-foreground">
                {t('fileSelected', { name: file.name, size: formatSize(file.size) })}
              </p>
            )}
            <form onSubmit={onParse} className="flex items-center gap-2">
              <Button type="submit" size="sm" disabled={!file || parseMut.isPending}>
                {parseMut.isPending ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-1.5 h-4 w-4" />
                )}
                <span>{parseMut.isPending ? t('parsing') : t('parse')}</span>
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Step 3: 解析预览 + 提交 */}
      {preview && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{t('previewTitle')}</p>
              <button
                type="button"
                onClick={toggleAll}
                className="text-xs text-primary hover:underline"
              >
                {selected.size === preview.providers.length ? t('deselectAll') : t('selectAll')}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('selected', { count: selected.size, total: preview.providers.length })}
            </p>

            {preview.globalWarnings.length > 0 && (
              <div className="space-y-1 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-amber-700 dark:text-amber-400">
                {preview.globalWarnings.map((w, i) => (
                  <p key={i} className="flex items-start gap-1">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>{w}</span>
                  </p>
                ))}
              </div>
            )}

            <div className="space-y-2">
              {preview.providers.map((p) => {
                const checked = selected.has(p.sourceId)
                return (
                  <label
                    key={p.sourceId}
                    className={`flex cursor-pointer items-start gap-2 rounded-md border p-2 text-xs transition-colors ${
                      checked ? 'border-primary/40 bg-primary/5' : 'border-border hover:bg-accent'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSelected(p.sourceId)}
                      className="mt-0.5 h-3.5 w-3.5"
                    />
                    <div className="flex-1 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{p.name}</span>
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {p.providerCode}
                        </span>
                        {p.isCurrent && (
                          <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-600 dark:text-emerald-400">
                            current
                          </span>
                        )}
                      </div>
                      <p className="truncate text-muted-foreground">{p.baseUrl || '—'}</p>
                      {p.warnings.length > 0 && (
                        <p className="text-amber-600 dark:text-amber-400">
                          {t('warning')}: {p.warnings.join('; ')}
                        </p>
                      )}
                    </div>
                  </label>
                )
              })}
            </div>

            {/* Conflict strategy */}
            <div className="space-y-2">
              <p className="text-xs font-medium">{t('conflictStrategy')}</p>
              <div className="grid grid-cols-3 gap-2">
                {CONFLICT_STRATEGIES.map((s) => {
                  const active = strategy === s
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStrategy(s)}
                      className={`rounded-md border px-2 py-1.5 text-left text-[11px] transition-colors ${
                        active ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent'
                      }`}
                    >
                      <p className="font-medium">{t(s as never)}</p>
                      <p className="mt-0.5 text-muted-foreground">{t(`${s}Desc` as never)}</p>
                    </button>
                  )
                })}
              </div>
            </div>

            <Button
              size="sm"
              onClick={() => commitMut.mutate()}
              disabled={selected.size === 0 || commitMut.isPending}
            >
              {commitMut.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <PackagePlus className="mr-1.5 h-4 w-4" />
              )}
              <span>{commitMut.isPending ? t('committing') : t('commit')}</span>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* History */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <History className="h-4 w-4 text-muted-foreground" />
            {t('historyTitle')}
          </p>
          {historyLoading ? (
            <div className="flex items-center text-xs text-muted-foreground">
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              {t('parsing')}
            </div>
          ) : history.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('historyEmpty')}</p>
          ) : (
            <div className="space-y-2">
              {history.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between rounded-md border border-border p-2 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{t(sourceLabelKey(h.source) as never)}</span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] ${
                          h.status === 'success'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : h.status === 'partial'
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                              : 'bg-red-500/10 text-red-600 dark:text-red-400'
                        }`}
                      >
                        {t(
                          `status${h.status.charAt(0).toUpperCase()}${h.status.slice(1)}` as never,
                        )}
                      </span>
                    </div>
                    <p className="truncate text-muted-foreground">{h.sourcePath}</p>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span>
                      {t('historyImported')}: {h.importedCount}
                    </span>
                    <span>
                      {t('historySkipped')}: {h.skippedCount}
                    </span>
                    <span>
                      {t('historyFailed')}: {h.failedCount}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </Container>
  )
}
