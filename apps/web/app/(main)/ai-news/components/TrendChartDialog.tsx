'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { TrendingUp, TrendingDown, Minus, X } from 'lucide-react'
import { fetchAiTrendChart, type TrendChartData } from '@/lib/ai-news-api'

interface Props {
  itemId: string
  title: string
  open: boolean
  onClose: () => void
}

/**
 * 趋势图表弹窗:展示单条资讯 7/14 天热度+排名曲线。
 *
 * 数据源:/api/ai-feed/trends?itemId=xxx&window=14
 * 需 ≥2 天快照才有曲线(明天 cron 后自动有,今天只有 1 天快照 → 显示"数据积累中")。
 *
 * SVG 简易折线图,不引入 chart 库(做减法原则)。
 */
export function TrendChartDialog({ itemId, title, open, onClose }: Props) {
  const t = useTranslations('aiNews')
  const [data, setData] = React.useState<TrendChartData | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [window, setWindow] = React.useState(14)

  const dialogRef = React.useRef<HTMLDivElement>(null)
  const closeButtonRef = React.useRef<HTMLButtonElement>(null)
  const titleId = React.useId()

  React.useEffect(() => {
    if (!open || !itemId) return
    setLoading(true)
    fetchAiTrendChart(itemId, window)
      .then(setData)
      .finally(() => setLoading(false))
  }, [open, itemId, window])

  // 无障碍:ESC 关闭 + focus trap + 焦点还原
  React.useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    closeButtonRef.current?.focus()
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (focusable.length === 0) return
        const first = focusable[0]!
        const last = focusable[focusable.length - 1]!
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  const points = data?.points ?? []
  const hasData = points.length >= 2
  const signal = data?.signals?.find((s) => s.windowDays === window)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-lg rounded-xl border bg-card shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-start gap-2 bg-muted/30 px-5 py-4">
          <div className="min-w-0 flex-1 space-y-1">
            <h3 className="line-clamp-2 text-sm font-semibold leading-tight">{title}</h3>
            <p className="text-[10px] text-muted-foreground">{t('trendChart.subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 窗口切换 */}
        <div className="flex items-center gap-1.5 px-5 pt-3">
          {[7, 14].map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setWindow(w)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                window === w
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background/60 text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              {w} {t('trendChart.days')}
            </button>
          ))}
        </div>

        {/* 内容 */}
        <div className="px-5 py-4">
          {loading ? (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              {t('trendChart.loading')}
            </div>
          ) : !hasData ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-center">
              <Minus className="h-6 w-6 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">{t('trendChart.noData')}</p>
              <p className="text-[10px] text-muted-foreground/60">{t('trendChart.noDataHint')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* 趋势信号徽章 */}
              {signal ? (
                <div className="flex items-center gap-2">
                  {signal.trendTag === 'rising' ? (
                    <span className="inline-flex items-center gap-0.5 rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      <TrendingUp className="h-3 w-3" />
                      +{signal.growthPct?.toFixed(0)}%
                    </span>
                  ) : signal.trendTag === 'cooling' ? (
                    <span className="inline-flex items-center gap-0.5 rounded-md bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-600 dark:text-rose-400">
                      <TrendingDown className="h-3 w-3" />
                      {signal.growthPct?.toFixed(0)}%
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      <Minus className="h-3 w-3" />
                      {t('trendChart.stable')}
                    </span>
                  )}
                  {signal.rankDelta !== null ? (
                    <span className="text-[10px] text-muted-foreground">
                      {t('trendChart.rankDelta')}: {signal.rankDelta > 0 ? '+' : ''}{signal.rankDelta}
                    </span>
                  ) : null}
                </div>
              ) : null}

              {/* SVG 折线图 */}
              <SimpleLineChart points={points} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** 简易 SVG 折线图(热度曲线),不引入 chart 库 */
function SimpleLineChart({ points }: { points: Array<{ snapshotDate: string; hotValue: number | null }> }) {
  const t = useTranslations('aiNews')
  const W = 440
  const H = 120
  const PAD = 30

  const validPoints = points.filter((p) => p.hotValue !== null && p.hotValue !== undefined)
  if (validPoints.length < 2) return null

  const values = validPoints.map((p) => Number(p.hotValue))
  const maxVal = Math.max(...values)
  const minVal = Math.min(...values)
  const range = maxVal - minVal || 1

  const xStep = (W - PAD * 2) / (validPoints.length - 1)
  const coords = validPoints.map((p, i) => ({
    x: PAD + i * xStep,
    y: H - PAD - ((Number(p.hotValue) - minVal) / range) * (H - PAD * 2),
    date: p.snapshotDate,
    val: Number(p.hotValue),
  }))

  const pathD = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ')

  return (
    <div className="space-y-1">
      <div className="text-[10px] font-medium text-muted-foreground">{t('trendChart.hotValue')}</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet" role="img" aria-label={t('trendChart.hotValue')}>
        {/* 横轴 */}
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} className="stroke-muted" strokeWidth={0.5} />
        {/* 折线 */}
        <path d={pathD} fill="none" className="stroke-primary" strokeWidth={1.5} />
        {/* 数据点 */}
        {coords.map((c, i) => (
          <g key={i}>
            <circle cx={c.x} cy={c.y} r={2.5} className="fill-primary" />
            <text x={c.x} y={H - PAD + 12} textAnchor="middle" className="fill-muted-foreground" fontSize={7}>
              {c.date.slice(5)}
            </text>
          </g>
        ))}
        {/* Y 轴标签 */}
        <text x={PAD - 5} y={PAD} textAnchor="end" className="fill-muted-foreground" fontSize={7}>
          {maxVal >= 10000 ? `${(maxVal / 10000).toFixed(0)}万` : maxVal}
        </text>
        <text x={PAD - 5} y={H - PAD} textAnchor="end" className="fill-muted-foreground" fontSize={7}>
          {minVal >= 10000 ? `${(minVal / 10000).toFixed(0)}万` : minVal}
        </text>
      </svg>
    </div>
  )
}
