'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { HelpCircle, Loader2, Search, Mail } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, Button, Input } from '@ihui/ui'
import { Alert } from '@/components/feedback'

interface HelpArticle {
  slug: string
  title: string
  summary?: string | null
  content?: string | null
  category?: string | null
  updatedAt?: string | null
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function MemberHelpPage() {
  const locale = useLocale()
  const [q, setQ] = React.useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['member', 'help-articles'],
    queryFn: () =>
      api<{ list: HelpArticle[] }>('/api/help/articles')
        .then((d) => d.list ?? [])
        .catch(() => [] as HelpArticle[]),
  })

  const articles = data ?? []
  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const fmt = (v?: string | null) => {
    if (!v) return '-'
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : dateFmt.format(d)
  }

  const kw = q.trim().toLowerCase()
  const filtered = articles.filter((a) => {
    if (!kw) return true
    const excerpt = a.summary ?? a.content ?? ''
    return a.title.toLowerCase().includes(kw) || excerpt.toLowerCase().includes(kw)
  })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <HelpCircle className="h-5 w-5 text-primary" />
          帮助中心
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">查找常见问题与使用指南</p>
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索问题..."
          className="pl-9"
        />
      </div>

      {error && <Alert variant="danger" description={(error as Error).message} />}

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          加载中...
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12 text-center">
          <HelpCircle className="h-8 w-8 text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground">{kw ? '未找到相关问题' : '暂无帮助文章'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => (
            <Link key={a.slug} href={`/help/${a.slug}`} className="block">
              <Card className="transition-colors hover:bg-accent">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-sm font-semibold">{a.title}</h2>
                    {a.updatedAt && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {fmt(a.updatedAt)}
                      </span>
                    )}
                  </div>
                  {a.summary && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{a.summary}</p>
                  )}
                  {a.category && (
                    <span className="mt-1.5 inline-block rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      {a.category}
                    </span>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <div className="flex justify-center pt-2">
        <Button asChild variant="outline" size="sm">
          <Link href="mailto:support@ihui.ai">
            <Mail className="h-4 w-4" />
            联系客服
          </Link>
        </Button>
      </div>
    </div>
  )
}
