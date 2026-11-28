// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

'use client'

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { CloudDownload, Gauge, Loader2, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react'

import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from '@ihui/ui-react'
import { apiOrThrow } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { CozeCoverage, CozeSyncManyResult } from './types'

interface CozeCoverageDialogProps {
  open: boolean
  onClose: () => void
}

const STATUS_ORDER: Array<keyof CozeCoverage['status']> = [
  'synced',
  'partial',
  'error',
  'not_found',
  'skipped_no_token',
  'never',
]

const STATUS_CLASS: Record<string, string> = {
  synced: 'text-emerald-600 dark:text-emerald-500',
  partial: 'text-amber-600 dark:text-amber-500',
  error: 'text-destructive',
  not_found: 'text-destructive',
  skipped_no_token: 'text-muted-foreground',
  never: 'text-muted-foreground',
}

const STATUS_LABEL_KEY: Record<string, string> = {
  synced: 'status_synced',
  partial: 'status_partial',
  error: 'status_error',
  not_found: 'status_not_found',
  skipped_no_token: 'status_skipped_no_token',
  never: 'status_never',
}

export function CozeCoverageDialog({ open, onClose }: CozeCoverageDialogProps) {
  const t = useTranslations('admin.agents.coze')
  const tc = useTranslations('common')
  const locale = useLocale()
  const qc = useQueryClient()
  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'agents', 'coze', 'coverage'],
    queryFn: () => apiOrThrow<CozeCoverage>('/api/agents/coze/status'),
    enabled: open,
  })

  const syncMut = useMutation({
    mutationFn: (limit: number) =>
      apiOrThrow<CozeSyncManyResult>('/api/agents/coze/sync', {
        method: 'POST',
        body: JSON.stringify({ limit, concurrency: 8, isPublished: true, allowDraft: true }),
      }),
    onSuccess: (result) => {
      toast.success(
        t('batchResult', {
          synced: result.synced,
          partial: result.partial,
          errors: result.errors,
          notFound: result.notFound,
        }),
      )
      qc.invalidateQueries({ queryKey: ['admin', 'agents'] })
      qc.invalidateQueries({ queryKey: ['admin', 'agents', 'coze', 'coverage'] })
      qc.invalidateQueries({ queryKey: ['agents'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const total = data?.totalBots ?? 0

  return (
    <Dialog open={open} onOpenChange={(next: boolean) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto min-[640px]:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-primary" />
            {t('coverageTitle')}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {tc('loading')}
          </div>
        ) : error ? (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-body text-destructive">
            {(error as Error).message}
          </div>
        ) : !data ? null : (
          <div className="space-y-4">
            <p className="text-body text-muted-foreground">{t('coverageSubtitle')}</p>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Metric label={t('totalBots')} value={total} />
              {STATUS_ORDER.map((key) => (
                <Metric
                  key={key}
                  label={t(STATUS_LABEL_KEY[key] ?? 'status_error')}
                  value={data.status[key]}
                  className={STATUS_CLASS[key]}
                />
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 p-3">
              {data.credentials.configured ? (
                <span className="inline-flex items-center gap-1 text-label text-emerald-600 dark:text-emerald-500">
                  <ShieldCheck className="h-4 w-4" />
                  {t('credentialsConfigured', { envName: data.credentials.envName ?? '—' })}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-label text-destructive">
                  <ShieldAlert className="h-4 w-4" />
                  {t('credentialsMissing')}
                </span>
              )}
              <span className="text-label text-muted-foreground">baseUrl: {data.credentials.baseUrl}</span>
              <span className="text-label text-muted-foreground">
                {t('lastSyncedAt')}: {data.lastSyncedAt ? dateFmt.format(new Date(data.lastSyncedAt)) : '—'}
              </span>
              <span className="text-label text-muted-foreground">
                {t('variablesCoverage', { rows: data.variables.rows, bots: data.variables.bots })}
              </span>
              <div className="ml-auto flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => syncMut.mutate(data.batch.size)}
                  disabled={syncMut.isPending}
                >
                  {syncMut.isPending ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-1 h-4 w-4" />
                  )}
                  {t('batchSync', { count: data.batch.size })}
                </Button>
                <Button
                  size="sm"
                  onClick={() => syncMut.mutate(data.batch.max)}
                  disabled={syncMut.isPending}
                >
                  {syncMut.isPending ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <CloudDownload className="mr-1 h-4 w-4" />
                  )}
                  {t('batchSync', { count: data.batch.max })}
                </Button>
              </div>
            </div>

            <section className="space-y-2 rounded-lg border p-4">
              <h3 className="text-body font-semibold">{t('fieldCoverage')}</h3>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {data.fieldCoverage.map((field) => {
                  const pct = total > 0 ? Math.round((field.nonNull / total) * 100) : 0
                  return (
                    <div key={field.key} className="space-y-1">
                      <div className="flex items-center justify-between gap-2 text-label">
                        <span className="truncate font-mono" title={field.label}>
                          {locale.startsWith('zh') ? field.label : field.key}
                        </span>
                        <span className="shrink-0 text-muted-foreground">
                          {field.nonNull}/{total}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded bg-muted">
                        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            <p className="text-label text-muted-foreground">
              {t('batchHint', {
                size: data.batch.size,
                max: data.batch.max,
                concurrency: data.batch.concurrency,
              })}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Metric({
  label,
  value,
  className,
}: {
  label: string
  value: number
  className?: string
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-label text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-heading font-semibold', className)}>{value}</p>
    </div>
  )
}
