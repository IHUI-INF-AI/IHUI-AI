'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import {
  Wrench,
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Users,
  ExternalLink,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import {
  Button,
  Card,
  CardContent,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import { cn } from '@/lib/utils'
import { BackButton } from '@/components/common'

type ToolCategory = 'text' | 'image' | 'video' | 'audio' | 'code' | '3d' | 'agent'

interface AigcTool {
  id: string
  name: string
  nameCn?: string
  category: ToolCategory
  subcategory?: string
  provider?: string
  url?: string
  description?: string
  coreFeatures?: string[] | null
  useCases?: string[] | null
  pricingModel?: string
  pricingDetail?: string
  freeTier?: string
  apiAvailable?: boolean
  mobileApp?: boolean
  pros?: string[] | null
  cons?: string[] | null
  tips?: string[] | null
  alternatives?: string[] | null
  rating?: number
  userCount?: number
}

interface AigcToolListData {
  list: AigcTool[]
  total: number
  page: number
  pageSize: number
}

const PAGE_SIZE = 12

const CATEGORIES: Array<{ value: string; labelKey: string }> = [
  { value: 'all', labelKey: 'all' },
  { value: 'text', labelKey: 'text' },
  { value: 'image', labelKey: 'image' },
  { value: 'video', labelKey: 'video' },
  { value: 'audio', labelKey: 'audio' },
  { value: 'code', labelKey: 'code' },
  { value: '3d', labelKey: '3d' },
  { value: 'agent', labelKey: 'agent' },
]

const CATEGORY_STYLE: Record<string, string> = {
  text: 'bg-sky-500/10 text-sky-600',
  image: 'bg-violet-500/10 text-violet-600',
  video: 'bg-rose-500/10 text-rose-600',
  audio: 'bg-amber-500/10 text-amber-600',
  code: 'bg-emerald-500/10 text-emerald-600',
  '3d': 'bg-indigo-500/10 text-indigo-600',
  agent: 'bg-fuchsia-500/10 text-fuchsia-600',
}

const CATEGORY_KEY: Record<string, string> = {
  text: 'text',
  image: 'image',
  video: 'video',
  audio: 'audio',
  code: 'code',
  '3d': '3d',
  agent: 'agent',
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

function isFreeTool(tool: AigcTool): boolean {
  const p = (tool.pricingModel ?? '').toLowerCase()
  if (p.includes('free') || p.includes('免费')) return true
  return Boolean(tool.freeTier?.trim())
}

function RatingStars({ rating }: { rating?: number | null }) {
  const full = Math.max(0, Math.min(5, Math.round(rating ?? 0)))
  return (
    <span className="shrink-0 text-amber-500" aria-label={`${rating ?? 0}`}>
      {'★'.repeat(full)}
      {'☆'.repeat(5 - full)}
    </span>
  )
}

function DetailSection({
  title,
  items,
  marker,
  markerClass,
}: {
  title: string
  items: string[]
  marker?: string
  markerClass?: string
}) {
  return (
    <div>
      <h3 className="mb-1.5 font-medium">{title}</h3>
      <ul className="space-y-1 text-muted-foreground">
        {items.map((item, i) => (
          <li key={`${i}-${item}`} className="flex items-start gap-1.5">
            {marker && <span className={cn('shrink-0 font-medium', markerClass)}>{marker}</span>}
            <span className="min-w-0">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function EduAiAigcToolsPage() {
  const t = useTranslations('eduAi.aigc')
  const tc = useTranslations('common')

  const [keyword, setKeyword] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [category, setCategory] = React.useState('all')
  const [page, setPage] = React.useState(1)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [detailOpen, setDetailOpen] = React.useState(false)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(keyword)
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [keyword])

  const { data, isLoading, error } = useQuery({
    queryKey: ['edu-ai', 'aigc-tools', debounced, category, page],
    queryFn: () => {
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        status: 'active',
      })
      if (debounced) qs.set('keyword', debounced)
      if (category !== 'all') qs.set('category', category)
      return api<AigcToolListData>(`/api/ai-education/aigc-tool?${qs.toString()}`)
    },
  })

  const detailQuery = useQuery({
    queryKey: ['edu-ai', 'aigc-tool', selectedId],
    queryFn: () => {
      if (selectedId === null) throw new Error('missing tool id')
      return api<AigcTool>(`/api/ai-education/aigc-tool/${selectedId}`)
    },
    enabled: selectedId !== null,
  })

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const tools = data?.list ?? []
  const detail = detailQuery.data

  const openDetail = (id: string) => {
    setSelectedId(id)
    setDetailOpen(true)
  }

  return (
    <div className="space-y-4">
      <BackButton fallbackHref="/edu" />
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Wrench className="h-7 w-7 text-primary" />
          {t('title')}
        </h1>
        <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
      </header>

      <div className="space-y-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder={t('search')}
            className="h-9 pl-8"
            aria-label={t('search')}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">{t('category')}</span>
          {CATEGORIES.map((cat) => (
            <Button
              key={cat.value}
              size="sm"
              variant={category === cat.value ? 'default' : 'outline'}
              onClick={() => {
                setCategory(cat.value)
                setPage(1)
              }}
            >
              {t(cat.labelKey)}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      ) : error ? (
        <Alert variant="danger" description={(error as Error).message} />
      ) : tools.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-8">
          <Sparkles className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{tc('empty')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-3">
          {tools.map((tool) => (
            <Card
              key={tool.id}
              className="flex cursor-pointer flex-col transition-colors hover:bg-accent"
              onClick={() => openDetail(tool.id)}
            >
              <CardContent className="flex min-w-0 flex-1 flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="line-clamp-1 font-medium">{tool.name}</p>
                    {tool.nameCn && (
                      <p className="line-clamp-1 text-xs text-muted-foreground">{tool.nameCn}</p>
                    )}
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-md px-2 py-0.5 text-xs',
                      CATEGORY_STYLE[tool.category] ?? 'bg-muted text-muted-foreground',
                    )}
                  >
                    {t(CATEGORY_KEY[tool.category] ?? 'all')}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary/60" />
                    <span className="line-clamp-1">{tool.provider}</span>
                  </span>
                  <RatingStars rating={tool.rating} />
                </div>

                {tool.description && (
                  <p className="line-clamp-2 flex-1 text-sm text-muted-foreground">
                    {tool.description}
                  </p>
                )}

                <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {isFreeTool(tool) && (
                      <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-600">
                        {t('free')}
                      </span>
                    )}
                    {tool.apiAvailable && (
                      <span className="rounded-md bg-sky-500/10 px-2 py-0.5 text-xs text-sky-600">
                        {t('api')}
                      </span>
                    )}
                  </div>
                  <span className="flex shrink-0 items-center gap-1 text-xs text-primary">
                    {t('viewDetail')}
                    <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{t('total', { n: total })}</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2 pr-8">
              {detail?.name}
              {detail?.nameCn && (
                <span className="text-sm font-normal text-muted-foreground">{detail.nameCn}</span>
              )}
            </DialogTitle>
            <DialogDescription className="flex flex-wrap items-center gap-2">
              {detail ? (
                <>
                  <span
                    className={cn(
                      'rounded-md px-2 py-0.5 text-xs',
                      CATEGORY_STYLE[detail.category] ?? 'bg-muted text-muted-foreground',
                    )}
                  >
                    {t(CATEGORY_KEY[detail.category] ?? 'all')}
                  </span>
                  {detail.provider && (
                    <span>
                      {t('provider')}: {detail.provider}
                    </span>
                  )}
                </>
              ) : (
                t('loading')
              )}
            </DialogDescription>
          </DialogHeader>

          {detailQuery.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('loading')}
            </div>
          ) : detailQuery.isError ? (
            <Alert variant="danger" description={(detailQuery.error as Error).message} />
          ) : detail ? (
            <div className="space-y-4 text-sm">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                <span className="flex items-center gap-1.5">
                  <RatingStars rating={detail.rating} />
                  <span className="text-xs text-muted-foreground">
                    {t('rating')}: {detail.rating ?? '-'}
                  </span>
                </span>
                {typeof detail.userCount === 'number' && detail.userCount > 0 && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    {detail.userCount}
                  </span>
                )}
                {detail.url && (
                  <a
                    href={detail.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-w-0 items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{detail.url}</span>
                  </a>
                )}
              </div>

              {detail.description && <p className="text-muted-foreground">{detail.description}</p>}

              {detail.coreFeatures?.length ? (
                <DetailSection title={t('coreFeatures')} items={detail.coreFeatures} />
              ) : null}
              {detail.useCases?.length ? (
                <DetailSection title={t('useCases')} items={detail.useCases} />
              ) : null}

              <div>
                <h3 className="mb-1.5 font-medium">{t('pricing')}</h3>
                <div className="space-y-1 text-muted-foreground">
                  {detail.pricingModel && <p>{detail.pricingModel}</p>}
                  {detail.pricingDetail && <p>{detail.pricingDetail}</p>}
                  {detail.freeTier && <p className="text-emerald-600">{detail.freeTier}</p>}
                </div>
              </div>

              {detail.pros?.length ? (
                <DetailSection title={t('pros')} items={detail.pros} marker="+" markerClass="text-emerald-600" />
              ) : null}
              {detail.cons?.length ? (
                <DetailSection title={t('cons')} items={detail.cons} marker="-" markerClass="text-rose-600" />
              ) : null}
              {detail.alternatives?.length ? (
                <DetailSection title={t('alternatives')} items={detail.alternatives} />
              ) : null}
              {detail.tips?.length ? (
                <DetailSection title={t('tips')} items={detail.tips} />
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
