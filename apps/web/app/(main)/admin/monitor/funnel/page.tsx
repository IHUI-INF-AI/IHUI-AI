'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Filter, TrendingDown } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@ihui/ui'
import { cn } from '@/lib/utils'

interface FunnelStage {
  key: string
  label: string
  count: number
  rate: number
}

interface FunnelData {
  stages: FunnelStage[]
  totalUsers: number
  convertedUsers: number
  conversionRate: number
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const selectClass = 'h-8 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export default function AdminMonitorFunnelPage() {
  const [funnel, setFunnel] = React.useState('signup')

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'monitor', 'funnel', funnel],
    queryFn: () => api<FunnelData>(`/api/admin/monitor/funnel/${funnel}`),
  })

  const stages = data?.stages ?? []
  const maxCount = stages.length > 0 ? (stages[0]?.count ?? 1) : 1

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Filter className="h-6 w-6 text-primary" />
            业务漏斗仪表盘
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">关键业务转化漏斗分析</p>
        </div>
        <Select value={funnel} onValueChange={setFunnel}>
          <SelectTrigger className={selectClass} aria-label="漏斗"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="signup">注册转化</SelectItem>
            <SelectItem value="purchase">下单转化</SelectItem>
            <SelectItem value="activation">激活转化</SelectItem>
            <SelectItem value="retention">留存转化</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {data && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">总用户</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{data.totalUsers.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">转化用户</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">{data.convertedUsers.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">转化率</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{data.conversionRate.toFixed(2)}%</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingDown className="h-4 w-4" />
            漏斗各阶段
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            </div>
          ) : stages.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">暂无漏斗数据</p>
          ) : (
            <div className="space-y-3">
              {stages.map((s, i) => {
                const width = maxCount > 0 ? (s.count / maxCount) * 100 : 0
                const prev = i > 0 ? stages[i - 1] : undefined
                const dropRate = prev && prev.count > 0 ? ((prev.count - s.count) / prev.count) * 100 : 0
                return (
                  <div key={s.key} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{s.label}</span>
                      <span className="text-muted-foreground">
                        {s.count.toLocaleString()} <span className="text-xs">({s.rate.toFixed(1)}%)</span>
                      </span>
                    </div>
                    <div className="relative h-8 overflow-hidden rounded-md bg-muted">
                      <div
                        className={cn('flex h-full items-center rounded-md px-2 text-xs font-medium text-white transition-all', i === 0 ? 'bg-primary' : i === stages.length - 1 ? 'bg-emerald-600' : 'bg-primary/70')}
                        style={{ width: `${Math.max(width, 15)}%` }}
                      >
                        {s.rate.toFixed(0)}%
                      </div>
                    </div>
                    {i > 0 && dropRate > 0 && (
                      <div className="text-xs text-red-500">↓ 流失 {dropRate.toFixed(1)}%</div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
