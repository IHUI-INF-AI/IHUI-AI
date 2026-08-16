'use client'

import * as React from 'react'
import Image from 'next/image'
import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import {
  Radio,
  PlayCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Calendar,
  ExternalLink,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import {
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import { BackButton } from '@/components/common'

interface LiveCategory {
  id: string
  name: string
}

interface LiveChannel {
  id: string
  title: string
  categoryId: string | null
  coverImage: string | null
  playUrl: string | null
  pushUrl: string | null
  lecturerName: string | null
  intro: string | null
  isLive: boolean
  isPublished: boolean
  viewCount: number
  startTime: string | null
  endTime: string | null
  status: number
}

interface LiveChannelListData {
  list: LiveChannel[]
  total: number
  page: number
  pageSize: number
}

interface LiveCategoryListData {
  list: LiveCategory[]
  total: number
}

const PAGE_SIZE = 12

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

function formatTime(value: string | null, locale: string): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export default function LivePage() {
  const t = useTranslations('eduAi.live')
  const locale = useLocale()

  const [category, setCategory] = React.useState<string | null>(null)
  const [page, setPage] = React.useState(1)
  const [selected, setSelected] = React.useState<LiveChannel | null>(null)
  const [dialogOpen, setDialogOpen] = React.useState(false)

  const { data: categoriesData, error: categoriesError } = useQuery({
    queryKey: ['eduAi', 'live', 'categories'],
    queryFn: () => api<LiveCategoryListData>(`/api/live/categories`),
  })
  const categories = categoriesData?.list ?? []

  const { data, isLoading, error } = useQuery({
    queryKey: ['eduAi', 'live', 'channels', category, page],
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (category !== null) qs.set('categoryId', category)
      return api<LiveChannelListData>(`/api/live/channels?${qs.toString()}`)
    },
  })

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const channels = data?.list ?? []

  const categoryName = (id: string | null): string => {
    if (id === null) return '-'
    return categories.find((c) => c.id === id)?.name ?? '-'
  }

  const openDialog = (channel: LiveChannel) => {
    setSelected(channel)
    setDialogOpen(true)
  }

  const isUpcoming = (c: LiveChannel): boolean => {
    if (c.isLive) return false
    if (!c.startTime) return false
    return new Date(c.startTime).getTime() > Date.now()
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <BackButton fallbackHref="/edu-ai" />
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Radio className="h-7 w-7 text-primary" />
          {t('title')}
        </h1>
        <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
      </header>

      {/* 分类筛选 chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">{t('category')}</span>
        <Button
          size="sm"
          variant={category === null ? 'default' : 'outline'}
          onClick={() => {
            setCategory(null)
            setPage(1)
          }}
        >
          {t('allCategories')}
        </Button>
        {categories.map((cat) => (
          <Button
            key={cat.id}
            size="sm"
            variant={category === cat.id ? 'default' : 'outline'}
            onClick={() => {
              setCategory(cat.id)
              setPage(1)
            }}
          >
            {cat.name}
          </Button>
        ))}
      </div>

      {categoriesError && (
        <Alert variant="danger" description={(categoriesError as Error).message} />
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      ) : error ? (
        <Alert variant="danger" description={(error as Error).message} />
      ) : channels.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-8">
          <PlayCircle className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-3">
          {channels.map((channel) => (
            <Card
              key={channel.id}
              className="flex cursor-pointer flex-col overflow-hidden transition-colors hover:bg-accent"
              onClick={() => openDialog(channel)}
            >
              <div className="relative flex h-36 items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
                {channel.coverImage ? (
                  <Image
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    src={channel.coverImage}
                    alt={channel.title}
                    className="object-cover"
                  />
                ) : (
                  <PlayCircle className="h-10 w-10 text-primary/40" />
                )}
                {channel.isLive ? (
                  <span className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-red-500 px-2 py-0.5 text-xs font-medium text-white">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                    {t('liveNow')}
                  </span>
                ) : isUpcoming(channel) ? (
                  <span className="absolute left-2 top-2 rounded-md bg-primary/90 px-2 py-0.5 text-xs font-medium text-white">
                    {t('upcoming')}
                  </span>
                ) : null}
              </div>
              <CardContent className="flex min-w-0 flex-1 flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-1 font-medium">{channel.title}</p>
                  <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {categoryName(channel.categoryId)}
                  </span>
                </div>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                  {t('startTime')}: {formatTime(channel.startTime, locale)}
                </p>
                {channel.intro && (
                  <p className="line-clamp-2 flex-1 text-sm text-muted-foreground">
                    {channel.intro}
                  </p>
                )}
                <span className="mt-auto flex shrink-0 items-center gap-1 pt-1 text-xs text-primary">
                  {t('viewDetail')}
                  <ExternalLink className="h-3.5 w-3.5" />
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {t('page', { page, total: totalPages })}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
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

      {/* 播放 Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2 pr-8">
              {selected?.title}
              {selected?.isLive ? (
                <span className="flex items-center gap-1 rounded-md bg-red-500 px-2 py-0.5 text-xs font-medium text-white">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                  {t('liveNow')}
                </span>
              ) : selected && isUpcoming(selected) ? (
                <span className="rounded-md bg-primary/90 px-2 py-0.5 text-xs font-medium text-white">
                  {t('upcoming')}
                </span>
              ) : null}
            </DialogTitle>
            <DialogDescription className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <span>
                {t('category')}: {categoryName(selected?.categoryId ?? null)}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {t('startTime')}: {formatTime(selected?.startTime ?? null, locale)}
              </span>
            </DialogDescription>
          </DialogHeader>

          {selected ? (
            <div className="space-y-4">
              {selected.playUrl ? (
                <div className="space-y-3">
                  <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
                    {/* 平台直播源一般不允许跨站 iframe 嵌入,内嵌失败时下方提供外链入口 */}
                    <iframe
                      src={selected.playUrl}
                      title={selected.title}
                      className="h-full w-full"
                      allowFullScreen
                    />
                  </div>
                  <a
                    href={selected.playUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex w-fit items-center gap-1 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {t('watch')}
                  </a>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-8">
                  <PlayCircle className="h-10 w-10 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">{t('noStream')}</p>
                </div>
              )}

              {selected.intro && (
                <p className="whitespace-pre-line text-sm leading-6 text-muted-foreground">
                  {selected.intro}
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('loading')}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
