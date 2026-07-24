'use client'

import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import ReactMarkdown from 'react-markdown'
import { Loader2, ArrowLeft, ArrowRight, Megaphone, CheckCheck } from 'lucide-react'

import { Card, CardContent, Button } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import {

api,
  markdownComponents,
  ANN_TYPE_BADGE,
  type Announcement,
  type AnnouncementDetail,
} from '@/lib/content'

interface ListItem extends Announcement {
  isRead?: boolean
}

export default function AnnouncementDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const t = useTranslations('announcements')
  const locale = useLocale()
  const qc = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['announcements', id],
    queryFn: () => api<AnnouncementDetail>(`/api/announcements/${id}`).then((d) => d.announcement),
  })

  // 复用列表缓存，推断上一篇/下一篇
  const { data: list } = useQuery({
    queryKey: ['announcements'],
    queryFn: () => api<{ list: ListItem[] }>('/api/announcements').then((d) => d.list ?? []),
  })

  const readMut = useMutation({
    mutationFn: () => api<{ ok: boolean }>(`/api/announcements/${id}/read`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['announcements'] }),
  })

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const fmt = (v?: string) => {
    if (!v) return '-'
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : dateFmt.format(d)
  }

  if (isLoading)
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t('loading')}
      </div>
    )

  if (error || !data)
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <button
          type="button"
          onClick={() => router.push('/announcements')}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('backToList')}
        </button>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error)?.message ?? t('notFound')}
        </div>
      </div>
    )

  const a = data

  // 列表按置顶 + 发布时间倒序排列，定位当前条目
  const sorted = (list ?? []).slice().sort((x, y) => {
    if (!!x.isPinned !== !!y.isPinned) return x.isPinned ? -1 : 1
    return new Date(y.publishedAt).getTime() - new Date(x.publishedAt).getTime()
  })
  const idx = sorted.findIndex((x) => x.id === a.id)
  const prev = idx > 0 ? sorted[idx - 1] : undefined
  const next = idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1] : undefined
  const isRead = list?.find((x) => x.id === a.id)?.isRead

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <Link
        href="/announcements"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('backToList')}
      </Link>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn('rounded-md px-2 py-0.5 text-xs font-medium', ANN_TYPE_BADGE[a.type])}
          >
            {t(`types.${a.type}`)}
          </span>
          <Megaphone className="h-4 w-4 text-muted-foreground" />
          {a.isPinned && <span className="text-xs text-primary">{t('pinned')}</span>}
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto h-7 gap-1 px-2 text-xs"
            disabled={isRead || readMut.isPending}
            onClick={() => readMut.mutate()}
          >
            {readMut.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : isRead ? (
              <CheckCheck className="h-3.5 w-3.5" />
            ) : null}
            {isRead ? t('markedRead') : t('markRead')}
          </Button>
          {readMut.isError && (
            <span className="text-xs text-destructive">{(readMut.error as Error)?.message}</span>
          )}
        </div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{a.title}</h1>
        <p className="text-sm text-muted-foreground">
          {t('publishedAt')} {fmt(a.publishedAt)}
        </p>
      </header>

      <Card>
        <CardContent className="p-6">
          <article className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown components={markdownComponents}>{a.content}</ReactMarkdown>
          </article>
        </CardContent>
      </Card>

      {(prev || next) && (
        <nav className="flex items-stretch gap-3 border-t pt-4">
          {prev ? (
            <Link
              href={`/announcements/${prev.id}`}
              className="group flex flex-1 items-center gap-2 rounded-md border px-3 py-2 transition-colors hover:bg-accent/40"
            >
              <ArrowLeft className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0">
                <span className="block text-xs text-muted-foreground">{t('prev')}</span>
                <span className="block break-words text-sm font-medium group-hover:text-primary">
                  {prev.title}
                </span>
              </span>
            </Link>
          ) : (
            <span className="flex-1" />
          )}
          {next ? (
            <Link
              href={`/announcements/${next.id}`}
              className="group flex flex-1 items-center justify-end gap-2 rounded-md border px-3 py-2 text-right transition-colors hover:bg-accent/40"
            >
              <span className="min-w-0">
                <span className="block text-xs text-muted-foreground">{t('next')}</span>
                <span className="block break-words text-sm font-medium group-hover:text-primary">
                  {next.title}
                </span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          ) : (
            <span className="flex-1" />
          )}
        </nav>
      )}
    </div>
  )
}
