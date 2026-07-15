'use client'

import * as React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Loader2, Plus, Pencil, Trash2, Eye, Heart } from 'lucide-react'
import { toast } from 'sonner'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardContent } from '@ihui/ui'
import type { ArticleItem, MyArticlesData } from '../../articles/types'

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const STATUS_LABEL: Record<string, string> = {
  draft: '草稿',
  published: '已发布',
  reviewing: '审核中',
}

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  published: 'bg-green-500/10 text-green-600',
  reviewing: 'bg-orange-500/10 text-orange-600',
}

export default function MyArticlesPage() {
  const t = useTranslations('user.articles')
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)

  const { data, isLoading, error } = useQuery({
    queryKey: ['articles', 'my', page],
    queryFn: () => api<MyArticlesData>(`/api/article/my?page=${page}&pageSize=20`),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      api<{ success: boolean }>(`/api/article/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('deleteSuccess', { default: '已删除' }))
      qc.invalidateQueries({ queryKey: ['articles', 'my'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const articles = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / 20))

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {t('title', { default: '我的文章' })}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('total', { default: '共 {n} 篇', n: total })}
          </p>
        </div>
        <Link href="/articles/edit">
          <Button size="sm">
            <Plus className="mr-1 h-4 w-4" />
            {t('create', { default: '新建文章' })}
          </Button>
        </Link>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      ) : articles.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16">
          <p className="text-sm text-muted-foreground">{t('empty', { default: '还没有文章' })}</p>
          <Link href="/articles/edit">
            <Button size="sm" variant="outline">
              <Plus className="mr-1 h-4 w-4" />
              {t('createFirst', { default: '写第一篇' })}
            </Button>
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {articles.map((a: ArticleItem) => (
              <Card key={a.id}>
                <CardContent className="flex items-start gap-3 p-4">
                  {a.coverImage ? (
                    <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-md">
                      <Image src={a.coverImage} alt={a.title} fill className="object-cover" />
                    </div>
                  ) : null}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-sm font-semibold">{a.title}</h3>
                      {a.status && (
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                            STATUS_STYLE[a.status] ?? STATUS_STYLE.draft
                          }`}
                        >
                          {STATUS_LABEL[a.status] ?? a.status}
                        </span>
                      )}
                    </div>
                    {a.summary ? (
                      <p className="line-clamp-2 text-xs text-muted-foreground">{a.summary}</p>
                    ) : null}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {a.viewCount}
                      </span>
                      {typeof a.likeCount === 'number' ? (
                        <span className="inline-flex items-center gap-1">
                          <Heart className="h-3 w-3" />
                          {a.likeCount}
                        </span>
                      ) : null}
                      {a.publishedAt ? (
                        <span>{new Date(a.publishedAt).toLocaleDateString('zh-CN')}</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Link href={`/articles/${a.id}`}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Link href={`/articles/edit?id=${a.id}`}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      onClick={() => deleteMut.mutate(a.id)}
                      disabled={deleteMut.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                上一页
              </Button>
              <span className="text-sm text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                下一页
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
