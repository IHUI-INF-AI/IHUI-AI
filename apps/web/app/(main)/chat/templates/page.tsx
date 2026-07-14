'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { Loader2, ArrowLeft, LayoutTemplate, Sparkles } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent } from '@ihui/ui'
import { cn } from '@/lib/utils'

interface Template {
  id: string
  title: string
  description: string | null
  content: string
  categoryId: string | null
  createdAt: string
}

interface Category {
  id: string
  name: string
}

interface TemplatesData {
  list: Template[]
  categories?: Category[]
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function ChatTemplatesPage() {
  const router = useRouter()
  const locale = useLocale()
  const [activeCat, setActiveCat] = React.useState('all')

  const { data, isLoading, error } = useQuery({
    queryKey: ['chat', 'templates'],
    queryFn: () => api<TemplatesData>('/api/chat/templates'),
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

  const categories = data?.categories ?? []
  const allTemplates = data?.list ?? []
  const templates =
    activeCat === 'all' ? allTemplates : allTemplates.filter((t) => t.categoryId === activeCat)

  function applyTemplate(content: string) {
    sessionStorage.setItem('chat-draft', content)
    router.push('/chat')
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <Link
        href="/chat"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        返回
      </Link>

      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <LayoutTemplate className="h-6 w-6 text-primary" />
          对话模板
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">选择模板快速开始对话</p>
      </div>

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveCat('all')}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              activeCat === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent',
            )}
          >
            全部
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCat(c.id)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                activeCat === c.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent',
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          加载中...
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center text-muted-foreground">
          <LayoutTemplate className="h-8 w-8 opacity-40" />
          <p className="text-sm">暂无模板</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {templates.map((tpl) => (
            <Card
              key={tpl.id}
              className="cursor-pointer transition-colors hover:bg-accent/40"
              onClick={() => applyTemplate(tpl.content)}
            >
              <CardContent className="space-y-2 p-4">
                <div className="flex items-start gap-2">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <h3 className="flex-1 truncate text-sm font-medium">{tpl.title}</h3>
                </div>
                {tpl.description && (
                  <p className="line-clamp-2 text-xs text-muted-foreground">{tpl.description}</p>
                )}
                <p className="line-clamp-2 rounded bg-muted/50 px-2 py-1 font-mono text-xs text-muted-foreground">
                  {tpl.content}
                </p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>点击使用</span>
                  <span>{fmt(tpl.createdAt)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
