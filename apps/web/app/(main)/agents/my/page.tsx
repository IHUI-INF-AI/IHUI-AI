'use client'

import * as React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useQuery } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { Loader2, ArrowLeft, Sparkles, Plus } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardContent } from '@ihui/ui'
import { cn } from '@/lib/utils'

interface Agent {
  agentId: string
  name: string
  description: string | null
  avatar: string | null
  status: string
  price: number
  isFree: boolean
  createdAt: string
  updatedAt: string
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

const STATUS_FILTERS = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '待审核' },
  { value: 'published', label: '已发布' },
  { value: 'rejected', label: '已拒绝' },
  { value: 'offline', label: '已下线' },
]

const STATUS_CLASS: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-500',
  published: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
  rejected: 'bg-destructive/10 text-destructive',
  offline: 'bg-muted text-muted-foreground',
}

export default function MyAgentsPage() {
  const locale = useLocale()
  const [status, setStatus] = React.useState('all')

  const { data, isLoading, error } = useQuery({
    queryKey: ['agents', 'my', status],
    queryFn: () => {
      const qs = new URLSearchParams({ page: '1', pageSize: '100' })
      if (status !== 'all') qs.set('status', status)
      return api<AgentsData>(`/api/agents/my?${qs.toString()}`)
    },
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

      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">我的智能体</h1>
          <p className="mt-1 text-sm text-muted-foreground">管理你创建的智能体</p>
        </div>
        <Button size="sm" asChild>
          <Link href="/agents/create">
            <Plus className="mr-1.5 h-4 w-4" />
            创建
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatus(f.value)}
            className={cn(
              'rounded-md px-3 py-1 text-xs font-medium transition-colors',
              status === f.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent',
            )}
          >
            {f.label}
          </button>
        ))}
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
          <Sparkles className="h-8 w-8 opacity-40" />
          <p className="text-sm">暂无智能体</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <Link key={agent.agentId} href={`/agents/${agent.agentId}`}>
              <Card className="transition-colors hover:bg-accent/40">
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start gap-3">
                    {agent.avatar ? (
                      <Image
                        src={agent.avatar}
                        alt={agent.name}
                        width={40}
                        height={40}
                        className="h-10 w-10 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                        <Sparkles className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1 space-y-1">
                      <h3 className="line-clamp-2 text-sm font-medium">{agent.name}</h3>
                      <span
                        className={cn(
                          'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
                          STATUS_CLASS[agent.status] ?? STATUS_CLASS.offline,
                        )}
                      >
                        {STATUS_FILTERS.find((f) => f.value === agent.status)?.label ??
                          agent.status}
                      </span>
                    </div>
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
                    <span>{fmt(agent.updatedAt)}</span>
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
