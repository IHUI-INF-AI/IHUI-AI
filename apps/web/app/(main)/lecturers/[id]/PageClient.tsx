'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { PlayCircle, Eye, ArrowLeft, Loader2 } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { Avatar } from '@/components/data/Avatar'

interface Lecturer {
  id: string
  name: string
  avatar: string | null
  title: string | null
  intro: string | null
  sort: number
  status: number
}
interface LecturerResp {
  lecturer: Lecturer | null
}

interface ChannelItem {
  id: string
  title: string
  coverImage: string | null
  lecturerName: string | null
  isLive: boolean
  viewCount: number
  intro: string | null
}
interface ChannelsResp {
  list: ChannelItem[]
  total: number
  page: number
  pageSize: number
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function LecturerDetailPageClient() {
  const { id } = useParams<{ id: string }>()
  const t = useTranslations('lecturer')
  const tl = useTranslations('live')

  const lecturerQuery = useQuery({
    queryKey: ['live', 'lecturer', id],
    queryFn: () => api<LecturerResp>(`/api/live/lecturers/${id}`),
  })

  const lecturer = lecturerQuery.data?.lecturer ?? null

  const channelsQuery = useQuery({
    queryKey: ['live', 'channels', 'lecturer', id],
    queryFn: () =>
      api<ChannelsResp>(
        `/api/live/channels?lecturerId=${encodeURIComponent(id)}`,
      ),
  })

  const channels = channelsQuery.data?.list ?? []

  if (lecturerQuery.isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-6xl items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!lecturer) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6 py-20 text-center">
        <PlayCircle className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t('notFound')}</p>
        <Link
          href="/lecturers"
          className="inline-flex items-center gap-1 text-sm text-primary transition-colors hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('backToList')}
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <Link
        href="/lecturers"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('backToList')}
      </Link>

      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-6 text-center sm:flex-row sm:text-left">
          <Avatar
            src={lecturer.avatar ?? undefined}
            name={lecturer.name}
            size="xl"
            className="h-20 w-20 text-2xl"
          />
          <div className="min-w-0 space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">{lecturer.name}</h1>
            {lecturer.title ? <p className="text-sm text-primary">{lecturer.title}</p> : null}
            {lecturer.intro ? (
              <p className="whitespace-pre-line text-sm leading-6 text-muted-foreground">
                {lecturer.intro}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">{t('courses')}</h2>
        {channelsQuery.isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : channels.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12">
            <PlayCircle className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t('noCourses')}</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {channels.map((channel) => (
              <Link key={channel.id} href={`/live/${channel.id}`} className="group block">
                <Card className="h-full overflow-hidden transition-colors hover:bg-accent">
                  <div className="relative flex h-32 items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
                    <PlayCircle className="h-10 w-10 text-primary/40" />
                    {channel.isLive && (
                      <span className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-red-500 px-2 py-0.5 text-xs font-medium text-white">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                        {tl('liveNow')}
                      </span>
                    )}
                  </div>
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-base">{channel.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1.5 p-4 pt-0 text-sm">
                    <p className="text-muted-foreground">
                      {channel.lecturerName ?? tl('unknownLecturer')}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Eye className="h-3.5 w-3.5" />
                      {tl('viewCount', { count: channel.viewCount })}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
