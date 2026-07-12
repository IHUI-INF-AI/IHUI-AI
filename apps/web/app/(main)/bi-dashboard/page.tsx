'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Users, ShoppingCart, DollarSign, Activity } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { BarChart } from '@/components/charts/BarChart'

interface BiStats {
  totalUsers: number
  totalOrders: number
  totalRevenue: number
  activeUsers: number
}

const DEFAULT_STATS: BiStats = {
  totalUsers: 0,
  totalOrders: 0,
  totalRevenue: 0,
  activeUsers: 0,
}

export default function BiDashboardPage() {
  const { data: stats = DEFAULT_STATS, isLoading } = useQuery({
    queryKey: ['bi-dashboard'],
    queryFn: async () => {
      const r = await fetchApi<BiStats>('/api/bi/dashboard')
      if (r.success && r.data) return r.data
      return DEFAULT_STATS
    },
  })

  const cards: {
    label: string
    value: string
    Icon: React.ComponentType<{ className?: string }>
  }[] = [
    { label: '总用户', value: stats.totalUsers.toLocaleString(), Icon: Users },
    { label: '总订单', value: stats.totalOrders.toLocaleString(), Icon: ShoppingCart },
    { label: '总收入', value: `¥${stats.totalRevenue.toLocaleString()}`, Icon: DollarSign },
    { label: '活跃用户', value: stats.activeUsers.toLocaleString(), Icon: Activity },
  ]

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">BI 数据看板</h1>
        <p className="text-sm text-muted-foreground">业务智能数据概览</p>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          加载中...
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map(({ label, value, Icon }) => (
            <Card key={label}>
              <CardContent className="flex items-center gap-3 p-5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="space-y-0.5">
                  <div className="text-sm text-muted-foreground">{label}</div>
                  <div className="text-2xl font-bold tracking-tight">{value}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">核心指标对比</CardTitle>
          <p className="text-xs text-muted-foreground">
            用户 / 订单 / 收入 / 活跃用户 数值横向对比
          </p>
        </CardHeader>
        <CardContent>
          <BarChart
            data={[stats.totalUsers, stats.totalOrders, stats.totalRevenue, stats.activeUsers]}
            xAxis={['用户', '订单', '收入', '活跃']}
            horizontal
            color="var(--primary)"
          />
        </CardContent>
      </Card>
    </div>
  )
}
