// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Bot, ChevronRight, Clock3, ImageIcon, Loader2, Mic, Plus, Search } from 'lucide-react'
import { toast } from 'sonner'

import { AgentGrid } from '../agents/AgentGrid'
import { fetchAgents, fetchCategories } from '../agents/helpers'
import type { Agent } from '../agents/types'
import { useAgent } from '@/hooks/use-agent'
import { apiOrThrow as api } from '@/lib/api'

interface BannerRow {
  id?: string | number
  title?: string
  description?: string
  image?: string
  imageUrl?: string
  cover?: string
  link?: string
  linkUrl?: string
  url?: string
}

interface RecentRow {
  agentId?: string
  id?: string
  name?: string
  avatar?: string
  usedAt?: string
  useCount?: number
}

function normalizeList<T>(payload: unknown, key: string): T[] {
  if (Array.isArray(payload)) return payload as T[]
  if (payload && typeof payload === 'object') {
    const bag = payload as Record<string, unknown>
    if (Array.isArray(bag[key])) return bag[key] as T[]
    if (Array.isArray(bag.list)) return bag.list as T[]
    if (Array.isArray(bag.banner)) return bag.banner as T[]
  }
  return []
}

function AvatarDot({ src, name }: { src?: string | null; name: string }) {
  if (src) {
    return (
      <Image
        src={src}
        alt={name}
        width={32}
        height={32}
        unoptimized
        className="h-8 w-8 shrink-0 rounded-full object-cover"
      />
    )
  }
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-caption font-medium text-secondary-foreground">
      {name.slice(0, 1).toUpperCase()}
    </span>
  )
}

export default function CommunityPageClient() {
  const t = useTranslations('community')
  const ta = useTranslations('agent')
  const tc = useTranslations('common')

  const [keyword, setKeyword] = React.useState('')
  const [debounced, setDebounced] = React.useState('')

  React.useEffect(() => {
    const tm = setTimeout(() => setDebounced(keyword.trim()), 300)
    return () => clearTimeout(tm)
  }, [keyword])

  const categoriesQuery = useQuery({
    queryKey: ['community', 'categories'],
    queryFn: fetchCategories,
  })

  const agentsQuery = useQuery({
    queryKey: ['community', 'agents', debounced],
    queryFn: () => fetchAgents({ page: 1, keyword: debounced, categoryId: 'all' }),
  })

  const bannerQuery = useQuery({
    queryKey: ['community', 'banners'],
    queryFn: async () => {
      const raw = await api<unknown>('/api/content/banner/list?position=home&status=1')
      return normalizeList<BannerRow>(raw, 'list').filter((b) => b.image || b.imageUrl || b.cover)
    },
  })

  const recentQuery = useQuery({
    queryKey: ['community', 'recent'],
    queryFn: async () => {
      const raw = await api<unknown>('/api/agents/use-history')
      return normalizeList<RecentRow>(raw, 'list').slice(0, 8)
    },
    retry: false,
  })

  const { agents: myAgents, loading: myLoading, fetchAgents: fetchMyAgents } = useAgent()

  React.useEffect(() => {
    void fetchMyAgents()
  }, [fetchMyAgents])

  const categories = categoriesQuery.data?.list ?? []
  const agents: Agent[] = agentsQuery.data?.list ?? []
  const banners = bannerQuery.data ?? []
  const recent = recentQuery.data ?? []

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-4">
      <header className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-title font-semibold text-foreground">{t('title')}</h1>
            <p className="mt-1 text-body text-muted-foreground">{t('subtitle')}</p>
          </div>
          <Link
            href="/plaza/new"
            className="ui-control inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-body text-foreground transition-colors hover:bg-secondary/60"
          >
            <Plus className="h-4 w-4" />
            {t('posts')}
          </Link>
        </div>
        {/* 对齐小程序 pages/community 的 InputArea:右侧两个入口只提示「完整版使用」,
            不假装可点(小程序端同一句提示,web 端不另造交互) */}
        <div className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="ui-control h-10 w-full rounded-md border border-border bg-card pl-9 pr-24 text-body text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <span className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
            <button
              type="button"
              onClick={() => toast.info(t('voiceHint'))}
              title={t('voiceHint')}
              aria-label={t('voiceHint')}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <Mic className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => toast.info(t('imageHint'))}
              title={t('imageHint')}
              aria-label={t('imageHint')}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <ImageIcon className="h-4 w-4" />
            </button>
          </span>
        </div>
      </header>

      {banners.length > 0 ? (
        <section aria-label={t('banners')} className="flex gap-3 overflow-x-auto pb-1">
          {banners.slice(0, 6).map((b, i) => {
            const img = b.image || b.imageUrl || b.cover || ''
            const href = b.linkUrl || b.link || b.url || '/agents'
            return (
              <Link
                key={b.id ?? i}
                href={href}
                className="group relative flex h-36 w-72 shrink-0 flex-col justify-end overflow-hidden rounded-lg border border-border bg-secondary"
              >
                {/* 用背景图而非 <Image>:远程图未加载时保留渐变底,不出现破图图标 */}
                {img ? (
                  <span
                    aria-hidden
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-300 group-hover:scale-[1.03]"
                    style={{ backgroundImage: `url("${img}")` }}
                  />
                ) : (
                  <span
                    aria-hidden
                    className="absolute inset-0 bg-gradient-to-br from-primary/25 via-secondary to-background"
                  />
                )}
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-6">
                  <span className="block text-body font-medium text-white">
                    {b.title || t('banners')}
                  </span>
                  {b.description ? (
                    <span className="mt-0.5 block truncate text-caption text-white/80">
                      {b.description}
                    </span>
                  ) : null}
                </span>
              </Link>
            )
          })}
        </section>
      ) : null}

      {categories.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-heading font-medium text-foreground">{t('categories')}</h2>
          <div className="flex flex-wrap gap-2">
            {categories.slice(0, 12).map((c) => (
              <Link
                key={c.categoryId}
                href={`/agents/categories/${c.categoryId}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-body text-foreground transition-colors hover:bg-secondary/60"
              >
                {/* 小程序分类胶囊带 fenlei_icon 图标;接口 Category.icon 有值就同屏显示,空值退回纯文字 */}
                {c.icon ? (
                  <Image
                    src={c.icon}
                    alt=""
                    width={16}
                    height={16}
                    unoptimized
                    className="h-4 w-4 shrink-0 rounded-xs object-cover"
                  />
                ) : null}
                {c.name}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-heading font-medium text-foreground">{t('recent')}</h2>
          <Link
            href="/agents"
            className="inline-flex items-center text-body text-muted-foreground hover:text-foreground"
          >
            {tc('more')}
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        {recentQuery.isLoading ? (
          <div className="flex items-center text-body text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {ta('loading')}
          </div>
        ) : recent.length > 0 ? (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {recent.map((r, i) => {
              const id = String(r.agentId || r.id || '')
              const name = r.name || t('unknownAgent')
              return (
                <Link
                  key={id || i}
                  href={id ? `/agents/${id}` : '/agents'}
                  className="flex w-56 shrink-0 items-center gap-2 rounded-lg border border-border bg-card p-2 transition-colors hover:bg-secondary/40"
                >
                  <AvatarDot src={r.avatar} name={name} />
                  <span className="min-w-0">
                    <span className="block truncate text-body text-foreground">{name}</span>
                    <span className="flex items-center gap-1 text-caption text-muted-foreground">
                      <Clock3 className="h-3 w-3" />
                      {t('recentHint')}
                    </span>
                  </span>
                </Link>
              )
            })}
          </div>
        ) : (
          <p className="text-body text-muted-foreground">{t('recentEmpty')}</p>
        )}
      </section>

      {myLoading || myAgents.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-heading font-medium text-foreground">{t('myAgents')}</h2>
            <Link
              href="/agents/my"
              className="inline-flex items-center text-body text-muted-foreground hover:text-foreground"
            >
              {tc('more')}
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          {myLoading ? (
            <div className="flex items-center text-body text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {ta('loading')}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {myAgents.slice(0, 8).map((a) => (
                <Link
                  key={a.id}
                  href={`/agents/${a.id}`}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-body text-foreground transition-colors hover:bg-secondary/60"
                >
                  <Bot className="h-4 w-4 text-muted-foreground" />
                  {a.name}
                </Link>
              ))}
            </div>
          )}
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-heading font-medium text-foreground">{t('recommended')}</h2>
          <Link
            href="/agents"
            className="inline-flex items-center text-body text-muted-foreground hover:text-foreground"
          >
            {tc('more')}
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        <AgentGrid agents={agents} isLoading={agentsQuery.isLoading} error={agentsQuery.error} />
      </section>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
