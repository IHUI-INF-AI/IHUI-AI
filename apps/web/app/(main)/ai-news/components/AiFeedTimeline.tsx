'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Flame, TrendingUp, TrendingDown, ExternalLink, Rss, Search, LineChart, Loader2 } from 'lucide-react'
import type { AiFeedTimelineItem } from '@/lib/ai-news-api'
import { TrendChartDialog } from './TrendChartDialog'

interface SourceMeta {
  sourceCode: string
  sourceName: string
  category: string
  icon: string | null
  color: string | null
}

interface Props {
  items: AiFeedTimelineItem[]
  sources: SourceMeta[]
  total: number
}

const CHANNEL_LIST = [
  { key: '', labelKey: 'feed.channelAll', matchCategory: null },
  { key: 'first-party', labelKey: 'feed.channelFirstParty', matchCategory: 'first-party' },
  { key: 'ai-media', labelKey: 'feed.channelNews', matchCategory: 'ai-media' },
  { key: 'ai-paper', labelKey: 'feed.channelPaper', matchCategory: 'ai-paper' },
  { key: 'hotlist', labelKey: 'feed.channelHotlist', matchCategory: '__hotlist__' },
] as const

const CATEGORY_LIST = [
  { key: '', labelKey: 'feed.categoryAll' },
  { key: 'ai-models', labelKey: 'feed.categoryModel' },
  { key: 'ai-products', labelKey: 'feed.categoryProduct' },
  { key: 'industry', labelKey: 'feed.categoryIndustry' },
  { key: 'paper', labelKey: 'feed.categoryPaper' },
  { key: 'tip', labelKey: 'feed.categoryTip' },
] as const

const LLM_CATEGORY_KEY_MAP: Record<string, string> = {
  'ai-models': 'feed.categoryModel',
  'ai-products': 'feed.categoryProduct',
  industry: 'feed.categoryIndustry',
  paper: 'feed.categoryPaper',
  tip: 'feed.categoryTip',
}

function llmCategoryLabel(cat: string | null, t: (k: string) => string): string {
  if (!cat) return ''
  const key = LLM_CATEGORY_KEY_MAP[cat]
  return key ? t(key) : cat
}

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

function sourceInitial(name: string): string {
  const ch = name.trim().charAt(0)
  return ch || '?'
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
  const [activeChannel, setActiveChannel] = React.useState<string>('')
  const [activeCategory, setActiveCategory] = React.useState<string>('')
  const [keyword, setKeyword] = React.useState<string>('')
  const [trendItemId, setTrendItemId] = React.useState<string | null>(null)
  const [trendTitle, setTrendTitle] = React.useState<string>('')

  const sourceMap = React.useMemo(() => {
    const m = new Map<string, SourceMeta>()
    for (const s of sources) m.set(s.sourceCode, s)
    return m
  }, [sources])

  const channelFiltered = React.useMemo(() => {
    if (!activeChannel) return items
    const channelDef = CHANNEL_LIST.find((c) => c.key === activeChannel)
    if (!channelDef || !channelDef.matchCategory) return items
    if (channelDef.matchCategory === '__hotlist__') {
      return items.filter((it) => {
        const src = sourceMap.get(it.sourceCode)
        return src?.category === 'general' || src?.category === 'tech-community'
      })
    }
    return items.filter((it) => {
      const src = sourceMap.get(it.sourceCode)
      return src?.category === channelDef.matchCategory
    })
  }, [items, activeChannel, sourceMap])

  const filteredItems = React.useMemo(() => {
    let result = channelFiltered
    if (activeCategory) {
      result = result.filter((it) => it.llmCategory === activeCategory)
    }
    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase()
      result = result.filter(
        (it) =>
          it.title.toLowerCase().includes(kw) ||
          (it.summary?.toLowerCase().includes(kw) ?? false),
      )
    }
    return result
  }, [channelFiltered, activeCategory, keyword])

  const dayGroups = React.useMemo(() => groupByDay(filteredItems), [filteredItems])

  const openTrend = (item: AiFeedTimelineItem) => {
    setTrendItemId(item.id)
    setTrendTitle(item.title)
  }

  return (
    <section
      aria-label={t('feed.label')}
      className="overflow-hidden rounded-xl border bg-card shadow-sm"
    >
      {/* 头部 */}
      <div className="space-y-3 p-6 pb-3">
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

        {/* 搜索框 */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder={t('feed.searchPlaceholder')}
            className="w-full rounded-md border bg-background/50 py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20"
          />
        </div>

        {/* Channel 筛选 Tab */}
        <div className="flex flex-wrap items-center gap-1.5">
          {CHANNEL_LIST.map((ch) => {
            const isActive = activeChannel === ch.key
            return (
              <button
                key={ch.key || 'channel-all'}
                type="button"
                onClick={() => setActiveChannel(ch.key)}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background/60 text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                {t(ch.labelKey)}
              </button>
            )
          })}
        </div>

        {/* Category 筛选 Tab */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {CATEGORY_LIST.map((cat) => {
            const isActive = activeCategory === cat.key
            return (
              <button
                key={cat.key || 'category-all'}
                type="button"
                onClick={() => setActiveCategory(cat.key)}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-muted-foreground/70 hover:bg-accent/60 hover:text-foreground'
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
          {keyword ? t('feed.searchEmpty') : t('feed.empty')}
        </div>
      ) : (
        <div className="space-y-4 px-6 pb-6">
          {dayGroups.map((group) => {
            const firstDate = new Date(group.items[0]!.lastSeenAt)
            return (
              <div key={group.day} className="space-y-2">
                <div className="flex items-center gap-2 pt-2">
                  <span className="text-xs font-semibold text-muted-foreground">
                    {formatDayLabel(firstDate, t)}
                  </span>
                  <span className="text-[10px] text-muted-foreground/60">
                    · {group.items.length} {t('feed.itemsUnit')}
                  </span>
                </div>

                {group.items.map((it) => {
                  const source = sourceMap.get(it.sourceCode)
                  const time = new Intl.DateTimeFormat('zh-CN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  }).format(new Date(it.lastSeenAt))
                  const hot = formatHot(it.currentHot)
                  const isRising = it.trendTag === 'rising'
                  const isCooling = it.trendTag === 'cooling'
                  const srcColor = source?.color ?? '#888'

                  return (
                    <div
                      key={it.id}
                      className="group flex flex-row items-start gap-3 rounded-lg border bg-background/40 p-3 transition-all hover:border-primary/40 hover:bg-accent/40 hover:shadow-sm"
                    >
                      <div className="w-10 shrink-0 pt-0.5 text-right">
                        <span className="text-xs font-mono text-muted-foreground">{time}</span>
                      </div>

                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {source ? (
                            <span
                              className="inline-flex h-5 items-center gap-1 rounded-md px-1.5 text-[10px] font-medium"
                              style={{ backgroundColor: `${srcColor}20`, color: srcColor }}
                            >
                              <span
                                className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm text-[8px] font-bold text-white"
                                style={{ backgroundColor: srcColor }}
                                aria-hidden
                              >
                                {sourceInitial(source.sourceName)}
                              </span>
                              {source.sourceName}
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                              {it.sourceCode}
                            </span>
                          )}
                          {it.llmCategory ? (
                            <span className="inline-flex items-center rounded-md bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              {llmCategoryLabel(it.llmCategory, t)}
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

                        <h3 className="line-clamp-2 text-sm font-semibold leading-tight transition-colors group-hover:text-primary">
                          {it.url ? (
                            <a
                              href={it.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="after:absolute after:inset-0"
                            >
                              {it.title}
                            </a>
                          ) : (
                            it.title
                          )}
                        </h3>

                        {it.summary ? (
                          <p className="line-clamp-2 text-xs text-muted-foreground">{it.summary}</p>
                        ) : null}

                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground/70">
                          {it.author ? <span className="truncate">{it.author}</span> : null}
                          {it.url ? (
                            <ExternalLink className="h-2.5 w-2.5 opacity-0 transition-opacity group-hover:opacity-100" />
                          ) : null}
                          {/* 趋势图表按钮 */}
                          <button
                            type="button"
                            onClick={() => openTrend(it)}
                            className="relative z-10 inline-flex items-center gap-0.5 rounded text-muted-foreground/60 transition-colors hover:text-primary"
                          >
                            <LineChart className="h-2.5 w-2.5" />
                            {t('feed.trendBtn')}
                          </button>
                        </div>
                      </div>

                      {hot ? (
                        <div className="flex w-14 shrink-0 flex-col items-end justify-start pt-0.5">
                          <Flame className="h-3.5 w-3.5 text-orange-500/80" />
                          <span className="text-sm font-bold tabular-nums text-orange-600 dark:text-orange-400">
                            {hot}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            )
          })}

          {/* 加载更多提示 */}
          {filteredItems.length < total && !keyword ? (
            <div className="flex items-center justify-center gap-2 pt-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t('feed.moreHint', { shown: filteredItems.length, total })}
            </div>
          ) : null}
        </div>
      )}

      {/* 趋势图表弹窗 */}
      {trendItemId ? (
        <TrendChartDialog
          itemId={trendItemId}
          title={trendTitle}
          open={!!trendItemId}
          onClose={() => setTrendItemId(null)}
        />
      ) : null}
    </section>
  )
}
