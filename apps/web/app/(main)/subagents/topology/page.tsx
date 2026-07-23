'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Network, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { fetchTopology } from '@/lib/subagents-api'
import { SwarmTopologyView, SWARM_ROLE_LABEL, SWARM_STATUS_LABEL } from '@/components/subagents/SwarmTopologyView'
import type { AgentRole, DispatchStatus } from '@ihui/shared/subagents/index'

const ROLE_DOT: Record<AgentRole, string> = {
  researcher: 'bg-indigo-500',
  coder: 'bg-emerald-500',
  reviewer: 'bg-amber-500',
  architect: 'bg-purple-500',
  debugger: 'bg-rose-500',
}
const STATUS_DOT: Record<DispatchStatus, string> = {
  pending: 'bg-slate-400',
  running: 'bg-blue-500',
  completed: 'bg-emerald-500',
  failed: 'bg-rose-500',
  cancelled: 'bg-slate-400',
  paused: 'bg-amber-500',
}

export default function SubagentTopologyPage() {
  const router = useRouter()
  const topoQ = useQuery({
    queryKey: ['subagents', 'topology'],
    queryFn: fetchTopology,
    refetchInterval: 5000,
  })

  const topology = topoQ.data?.topology
  const roles = React.useMemo(
    () => Array.from(new Set(topology?.nodes.map((n) => n.agentRole) ?? [])),
    [topology],
  )
  const statuses = React.useMemo(
    () => Array.from(new Set(topology?.nodes.map((n) => n.status) ?? [])),
    [topology],
  )

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <button
        type="button"
        onClick={() => router.push('/subagents')}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        返回列表
      </button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Network className="h-6 w-6 text-primary" />
            Swarm 拓扑
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            多智能体网络可视化 · 节点按角色着色 · 边显示条件
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        {roles.map((r) => (
          <span key={r} className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded ${ROLE_DOT[r]}`} />
            {SWARM_ROLE_LABEL[r]}
          </span>
        ))}
        <span className="text-muted-foreground">·</span>
        {statuses.map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded ${STATUS_DOT[s]}`} />
            {SWARM_STATUS_LABEL[s]}
          </span>
        ))}
      </div>

      <Card>
        <CardHeader className="p-4">
          <CardTitle className="text-sm">
            拓扑图({topology?.nodes.length ?? 0} 节点 / {topology?.edges.length ?? 0} 边)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {topoQ.isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              加载中...
            </div>
          ) : (
            <SwarmTopologyView topology={topology} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
