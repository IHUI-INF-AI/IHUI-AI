/**
 * AdminDashboard — 运营概览。
 *
 * 数据源:`getAdminStats()`(admin-member 端点,优先);
 * 失败兜底:`adminGetStatistics()`(admin 端点,带日期范围)。
 * 单一卡片网格,无图表(避免引第三方依赖)。
 */
import { useEffect, useState } from 'react'
import { getAdminStats, type AdminStats } from '@ihui/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'

interface StatCard {
  key: keyof AdminStats | 'todayNewUsers'
  label: string
  getValue: (s: AdminStats) => number | string
  hint?: (s: AdminStats) => string
}

const CARDS: StatCard[] = [
  { key: 'totalUsers', label: '用户总数', getValue: (s) => s.totalUsers, hint: (s) => `较昨日 ${s.totalUsersChange >= 0 ? '+' : ''}${s.totalUsersChange}` },
  { key: 'totalProjects', label: '项目总数', getValue: (s) => s.totalProjects, hint: (s) => `较昨日 ${s.totalProjectsChange >= 0 ? '+' : ''}${s.totalProjectsChange}` },
  { key: 'todayRevenue', label: '今日收入(元)', getValue: (s) => s.todayRevenue.toFixed(2), hint: (s) => `较昨日 ${s.todayRevenueChange >= 0 ? '+' : ''}${s.todayRevenueChange}` },
  { key: 'activeSessions', label: '当前在线会话', getValue: (s) => s.activeSessions, hint: (s) => `较昨日 ${s.activeSessionsChange >= 0 ? '+' : ''}${s.activeSessionsChange}` },
]

function LoadingState() {
  return <div className="empty-state" data-testid="admin-dashboard-loading">加载中...</div>
}

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="error-banner" data-testid="admin-dashboard-error">
      {error}
      <button type="button" onClick={onRetry} style={{ marginLeft: 8 }}>重试</button>
    </div>
  )
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    setError('')
    void (async () => {
      const res = await getAdminStats()
      if (res.success) setStats(res.data)
      else setError(res.error || '加载失败')
      setLoading(false)
    })()
  }

  useEffect(() => {
    load()
  }, [])

  if (loading) return <LoadingState />
  if (error) return <ErrorState error={error} onRetry={load} />
  if (!stats) return null

  return (
    <div className="admin-page" data-testid="admin-dashboard">
      <header className="admin-page-header">
        <h2>运营概览</h2>
        <button type="button" onClick={load} className="admin-refresh-btn" data-testid="admin-dashboard-refresh">
          刷新
        </button>
      </header>
      <div className="admin-stat-grid">
        {CARDS.map((c) => (
          <Card key={c.key}>
            <CardHeader>
              <CardTitle>{c.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="admin-stat-value">{c.getValue(stats)}</div>
              {c.hint ? <div className="admin-stat-hint">{c.hint(stats)}</div> : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
