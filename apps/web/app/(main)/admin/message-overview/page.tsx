'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bell, Megaphone, Mail, Sparkles, Loader2, TrendingUp } from 'lucide-react'
import { eduApi } from '@/lib/edu'
import { StatCard } from '@/components/data'
import { LineChart } from '@/components/charts'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'

interface NotifItem {
  id: string
  createdAt: string
}
interface PageList<T> {
  list?: T[]
  total?: number
}

async function api<T>(url: string): Promise<T> {
  return eduApi<T>(url)
}

function toDateStr(s: string): string {
  return s ? new Date(s).toISOString().slice(0, 10) : ''
}

function buildTrend(items: NotifItem[]): { labels: string[]; data: number[] } {
  const today = new Date()
  const labels: string[] = []
  const data: number[] = []
  const map = new Map<string, number>()
  for (const it of items) {
    const d = toDateStr(it.createdAt)
    if (d) map.set(d, (map.get(d) ?? 0) + 1)
  }
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    labels.push(`${d.getMonth() + 1}/${d.getDate()}`)
    data.push(map.get(key) ?? 0)
  }
  return { labels, data }
}

export default function MessageOverviewPage() {
  const todayStr = new Date().toISOString().slice(0, 10)

  const { data: notifData, isLoading: ln } = useQuery({
    queryKey: ['msg-overview', 'notifications'],
    queryFn: () => api<PageList<NotifItem>>('/api/notifications?pageSize=100'),
  })
  const { data: annData, isLoading: la } = useQuery({
    queryKey: ['msg-overview', 'announcements'],
    queryFn: () =>
      api<PageList<unknown>>('/api/admin/messages/announcements?includeUnpublished=true'),
  })
  const { data: letterData, isLoading: ll } = useQuery({
    queryKey: ['msg-overview', 'private-letters'],
    queryFn: () => api<PageList<unknown>>('/api/admin/private-letters?pageSize=100'),
  })

  const notifList = React.useMemo(() => notifData?.list ?? [], [notifData?.list])
  const todayNew = React.useMemo(
    () => notifList.filter((n) => toDateStr(n.createdAt) === todayStr).length,
    [notifList, todayStr],
  )
  const trend = React.useMemo(() => buildTrend(notifList), [notifList])

  const cards = [
    { title: '通知总数', value: notifData?.total ?? notifList.length, icon: Bell, loading: ln },
    {
      title: '公告总数',
      value: annData?.total ?? annData?.list?.length ?? 0,
      icon: Megaphone,
      loading: la,
    },
    {
      title: '私信总数',
      value: letterData?.total ?? letterData?.list?.length ?? 0,
      icon: Mail,
      loading: ll,
    },
    { title: '今日新增通知', value: todayNew, icon: Sparkles, loading: ln },
  ]

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">消息概览</h1>
        <p className="text-sm text-muted-foreground">通知 / 公告 / 私信总数与近 7 天通知趋势</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <StatCard
            key={c.title}
            title={c.title}
            value={c.loading ? '—' : c.value}
            icon={c.icon}
            loading={c.loading}
          />
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-primary" />
            通知趋势（近 7 天）
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ln ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              加载中...
            </div>
          ) : (
            <LineChart data={trend.data} xAxis={trend.labels} height={260} smooth />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
