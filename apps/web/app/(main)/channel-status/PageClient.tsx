// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 渠道公开监控页(2026-09-16 立,第三轮对标补强 O,对标 Sub2API channelMonitorV2)。
 * status page 形态:整体概览 + 渠道卡片(状态徽章/延迟/模型数/最近检查),
 * 数据源 GET /api/relay/monitor/status(公开脱敏,不含上游 Key/账号/URL),60s 自动刷新。
 */
import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
import { Loader2, RefreshCw } from 'lucide-react'

import { Button, Card, CardContent } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'

interface MonitorChannel {
  providerCode: string
  displayName: string
  status: 'operational' | 'degraded' | 'down' | 'maintenance'
  latencyMs: { avg: number; p95: number } | null
  modelCount: number
  lastCheckedAt: string | null
}

interface MonitorStatus {
  channels: MonitorChannel[]
  generatedAt: string
}

const STATUS_STYLE: Record<MonitorChannel['status'], string> = {
  operational: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  degraded: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  down: 'bg-red-500/10 text-red-600 dark:text-red-400',
  maintenance: 'bg-muted text-muted-foreground',
}

/** 相对时间(n 分钟前);竞品 relativeMinutesAgo 同款。 */
function relativeTime(iso: string | null): string {
  if (!iso) return '-'
  const diff = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(diff)) return '-'
  const m = Math.max(0, Math.floor(diff / 60000))
  if (m < 1) return '刚刚'
  if (m < 60) return `${m} 分钟前`
  return `${Math.floor(m / 60)} 小时前`
}

export default function ChannelStatusClient() {
  const t = useTranslations('channelStatus')
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['relay', 'monitor', 'status'],
    queryFn: async () => {
      const r = await fetchApi<MonitorStatus>('/api/relay/monitor/status')
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    refetchInterval: 60_000,
  })

  const channels = data?.channels ?? []
  const count = (s: MonitorChannel['status']) => channels.filter((c) => c.status === s).length

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} aria-hidden />
          <span>{t('refresh')}</span>
        </Button>
      </div>

      {error && <Alert variant="danger" description={(error as Error).message} />}

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          <span>{t('loading')}</span>
        </div>
      ) : channels.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">{t('empty')}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 min-[640px]:grid-cols-4">
            {(['operational', 'degraded', 'down', 'maintenance'] as const).map((s) => (
              <div key={s} className="rounded-lg border bg-card p-3 text-center">
                <p className="text-2xl font-medium tabular-nums">{count(s)}</p>
                <p className={cn('mt-1 rounded-md px-2 py-0.5 text-xs', STATUS_STYLE[s])}>{t(s)}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-2">
            {channels.map((c) => (
              <Card key={c.providerCode}>
                <CardContent className="min-[640px]:p-3 space-y-2 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{c.displayName}</p>
                    <span
                      className={cn(
                        'rounded-md px-2 py-0.5 text-xs font-medium',
                        STATUS_STYLE[c.status],
                      )}
                    >
                      {t(c.status)}
                    </span>
                  </div>
                  <dl className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <dt className="text-muted-foreground">{t('avgLatency')}</dt>
                      <dd className="tabular-nums">
                        {c.latencyMs ? `${Math.round(c.latencyMs.avg)}ms` : '-'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">{t('p95')}</dt>
                      <dd className="tabular-nums">
                        {c.latencyMs ? `${Math.round(c.latencyMs.p95)}ms` : '-'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">{t('models')}</dt>
                      <dd className="tabular-nums">{c.modelCount}</dd>
                    </div>
                  </dl>
                  <p className="text-[11px] text-muted-foreground">
                    {t('lastChecked')} {relativeTime(c.lastCheckedAt)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
