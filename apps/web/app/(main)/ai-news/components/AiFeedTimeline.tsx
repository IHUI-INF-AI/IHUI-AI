'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Flame, TrendingUp, TrendingDown, ExternalLink, Rss } from 'lucide-react'
import type { AiFeedTimelineItem } from '@/lib/ai-news-api'

interface SourceMeta {
  sourceCode: string
  sourceName: string
  icon: string | null
  color: string | null
}

interface Props {
  items: AiFeedTimelineItem[]
  sources: SourceMeta[]
  total: number
}

const CATEGORY_LIST = [
  { key: '', labelKey: 'feed.categoryAll' },
  { key: 'hotspot', labelKey: 'feed.categoryHotspot' },
  { key: 'account', labelKey: 'feed.categoryAccount' },
  { key: 'analysis', labelKey: 'feed.categoryAnalysis' },
  { key: 'creation', labelKey: 'feed.categoryCreation' },
  { key: 'tool', labelKey: 'feed.categoryTool' },
  { key: 'source', labelKey: 'feed.categorySource' },
] as const

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

function formatDayLabel(date: Date, t: (k: string) => string): string {
  const today = startOfDay(new Date())
  const yesterday = today - 86400_000
  const target = startOfDay(date)
  if (target === today) return t('feed.today')
  if (target === yesterday) return t('feed.yesterday')
  return new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric' }).format(date)
}

function formatHot(n: number | null): string {
  if (n === null || n === 0) return ''
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}亿`
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)}万`
  return String(n)
}

function groupByDay(items: AiFeedTimelineItem[]): Array<{ day: string; items: AiFeedTimelineItem[] }> {
  const groups = new Map<string, AiFeedTimelineItem[]>()
  for (const it of items) {
    const date = new Date(it.lastSeenAt)
    const dayKey = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
    const arr = groups.get(dayKey)
    if (arr) arr.push(it)
    else groups.set(dayKey, [it])
  }
  return Array.from(groups.entries()).map(([dayKey, list]) => ({
    day: dayKey,
    items: list,
  }))
}

export function AiFeedTimeline({ items, sources, total }: Props) {
  const t = useTranslations('aiNews')
  const [activeCategory, setActiveCategory] = React.useState<string>('')

  const sourceMap = React.useMemo(() => {
    const m = new Map<string, SourceMeta>()
    for (const s of sources) m.set(s.sourceCode, s)
    return m
  }, [sources])

  const filteredItems = React.useMemo(() => {
    if (!activeCategory) return items
    return items.filter((it) => it.llmCategory === activeCategory)
  }, [items, activeCategory])

  const dayGroups = React.useMemo(() => groupByDay(filteredItems), [filteredItems])

  return (
    <section
      aria-label={t('feed.label')}
      className="overflow-hidden rounded-xl border bg-card shadow-sm"
    >
      {/* 头部 */}
      <div className="space-y-2 p-6 pb-3">
        <div className="flex flex-row items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Rss className="h-4 w-4 text-primary" />
              {t('feed.title')}
            </h2>
            <p className="text-xs text-muted-foreground">{t('feed.subtitle')}</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-md border bg-background/50 px-2 py-1 text-xs text-muted-foreground">
            {t('feed.totalPrefix')}
            <span className="font-medium text-foreground">{total}</span>
            {t('feed.totalSuffix')}
          </span>
        </div>

        {/* Category 筛选 Tab */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2">
          {CATEGORY_LIST.map((cat) => {
            const isActive = activeCategory === cat.key
            return (
              <button
                key={cat.key || 'all'}
                type="button"
                onClick={() => setActiveCategory(cat.key)}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background/60 text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                {t(cat.labelKey)}
              </button>
            )
          })}
        </div>
      </div>

      {/* 时间线列表 */}
      {dayGroups.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          {t('feed.empty')}
        </div>
      ) : (
        <div className="space-y-4 px-6 pb-6">
          {dayGroups.map((group) => {
            const firstDate = new Date(group.items[0]!.lastSeenAt)
            return (
              <div key={group.day} className="space-y-2">
                {/* 日期分组标题 */}
                <div className="flex items-center gap-2 pt-2">
                  <span className="text-xs font-semibold text-muted-foreground">
                    {formatDayLabel(firstDate, t)}
                  </span>
                  <span className="text-[10px] text-muted-foreground/60">
                    · {group.items.length} {t('feed.itemsUnit')}
                  </span>
                </div>

                {/* 单条资讯 */}
                {group.items.map((it) => {
                  const source = sourceMap.get(it.sourceCode)
                  const time = new Intl.DateTimeFormat('zh-CN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  }).format(new Date(it.lastSeenAt))
                  const hot = formatHot(it.currentHot)
                  const isRising = it.trendTag === 'rising'
                  const isCooling = it.trendTag === 'cooling'

                  return (
                    <a
                      key={it.id}
                      href={it.url ?? '#'}
                      target={it.url ? '_blank' : undefined}
                      rel={it.url ? 'noopener noreferrer' : undefined}
                      className="group flex flex-row items-start gap-3 rounded-lg border bg-background/40 p-3 transition-colors hover:border-primary/40 hover:bg-accent/40"
                    >
                      {/* 左侧时间 */}
                      <div className="w-10 shrink-0 pt-0.5 text-right">
                        <span className="text-xs font-mono text-muted-foreground">{time}</span>
                      </div>

                      {/* 中间内容 */}
                      <div className="min-w-0 flex-1 space-y-1.5">
                        {/* 来源徽章行 */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          {source ? (
                            <span
                              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium"
                              style={{
                                backgroundColor: `${source.color ?? '#888'}20`,
                                color: source.color ?? '#888',
                              }}
                            >
                              <span aria-hidden>{source.icon}</span>
                              {source.sourceName}
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                              {it.sourceCode}
                            </span>
                          )}
                          {it.llmCategory ? (
                            <span className="inline-flex items-center rounded-md bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              {t(`feed.category${it.llmCategory.charAt(0).toUpperCase()}${it.llmCategory.slice(1)}`)}
                            </span>
                          ) : null}
                          {isRising ? (
                            <span className="inline-flex items-center gap-0.5 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                              <TrendingUp className="h-2.5 w-2.5" />
                              +{it.trendGrowthPct !== null ? `${it.trendGrowthPct.toFixed(0)}%` : ''}
                            </span>
                          ) : null}
                          {isCooling ? (
                            <span className="inline-flex items-center gap-0.5 rounded-md bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-medium text-rose-600 dark:text-rose-400">
                              <TrendingDown className="h-2.5 w-2.5" />
                              {it.trendGrowthPct !== null ? `${it.trendGrowthPct.toFixed(0)}%` : ''}
                            </span>
                          ) : null}
                        </div>

                        {/* 标题 */}
                        <h3 className="line-clamp-2 text-sm font-semibold leading-tight transition-colors group-hover:text-primary">
                          {it.title}
                        </h3>

                        {/* 摘要 */}
                        {it.summary ? (
                          <p className="line-clamp-2 text-xs text-muted-foreground">{it.summary}</p>
                        ) : null}

                        {/* 来源作者 + 外链图标 */}
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
                          {it.author ? <span className="truncate">{it.author}</span> : null}
                          {it.url ? (
                            <ExternalLink className="h-2.5 w-2.5 opacity-0 transition-opacity group-hover:opacity-100" />
                          ) : null}
                        </div>
                      </div>

                      {/* 右侧热度 */}
                      {hot ? (
                        <div className="flex w-14 shrink-0 flex-col items-end justify-start pt-0.5">
                          <Flame className="h-3.5 w-3.5 text-orange-500/80" />
                          <span className="text-sm font-bold tabular-nums text-orange-600 dark:text-orange-400">
                            {hot}
                          </span>
                        </div>
                      ) : null}
                    </a>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
