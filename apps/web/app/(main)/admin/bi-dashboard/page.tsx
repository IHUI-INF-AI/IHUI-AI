'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { TrendingUp, ShoppingCart, Users, Activity } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import type { EChartsOption } from 'echarts'
import { fetchApi } from '@/lib/api'
import { EChart } from '@/components/charts/EChart'
import { formatNumber } from '@/lib/date-utils'
import { BackButton } from '@/components/common'

interface BiTrend {
  date: string
  revenue: number
  orders: number
}
interface BiCategory {
  name: string
  value: number
}
interface BiSource {
  name: string
  value: number
}
interface BiDashboardData {
  totalRevenue: number
  totalOrders: number
  newUsers: number
  activeUsers: number
  trend: BiTrend[]
  categories: BiCategory[]
  sources: BiSource[]
}

/** 加载失败时的诚实空态(全 0/空数组),避免用假数字冒充真实运营数据 */
const EMPTY: BiDashboardData = {
  totalRevenue: 0,
  totalOrders: 0,
  newUsers: 0,
  activeUsers: 0,
  trend: [],
  categories: [],
  sources: [],
}

const STAT_CARDS = [
  { key: 'totalRevenue' as const, label: '总营收', icon: TrendingUp, color: 'text-emerald-600' },
  { key: 'totalOrders' as const, label: '总订单', icon: ShoppingCart, color: 'text-teal-600' },
  { key: 'newUsers' as const, label: '新增用户', icon: Users, color: 'text-purple-600' },
  { key: 'activeUsers' as const, label: '活跃用户', icon: Activity, color: 'text-orange-600' },
]

export default function BiDashboardPage() {
  const { data, isLoading, error } = useQuery<BiDashboardData>({
    queryKey: ['bi-dashboard'],
    queryFn: async () => {
      const r = await fetchApi<BiDashboardData>('/api/admin/bi-dashboard')
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    staleTime: 60_000,
  })
  const d = data ?? EMPTY

  const trendOption: EChartsOption = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['营收', '订单'], top: 0 },
    grid: { left: 50, right: 50, top: 40, bottom: 30 },
    xAxis: { type: 'category', data: d.trend.map((t) => t.date), boundaryGap: false },
    yAxis: [
      { type: 'value', name: '营收(元)' },
      { type: 'value', name: '订单' },
    ],
    series: [
      {
        name: '营收',
        type: 'line',
        smooth: true,
        data: d.trend.map((t) => t.revenue),
        itemStyle: { color: '#3b82f6' },
        areaStyle: { opacity: 0.1 },
      },
      {
        name: '订单',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        data: d.trend.map((t) => t.orders),
        itemStyle: { color: '#10b981' },
      },
    ],
  }

  const categoryOption: EChartsOption = {
    tooltip: { trigger: 'axis' },
    grid: { left: 50, right: 20, top: 20, bottom: 30 },
    xAxis: { type: 'category', data: d.categories.map((c) => c.name) },
    yAxis: { type: 'value' },
    series: [
      {
        type: 'bar',
        data: d.categories.map((c) => c.value),
        itemStyle: { color: '#6366f1', borderRadius: [4, 4, 0, 0] },
        barWidth: '50%',
      },
    ],
  }

  const sourceOption: EChartsOption = {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0 },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: true,
        label: { show: false },
        data: d.sources.map((s) => ({ name: s.name, value: s.value })),
        color: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#94a3b8'],
      },
    ],
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <BackButton />
      <div>
        <h1 className="text-2xl font-bold">BI 仪表板</h1>
        <p className="mt-1 text-sm text-muted-foreground">业务核心指标与趋势可视化</p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          BI 数据加载失败:{(error as Error).message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-4">
        {STAT_CARDS.map((c) => {
          const Icon = c.icon
          return (
            <Card key={c.key}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {c.label}
                </CardTitle>
                <Icon className={`h-4 w-4 ${c.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {isLoading ? '—' : formatNumber(d[c.key] as number)}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">7 天趋势</CardTitle>
          <p className="text-xs text-muted-foreground">营收与订单变化</p>
        </CardHeader>
        <CardContent>
          <EChart option={trendOption} loading={isLoading} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 min-[1024px]:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">分类对比</CardTitle>
            <p className="text-xs text-muted-foreground">各业务模块营收</p>
          </CardHeader>
          <CardContent>
            <EChart option={categoryOption} loading={isLoading} height={280} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">来源分布</CardTitle>
            <p className="text-xs text-muted-foreground">用户访问来源</p>
          </CardHeader>
          <CardContent>
            <EChart option={sourceOption} loading={isLoading} height={280} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
