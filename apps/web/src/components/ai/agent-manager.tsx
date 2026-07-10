'use client'

import * as React from 'react'
import { Bot, Plus, CheckCircle2, Loader2, AlertCircle, Circle } from 'lucide-react'

import { Button } from '@ihui/ui'
import { cn } from '@/lib/utils'

export interface AgentItem {
  id: string
  name: string
  role: string
  status: 'idle' | 'running' | 'done' | 'error'
  model?: string
}

interface AgentManagerProps {
  agents: AgentItem[]
  onSelect?: (id: string) => void
  onCreate?: () => void
  selectedId?: string
}

const STATUS_META: Record<
  AgentItem['status'],
  { label: string; icon: React.ComponentType<{ className?: string }>; cls: string }
> = {
  idle: { label: '空闲', icon: Circle, cls: 'text-muted-foreground' },
  running: { label: '运行中', icon: Loader2, cls: 'text-blue-500' },
  done: { label: '已完成', icon: CheckCircle2, cls: 'text-emerald-500' },
  error: { label: '错误', icon: AlertCircle, cls: 'text-destructive' },
}

export function AgentManager({ agents, onSelect, onCreate, selectedId }: AgentManagerProps) {
  const active = agents.filter((a) => a.status === 'running').length

  return (
    <div className="flex h-full flex-col rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b p-4">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-semibold">Agent 管理</h3>
        </div>
        <Button variant="outline" size="sm" onClick={onCreate}>
          <Plus className="h-4 w-4" />
          新建
        </Button>
      </div>
      <div className="flex items-center gap-4 border-b bg-muted/30 px-4 py-2.5 text-xs">
        <span className="text-muted-foreground">
          活跃 <span className="font-semibold text-blue-500">{active}</span>
        </span>
        <span className="text-muted-foreground">
          总计 <span className="font-semibold text-foreground">{agents.length}</span>
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {agents.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">暂无 Agent</p>
        ) : (
          <ul className="space-y-1">
            {agents.map((agent) => {
              const meta = STATUS_META[agent.status]
              const Icon = meta.icon
              const isSel = agent.id === selectedId
              return (
                <li key={agent.id}>
                  <button
                    type="button"
                    onClick={() => onSelect?.(agent.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                      isSel ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-muted/50',
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-4 w-4 shrink-0',
                        meta.cls,
                        agent.status === 'running' && 'animate-spin',
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{agent.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{agent.role}</p>
                    </div>
                    {agent.model && (
                      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {agent.model}
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

export default AgentManager
