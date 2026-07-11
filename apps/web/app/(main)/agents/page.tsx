'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Search, Loader2, Bot, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Input, Button, Card, CardContent } from '@ihui/ui'
import { Grid } from '@/components/layout'
import { Avatar } from '@/components/data/Avatar'

interface Agent {
  agentId: string
  name: string
  description: string | null
  avatar: string | null
  cover: string | null
  categoryId: string | null
  status: string
  price: number
  isFree: boolean
  sort: number
  remark: string | null
  createdAt: string
  updatedAt: string
}

interface Category {
  categoryId: string
  name: string
  description: string | null
  icon: string | null
  sort: number
  status: string
  isPaid: boolean
  createdAt: string
}

interface AgentsData {
  list: Agent[]
  total: number
  page: number
  pageSize: number
}

interface CategoriesData {
  list: Category[]
  total: number
  page: number
  pageSize: number
}

const PAGE_SIZE = 12

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

function fetchAgents(params: {
  page: number
  keyword: string
  categoryId: string
}): Promise<AgentsData> {
  const qs = new URLSearchParams({
    page: String(params.page),
    pageSize: String(PAGE_SIZE),
    status: 'published',
  })
  if (params.keyword) qs.set('keyword', params.keyword)
  if (params.categoryId !== 'all') qs.set('categoryId', params.categoryId)
  return api<AgentsData>(`/api/agents/list?${qs.toString()}`)
}

function fetchCategories(): Promise<CategoriesData> {
  return api<CategoriesData>(`/api/categories/list?page=1&pageSize=100&status=1`)
}

export default function AgentsMarketPage() {
  const t = useTranslations('agents')
  const tc = useTranslations('common')
  const locale = useLocale()

  const [keyword, setKeyword] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [categoryId, setCategoryId] = React.useState('all')
  const [page, setPage] = React.useState(1)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(keyword)
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [keyword])

  const { data: catData } = useQuery({
    queryKey: ['agents', 'categories'],
    queryFn: fetchCategories,
  })

  const { data, isLoading, error } = useQuery({
    queryKey: ['agents', 'list', debounced, categoryId, page],
    queryFn: () => fetchAgents({ page, keyword: debounced, categoryId }),
  })

  const categories = catData?.list ?? []
  const agents = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const priceFmt = new Intl.NumberFormat(locale, { style: 'currency', currency: 'CNY' })

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
          <Bot className="h-7 w-7 text-primary" />
          {t('marketTitle')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('marketSubtitle')}</p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="h-9 pl-8"
            aria-label={tc('search')}
          />
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setCategoryId('all')
              setPage(1)
            }}
            className={cn(
              'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
              categoryId === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground',
            )}
          >
            {t('allCategories')}
          </button>
          {categories.map((c) => (
            <button
              key={c.categoryId}
              type="button"
              onClick={() => {
                setCategoryId(c.categoryId)
                setPage(1)
              }}
              className={cn(
                'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                categoryId === c.categoryId
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground',
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      ) : agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-20 text-center">
          <Bot className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        </div>
      ) : (
        <Grid cols={1} smCols={2} lgCols={3} gap="md">
          {agents.map((a) => (
            <Link key={a.agentId} href={`/agents/${a.agentId}`} className="group">
              <Card className="flex h-full flex-col overflow-hidden transition-colors hover:bg-accent">
                <div className="relative h-32 w-full overflow-hidden bg-muted">
                  {a.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.cover}
                      alt={a.name}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground/40">
                      <Sparkles className="h-8 w-8" />
                    </div>
                  )}
                </div>
                <CardContent className="flex flex-1 flex-col gap-2 p-4">
                  <div className="flex items-center gap-2">
                    <Avatar src={a.avatar ?? undefined} name={a.name ?? 'A'} size="sm" />
                    <span className="break-words font-medium">{a.name}</span>
                  </div>
                  <p className="flex-1 text-sm text-muted-foreground">
                    {a.description || t('noDescription')}
                  </p>
                  <div className="flex items-center justify-between pt-1">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                        a.isFree
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
                          : 'bg-primary/10 text-primary',
                      )}
                    >
                      {a.isFree ? t('free') : priceFmt.format(a.price)}
                    </span>
                    <span className="text-xs text-primary opacity-0 transition-opacity group-hover:opacity-100">
                      {t('viewDetail')}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </Grid>
      )}

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{t('total', { total })}</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
            {t('prev')}
          </Button>
          <span className="text-sm text-muted-foreground">
            {t('page', { page, total: totalPages })}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('next')}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
