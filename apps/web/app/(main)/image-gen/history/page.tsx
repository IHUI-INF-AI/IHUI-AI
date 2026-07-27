'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { Loader2, ArrowLeft, History } from 'lucide-react'
import Image from 'next/image'

import { fetchApi } from '@/lib/api'
import { Card, CardContent } from '@ihui/ui-react'

interface GenItem {
  id: string
  prompt: string
  imageUrl: string
  size: string | null
  createdAt: string
}

interface ListData {
  list: GenItem[]
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function ImageGenHistoryPage() {
  const locale = useLocale()

  const { data, isLoading, error } = useQuery({
    queryKey: ['image-gen', 'history'],
    queryFn: () => api<ListData>('/api/image-gen/history'),
  })

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const fmt = (v: string) => {
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : dateFmt.format(d)
  }

  const items = data?.list ?? []

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <Link
        href="/image-gen"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        返回
      </Link>

      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <History className="h-6 w-6 text-primary" />
          生成历史
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">查看历史生成记录</p>
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
          <History className="h-8 w-8 opacity-40" />
          <p className="text-sm">暂无生成记录</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <Card key={item.id} className="overflow-hidden transition-colors hover:bg-accent/40">
              <div className="relative aspect-square w-full bg-muted">
                <Image src={item.imageUrl} alt={item.prompt} fill className="object-cover" />
              </div>
              <CardContent className="space-y-1 p-3">
                <p className="line-clamp-2 text-xs font-medium">{item.prompt}</p>
                <p className="text-xs text-muted-foreground">{fmt(item.createdAt)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
