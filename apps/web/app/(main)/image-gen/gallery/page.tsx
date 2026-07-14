'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { Loader2, ArrowLeft, Images } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent } from '@ihui/ui'

interface GalleryItem {
  id: string
  prompt: string
  imageUrl: string
  authorName: string | null
  likeCount: number
  createdAt: string
}

interface ListData {
  list: GalleryItem[]
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function ImageGenGalleryPage() {
  const locale = useLocale()

  const { data, isLoading, error } = useQuery({
    queryKey: ['image-gen', 'gallery'],
    queryFn: () => api<ListData>('/api/image-gen/gallery'),
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

  const items = data?.list ?? []
  const columns: GalleryItem[][] = [[], [], []]
  items.forEach((item, i) => {
    const col = columns[i % 3]
    if (col) col.push(item)
  })

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <Link
        href="/image-gen"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        返回
      </Link>

      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Images className="h-6 w-6 text-primary" />
          公开画廊
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">社区创作的图片作品</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          加载中...
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center text-muted-foreground">
          <Images className="h-8 w-8 opacity-40" />
          <p className="text-sm">暂无作品</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {columns.map((col, ci) => (
            <div key={ci} className="space-y-3">
              {col.map((item) => (
                <Card
                  key={item.id}
                  className="overflow-hidden transition-colors hover:bg-accent/40"
                >
                  <div className="w-full bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.imageUrl} alt={item.prompt} className="w-full object-cover" />
                  </div>
                  <CardContent className="space-y-1 p-3">
                    <p className="line-clamp-2 text-xs font-medium">{item.prompt}</p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="truncate">{item.authorName ?? '匿名'}</span>
                      <span>{fmt(item.createdAt)}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
