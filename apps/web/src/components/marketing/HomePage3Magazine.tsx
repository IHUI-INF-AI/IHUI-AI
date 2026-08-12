'use client'

import * as React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, FileText } from 'lucide-react'
import { Card } from '@ihui/ui-react'
import { fetchApi } from '@/lib/api'

interface NewsItem {
  id: string
  title: string
  coverImage?: string | null
  authorName?: string | null
  createdAt?: string
  categoryName?: string | null
}

type TabKey = 'platform' | 'external'

const TAB_CATEGORY_MAP: Record<TabKey, string[]> = {
  platform: ['AI 模型发布', 'AI 学术前沿', 'AI 产业动态', 'AI 安全与治理'],
  external: ['科技前沿', '教育创新', '金融科技', '医疗健康', '机器人产业', 'AI 艺术', '创业投资', '政策法规'],
}

function unwrap<T>(r: { success: boolean; data?: T; error?: string }): T {
  if (!r.success) throw new Error(r.error)
  return r.data as T
}

function HeroCard({ item, tag }: { item: NewsItem; tag: string }) {
  return (
    <Link
      href={`/news/${item.id}`}
      className="group relative flex h-full min-h-[220px] overflow-hidden rounded-xl border bg-card transition-colors hover:border-primary/40 hover:bg-primary/5"
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
      <div className="relative z-10 mt-auto flex flex-col gap-1.5 p-5">
        <span className="inline-flex w-fit items-center rounded-md bg-card px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-foreground">
          {tag}
        </span>
        <h3 className="line-clamp-2 text-lg font-bold leading-tight text-white min-[1024px]:text-xl">
          {item.title}
        </h3>
        <div className="flex items-center gap-2 text-xs text-white/85">
          <span className="truncate">{item.authorName || item.title}</span>
          {item.createdAt && (
            <>
              <span className="text-white/40">·</span>
              <time className="flex-shrink-0 text-white/70">{formatDate(item.createdAt)}</time>
            </>
          )}
        </div>
      </div>
    </Link>
  )
}

function formatDate(input: string): string {
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) return ''
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function SideCard({ item, tag }: { item: NewsItem; tag: string }) {
  return (
    <Link
      href={`/news/${item.id}`}
      className="group flex flex-1 flex-col overflow-hidden rounded-lg border bg-card transition-colors hover:border-primary/40 hover:bg-primary/5"
    >
      <div className="relative h-24 w-full overflow-hidden bg-muted">
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
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 p-2.5">
        <span className="inline-flex w-fit items-center rounded bg-muted px-1.5 py-px text-xs font-semibold uppercase tracking-wider text-foreground/80">
          {tag}
        </span>
        <h3 className="line-clamp-2 text-xs font-semibold leading-snug">{item.title}</h3>
        <div className="mt-auto flex items-center justify-between gap-1.5">
          <p className="truncate text-xs text-muted-foreground">{item.authorName || item.title}</p>
          {item.createdAt && (
            <time className="flex-shrink-0 text-xs text-muted-foreground/70">
              {formatDate(item.createdAt)}
            </time>
          )}
        </div>
      </div>
    </Link>
  )
}

function MiniCard({ item }: { item: NewsItem }) {
  return (
    <Link
      href={`/news/${item.id}`}
      className="group flex flex-col overflow-hidden rounded-lg border bg-card transition-colors hover:border-primary/40 hover:bg-primary/5"
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
        {item.coverImage ? (
          <Image
            src={item.coverImage}
            alt={item.title}
            fill
            unoptimized
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(min-width: 1024px) 25vw, 50vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/10 to-muted">
            <FileText className="h-6 w-6 text-muted-foreground/30" />
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 p-2">
        <h4 className="line-clamp-2 text-xs font-semibold leading-snug">{item.title}</h4>
        <div className="mt-auto flex items-center justify-between gap-1">
          <p className="truncate text-xs text-muted-foreground">{item.authorName || item.title}</p>
          {item.createdAt && (
            <time className="flex-shrink-0 text-xs text-muted-foreground/70">
              {formatDate(item.createdAt)}
            </time>
          )}
        </div>
      </div>
    </Link>
  )
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 min-[1024px]:grid-cols-[1.6fr_1fr]">
        <div className="h-[300px] animate-pulse rounded-xl bg-muted min-[768px]:h-[340px]" />
        <div className="flex flex-col gap-4">
          <div className="h-[160px] animate-pulse rounded-lg bg-muted" />
          <div className="h-[160px] animate-pulse rounded-lg bg-muted" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-4">
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

  const { data: allItems = [], isLoading } = useQuery<NewsItem[]>({
    queryKey: ['marketing', 'magazine'],
    queryFn: async () => {
      // pageSize=100 拉满(articlesQuerySchema 上限 100):前端按 TAB_CATEGORY_MAP 分类过滤,
      // 若只拉 50 条,排序靠后的小分类(AI 学术前沿 / AI 安全与治理)会被截断,tab 过滤后永远为空
      const d = unwrap<{ list: NewsItem[] }>(await fetchApi('/api/news/articles?pageSize=100'))
      return d.list ?? []
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  })

  const items = React.useMemo(() => {
    const categories = TAB_CATEGORY_MAP[activeTab]
    // categoryName 类型为 string | null | undefined(可选属性),必须同时排除 null 与 undefined
    // 才能安全传给 categories.includes(string) —— 不能只写 !== null(会漏 undefined),也不能用 !=(违反 eqeqeq)
    return allItems.filter(
      (item) =>
        item.categoryName !== null &&
        item.categoryName !== undefined &&
        categories.includes(item.categoryName),
    )
  }, [allItems, activeTab])

  const hero = items[0]
  // 自适应列表项数:保证 listItems 至少 4 条以便填满 4 列网格,不足时减少 sideItems
  const targetList = 4
  const availAfterHero = items.length - 1
  const sideCount = Math.min(2, Math.max(0, availAfterHero - targetList))
  const sideItems = items.slice(1, 1 + sideCount)
  const listItems = items.slice(1 + sideCount, 1 + sideCount + Math.min(8, availAfterHero - sideCount))

  const tabClass = (key: TabKey) =>
    activeTab === key
      ? 'rounded-md bg-card px-4 py-1.5 text-sm font-medium text-foreground'
      : 'rounded-md px-4 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-card hover:text-foreground'

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
          <h2 className="text-2xl font-bold tracking-tight min-[768px]:text-3xl">{t('title')}</h2>
          <h3 className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground/70">
            {t('titleEn')}
          </h3>
          <p className="text-sm text-muted-foreground/80">{t('subtitle')}</p>
        </div>
        <div className="inline-flex gap-0.5 rounded-lg bg-muted p-0.5">
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
        <Card className="flex min-h-0 flex-1 items-center justify-center text-sm text-muted-foreground">
          {t('empty')}
        </Card>
      ) : items.length < 3 ? (
        <div className="flex flex-1 flex-col gap-3">
          <div className="grid grid-cols-2 gap-3 min-[640px]:grid-cols-4">
            {items.map((item) => (
              <MiniCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 min-[1024px]:grid-cols-[1.6fr_1fr]">
            {hero && <HeroCard item={hero} tag={t('tagHot')} />}
            <div className="flex flex-col gap-4">
              {sideItems.map((n) => (
                <SideCard key={n.id} item={n} tag={t('tagNews')} />
              ))}
            </div>
          </div>
          {listItems.length > 0 && (
            <div className="grid grid-cols-2 gap-3 min-[640px]:grid-cols-4">
              {listItems.map((n) => (
                <MiniCard key={n.id} item={n} />
              ))}
            </div>
          )}
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
