'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { Server, Package, KeyRound, Activity, Coins, ArrowRight } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { Skeleton } from '@/components/ui/skeleton'

interface ProviderDist {
  providerCode: string
  count: number
}

interface RelayStats {
  totalModels: number
  publicModels: number
  privateModels: number
  providerDistribution: ProviderDist[]
  last30dCalls: number
  last30dTokens: number
}

const STATS = [
  { key: 'totalModels' as const, label: '模型总数', icon: Package, color: 'text-primary' },
  { key: 'publicModels' as const, label: '已上架', icon: Server, color: 'text-emerald-600 dark:text-emerald-400' },
  { key: 'privateModels' as const, label: '未上架', icon: Server, color: 'text-muted-foreground' },
  { key: 'last30dCalls' as const, label: '近 30 天调用', icon: Activity, color: 'text-amber-600 dark:text-amber-400' },
]

export default function AdminRelayOverviewPage() {
  const locale = useLocale()
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'relay', 'stats'],
    queryFn: async () => {
      const r = await fetchApi<RelayStats>('/api/admin/relay/models/stats')
      if (!r.success) throw new Error(r.error)
      return r.data
    },
  })

  const numFmt = new Intl.NumberFormat(locale)
  const stats = data ?? {
    totalModels: 0,
    publicModels: 0,
    privateModels: 0,
    providerDistribution: [],
    last30dCalls: 0,
    last30dTokens: 0,
  }
  const maxProviderCount = Math.max(1, ...stats.providerDistribution.map((p) => p.count))

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Server className="h-6 w-6 text-primary" />
          模型中转站
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          统一管理上游厂商模型上架、Key 池调度、动态发现审批与调用日志
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((s) => (
          <Card key={s.key}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span>{s.label}</span>
                <s.icon className={`h-4 w-4 ${s.color}`} />
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-7 w-24" />
              ) : (
                <div className={`text-2xl font-bold tabular-nums ${s.color}`}>
                  {numFmt.format(stats[s.key])}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Coins className="h-4 w-4 text-amber-600" />
              近 30 天 Token 用量
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-7 w-32" />
            ) : (
              <div className="text-2xl font-bold tabular-nums">
                {numFmt.format(stats.last30dTokens)}
              </div>
            )}
            <p className="mt-1 text-xs text-muted-foreground">累计 prompt + completion tokens</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">厂商分布(已上架)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? (
              <Skeleton variant="list" rows={3} />
            ) : stats.providerDistribution.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">暂无数据</p>
            ) : (
              stats.providerDistribution.map((p) => (
                <div key={p.providerCode} className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-xs text-muted-foreground">{p.providerCode}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-sm bg-muted">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${(p.count / maxProviderCount) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-xs tabular-nums">{p.count}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: '/admin/relay/models', label: '模型管理', desc: '上下架 / 定价 / 排序', icon: Package },
          { href: '/admin/relay/key-pool', label: 'Key 池', desc: '调度 / 健康检查', icon: KeyRound },
          { href: '/admin/relay/discovery', label: '动态发现', desc: '上游模型审批', icon: Activity },
          { href: '/admin/relay/logs', label: '调用日志', desc: '请求 / Token / 错误', icon: Coins },
        ].map((entry) => (
          <Link
            key={entry.href}
            href={entry.href}
            className="group flex items-center justify-between rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted/50"
          >
            <div className="flex items-center gap-2">
              <entry.icon className="h-5 w-5 text-primary" />
              <div>
                <div className="text-sm font-medium">{entry.label}</div>
                <div className="text-xs text-muted-foreground">{entry.desc}</div>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>
    </div>
  )
}
