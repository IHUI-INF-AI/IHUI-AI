'use client'

import * as React from 'react'
import { Bot, ChevronRight, Loader2, Check, AlertCircle, Clock, Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Checklist, type ChecklistItemData } from './checklist'
import {
  SUBAGENT_COLOR_CLASS,
  type Subagent,
  type SubagentStatus,
} from '@/hooks/use-agent-progress'
import { formatDuration } from './foldable-section'

const STATUS_ICON: Record<SubagentStatus, React.ComponentType<{ className?: string }>> = {
  spawned: Clock,
  running: Loader2,
  done: Check,
  failed: AlertCircle,
  dead: AlertCircle,
}

const STATUS_CLS: Record<SubagentStatus, string> = {
  spawned: 'text-amber-400',
  running: 'text-primary',
  done: 'text-emerald-500',
  failed: 'text-destructive',
  dead: 'text-muted-foreground/50',
}

interface SubAgentTaskTreeProps {
  subagent: Subagent
  defaultCollapsed?: boolean
  className?: string
  'data-testid'?: string
}

export const SubAgentTaskTree = React.memo(function SubAgentTaskTree({
  subagent,
  defaultCollapsed = false,
  className,
  'data-testid': testId,
}: SubAgentTaskTreeProps) {
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed)
  const StatusIcon = STATUS_ICON[subagent.status] ?? Clock
  const colorCls = SUBAGENT_COLOR_CLASS[subagent.color]

  const tools = subagent.tools ?? []
  const checklistItems: ChecklistItemData[] = tools.map((tool) => ({
    id: tool.id,
    label: tool.toolName,
    status:
      tool.status === 'success' ? 'completed' : tool.status === 'error' ? 'failed' : 'in_progress',
    meta: tool.durationMs !== undefined ? formatDuration(tool.durationMs) : undefined,
    description: tool.error ? `失败: ${tool.error}` : undefined,
  }))

  return (
    <div
      className={cn(
        'relative space-y-0.5 rounded-md border border-border/40 bg-card/30 p-1.5',
        className,
      )}
      data-testid={testId ?? 'subagent-task-tree'}
      data-subagent-id={subagent.id}
      data-subagent-status={subagent.status}
    >
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        aria-expanded={!collapsed}
        className="flex w-full items-center gap-1.5 rounded-sm px-1 py-0.5 text-left transition-colors hover:bg-accent/30"
      >
        <ChevronRight
          className={cn(
            'h-2.5 w-2.5 shrink-0 text-muted-foreground/60 transition-transform duration-150',
            !collapsed && 'rotate-90',
          )}
          aria-hidden
        />
        <StatusIcon
          className={cn(
            'h-3 w-3 shrink-0',
            STATUS_CLS[subagent.status],
            subagent.status === 'running' && 'animate-spin',
          )}
          aria-hidden
        />
        <Bot className={cn('h-3 w-3 shrink-0', colorCls)} aria-hidden />
        <span className="shrink-0 text-[11px] font-medium text-foreground/90">
          {subagent.nickname}
        </span>
        <span className="shrink-0 text-[10px] text-muted-foreground/60">{subagent.handle}</span>
        <span className="flex-1" />
        {subagent.currentTask && (
          <span className="hidden truncate text-[10px] text-muted-foreground/60 lg:inline">
            {subagent.currentTask}
          </span>
        )}
        {subagent.durationMs !== undefined && (
          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/60">
            {formatDuration(subagent.durationMs)}
          </span>
        )}
        {subagent.tokenUsage !== undefined && subagent.tokenUsage > 0 && (
          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/60">
            {Math.round(subagent.tokenUsage / 1000)}k tok
          </span>
        )}
      </button>

      {subagent.failureReason && (
        <div className="ml-4 flex items-start gap-1 text-[10px] text-destructive/80">
          <AlertCircle className="mt-0.5 h-2.5 w-2.5 shrink-0" aria-hidden />
          <span className="break-all">{subagent.failureReason}</span>
        </div>
      )}

      {!collapsed && checklistItems.length > 0 && (
        <div className="ml-4 border-l border-border/40 pl-2 pt-1">
          <div className="mb-1 inline-flex items-center gap-1 text-[10px] text-muted-foreground/60">
            <Wrench className="h-2.5 w-2.5" aria-hidden />
            工具调用 ({checklistItems.length})
          </div>
          <Checklist items={checklistItems} dense />
        </div>
      )}

      {!collapsed && subagent.currentTask && (
        <div className="ml-4 flex items-start gap-1 border-l border-border/40 pl-2 text-[10px] text-muted-foreground/70">
          <span className="shrink-0">→</span>
          <span className="break-all">{subagent.currentTask}</span>
        </div>
      )}
    </div>
  )
})

export default SubAgentTaskTree
