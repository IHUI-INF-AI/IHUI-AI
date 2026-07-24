'use client'

import { Card } from '@ihui/ui-react'
import { StatChart } from '@/components/bi/stat-chart'

/**
 * 仪表板统计管理
 *
 * 数据源:`/api/v1/admin/stats/dashboard`(后端未实装前为空态兜底)
 * 路由:`/admin/dashboard-stat`
 *
 * ECharts 集成:展示 7 日趋势折线 + 4 类指标分布柱状 + 占比饼图(均使用 in-memory demo 数据)。
 */
const TREND_DATA = [
  { label: '周一', value: 1280 },
  { label: '周二', value: 1520 },
  { label: '周三', value: 1860 },
  { label: '周四', value: 1740 },
  { label: '周五', value: 2210 },
  { label: '周六', value: 1980 },
  { label: '周日', value: 2390 },
]

const METRIC_DATA = [
  { label: 'PV', value: 12980 },
  { label: 'UV', value: 4260 },
  { label: '订单', value: 184 },
  { label: '营收', value: 56 },
]

const RATIO_DATA = [
  { label: '已成交', value: 184 },
  { label: '进行中', value: 62 },
  { label: '已取消', value: 18 },
  { label: '待支付', value: 41 },
]

export default function DashboardStatPage() {
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold tracking-tight">仪表板统计</h1>
        <p className="text-sm text-muted-foreground">管理仪表板统计相关数据</p>
      </header>

      <Card className="p-4">
        <StatChart type="area" data={TREND_DATA} title="近 7 日访问趋势" height={260} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <StatChart type="bar" data={METRIC_DATA} title="核心指标分布" height={240} />
        </Card>
        <Card className="p-4">
          <StatChart type="pie" data={RATIO_DATA} title="订单状态占比" height={240} />
        </Card>
      </div>

      <Card className="flex flex-col items-center justify-center gap-2 p-8 text-center text-sm text-muted-foreground">
        <p>完整仪表板功能待后端 API 实装后启用</p>
        <p className="text-xs">预计接口:GET /api/v1/admin/stats/dashboard</p>
      </Card>
    </div>
  )
}
