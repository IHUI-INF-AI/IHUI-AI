'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Plus, Network, Loader2, Eye } from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { fetchActiveDispatches, fetchStats, fetchQueue } from '@/lib/subagents-api'
import { StatsCards } from '@/components/subagents/StatsCards'
import { QueueList, PRIORITY_BADGE, PRIORITY_LABEL } from '@/components/subagents/QueueList'
import type { DispatchStatus, AgentRole } from '@ihui/shared/subagents/index'

const STATUS_BADGE: Record<DispatchStatus, string> = {
  pending: 'bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300',
  running: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  failed: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  cancelled: 'bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300',
  paused: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
}
const STATUS_LABEL: Record<DispatchStatus, string> = {
  pending: '等待',
  running: '运行中',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消',
  paused: '已暂停',
}

const ROLE_BADGE: Record<AgentRole, string> = {
  researcher: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
  coder: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  reviewer: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  architect: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
  debugger: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
}
const ROLE_LABEL: Record<AgentRole, string> = {
  researcher: '研究员',
  coder: '编码员',
  reviewer: '评审员',
  architect: '架构师',
  debugger: '调试员',
}

const dateFmt = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

export default function SubagentsListPage() {
  const router = useRouter()
  const statsQ = useQuery({ queryKey: ['subagents', 'stats'], queryFn: fetchStats })
  const queueQ = useQuery({ queryKey: ['subagents', 'queue'], queryFn: fetchQueue })
  const activeQ = useQuery({
    queryKey: ['subagents', 'active'],
    queryFn: fetchActiveDispatches,
    refetchInterval: 5000,
  })

  const dispatches = activeQ.data?.dispatches ?? []

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Subagent 派单</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            多智能体团队调度 · 对标 TRAE Work
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push('/subagents/topology')}>
            <Network className="h-4 w-4" />
            Swarm 拓扑
          </Button>
          <Button size="sm" onClick={() => router.push('/subagents/dispatch')}>
            <Plus className="h-4 w-4" />
            新建派单
          </Button>
        </div>
      </div>

      <StatsCards stats={statsQ.data} isLoading={statsQ.isLoading} />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader className="p-4">
            <CardTitle className="text-sm">活跃派单({dispatches.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {activeQ.isLoading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                加载中...
              </div>
            ) : dispatches.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">无活跃派单</p>
            ) : (
              <ul className="space-y-1.5">
                {dispatches.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-accent"
                  >
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_BADGE[d.status]}`}>
                      {STATUS_LABEL[d.status]}
                    </span>
                    {d.priority && (
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${PRIORITY_BADGE[d.priority]}`}>
                        {PRIORITY_LABEL[d.priority]}
                      </span>
                    )}
                    {d.agentRole && (
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${ROLE_BADGE[d.agentRole]}`}>
                        {ROLE_LABEL[d.agentRole]}
                      </span>
                    )}
                    <span className="flex-1 truncate text-sm">{d.goal}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {dateFmt.format(new Date(d.createdAt))}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      onClick={() => router.push(`/subagents/detail?id=${d.id}`)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <QueueList queue={queueQ.data?.queue} isLoading={queueQ.isLoading} onItemClick={(id) => router.push(`/subagents/${id}`)} />
      </div>
    </div>
  )
}
