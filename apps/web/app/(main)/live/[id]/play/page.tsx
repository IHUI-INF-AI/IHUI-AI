'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { ArrowLeft, Loader2, Radio, Send, Heart, Share2, Bell } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, Button, Input } from '@ihui/ui'
import { LivePlayer } from '@/components/media'

interface ChannelDetail {
  id: string
  title: string
  coverImage: string | null
  intro: string | null
  lecturerName: string | null
  lecturerAvatar: string | null
  playUrl: string | null
  startTime: string | null
  endTime: string | null
  isLive: boolean
  viewCount: number
  likeCount: number
}

interface ChannelResp {
  channel: ChannelDetail | null
}

interface Danmu {
  id: number
  userName: string
  content: string
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function LivePlayPage() {
  const { id } = useParams<{ id: string }>()
  const t = useTranslations('live')
  const locale = useLocale()

  const { data, isLoading, error } = useQuery({
    queryKey: ['live', 'channel', id],
    queryFn: () => api<ChannelResp>(`/api/live/channels/${id}`),
  })

  const channel = data?.channel ?? null

  const [danmuList, setDanmuList] = React.useState<Danmu[]>([
    { id: 1, userName: '张同学', content: '老师讲得很清晰' },
    { id: 2, userName: '李同学', content: '这个知识点终于懂了' },
    { id: 3, userName: '王同学', content: '期待下次直播' },
  ])
  const [newDanmu, setNewDanmu] = React.useState('')
  const [liked, setLiked] = React.useState(false)
  const [subscribed, setSubscribed] = React.useState(false)
  const danmuRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (danmuRef.current) {
      danmuRef.current.scrollTop = danmuRef.current.scrollHeight
    }
  }, [danmuList])

  const dateFmt = new Intl.DateTimeFormat(locale, {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const handleSendDanmu = () => {
    if (!newDanmu.trim()) return
    setDanmuList((prev) => [...prev, { id: Date.now(), userName: '我', content: newDanmu.trim() }])
    setNewDanmu('')
  }

  const backLink = (
    <Link
      href={`/live/${id}`}
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

  if (error || !channel)
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6">
        {backLink}
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16">
          <Radio className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('notFound')}</p>
        </div>
      </div>
    )

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      {backLink}

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          <Card className="overflow-hidden">
            <div className="relative aspect-video bg-black">
              {channel.playUrl ? (
                <LivePlayer
                  src={channel.playUrl}
                  poster={channel.coverImage ?? undefined}
                  autoPlay={channel.isLive}
                  muted={channel.isLive}
                  className="h-full w-full"
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Radio className="h-10 w-10" />
                  <p className="text-sm">{t('notLive')}</p>
                </div>
              )}
            </div>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h1 className="text-lg font-semibold">{channel.title}</h1>
                  <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{channel.lecturerName || '—'}</span>
                    <span>·</span>
                    <span>{channel.viewCount} 观看</span>
                    {channel.startTime && (
                      <>
                        <span>·</span>
                        <span>{dateFmt.format(new Date(channel.startTime))}</span>
                      </>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={subscribed ? 'outline' : 'default'}
                  onClick={() => setSubscribed((v) => !v)}
                >
                  <Bell className="mr-1 h-3.5 w-3.5" />
                  {subscribed ? '已订阅' : '订阅'}
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={liked ? 'default' : 'outline'}
                  onClick={() => setLiked((v) => !v)}
                >
                  <Heart className={`mr-1 h-3.5 w-3.5 ${liked ? 'fill-current' : ''}`} />
                  {channel.likeCount + (liked ? 1 : 0)}
                </Button>
                <Button size="sm" variant="outline">
                  <Share2 className="mr-1 h-3.5 w-3.5" />
                  分享
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="flex h-[600px] flex-col">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-medium">弹幕互动</h2>
          </div>
          <div ref={danmuRef} className="flex-1 space-y-2 overflow-y-auto p-4">
            {danmuList.map((d) => (
              <div key={d.id} className="text-sm">
                <span className="font-medium text-primary">{d.userName}:</span>{' '}
                <span className="text-muted-foreground">{d.content}</span>
              </div>
            ))}
          </div>
          <div className="border-t p-3">
            <div className="flex gap-2">
              <Input
                value={newDanmu}
                onChange={(e) => setNewDanmu(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendDanmu()}
                placeholder="发送弹幕..."
                className="flex-1"
              />
              <Button size="sm" onClick={handleSendDanmu} disabled={!newDanmu.trim()}>
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
