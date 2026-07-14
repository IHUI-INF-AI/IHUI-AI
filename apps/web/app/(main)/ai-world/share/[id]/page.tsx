'use client'

import * as React from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { toast } from 'sonner'
import { Loader2, ArrowLeft, Share2, Copy, Eye, Calendar, Sparkles } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardContent } from '@ihui/ui'

interface AiWorldItem {
  id: string
  title: string
  content: string | null
  coverImage: string | null
  viewCount: number
  createdAt: string
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function AiWorldSharePage() {
  const params = useParams<{ id: string }>()
  const locale = useLocale()
  const [copied, setCopied] = React.useState(false)

  const {
    data: world,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['ai-world', 'share', params.id],
    queryFn: () => api<{ world: AiWorldItem }>(`/api/ai-world/${params.id}`).then((d) => d.world),
    enabled: !!params.id,
  })

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const fmt = (v: string) => {
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : dateFmt.format(d)
  }

  const shareUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/ai-world/${params.id}` : ''

  function copyLink() {
    if (!shareUrl) return
    navigator.clipboard
      .writeText(shareUrl)
      .then(() => {
        setCopied(true)
        toast.success('链接已复制')
        setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => toast.error('复制失败'))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        加载中...
      </div>
    )
  }

  if (error || !world) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <Link
          href="/ai-world"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          返回
        </Link>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error)?.message ?? '项目不存在'}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <Link
        href={`/ai-world/${params.id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        返回
      </Link>

      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Share2 className="h-6 w-6 text-primary" />
          分享项目
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">分享这个 AI 世界项目给他人</p>
      </div>

      <Card className="overflow-hidden">
        {world.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={world.coverImage} alt={world.title} className="h-40 w-full object-cover" />
        ) : (
          <div className="flex h-40 items-center justify-center bg-muted">
            <Sparkles className="h-10 w-10 text-muted-foreground/40" />
          </div>
        )}
        <CardContent className="space-y-3 p-5">
          <h2 className="text-lg font-bold tracking-tight">{world.title}</h2>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {world.viewCount} 次浏览
            </span>
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {fmt(world.createdAt)}
            </span>
          </div>
          {world.content && (
            <p className="line-clamp-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {world.content}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="space-y-2">
            <p className="text-sm font-medium">分享链接</p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={shareUrl}
                className="flex h-9 flex-1 rounded-md border border-input bg-muted/50 px-3 py-1 text-sm text-muted-foreground"
              />
              <Button size="sm" onClick={copyLink}>
                <Copy className="mr-1.5 h-4 w-4" />
                {copied ? '已复制' : '复制'}
              </Button>
            </div>
          </div>

          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-6">
            <div className="flex h-32 w-32 items-center justify-center rounded-lg bg-muted">
              <Share2 className="h-12 w-12 text-muted-foreground/40" />
            </div>
            <p className="text-xs text-muted-foreground">扫码分享</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
