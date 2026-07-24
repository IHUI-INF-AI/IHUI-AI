'use client'

import * as React from 'react'
import { useLocale } from 'next-intl'
import {
  Bot,
  MessageSquare,
  Activity,
  Percent,
  Plus,
  Loader2,
  Settings,
  Play,
  Square,
} from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'

interface BotItem {
  id: string
  name: string
  model: string
  enabled: boolean
  createdAt: number
}

interface DashboardStats {
  activeBots: number
  activeSessions: number
  todayMessages: number
  successRate: number
}

type BotsData = { list: BotItem[] } | BotItem[]

export default function ClawdbotDashboardPage() {
  const locale = useLocale()
  const [bots, setBots] = React.useState<BotItem[]>([])
  const [stats, setStats] = React.useState<DashboardStats>({
    activeBots: 0,
    activeSessions: 0,
    todayMessages: 0,
    successRate: 0,
  })
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const timeFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const load = React.useCallback(async () => {
    const [botsRes, statsRes] = await Promise.all([
      fetchApi<BotsData>('/api/admin/clawdbot/bots'),
      fetchApi<DashboardStats>('/api/admin/clawdbot/stats'),
    ])
    if (botsRes.success && botsRes.data) {
      const d = botsRes.data
      setBots(Array.isArray(d) ? d : (d.list ?? []))
    } else if (!botsRes.success) {
      setError(botsRes.error)
    }
    if (statsRes.success && statsRes.data) setStats(statsRes.data)
    setLoading(false)
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> 加载中...
      </div>
    )
  }
  if (error) {
    return (
      <div className="p-4">
        <Alert variant="danger" title="加载失败" description={error} />
      </div>
    )
  }

  const statCards = [
    { key: 'bots', label: '活跃 Bot', value: stats.activeBots, icon: Bot, cls: 'text-primary' },
    {
      key: 'sessions',
      label: '在线会话',
      value: stats.activeSessions,
      icon: MessageSquare,
      cls: 'text-emerald-600',
    },
    {
      key: 'messages',
      label: '今日消息',
      value: stats.todayMessages,
      icon: Activity,
      cls: 'text-amber-600',
    },
    {
      key: 'rate',
      label: '成功率',
      value: `${stats.successRate.toFixed(1)}%`,
      icon: Percent,
      cls: 'text-sky-600',
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Bot className="h-6 w-6 text-primary" /> Clawdbot 控制台
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Bot 管理、会话监控、工具与权限</p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            window.location.href = '/admin/clawdbot/bots'
          }}
        >
          <Plus className="h-4 w-4" /> 创建 Bot
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {statCards.map((c) => (
          <div key={c.key} className="flex items-center gap-3 rounded-lg border bg-card p-3">
            <c.icon className={cn('h-5 w-5', c.cls)} />
            <div>
              <p className="text-lg font-semibold">{c.value}</p>
              <p className="text-xs text-muted-foreground">{c.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-2.5">
          <p className="text-sm font-medium">Bot 列表</p>
        </div>
        <div className="divide-y">
          {bots.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              暂无 Bot
            </div>
          ) : (
            bots.map((b) => (
              <div key={b.id} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{b.name}</p>
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5 text-xs',
                        b.enabled
                          ? 'bg-emerald-500/10 text-emerald-600'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {b.enabled ? '运行中' : '已停止'}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {b.model} · 创建于 {timeFmt.format(new Date(b.createdAt))}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      window.location.href = '/admin/clawdbot/bots'
                    }}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                  {b.enabled ? (
                    <Square className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Play className="h-4 w-4 text-emerald-600" />
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
