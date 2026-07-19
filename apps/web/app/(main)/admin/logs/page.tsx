'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  ScrollText,
  Trash2,
  BarChart3,
  Activity,
  Timer,
} from 'lucide-react'
import {
  Button,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@ihui/ui'
import { cn } from '@/lib/utils'

import { LogFilter } from './LogFilter'
import { LogTable } from './LogTable'
import { LogDetailDialog } from './LogDetailDialog'
import {
  PAGE_SIZE,
  STATS_DAYS_OPTS,
  CLEANUP_DAYS_OPTS,
  api,
  statusClass,
  Badge,
  MetricCard,
} from './helpers'
import type { ApiLog, LogsData, LogStats } from './types'
import { formatNumber } from '@/lib/date-utils'

export default function AdminLogsPage() {
  const t = useTranslations('admin.logs')
  const tc = useTranslations('common')
  const locale = useLocale()
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [method, setMethod] = React.useState('all')
  const [statusCode, setStatusCode] = React.useState('')
  const [path, setPath] = React.useState('')
  const [selected, setSelected] = React.useState<ApiLog | null>(null)
  const [statsDays, setStatsDays] = React.useState(7)
  const [cleanupOpen, setCleanupOpen] = React.useState(false)
  const [cleanupDays, setCleanupDays] = React.useState(30)
  const [cleanupErr, setCleanupErr] = React.useState<string | null>(null)
  const [cleanupResult, setCleanupResult] = React.useState<{
    deleted: number
    days: number
  } | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'logs', page, method, statusCode, path],
    queryFn: async () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (method !== 'all') qs.set('method', method)
      if (statusCode.trim()) qs.set('statusCode', statusCode.trim())
      if (path.trim()) qs.set('path', path.trim())
      return api<LogsData>(`/api/admin/logs?${qs.toString()}`)
    },
  })

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin', 'logs', 'stats', statsDays],
    queryFn: () => api<LogStats>(`/api/admin/logs/stats?days=${statsDays}`),
  })

  const cleanupMut = useMutation({
    mutationFn: () =>
      api<{ deletedCount: number; days: number }>(`/api/admin/logs/cleanup`, {
        method: 'POST',
        body: JSON.stringify({ days: cleanupDays }),
      }),
    onSuccess: (res) => {
      setCleanupResult({ deleted: res.deletedCount, days: res.days })
      qc.invalidateQueries({ queryKey: ['admin', 'logs'] })
    },
    onError: (e: Error) => setCleanupErr(e.message),
  })

  function openCleanup() {
    setCleanupErr(null)
    setCleanupResult(null)
    setCleanupOpen(true)
  }
  function closeCleanup() {
    if (cleanupMut.isPending) return
    setCleanupOpen(false)
    setCleanupErr(null)
    setCleanupResult(null)
  }
  function doCleanup() {
    setCleanupErr(null)
    cleanupMut.mutate()
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const logs = data?.list ?? []
  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const resetPage = () => setPage(1)

  const statsTotal = stats?.total ?? 0
  const statsAvg = stats?.avgDuration ?? 0
  const byStatus = stats?.byStatus ?? []
  const errorCount = byStatus
    .filter((s) => s.statusCode >= 400)
    .reduce((sum, s) => sum + s.count, 0)
  const errorRate = statsTotal > 0 ? ((errorCount / statsTotal) * 100).toFixed(1) : '0.0'
  const maxCount = Math.max(1, ...byStatus.map((s) => s.count))

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <ScrollText className="h-6 w-6 text-primary" />
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button size="sm" variant="outline" onClick={openCleanup}>
          <Trash2 className="h-4 w-4" />
          {t('cleanup')}
        </Button>
      </div>

      <div className="space-y-3 rounded-lg border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <BarChart3 className="h-4 w-4 text-primary" />
            {t('statsTitle')}
          </div>
          <div className="flex items-center gap-1 rounded-md border bg-muted/30 p-0.5">
            {STATS_DAYS_OPTS.map((d) => (
              <button
                key={d}
                onClick={() => setStatsDays(d)}
                className={cn(
                  'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                  statsDays === d
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t('days', { count: d })}
              </button>
            ))}
          </div>
        </div>

        {statsLoading ? (
          <div className="flex items-center py-6 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t('loading')}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <MetricCard
                icon={Activity}
                label={t('metricTotal')}
                value={formatNumber(statsTotal)}
              />
              <MetricCard
                icon={Timer}
                label={t('metricAvgDuration')}
                value={`${statsAvg} ${t('ms')}`}
              />
              <MetricCard
                icon={BarChart3}
                label={t('metricErrorCount')}
                value={formatNumber(errorCount)}
              />
              <MetricCard icon={Activity} label={t('metricErrorRate')} value={`${errorRate}%`} />
            </div>

            {byStatus.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs uppercase text-muted-foreground">{t('byStatus')}</div>
                <div className="space-y-1.5">
                  {byStatus
                    .slice()
                    .sort((a, b) => a.statusCode - b.statusCode)
                    .map((s) => (
                      <div key={s.statusCode} className="flex items-center gap-2 text-xs">
                        <Badge cls={statusClass(s.statusCode)}>{s.statusCode}</Badge>
                        <div className="relative h-5 flex-1 overflow-hidden rounded bg-muted/50">
                          <div
                            className={cn(
                              'h-full rounded transition-all',
                              statusClass(s.statusCode).split(' ')[0],
                            )}
                            style={{ width: `${(s.count / maxCount) * 100}%` }}
                          />
                        </div>
                        <span className="w-12 shrink-0 text-right font-mono text-muted-foreground">
                          {s.count}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <LogFilter
        method={method}
        onMethodChange={(v) => {
          setMethod(v)
          resetPage()
        }}
        statusCode={statusCode}
        onStatusCodeChange={(v) => {
          setStatusCode(v)
          resetPage()
        }}
        path={path}
        onPathChange={(v) => {
          setPath(v)
          resetPage()
        }}
      />

      <LogTable
        list={logs}
        isLoading={isLoading}
        error={error as Error | null}
        dateFmt={dateFmt}
        onSelect={setSelected}
      />

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{t('total', { total })}</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
            {t('prev')}
          </Button>
          <span className="text-sm text-muted-foreground">
            {t('page', { page, total: totalPages })}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('next')}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <LogDetailDialog selected={selected} dateFmt={dateFmt} onClose={() => setSelected(null)} />

      <Dialog
        open={cleanupOpen}
        onOpenChange={(o) => (!o && !cleanupMut.isPending ? closeCleanup() : null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('cleanupTitle')}</DialogTitle>
            <DialogDescription>{t('cleanupDesc')}</DialogDescription>
          </DialogHeader>
          {cleanupErr && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {cleanupErr}
            </div>
          )}
          {cleanupResult ? (
            <div className="rounded-md bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-600 dark:text-emerald-500">
              {t('cleanupSuccess', { count: cleanupResult.deleted, days: cleanupResult.days })}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>{t('cleanupDays')}</Label>
                <div className="flex flex-wrap gap-2">
                  {CLEANUP_DAYS_OPTS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setCleanupDays(d)}
                      className={cn(
                        'rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
                        cleanupDays === d
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-input text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {t('days', { count: d })}
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-500">
                {t('cleanupWarn')}
              </div>
            </div>
          )}
          <DialogFooter>
            {cleanupResult ? (
              <Button type="button" onClick={closeCleanup}>
                {tc('close')}
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeCleanup}
                  disabled={cleanupMut.isPending}
                >
                  {tc('cancel')}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={cleanupMut.isPending}
                  onClick={doCleanup}
                >
                  {cleanupMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t('cleanupConfirm')}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
