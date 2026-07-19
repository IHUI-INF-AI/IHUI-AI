import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { PlayCircle, Eye, ArrowLeft } from 'lucide-react'

import { fetchApiServer } from '@/lib/api-server'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { Avatar } from '@/components/data/Avatar'

export const revalidate = 60

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

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const r = await fetchApiServer<LecturerResp>(`/api/live/lecturers/${id}`)
  if (!r.success || !r.data.lecturer) return { title: '讲师详情 | IHUI AI' }
  const lecturer = r.data.lecturer
  const title = `${lecturer.name} - ${lecturer.title ?? 'AI 行业分析师'} | IHUI AI`
  const description = lecturer.intro ?? `${lecturer.name} 的讲师详情`
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'profile',
      images: lecturer.avatar ? [{ url: lecturer.avatar }] : undefined,
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  }
}

export default async function LecturerDetailPage({ params }: PageProps) {
  const { id } = await params
  const locale = await getLocale()
  const t = await getTranslations({ locale, namespace: 'lecturer' })
  const tl = await getTranslations({ locale, namespace: 'live' })

  const lecturerResp = await fetchApiServer<LecturerResp>(`/api/live/lecturers/${id}`)
  if (!lecturerResp.success || !lecturerResp.data.lecturer) notFound()
  const lecturer = lecturerResp.data.lecturer

  const channelsResp = await fetchApiServer<ChannelsResp>(
    `/api/live/channels?lecturerId=${encodeURIComponent(id)}`,
  )
  const channels = channelsResp.success ? channelsResp.data.list : []

  const backLink = (
    <Link
      href="/lecturers"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" />
      {t('backToList')}
    </Link>
  )

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      {backLink}

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
        {channels.length === 0 ? (
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
