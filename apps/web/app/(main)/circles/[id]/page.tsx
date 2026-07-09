'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { ArrowLeft, Loader2, Users, MessageSquare, Circle } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@ihui/ui'

interface CircleDetail {
  id: string
  name: string
  description?: string | null
  memberCount: number
  postCount: number
  createdAt: string
}

interface PostItem {
  id: string
  title: string
  content?: string | null
  authorName?: string | null
  replyCount: number
  createdAt: string
}

interface PostsData {
  list: PostItem[]
  total: number
  page: number
  pageSize: number
}

const PAGE_SIZE = 20

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function CircleDetailPage() {
  const t = useTranslations('circles')
  const tc = useTranslations('common')
  const locale = useLocale()
  const router = useRouter()
  const params = useParams<{ id: string }>()

  const { data: circleData, isLoading: circleLoading, error: circleError } = useQuery({
    queryKey: ['circle', params.id],
    queryFn: () => api<{ circle: CircleDetail }>(`/api/circles/${params.id}`),
    enabled: !!params.id,
  })

  const { data: postsData, isLoading: postsLoading } = useQuery({
    queryKey: ['circle-posts', params.id],
    queryFn: () => api<PostsData>(`/api/circles/${params.id}/posts?page=1&pageSize=${PAGE_SIZE}`),
    enabled: !!params.id,
  })

  const dateFmt = new Intl.DateTimeFormat(locale, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  const circle = circleData?.circle
  const posts = postsData?.list ?? []

  if (circleLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t('loading')}
      </div>
    )
  }

  if (circleError || !circle) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          {tc('back')}
        </Button>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(circleError as Error)?.message ?? t('empty')}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.back()}>
        <ArrowLeft className="mr-1.5 h-4 w-4" />
        {tc('back')}
      </Button>

      <Card>
        <CardHeader className="p-5">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Circle className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl">{circle.name}</CardTitle>
          {circle.description && (
            <CardDescription className="text-sm">{circle.description}</CardDescription>
          )}
          <div className="flex items-center gap-4 pt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {t('memberCount', { count: circle.memberCount })}
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5" />
              {t('postCount', { count: circle.postCount })}
            </span>
          </div>
        </CardHeader>
      </Card>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">{tc('posts')}</h2>
        {postsLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t('loading')}
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
            {tc('noPosts')}
          </div>
        ) : (
          <div className="space-y-2">
            {posts.map((p) => (
              <Card key={p.id} className="transition-colors hover:border-primary/40">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.title}</p>
                      {p.content && (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{p.content}</p>
                      )}
                      <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
                        {p.authorName && <span>{p.authorName}</span>}
                        <span>{dateFmt.format(new Date(p.createdAt))}</span>
                        <span className="flex items-center gap-0.5">
                          <MessageSquare className="h-3 w-3" />
                          {p.replyCount}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
