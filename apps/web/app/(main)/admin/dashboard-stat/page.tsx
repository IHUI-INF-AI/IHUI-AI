import { Card } from '@ihui/ui'

/**
 * 仪表板统计管理
 *
 * 数据源:`/api/v1/admin/stats/dashboard`(后端未实装前为空态兜底)
 * 路由:`/admin/dashboard-stat`
 */
export default function DashboardStatPage() {
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold tracking-tight">仪表板统计</h1>
        <p className="text-sm text-muted-foreground">管理仪表板统计相关数据</p>
      </header>
      <Card className="flex flex-col items-center justify-center gap-2 p-12 text-center text-sm text-muted-foreground">
        <p>仪表板统计功能待后端 API 实装后启用</p>
        <p className="text-xs">预计接口:GET /api/v1/admin/stats/dashboard</p>
      </Card>
    </div>
  )
}
