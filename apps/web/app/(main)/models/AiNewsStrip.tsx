'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Calendar, ChevronRight, Newspaper, Sparkles, TrendingUp } from 'lucide-react'

import { Button, Card } from '@ihui/ui-react'
import { getAiNewsFeed, type AiNewsItem } from '@/lib/models-api'
import { LIVE_2026_MODELS } from './helpers'

/**
 * 2026-07 真实 AI 资讯条带
 *
 * 数据流:packages/database/seed/ai-fresh-2026.ts 的 newsArticles 落地到 DB
 *         → 后端 /api/news/articles/pinned + /recommended(已存在)
 *         → 前端 getAiNewsFeed() 拉取
 *         → 失败 fallback:渲染 LIVE_2026_MODELS 的"模型名 + releasedAt"作为 6 条静态资讯
 *
 * 布局:
 *   - 标题栏(NewsFlash + 副标题)
 *   - 6 张资讯卡片(grid 2 / sm:3 / lg:6)
 *   - "暂无最新资讯"空态("AI 数据库暂未连接,显示 2026-07 真实模型列表"提示)
 *
 * 守门:无数据时**不渲染整条**(避免 200px+ 空容器),只在有数据时显示。
 */
export function AiNewsStrip({ initialNews }: { initialNews: AiNewsItem[] }) {
  const t = useTranslations('models')
  // initialData 来自 SSR,useQuery 客户端会接管并自动重取(revalidate 5min)
  const { data, isLoading } = useQuery({
    queryKey: ['ai-news-feed'],
    queryFn: () => getAiNewsFeed(6),
    initialData: initialNews.length > 0 ? initialNews : undefined,
    retry: 1,
    throwOnError: false,
    staleTime: 5 * 60 * 1000,
  })

  const news = data ?? []
  // API 无数据时 fallback:从 LIVE_2026_MODELS 派生 6 条"最新发布"条目
  const fallbackItems = React.useMemo<FallbackItem[]>(() => {
    return LIVE_2026_MODELS.slice(0, 6).map((m) => ({
      id: m.id,
      title: m.name,
      summary: m.description,
      date: m.releasedAt ?? '',
      provider: m.provider,
    }))
  }, [])

  if (news.length === 0 && !isLoading) {
    // 兜底态:显示 6 条 LIVE_2026_MODELS 的"模型发布"卡片,提示"暂无最新资讯"
    return (
      <Card className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 [&>span]:translate-y-[0.5px]">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Newspaper className="h-3.5 w-3.5" />
            </div>
            <h2 className="text-sm font-semibold">{t('aiNews.title')}</h2>
            <span className="text-[10px] text-muted-foreground">{t('aiNews.fallbackHint')}</span>
          </div>
          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground [&>span]:translate-y-[0.5px]">
            <Calendar className="h-3 w-3" />
            <span>2026-07</span>
          </span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {fallbackItems.map((item) => (
            <FallbackNewsCard key={item.id} item={item} />
          ))}
        </div>
      </Card>
    )
  }

  if (isLoading && news.length === 0) {
    return (
      <Card className="flex items-center gap-2 p-4 text-xs text-muted-foreground">
        <div className="h-3 w-3 animate-pulse rounded-full bg-muted-foreground/40" />
        <span>{t('aiNews.loading')}</span>
      </Card>
    )
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 [&>span]:translate-y-[0.5px]">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Newspaper className="h-3.5 w-3.5" />
          </div>
          <h2 className="text-sm font-semibold">{t('aiNews.title')}</h2>
          <span className="text-[10px] text-muted-foreground">{t('aiNews.subtitle')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 [&>span]:translate-y-[0.5px]">
            <TrendingUp className="h-3 w-3" />
            <span>{t('aiNews.liveTag')}</span>
          </span>
          <Button variant="ghost" size="sm" className="h-6 gap-0.5 px-2 text-[11px]" asChild>
            <Link href="/news">
              <span>{t('aiNews.viewAll')}</span>
              <ChevronRight className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {news.map((n) => (
          <NewsCard key={n.id} item={n} />
        ))}
      </div>
    </Card>
  )
}

function NewsCard({ item }: { item: AiNewsItem }) {
  const t = useTranslations('models')
  const dateLabel = item.publishedAt ? formatDate(item.publishedAt) : '2026-07'

  return (
    <Link
      href={item.relatedModelIds[0] ? `/models?provider=${item.relatedModelIds[0]}` : '/news'}
      className="group flex h-full flex-col gap-1.5 rounded-md border border-border bg-background p-2.5 transition-colors hover:border-primary/40 hover:bg-accent/40"
    >
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground [&>span]:translate-y-[0.5px]">
        <Calendar className="h-2.5 w-2.5" />
        <span>{dateLabel}</span>
        {item.relatedModelIds.length > 0 && (
          <>
            <span className="text-muted-foreground/60">·</span>
            <span className="inline-flex items-center gap-0.5 text-primary">
              <Sparkles className="h-2.5 w-2.5" />
              <span>{t('aiNews.relatedModels', { count: item.relatedModelIds.length })}</span>
            </span>
          </>
        )}
      </div>
      <h3 className="line-clamp-2 text-xs font-medium leading-snug text-foreground group-hover:text-primary">
        {item.title}
      </h3>
      {item.summary && (
        <p className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
          {item.summary}
        </p>
      )}
    </Link>
  )
}

function FallbackNewsCard({ item }: { item: FallbackItem }) {
  const t = useTranslations('models')
  return (
    <Link
      href="/models"
      className="group flex h-full flex-col gap-1.5 rounded-md border border-border bg-muted/30 p-2.5 transition-colors hover:border-primary/40 hover:bg-accent/40"
    >
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground [&>span]:translate-y-[0.5px]">
        <Calendar className="h-2.5 w-2.5" />
        <span>{item.date || '2026-07'}</span>
        <span className="text-muted-foreground/60">·</span>
        <span>{t(`providers.${item.provider}`)}</span>
      </div>
      <h3 className="line-clamp-1 text-xs font-medium leading-snug text-foreground group-hover:text-primary">
        {item.title}
      </h3>
      <p className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
        {item.summary}
      </p>
    </Link>
  )
}

interface FallbackItem {
  id: string
  title: string
  summary: string
  date: string
  provider: string
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '2026-07'
    return d.toISOString().slice(0, 10)
  } catch {
    return '2026-07'
  }
}
