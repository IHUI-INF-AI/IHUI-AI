'use client'

import * as React from 'react'
import { Play, Square, Pause, Copy, Trash2 } from 'lucide-react'
import { Card, CardContent, cn } from '@ihui/ui-react'

export type AgentStatus = 'running' | 'paused' | 'stopped' | 'error'

export interface AgentInfo {
  id: string
  name: string
  role: string
  model: string
  status: AgentStatus
  lastActiveAt: string
}

export interface Agent extends AgentInfo {
  tools?: string[]
  permissionMode?: string
  maxIterations?: number
  systemPrompt?: string
}

export interface RawAgent {
  id?: string
  agentId?: string
  name?: string
  role?: string
  model?: string
  status?: string
  lastActiveAt?: string
  updatedAt?: string
  createdAt?: string
  tools?: string[]
  permissionMode?: string
  maxIterations?: number
  systemPrompt?: string
}

export const ROLE_LABEL: Record<string, string> = {
  researcher: '研究员',
  coder: '编码员',
  reviewer: '审查员',
  tester: '测试员',
  custom: '自定义',
}

const STATUS_BADGE: Record<AgentStatus, { label: string; className: string }> = {
  running: { label: '运行中', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500' },
  paused: { label: '已暂停', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-500' },
  stopped: { label: '已停止', className: 'bg-muted text-muted-foreground' },
  error: { label: '异常', className: 'bg-destructive/10 text-destructive' },
}

const dateFmt = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

export function normalizeAgent(a: RawAgent): Agent {
  return {
    id: a.id ?? a.agentId ?? '',
    name: a.name ?? '未命名',
    role: a.role ?? 'custom',
    model: a.model ?? 'default',
    status: (a.status ?? 'stopped') as AgentStatus,
    lastActiveAt: a.lastActiveAt ?? a.updatedAt ?? a.createdAt ?? new Date().toISOString(),
    tools: a.tools,
    permissionMode: a.permissionMode,
    maxIterations: a.maxIterations,
    systemPrompt: a.systemPrompt,
  }
}

type Action = 'start' | 'stop' | 'pause' | 'copy' | 'delete'

interface CardProps {
  agent: AgentInfo
  selected: boolean
  onSelect: () => void
  onAction: (action: Action) => void
}

export function AgentCard({ agent, selected, onSelect, onAction }: CardProps) {
  const badge = STATUS_BADGE[agent.status] ?? STATUS_BADGE.stopped
  const roleLabel = ROLE_LABEL[agent.role] ?? agent.role
  const fmt = (v: string) => {
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : dateFmt.format(d)
  }
  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation()
    fn()
  }

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      className={cn(
        'cursor-pointer transition-colors hover:bg-accent/40',
        selected && 'bg-accent/60 ring-1 ring-accent',
      )}
    >
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            <h3 className="truncate text-sm font-medium">{agent.name}</h3>
            <p className="truncate text-xs text-muted-foreground">
              {roleLabel} · {agent.model}
            </p>
          </div>
          <span className={cn('inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-xs font-medium', badge.className)}>
            {badge.label}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">最后活跃 {fmt(agent.lastActiveAt)}</span>
          <div className="flex items-center gap-0.5">
            {agent.status !== 'running' && (
              <ActionButton label="启动" onClick={stop(() => onAction('start'))}>
                <Play className="h-3.5 w-3.5" />
              </ActionButton>
            )}
            {agent.status === 'running' && (
              <ActionButton label="暂停" onClick={stop(() => onAction('pause'))}>
                <Pause className="h-3.5 w-3.5" />
              </ActionButton>
            )}
            {(agent.status === 'running' || agent.status === 'paused') && (
              <ActionButton label="停止" onClick={stop(() => onAction('stop'))}>
                <Square className="h-3.5 w-3.5" />
              </ActionButton>
            )}
            <ActionButton label="复制配置" onClick={stop(() => onAction('copy'))}>
              <Copy className="h-3.5 w-3.5" />
            </ActionButton>
            <ActionButton label="删除" danger onClick={stop(() => onAction('delete'))}>
              <Trash2 className="h-3.5 w-3.5" />
            </ActionButton>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface DetailProps {
  agent: Agent
}

export function AgentDetailCard({ agent }: DetailProps) {
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <h2 className="truncate text-lg font-semibold">{agent.name}</h2>
            <p className="text-xs text-muted-foreground">
              {ROLE_LABEL[agent.role] ?? agent.role} · {agent.model}
            </p>
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">
            {dateFmt.format(new Date(agent.lastActiveAt))}
          </span>
        </div>
        {agent.tools && agent.tools.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {agent.tools.map((t) => (
              <span key={t} className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                {t}
              </span>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-md border p-2">
            <div className="text-muted-foreground">权限模式</div>
            <div className="mt-0.5 font-medium">{agent.permissionMode ?? 'default'}</div>
          </div>
          <div className="rounded-md border p-2">
            <div className="text-muted-foreground">最大迭代</div>
            <div className="mt-0.5 font-medium">{agent.maxIterations ?? 25}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface ActionButtonProps {
  label: string
  onClick: (e: React.MouseEvent) => void
  danger?: boolean
  children: React.ReactNode
}

function ActionButton({ label, onClick, danger, children }: ActionButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        'inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
        danger && 'hover:bg-destructive/10 hover:text-destructive',
      )}
    >
      {children}
    </button>
  )
}
