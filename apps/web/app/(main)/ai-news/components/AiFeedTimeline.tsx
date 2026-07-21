'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Flame, TrendingUp, TrendingDown, ExternalLink, Rss } from 'lucide-react'
import type { AiFeedTimelineItem } from '@/lib/ai-news-api'

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

/**
 * Channel Tab(按信源类型筛选,参考 aihot.virxact.com/all 的"来源"三分法)
 * - 全部:所有信源
 * - 一手(first-party):厂商官方博客(OpenAI/Anthropic/Google/...)
 * - 资讯(ai-media):媒体 RSS(机器之心/MIT Tech Review/...)
 * - 论文(ai-paper):学术论文(arXiv CS.AI / CS.CL)
 * - 热榜(hotlist):DailyHotApi 热榜(微博/知乎/HN/...)
 */
const CHANNEL_LIST = [
  { key: '', labelKey: 'feed.channelAll', matchCategory: null },
  { key: 'first-party', labelKey: 'feed.channelFirstParty', matchCategory: 'first-party' },
  { key: 'ai-media', labelKey: 'feed.channelNews', matchCategory: 'ai-media' },
  { key: 'ai-paper', labelKey: 'feed.channelPaper', matchCategory: 'ai-paper' },
  { key: 'hotlist', labelKey: 'feed.channelHotlist', matchCategory: '__hotlist__' },
] as const

/**
 * Category Tab(按单条资讯的 LLM 分类筛选,参考 aihot 6 类)
 * llmCategory 字段由 ai-feed-process cron 的 LLM 自动分类填充
 */
const CATEGORY_LIST = [
  { key: '', labelKey: 'feed.categoryAll' },
  { key: 'ai-models', labelKey: 'feed.categoryModel' },
  { key: 'ai-products', labelKey: 'feed.categoryProduct' },
  { key: 'industry', labelKey: 'feed.categoryIndustry' },
  { key: 'paper', labelKey: 'feed.categoryPaper' },
  { key: 'tip', labelKey: 'feed.categoryTip' },
] as const

/**
 * llmCategory 原值 → i18n key 映射。
 * 后端 LLM 可能输出的 category 值:ai-models / ai-products / industry / paper / tip。
 * 单条资讯徽章用此映射查找翻译 key,未命中则原样回显(避免动态拼接 key 生成 `feed.categoryAi-models` 等无效 key)。
 */
const LLM_CATEGORY_KEY_MAP: Record<string, string> = {
  'ai-models': 'feed.categoryModel',
  'ai-products': 'feed.categoryProduct',
  industry: 'feed.categoryIndustry',
  paper: 'feed.categoryPaper',
  tip: 'feed.categoryTip',
}

/** 单条资讯徽章翻译:命中映射返回 i18n 文案,未命中原样回显(防御 LLM 输出未知 category) */
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

/** 取信源首字母作为徽章图标(避免引入完整 BrandIcon 依赖) */
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

  const sourceMap = React.useMemo(() => {
    const m = new Map<string, SourceMeta>()
    for (const s of sources) m.set(s.sourceCode, s)
    return m
  }, [sources])

  // channel 筛选:按信源 category 筛选(hotlist = general + tech-community)
  const channelFiltered = React.useMemo(() => {
    if (!activeChannel) return items
    const channelDef = CHANNEL_LIST.find((c) => c.key === activeChannel)
    if (!channelDef || !channelDef.matchCategory) return items
    if (channelDef.matchCategory === '__hotlist__') {
      // 热榜:source.category === 'general' || 'tech-community'
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

  // category 筛选:按单条资讯的 llmCategory 筛选
  const filteredItems = React.useMemo(() => {
    if (!activeCategory) return channelFiltered
    return channelFiltered.filter((it) => it.llmCategory === activeCategory)
  }, [channelFiltered, activeCategory])

  const dayGroups = React.useMemo(() => groupByDay(filteredItems), [filteredItems])

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

        {/* Channel 筛选 Tab(按信源类型,5 个) */}
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

        {/* Category 筛选 Tab(按资讯类型,6 个) */}
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
                  const srcColor = source?.color ?? '#888'

                  return (
                    <a
                      key={it.id}
                      href={it.url ?? '#'}
                      target={it.url ? '_blank' : undefined}
                      rel={it.url ? 'noopener noreferrer' : undefined}
                      className="group flex flex-row items-start gap-3 rounded-lg border bg-background/40 p-3 transition-all hover:border-primary/40 hover:bg-accent/40 hover:shadow-sm"
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
                              className="inline-flex h-5 items-center gap-1 rounded-md px-1.5 text-[10px] font-medium"
                              style={{
                                backgroundColor: `${srcColor}20`,
                                color: srcColor,
                              }}
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
