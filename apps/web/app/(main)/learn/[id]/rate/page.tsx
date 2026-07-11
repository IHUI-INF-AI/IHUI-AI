'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Star, Loader2, MessageSquare } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'

interface RateItem {
  id: string
  user?: { id: string; nickname: string; avatar?: string }
  userName?: string
  userAvatar?: string
  rating: number
  content: string
  createdAt?: string
  createTime?: string
}
interface RateListData {
  list: RateItem[]
  total?: number
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

function formatTime(t?: string) {
  if (!t) return ''
  try {
    const d = new Date(t)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  } catch {
    return t
  }
}

export default function CourseRatePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const qc = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['learn', 'rate', id],
    queryFn: () => api<RateListData>(`/api/learn/${id}/rates`),
  })

  const [rating, setRating] = React.useState(5)
  const [content, setContent] = React.useState('')
  const [hoverRating, setHoverRating] = React.useState(0)

  const submitMut = useMutation({
    mutationFn: () =>
      api(`/api/learn/${id}/rates`, {
        method: 'POST',
        body: JSON.stringify({ rating, content }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['learn', 'rate', id] })
      setContent('')
      setRating(5)
    },
  })

  const list = data?.list ?? []

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return
    submitMut.mutate()
  }

  if (isLoading)
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        加载中...
      </div>
    )

  if (error)
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <button
          type="button"
          onClick={() => router.push(`/learn/${id}`)}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          返回课程
        </button>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error)?.message ?? '加载失败'}
        </div>
      </div>
    )

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <Link
        href={`/learn/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        返回课程
      </Link>

      <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
        <Star className="h-6 w-6 text-primary" />
        课程评价
      </h1>

      {/* 评价表单 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">我要评价</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">评分</label>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(n)}
                    onMouseEnter={() => setHoverRating(n)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="p-1"
                    aria-label={`${n}星`}
                  >
                    <Star
                      className={`h-6 w-6 transition-colors ${
                        (hoverRating || rating) >= n
                          ? 'fill-amber-400 text-amber-400'
                          : 'fill-none text-muted-foreground'
                      }`}
                    />
                  </button>
                ))}
                <span className="ml-2 text-sm text-muted-foreground">{rating} / 5</span>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">评价内容</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="请输入您对本课程的评价..."
                rows={4}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            {submitMut.isError && (
              <p className="text-xs text-destructive">{(submitMut.error as Error)?.message}</p>
            )}
            <Button type="submit" disabled={submitMut.isPending || !content.trim()}>
              {submitMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              提交评价
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* 评价列表 */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">全部评价 ({list.length})</h2>
        {list.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16">
            <MessageSquare className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">暂无评价，快来发表第一条评价吧</p>
          </div>
        ) : (
          <div className="space-y-3">
            {list.map((item) => {
              const name = item.user?.nickname ?? item.userName ?? '匿名用户'
              const avatar = item.user?.avatar ?? item.userAvatar
              const time = formatTime(item.createdAt ?? item.createTime)
              return (
                <Card key={item.id}>
                  <CardContent className="flex items-start gap-3 p-4">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-primary/15 to-primary/5">
                      {avatar ? (
                        <img src={avatar} alt={name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-sm font-medium text-primary">
                          {name.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{name}</span>
                        {time && <span className="text-xs text-muted-foreground">{time}</span>}
                      </div>
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star
                            key={n}
                            className={`h-3.5 w-3.5 ${
                              item.rating >= n
                                ? 'fill-amber-400 text-amber-400'
                                : 'fill-none text-muted-foreground'
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-sm text-muted-foreground">{item.content}</p>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
