// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 数据分析仪表盘 — 统计卡片 + 趋势折线图 + 平台分布饼图 + 失败原因柱状图 + 账号健康度表格。
 * 纯 SVG 实现图表,无 Chart.js/Echarts 依赖。
 *
 * AGENTS.md §4:rounded-md / 无分割线 / 无渐变遮罩 / SVG 用 currentColor
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { ExternalLink } from 'lucide-react'
import { Card, CardContent, Button, Badge } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { splitDisplayNameParts } from '@/lib/publish/display-name'
import type { ContentPerformance } from '@/lib/publish/top-content'

export type AnalyticsPeriod = '7d' | '30d' | '90d'

const PLATFORM_DISPLAY_NAMES: Record<string, string> = {
  csdn: 'CSDN',
  juejin: '掘金',
  weibo: '微博',
  xiaohongshu: '小红书',
  bilibili: 'B站',
  zhihu: '知乎',
  douyin: '抖音',
  wechat: '公众号',
  baijiahao: '百家号',
  netease: '网易号',
  shipinhao: '视频号',
}

function platformDisplayName(key: string): string {
  return PLATFORM_DISPLAY_NAMES[key] ?? key
}

export interface AnalyticsMetricsSummary {
  readonly totals: {
    readonly views: number
    readonly likes: number
    readonly comments: number
    readonly shares: number
  }
  readonly platforms: ReadonlyArray<{
    readonly platform: string
    readonly items: number
    readonly views: number
    readonly likes: number
    readonly comments: number
    readonly shares: number
  }>
  readonly trend: ReadonlyArray<{
    readonly date: string
    readonly views: number
    readonly likes: number
    readonly comments: number
    readonly shares: number
  }>
}

export interface AnalyticsOverview {
  readonly totalPublished: number
  readonly successRate: number
  readonly avgDurationMs: number
  readonly activeAccounts: number
  readonly trend: ReadonlyArray<{ readonly date: string; readonly count: number }>
  readonly platformDistribution: ReadonlyArray<{
    readonly platform: string
    readonly count: number
    readonly color: string
  }>
  readonly failureReasons: ReadonlyArray<{ readonly reason: string; readonly count: number }>
  /** 互动指标汇总(publish_metrics 回流),无采集数据时为 null */
  readonly metrics?: AnalyticsMetricsSummary | null
}

export interface AccountHealth {
  readonly accountId: number
  readonly platform: string
  readonly displayName: string
  readonly successRate: number
  readonly lastPublishedAt: string | null
  readonly riskStatus: 'safe' | 'low' | 'medium' | 'high'
}

export interface AnalyticsDashboardProps {
  readonly period: AnalyticsPeriod
  readonly onPeriodChange: (period: AnalyticsPeriod) => void
  readonly overview: AnalyticsOverview | null
  readonly accounts: AccountHealth[]
  /** 逐篇阅读/播放快照,按周期过滤后取前 5;无指标时为空 */
  readonly topContent?: ReadonlyArray<ContentPerformance>
}

const PERIODS: readonly AnalyticsPeriod[] = ['7d', '30d', '90d']

const RISK_BADGE: Record<AccountHealth['riskStatus'], { label: string; class: string }> = {
  safe: {
    label: '安全',
    class: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  },
  low: { label: '低风险', class: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400' },
  medium: {
    label: '中风险',
    class: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  },
  high: { label: '高风险', class: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400' },
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60_000).toFixed(1)}min`
}

export function AnalyticsDashboard({
  period,
  onPeriodChange,
  overview,
  accounts,
  topContent = [],
}: AnalyticsDashboardProps) {
  const t = useTranslations('publish')

  return (
    <div className="space-y-4">
      {/* 时间筛选 */}
      <div className="flex items-center gap-1">
        {PERIODS.map((p) => (
          <Button
            key={p}
            type="button"
            variant={period === p ? 'default' : 'outline'}
            size="xs"
            className="px-3 text-label"
            onClick={() => onPeriodChange(p)}
          >
            {t(
              p === '7d'
                ? 'analytics.period7d'
                : p === '30d'
                  ? 'analytics.period30d'
                  : 'analytics.period90d',
            )}
          </Button>
        ))}
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 gap-3 min-[640px]:grid-cols-4">
        <StatCard
          label={t('analytics.totalPublished')}
          value={overview ? String(overview.totalPublished) : '-'}
        />
        <StatCard
          label={t('analytics.successRate')}
          value={overview ? `${overview.successRate.toFixed(1)}%` : '-'}
          valueClass="text-emerald-600 dark:text-emerald-400"
        />
        <StatCard
          label={t('analytics.avgDuration')}
          value={overview ? formatDuration(overview.avgDurationMs) : '-'}
        />
        <StatCard
          label={t('analytics.activeAccounts')}
          value={overview ? String(overview.activeAccounts) : '-'}
        />
      </div>

      {/* 互动指标(指标回流) */}
      {overview?.metrics ? (
        <Card>
          <CardContent className="min-[640px]:p-3 p-3">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-label font-medium text-muted-foreground">
                互动数据（来自已发布内容最新快照）
              </h3>
              <span className="text-label text-muted-foreground">
                {overview.metrics.platforms.length} 个平台有采集
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 min-[640px]:grid-cols-4">
              <StatCard label="阅读 / 播放" value={String(overview.metrics.totals.views)} />
              <StatCard label="点赞" value={String(overview.metrics.totals.likes)} />
              <StatCard label="评论" value={String(overview.metrics.totals.comments)} />
              <StatCard label="转发" value={String(overview.metrics.totals.shares)} />
            </div>
            {overview.metrics.platforms.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {overview.metrics.platforms.map((p) => (
                  <Badge key={p.platform} variant="secondary" className="text-label">
                    {p.platform} · {p.views} 阅读 / {p.likes} 赞 / {p.comments} 评
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-label text-muted-foreground">
                还没有指标快照，去「发布监测」页对已发布内容点一次刷新指标。
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* 内容复盘:从平台汇总下钻到具体一篇 */}
      {topContent.length > 0 ? (
        <Card>
          <CardContent className="min-[640px]:p-3 p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-label font-medium text-muted-foreground">
                内容复盘（按阅读 / 播放排序）
              </h3>
              <span className="text-label text-muted-foreground">前 {topContent.length} 篇</span>
            </div>
            <div className="space-y-1.5">
              {topContent.map((item, index) => (
                <div
                  key={`${item.taskId}-${item.platform}`}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-2 py-2',
                    index % 2 === 1 && 'bg-muted/20',
                  )}
                >
                  <span className="w-5 shrink-0 text-center font-mono text-label text-muted-foreground">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-label font-medium">{item.title}</div>
                    <div className="text-[10px] text-muted-foreground">{item.platform}</div>
                    {item.platforms && item.platforms.length > 1 ? (
                      <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
                        {item.platforms.map((platform) => (
                          <span
                            key={platform.platform}
                            className="text-[10px] text-muted-foreground tabular-nums"
                          >
                            {platform.publishedUrl ? (
                              <a
                                href={platform.publishedUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="hover:text-primary"
                              >
                                {platformDisplayName(platform.platform)} {platform.views}
                              </a>
                            ) : (
                              <>
                                {platformDisplayName(platform.platform)} {platform.views}
                              </>
                            )}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right text-label tabular-nums">
                    <div>
                      {item.views.toLocaleString('zh-CN')} 阅读
                      <span className="ml-2 text-muted-foreground">
                        {item.likes.toLocaleString('zh-CN')} 赞
                      </span>
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {item.comments.toLocaleString('zh-CN')} 评 ·{' '}
                      {item.shares.toLocaleString('zh-CN')} 转
                    </div>
                  </div>
                  {item.publishedUrl ? (
                    <a
                      href={item.publishedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 text-muted-foreground hover:text-primary"
                      aria-label={`打开 ${item.title}`}
                    >
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
            <p className="mt-2 text-label text-muted-foreground">
              只看周期内已采集到快照的内容；没有数据的篇目去「发布监测」页刷新指标。
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/* 趋势图 + 平台分布 */}
      <div className="grid grid-cols-1 gap-3 tablet-lg:grid-cols-3">
        <Card className="tablet-lg:col-span-2">
          <CardContent className="min-[640px]:p-3 p-3">
            <h3 className="mb-3 text-label font-medium text-muted-foreground">
              {t('analytics.trend')}
            </h3>
            <TrendChart data={overview?.trend ?? []} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="min-[640px]:p-3 p-3">
            <h3 className="mb-3 text-label font-medium text-muted-foreground">
              {t('analytics.platformDistribution')}
            </h3>
            <PieChart data={overview?.platformDistribution ?? []} />
          </CardContent>
        </Card>
      </div>

      {/* 失败原因 */}
      <Card>
        <CardContent className="min-[640px]:p-3 p-3">
          <h3 className="mb-3 text-label font-medium text-muted-foreground">
            {t('analytics.failureReasons')}
          </h3>
          <BarChart data={overview?.failureReasons ?? []} />
        </CardContent>
      </Card>

      {/* 账号健康度 */}
      <Card>
        <CardContent className="min-[640px]:p-3 p-3">
          <h3 className="mb-3 text-label font-medium text-muted-foreground">
            {t('analytics.accountHealth')}
          </h3>
          {accounts.length === 0 ? (
            <p className="py-4 text-center text-label text-muted-foreground">
              {t('analytics.noData')}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-label">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">{t('preview.title')}</th>
                    <th className="pb-2 px-3 font-medium">{t('analytics.successRate')}</th>
                    <th className="pb-2 px-3 font-medium">{t('analytics.lastPublished')}</th>
                    <th className="pb-2 px-3 font-medium">{t('analytics.riskStatus')}</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((a, idx) => {
                    const risk = RISK_BADGE[a.riskStatus]
                    return (
                      <tr
                        key={a.accountId}
                        className={cn('bg-card', idx % 2 === 1 && 'bg-muted/20')}
                      >
                        <td className="py-2 pr-3">
                          <div className="font-medium">
                            {splitDisplayNameParts(a.displayName).name}
                          </div>
                          <div className="text-[10px] text-muted-foreground">{a.platform}</div>
                        </td>
                        <td className="px-3">
                          <span
                            className={cn(
                              'font-mono',
                              a.successRate >= 0.8
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : a.successRate >= 0.5
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-rose-600 dark:text-rose-400',
                            )}
                          >
                            {(a.successRate * 100).toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-3 text-muted-foreground">
                          {a.lastPublishedAt
                            ? new Date(a.lastPublishedAt).toLocaleDateString('zh-CN')
                            : '-'}
                        </td>
                        <td className="px-3">
                          <Badge variant="secondary" className={cn('text-[10px]', risk.class)}>
                            {risk.label}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({
  label,
  value,
  valueClass,
}: {
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <Card>
      <CardContent className="min-[640px]:p-3 p-3">
        <div className="text-[10px] text-muted-foreground">{label}</div>
        <div className={cn('mt-1 text-lg font-semibold', valueClass)}>{value}</div>
      </CardContent>
    </Card>
  )
}

function TrendChart({ data }: { data: ReadonlyArray<{ date: string; count: number }> }) {
  const t = useTranslations('publish')
  if (data.length === 0)
    return (
      <div className="py-8 text-center text-label text-muted-foreground">
        {t('analytics.noData')}
      </div>
    )
  const max = Math.max(...data.map((d) => d.count), 1)
  const width = 600
  const height = 160
  const padding = 24
  const stepX = (width - padding * 2) / Math.max(1, data.length - 1)
  const points = data
    .map((d, i) => {
      const x = padding + i * stepX
      const y = height - padding - (d.count / max) * (height - padding * 2)
      return `${x},${y}`
    })
    .join(' ')
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-primary"
      />
      {data.map((d, i) => {
        const x = padding + i * stepX
        const y = height - padding - (d.count / max) * (height - padding * 2)
        return (
          <g key={i}>
            <circle cx={x} cy={y} r="3" className="fill-primary" />
            <text
              x={x}
              y={height - 4}
              textAnchor="middle"
              className="fill-muted-foreground text-[8px]"
            >
              {d.date.slice(5)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function PieChart({
  data,
}: {
  data: ReadonlyArray<{ platform: string; count: number; color: string }>
}) {
  const t = useTranslations('publish')
  if (data.length === 0)
    return (
      <div className="py-8 text-center text-label text-muted-foreground">
        {t('analytics.noData')}
      </div>
    )
  const total = data.reduce((s, d) => s + d.count, 0)
  let cumulative = 0
  const radius = 60
  const cx = 70
  const cy = 70
  return (
    <div className="flex items-center gap-3">
      <svg width="140" height="140" viewBox="0 0 140 140" role="img">
        {data.map((d, i) => {
          const startAngle = (cumulative / total) * 2 * Math.PI - Math.PI / 2
          cumulative += d.count
          const endAngle = (cumulative / total) * 2 * Math.PI - Math.PI / 2
          const x1 = cx + radius * Math.cos(startAngle)
          const y1 = cy + radius * Math.sin(startAngle)
          const x2 = cx + radius * Math.cos(endAngle)
          const y2 = cy + radius * Math.sin(endAngle)
          const largeArc = endAngle - startAngle > Math.PI ? 1 : 0
          return (
            <path
              key={i}
              d={`M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`}
              className={d.color}
            />
          )
        })}
      </svg>
      <div className="flex-1 min-w-0 space-y-1">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-1.5 text-[11px]">
            <span className={cn('h-2 w-2 rounded-md', d.color)} />
            <span className="flex-1 truncate">{d.platform}</span>
            <span className="text-muted-foreground">{((d.count / total) * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function BarChart({ data }: { data: ReadonlyArray<{ reason: string; count: number }> }) {
  const t = useTranslations('publish')
  if (data.length === 0)
    return (
      <div className="py-8 text-center text-label text-muted-foreground">
        {t('analytics.noData')}
      </div>
    )
  const max = Math.max(...data.map((d) => d.count), 1)
  return (
    <div className="space-y-2">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-32 shrink-0 truncate text-right text-[11px] text-muted-foreground">
            {d.reason}
          </span>
          <div className="h-4 flex-1 overflow-hidden rounded-md bg-muted">
            <div
              className="h-full rounded-md bg-primary/70 transition-all"
              style={{ width: `${(d.count / max) * 100}%` }}
            />
          </div>
          <span className="w-8 shrink-0 text-[11px] font-mono text-muted-foreground">
            {d.count}
          </span>
        </div>
      ))}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
