'use client'

import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'

import { Card } from '@ihui/ui-react'
import { StatChart, type StatChartPoint } from '@/components/bi/stat-chart'
import { fetchApi } from '@/lib/api'

/**
 * 仪表板统计管理
 *
 * 数据源:`GET /api/admin/stats/dashboard`
 * 路由:`/admin/dashboard-stat`
 *
 * ECharts 集成:展示 7 日趋势折线 + 核心指标分布柱状 + 占比饼图。
 * 后端返回 `{ overview, trend, metrics }`,overview 兜底填充 metrics 图表。
 */
interface DashboardData {
  trend?: StatChartPoint[]
  metrics?: StatChartPoint[]
  ratios?: StatChartPoint[]
  overview?: { pv: number; uv: number; orders: number; revenue: number }
}

export default function DashboardStatPage() {
  const { data: resp, isLoading, isError } = useQuery({
    queryKey: ['admin', 'stats', 'dashboard'],
    queryFn: async () => {
      const r = await fetchApi<DashboardData>('/api/admin/stats/dashboard')
      if (!r.success) throw new Error(r.error)
      return r.data
    },
  })

  const trendData: StatChartPoint[] = resp?.trend ?? []
  const metricsData: StatChartPoint[] = resp?.metrics?.length
    ? resp.metrics
    : resp?.overview
      ? [
          { label: 'PV', value: resp.overview.pv },
          { label: 'UV', value: resp.overview.uv },
          { label: '订单', value: resp.overview.orders },
          { label: '营收', value: resp.overview.revenue },
        ]
      : []
  const ratioData: StatChartPoint[] = resp?.ratios ?? []

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold tracking-tight">仪表板统计</h1>
        <p className="text-xs text-muted-foreground">管理仪表板统计相关数据</p>
      </header>

      {isError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-2.5 text-sm text-red-600">
          数据加载失败,请稍后重试或检查 API 连接
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          加载中...
        </div>
      ) : (
        <>
          <Card className="p-4">
            <StatChart type="area" data={trendData} title="近 7 日访问趋势" height={260} />
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-4">
              <StatChart type="bar" data={metricsData} title="核心指标分布" height={240} />
            </Card>
            <Card className="p-4">
              <StatChart type="pie" data={ratioData} title="订单状态占比" height={240} />
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
