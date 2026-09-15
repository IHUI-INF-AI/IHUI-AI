// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 发布监测单篇卡片(从 monitor/page.tsx 抽出)
 *
 * 一篇发布内容一目了然四块:发布状态 / 样式核验 / 修复重提 / 互动数据。
 * "重新核验" 调 POST /api/publish/monitor/verify,"刷新数据" 调
 * POST /api/publish/monitor/refresh-metrics,成功后回调父级刷新整列。
 *
 * AGENTS.md §4:rounded-md(禁 rounded-full)/ 无分割线 / 无渐变遮罩 / 状态徽章成功绿失败红进行中黄
 */
import * as React from 'react'
import { useTranslations } from 'next-intl'
import type { LucideIcon } from 'lucide-react'
import {
  ExternalLink,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  RotateCcw,
  BarChart3,
  Loader2,
} from 'lucide-react'
import { Button, Card, CardContent } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { fetchApi } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { PLATFORM_KEY } from '../helpers'

export interface StyleCheck {
  readonly checked_at: string
  readonly passed: boolean
  readonly issues: string[]
  readonly content_length: number
  readonly images_total: number
  readonly images_loaded: number
}

export interface Metrics {
  readonly views: number
  readonly likes: number
  readonly comments: number
  readonly shares: number
  readonly collected_at: string
}

export interface MonitorItem {
  readonly task_id: string
  readonly title: string
  readonly platform: string
  readonly account_id: number
  readonly status: string
  readonly published_url: string | null
  readonly platform_content_id: string | null
  readonly created_at: string | null
  readonly finished_at: string | null
  readonly last_error: string | null
  readonly resubmit_count: number
  readonly style_check: StyleCheck | null
  readonly metrics: Metrics | null
}

const STATUS_STYLE: Record<string, string> = {
  success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  failed: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  running: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  pending: 'bg-muted text-muted-foreground',
  partial: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  skipped: 'bg-muted text-muted-foreground',
}

const TIME_FMT = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Shanghai',
})

function fmtTime(s?: string | null): string {
  if (!s) return '-'
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? '-' : TIME_FMT.format(d)
}

function Block({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-md bg-muted/40 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span style={{ transform: 'translateY(0.3px)' }}>{label}</span>
      </div>
      <div className="space-y-1.5 text-sm">{children}</div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col">
      <span className="text-lg font-semibold tabular-nums leading-none">
        {value.toLocaleString()}
      </span>
      <span className="mt-1 text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

export function MonitorCard({
  item,
  onChanged,
}: {
  item: MonitorItem
  onChanged: () => void
}) {
  const t = useTranslations('publishMonitor')
  const tp = useTranslations('publish')
  const toast = useToast()
  const [verifying, setVerifying] = React.useState(false)
  const [refreshing, setRefreshing] = React.useState(false)

  const statusKey = item.status in STATUS_STYLE ? item.status : 'pending'
  const statusLabel: Record<string, string> = {
    success: t('statusSuccess'),
    failed: t('statusFailed'),
    running: t('statusRunning'),
    pending: t('statusPending'),
    partial: t('statusRunning'),
    skipped: t('statusUnknown'),
  }
  const style = item.style_check
  const metrics = item.metrics
  const platformName = tp(PLATFORM_KEY[item.platform] ?? 'platforms.unknown')

  async function handleVerify() {
    setVerifying(true)
    try {
      const r = await fetchApi<StyleCheck>('/api/publish/monitor/verify', {
        method: 'POST',
        body: JSON.stringify({ task_id: item.task_id }),
      })
      if (!r.success) {
        toast.error(r.error || t('reVerify'))
        return
      }
      toast.success(r.data.passed ? t('verifyPassed') : t('verifyFailed'))
      onChanged()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setVerifying(false)
    }
  }

  async function handleRefreshMetrics() {
    setRefreshing(true)
    try {
      const r = await fetchApi<Metrics>('/api/publish/monitor/refresh-metrics', {
        method: 'POST',
        body: JSON.stringify({ task_id: item.task_id }),
      })
      if (!r.success) {
        toast.error(r.error || t('refreshMetrics'))
        return
      }
      toast.success(t('refreshMetrics'))
      onChanged()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <Card>
      <CardContent className="min-[640px]:p-3 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              {platformName}
            </span>
            <span className="truncate text-sm font-medium">{item.title}</span>
          </div>
          <span
            className={cn(
              'shrink-0 rounded-md px-2 py-0.5 text-xs font-medium',
              STATUS_STYLE[statusKey],
            )}
          >
            {statusLabel[item.status] ?? item.status}
          </span>
        </div>

        {item.status === 'failed' && item.last_error && (
          <pre className="thin-scroll mt-2 max-h-28 overflow-auto rounded bg-rose-50 p-2 text-[10px] text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            {item.last_error}
          </pre>
        )}

        {item.published_url && (
          <a
            href={item.published_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            {t('openUrl')}
          </a>
        )}

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Block icon={AlertTriangle} label={t('blockStatus')}>
            <Row label={t('platform')}>{platformName}</Row>
            <Row label={t('status')}>{statusLabel[item.status] ?? item.status}</Row>
            <Row label={t('publishedAt')}>{fmtTime(item.created_at)}</Row>
            <Row label={t('finishedAt')}>{fmtTime(item.finished_at)}</Row>
          </Block>

          <Block
            icon={style?.passed ? CheckCircle2 : style ? XCircle : AlertTriangle}
            label={t('blockVerify')}
          >
            <Row label={t('verifyAt')}>
              {style ? (
                <span
                  className={cn(
                    'inline-flex items-center gap-1',
                    style.passed
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400',
                  )}
                >
                  {style.passed ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5" />
                  )}
                  {style.passed ? t('verifyPassed') : t('verifyFailed')}
                </span>
              ) : (
                <span className="text-muted-foreground">{t('verifyPending')}</span>
              )}
            </Row>
            <Row label={t('contentLength')}>
              {style ? style.content_length.toLocaleString() : '-'}
            </Row>
            <Row label={t('images')}>
              {style ? `${style.images_loaded}/${style.images_total}` : '-'}
            </Row>
            {style && style.issues.length > 0 && (
              <div className="space-y-0.5 pt-1">
                <div className="text-xs text-muted-foreground">{t('issues')}</div>
                <ul className="list-inside list-disc space-y-0.5 text-xs text-rose-600 dark:text-rose-400">
                  {style.issues.map((iss, i) => (
                    <li key={i}>{iss}</li>
                  ))}
                </ul>
              </div>
            )}
            {style && style.issues.length === 0 && (
              <div className="pt-1 text-xs text-muted-foreground">{t('noIssues')}</div>
            )}
            <Button
              size="sm"
              variant="outline"
              className="mt-1 w-full"
              disabled={verifying}
              onClick={() => void handleVerify()}
            >
              {verifying ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Search className="h-3.5 w-3.5" />
              )}
              {verifying ? t('reVerifying') : t('reVerify')}
            </Button>
          </Block>

          <Block icon={RotateCcw} label={t('blockResubmit')}>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-semibold tabular-nums leading-none">
                {item.resubmit_count}
              </span>
              <span className="text-xs text-muted-foreground">{t('resubmitCount')}</span>
            </div>
          </Block>

          <Block icon={BarChart3} label={t('blockMetrics')}>
            {metrics ? (
              <>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                  <Metric label={t('metricsViews')} value={metrics.views} />
                  <Metric label={t('metricsLikes')} value={metrics.likes} />
                  <Metric label={t('metricsComments')} value={metrics.comments} />
                  <Metric label={t('metricsShares')} value={metrics.shares} />
                </div>
                <Row label={t('metricsCollectedAt')}>{fmtTime(metrics.collected_at)}</Row>
              </>
            ) : (
              <div className="text-xs text-muted-foreground">{t('verifyPending')}</div>
            )}
            <Button
              size="sm"
              variant="outline"
              className="mt-1 w-full"
              disabled={refreshing}
              onClick={() => void handleRefreshMetrics()}
            >
              {refreshing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RotateCcw className="h-3.5 w-3.5" />
              )}
              {refreshing ? t('refreshMetricsLoading') : t('refreshMetrics')}
            </Button>
          </Block>
        </div>
      </CardContent>
    </Card>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
