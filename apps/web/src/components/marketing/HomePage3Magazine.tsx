'use client'

import * as React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, FileText } from 'lucide-react'
import { Card } from '@ihui/ui'
import { fetchApi } from '@/lib/api'

interface NewsItem {
  id: string
  title: string
  coverImage?: string | null
  authorName?: string | null
  createdAt?: string
}

type TabKey = 'platform' | 'external'

function unwrap<T>(r: { success: boolean; data?: T; error?: string }): T {
  if (!r.success) throw new Error(r.error)
  return r.data as T
}

function HeroCard({ item, tag }: { item: NewsItem; tag: string }) {
  return (
    <Link
      href={`/news/${item.id}`}
      className="group relative flex min-h-[300px] overflow-hidden rounded-xl border bg-card transition-colors hover:border-primary/40 hover:bg-primary/5 md:min-h-[340px]"
    >
      <div className="absolute inset-0">
        {item.coverImage ? (
          <Image
            src={item.coverImage}
            alt={item.title}
            fill
            unoptimized
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(min-width: 1024px) 60vw, 100vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/10 to-muted">
            <FileText className="h-12 w-12 text-muted-foreground/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/50 transition-colors group-hover:bg-black/60" />
      </div>
      <div className="relative z-10 mt-auto flex flex-col gap-2 p-6">
        <span className="inline-flex w-fit items-center rounded-md bg-card px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-foreground">
          {tag}
        </span>
        <h3 className="line-clamp-2 text-xl font-bold leading-tight text-white">{item.title}</h3>
        <p className="line-clamp-2 text-sm text-white/85">{item.authorName || item.title}</p>
        {item.createdAt && <time className="text-xs text-white/70">{item.createdAt}</time>}
      </div>
    </Link>
  )
}

function SideCard({ item, tag }: { item: NewsItem; tag: string }) {
  return (
    <Link
      href={`/news/${item.id}`}
      className="group flex flex-1 flex-col overflow-hidden rounded-lg border bg-card transition-colors hover:border-primary/40 hover:bg-primary/5"
    >
      <div className="relative h-24 overflow-hidden bg-muted">
        {item.coverImage ? (
          <Image
            src={item.coverImage}
            alt={item.title}
            fill
            unoptimized
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(min-width: 1024px) 40vw, 100vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/10 to-muted">
            <FileText className="h-8 w-8 text-muted-foreground/30" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <span className="inline-flex w-fit items-center rounded-md bg-muted px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-foreground">
          {tag}
        </span>
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{item.title}</h3>
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {item.authorName || item.title}
        </p>
        {item.createdAt && (
          <time className="mt-auto text-xs text-muted-foreground/70">{item.createdAt}</time>
        )}
      </div>
    </Link>
  )
}

function ListItem({ item }: { item: NewsItem }) {
  return (
    <Link
      href={`/news/${item.id}`}
      className="group flex items-start gap-2.5 rounded-md border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-primary/5"
    >
      <span className="mt-1 h-8 w-[3px] flex-shrink-0 rounded-sm bg-border transition-colors group-hover:bg-primary" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h4 className="line-clamp-2 text-xs font-medium leading-snug">{item.title}</h4>
        {item.createdAt && (
          <time className="text-xs text-muted-foreground/70">{item.createdAt}</time>
        )}
      </div>
      <ChevronRight className="mt-1 h-3 w-3 flex-shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
    </Link>
  )
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="h-[300px] animate-pulse rounded-xl bg-muted md:h-[340px]" />
        <div className="flex flex-col gap-4">
          <div className="h-[160px] animate-pulse rounded-lg bg-muted" />
          <div className="h-[160px] animate-pulse rounded-lg bg-muted" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
    </div>
  )
}

export function HomePage3Magazine() {
  const t = useTranslations('marketing.magazine')
  const [activeTab, setActiveTab] = React.useState<TabKey>('platform')

  const { data: items = [], isLoading } = useQuery<NewsItem[]>({
    queryKey: ['marketing', 'magazine'],
    queryFn: async () => {
      // 2026-07-20 修正:后端 GET /api/news 根路由不存在,正确路由是 /api/news/articles
      // (apps/api/src/routes/news.ts 第 122-130 行,GET /news/articles 公开路由)
      // 之前调 /api/news 返回 404,导致"最新资讯"板块永远显示 empty
      const d = unwrap<{ list: NewsItem[] }>(await fetchApi('/api/news/articles?pageSize=8'))
      return d.list ?? []
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  })

  const hero = items[0]
  const sideItems = items.slice(1, 3)
  const listItems = items.slice(3, 7)

  const tabClass = (key: TabKey) =>
    activeTab === key
      ? 'rounded-md border border-border bg-background px-5 py-2 text-sm font-medium text-foreground shadow-sm'
      : 'rounded-md border border-transparent px-5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-background hover:text-foreground'

  // 2026-07-20 改(自适应 v4,根因):根 section 改 flex flex-1 flex-col,让它在 page4
  // wrapper (flex-1 min-h-0) 内撑开 = 视口 - footer 自然高度。
  // - 中间 Card / grid 区域继承 flex-1,占满 magazine 容器剩余空间;
  // - "查看更多" 链接用 mt-auto 贴底,跟 footer 顶边无缝衔接;
  // - 之前缺 flex-1,根 section 高度 = 内容自然高度 (~140px),container 撑到
  //   ~500px,导致 Card 下方 ~360px 大空白 (用户反馈"大量空余空间" 根因)。
  return (
    <section className="flex flex-1 flex-col space-y-4">
      <header className="flex flex-col items-center gap-3 text-center">
        <div className="flex flex-col items-center gap-1">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">{t('title')}</h2>
          <h3 className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground/70">
            {t('titleEn')}
          </h3>
          <p className="text-sm text-muted-foreground/80">{t('subtitle')}</p>
        </div>
        <div className="inline-flex gap-1 rounded-lg bg-muted p-1">
          <button
            type="button"
            onClick={() => setActiveTab('platform')}
            className={tabClass('platform')}
          >
            {t('tabPlatform')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('external')}
            className={tabClass('external')}
          >
            {t('tabExternal')}
          </button>
        </div>
      </header>

      {isLoading ? (
        <Skeleton />
      ) : items.length === 0 ? (
        // 2026-07-20 改:Card 加 flex-1 min-h-0,让"暂无内容"占满 magazine 容器
        // 剩余空间,不再留下方大空隙;h-40 (固定 160px) 已删除,改由 flex-1 撑开。
        <Card className="flex min-h-0 flex-1 items-center justify-center text-sm text-muted-foreground">
          {t('empty')}
        </Card>
      ) : (
        <div className="flex flex-1 flex-col gap-4">
          <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
            {hero && <HeroCard item={hero} tag={t('tagHot')} />}
            <div className="flex flex-col gap-4">
              {sideItems.map((n) => (
                <SideCard key={n.id} item={n} tag={t('tagNews')} />
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {listItems.map((n) => (
              <ListItem key={n.id} item={n} />
            ))}
          </div>
        </div>
      )}

      {/* 2026-07-20 改:mt-auto 推到底部,贴齐 magazine 容器底边 = footer 顶边,
          配合根 section flex-1,空数据时 Card 已占满中间空间,链接紧跟 Card 下方
          不再悬空。 */}
      <div className="mt-auto flex justify-end pt-2">
        <Link
          href="/news"
          className="flex items-center gap-0.5 text-xs text-muted-foreground transition-colors hover:text-primary"
        >
          {t('viewMore')}
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
    </section>
  )
}
