'use client'

import * as React from 'react'
import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Search, Code2, CheckCircle2, Compass, Bug, type LucideIcon } from 'lucide-react'
import type { AgentRole } from '@ihui/shared/subagents/index'

/** DAG 自定义节点 data 契约(DagGraph 映射时注入) */
export interface DagNodeData {
  agentRole: AgentRole
  task: string
  /** 节点逻辑 id(用于展示,与 ReactFlow Node.id 一致) */
  nodeId: string
  [key: string]: unknown
}

const ROLE_ICON: Record<AgentRole, LucideIcon> = {
  researcher: Search,
  coder: Code2,
  reviewer: CheckCircle2,
  architect: Compass,
  debugger: Bug,
}

const ROLE_LABEL: Record<AgentRole, string> = {
  researcher: '研究员',
  coder: '编码员',
  reviewer: '评审员',
  architect: '架构师',
  debugger: '调试员',
}

/** 角色 accent 配色(text + bg tint + border),subtle 不发光 */
const ROLE_ACCENT: Record<AgentRole, { text: string; bg: string; border: string }> = {
  researcher: { text: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200' },
  coder: { text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  reviewer: { text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  architect: { text: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200' },
  debugger: { text: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' },
}

function DagNodeComponent({ data }: NodeProps) {
  const role = (data as DagNodeData).agentRole
  const task = (data as DagNodeData).task ?? ''
  const nodeId = (data as DagNodeData).nodeId ?? ''
  const Icon = ROLE_ICON[role] ?? Search
  const accent = ROLE_ACCENT[role] ?? ROLE_ACCENT.researcher
  const label = ROLE_LABEL[role] ?? role

  return (
    <div
      className={`group relative w-[180px] rounded-lg border bg-card p-3 shadow-sm transition-colors hover:bg-accent ${accent.border}`}
    >
      {/* 入边连接点(左) */}
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2 !w-2 !border-2 !border-background !bg-muted-foreground"
      />
      {/* 出边连接点(右) */}
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2 !w-2 !border-2 !border-background !bg-muted-foreground"
      />

      <div className="flex items-center gap-2">
        <span
          className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${accent.bg} ${accent.text}`}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="truncate text-xs font-semibold text-foreground">{nodeId}</span>
            <span className={`shrink-0 text-[10px] font-medium ${accent.text}`}>{label}</span>
          </div>
        </div>
      </div>

      {/* task 文本,截断 2 行 */}
      <p className="mt-2 line-clamp-2 text-xs leading-snug text-muted-foreground">{task}</p>
    </div>
  )
}

export const DagNode = memo(DagNodeComponent)
export { ROLE_LABEL as DAG_NODE_ROLE_LABEL }
