'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { PlayCircle, Eye, Loader2, ArrowLeft, Radio, Calendar } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@ihui/ui'
import { LivePlayer } from '@/components/media'

interface ChannelDetail {
  id: string
  title: string
  coverImage: string | null
  intro: string | null
  categoryId: string | null
  lecturerId: string | null
  lecturerName: string | null
  playUrl: string | null
  startTime: string | null
  endTime: string | null
  isLive: boolean
  isPublished: boolean
  viewCount: number
  status: number
}
interface ChannelResp {
  channel: ChannelDetail | null
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function LiveDetailPage() {
  const { id } = useParams<{ id: string }>()
  const t = useTranslations('live')
  const locale = useLocale()

  const { data, isLoading, error } = useQuery({
    queryKey: ['live', 'channel', id],
    queryFn: () => api<ChannelResp>(`/api/live/channels/${id}`),
  })

  const channel = data?.channel ?? null

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  const fmt = (v?: string | null) => {
    if (!v) return '-'
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : dateFmt.format(d)
  }

  const backLink = (
    <Link
      href="/live"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" />
      {t('detailBack')}
    </Link>
  )

  if (isLoading)
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6">
        {backLink}
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      </div>
    )

  const errMsg = (error as Error | null)?.message ?? ''
  const isNotFound = !channel || /不存在|not found|404/i.test(errMsg)

  if (error || !channel)
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6">
        {backLink}
        {isNotFound ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16">
            <Radio className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t('notFound')}</p>
          </div>
        ) : (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            {errMsg}
          </div>
        )}
      </div>
    )

  const renderBadge = () => {
    const now = Date.now()
    const startMs = channel.startTime ? new Date(channel.startTime).getTime() : NaN
    const endMs = channel.endTime ? new Date(channel.endTime).getTime() : NaN
    if (channel.isLive) {
      return (
        <span className="flex items-center gap-1 rounded-md bg-red-500 px-2.5 py-0.5 text-xs font-medium text-white">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
          {t('liveNow')}
        </span>
      )
    }
    if (!Number.isNaN(endMs) && now > endMs) {
      return (
        <span className="rounded-md bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          {t('ended')}
        </span>
      )
    }
    if (!Number.isNaN(startMs) && now < startMs) {
      return (
        <span className="rounded-md bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
          {t('upcoming')}
        </span>
      )
    }
    return null
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      {backLink}

      <Card className="overflow-hidden">
        {channel.playUrl ? (
          <div className="relative aspect-video bg-black">
            <LivePlayer
              src={channel.playUrl}
              poster={channel.coverImage ?? undefined}
              autoPlay={channel.isLive}
              muted={channel.isLive}
              className="h-full w-full"
            />
            <div className="absolute left-3 top-3 z-10">{renderBadge()}</div>
          </div>
        ) : (
          <div className="relative flex h-56 items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
            {channel.coverImage ? (
              <Image
                fill
                src={channel.coverImage}
                alt={channel.title}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : null}
            {channel.coverImage ? <div className="absolute inset-0 bg-black/25" /> : null}
            <PlayCircle
              className={cn(
                'relative h-14 w-14 drop-shadow',
                channel.coverImage ? 'text-white/90' : 'text-primary/40',
              )}
            />
            <div className="absolute left-3 top-3">{renderBadge()}</div>
          </div>
        )}
        <CardContent className="space-y-4 p-6">
          <h1 className="text-2xl font-bold tracking-tight">{channel.title}</h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            <span>{channel.lecturerName ?? t('unknownLecturer')}</span>
            <span className="flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" />
              {t('viewCount', { count: channel.viewCount })}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {t('startTime')}: {fmt(channel.startTime)}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {t('endTime')}: {fmt(channel.endTime)}
            </span>
          </div>
          {channel.intro ? (
            <p className="whitespace-pre-line text-sm leading-6 text-foreground/90">
              {channel.intro}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
