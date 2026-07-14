'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { Loader2, ArrowLeft, BarChart3, Users, Star, Phone } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent } from '@ihui/ui'

interface Stats {
  totalAgents?: number
  totalCalls?: number
  totalUsers?: number
  avgRating?: number
  publishedCount?: number
  pendingCount?: number
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function AgentStatsPage() {
  const locale = useLocale()
  const { data, isLoading, error } = useQuery({
    queryKey: ['agents', 'stats'],
    queryFn: () => api<Stats>('/api/agents/stats'),
  })

  const numFmt = new Intl.NumberFormat(locale)
  const stats = data ?? {}

  const cards = [
    {
      label: '智能体总数',
      value: stats.totalAgents ?? 0,
      icon: BarChart3,
      color: 'text-primary',
    },
    {
      label: '已发布',
      value: stats.publishedCount ?? 0,
      icon: Star,
      color: 'text-emerald-600 dark:text-emerald-500',
    },
    {
      label: '待审核',
      value: stats.pendingCount ?? 0,
      icon: Star,
      color: 'text-amber-600 dark:text-amber-500',
    },
    {
      label: '总调用数',
      value: stats.totalCalls ?? 0,
      icon: Phone,
      color: 'text-primary',
    },
    {
      label: '使用用户数',
      value: stats.totalUsers ?? 0,
      icon: Users,
      color: 'text-primary',
    },
    {
      label: '平均评分',
      value: stats.avgRating?.toFixed(1) ?? '0.0',
      icon: Star,
      color: 'text-amber-600 dark:text-amber-500',
    },
  ]

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
          <BarChart3 className="h-6 w-6 text-primary" />
          智能体统计
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">智能体使用数据概览</p>
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
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {cards.map((card) => {
            const Icon = card.icon
            return (
              <Card key={card.label}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{card.label}</span>
                    <Icon className={`h-4 w-4 ${card.color}`} />
                  </div>
                  <p className={`text-2xl font-bold ${card.color}`}>
                    {typeof card.value === 'number' ? numFmt.format(card.value) : card.value}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
