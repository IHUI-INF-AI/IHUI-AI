'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useQuery } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { Loader2, ArrowLeft, Sparkles, Star } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent } from '@ihui/ui'
import { cn } from '@/lib/utils'

interface Agent {
  agentId: string
  name: string
  description: string | null
  avatar: string | null
  cover: string | null
  status: string
  price: number
  isFree: boolean
  sort: number
  createdAt: string
}

interface AgentsData {
  list: Agent[]
  total: number
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function FeaturedAgentsPage() {
  const locale = useLocale()

  const { data, isLoading, error } = useQuery({
    queryKey: ['agents', 'featured'],
    queryFn: () =>
      api<AgentsData>('/api/agents/list?featured=1&status=published&page=1&pageSize=20'),
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

  const agents = data?.list ?? []

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <Link
        href="/agents"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        返回
      </Link>

      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Star className="h-6 w-6 text-primary" />
          精选智能体
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">编辑推荐的优质智能体</p>
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
      ) : agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center text-muted-foreground">
          <Star className="h-8 w-8 opacity-40" />
          <p className="text-sm">暂无精选智能体</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <Link key={agent.agentId} href={`/agents/${agent.agentId}`}>
              <Card className="overflow-hidden transition-colors hover:bg-accent/40">
                <div className="relative h-24 w-full bg-muted">
                  {agent.cover ? (
                    <Image
                      fill
                      src={agent.cover}
                      alt={agent.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Sparkles className="h-8 w-8 text-muted-foreground/40" />
                    </div>
                  )}
                  <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-amber-500/90 px-2 py-0.5 text-xs font-medium text-white">
                    <Star className="h-3 w-3" />
                    精选
                  </span>
                </div>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start gap-2">
                    {agent.avatar ? (
                      <Image
                        src={agent.avatar}
                        alt={agent.name}
                        width={32}
                        height={32}
                        className="h-8 w-8 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                        <Sparkles className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <h3 className="line-clamp-2 pt-1 text-sm font-medium">{agent.name}</h3>
                  </div>
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {agent.description ?? '暂无描述'}
                  </p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span
                      className={cn(
                        'font-semibold',
                        agent.isFree ? 'text-emerald-600 dark:text-emerald-500' : 'text-primary',
                      )}
                    >
                      {agent.isFree ? '免费' : `¥${agent.price}`}
                    </span>
                    <span>{fmt(agent.createdAt)}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
