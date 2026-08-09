'use client'

import * as React from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { cn } from '@/lib/utils'
import type { StepNodeData, StepType } from './types'

// 颜色映射
const COLOR_MAP: Record<StepNodeData['color'], { border: string; bg: string; icon: string; badge: string }> = {
  blue: { border: 'border-blue-500/40', bg: 'bg-blue-500/5', icon: 'text-blue-500', badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  amber: { border: 'border-amber-500/40', bg: 'bg-amber-500/5', icon: 'text-amber-500', badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  emerald: { border: 'border-emerald-500/40', bg: 'bg-emerald-500/5', icon: 'text-emerald-500', badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  violet: { border: 'border-violet-500/40', bg: 'bg-violet-500/5', icon: 'text-violet-500', badge: 'bg-violet-500/10 text-violet-600 dark:text-violet-400' },
  red: { border: 'border-red-500/40', bg: 'bg-red-500/5', icon: 'text-red-500', badge: 'bg-red-500/10 text-red-600 dark:text-red-400' },
  slate: { border: 'border-slate-400/40', bg: 'bg-slate-400/5', icon: 'text-muted-foreground', badge: 'bg-muted text-muted-foreground' },
}

const TYPE_LABEL: Record<StepType, string> = {
  trigger: '触发',
  echo: '回显',
  skill: '技能',
  llm: 'LLM',
  condition: '条件',
  delay: '延迟',
  loop: '循环',
  parallel: '并行',
  tool: '工具',
}

/** 自定义步骤节点组件 */
export function StepNode({ data, selected }: NodeProps<Node<StepNodeData>>) {
  const c = COLOR_MAP[data.color]
  return (
    <div
      className={cn(
        'min-w-[200px] rounded-lg border-2 bg-card px-4 py-3 shadow-sm transition-shadow',
        c.border,
        c.bg,
        selected && 'shadow-md ring-2 ring-primary/30',
      )}
    >
      {/* 输入连接点(非 trigger 节点) */}
      {data.stepType !== 'trigger' && (
        <Handle type="target" position={Position.Top} className="!border-2 !border-border !bg-background" />
      )}

      {/* 头部 */}
      <div className="flex items-center gap-2">
        <div className={cn('flex h-6 w-6 items-center justify-center rounded text-xs', c.badge)}>
          {TYPE_LABEL[data.stepType]}
        </div>
        <span className="text-sm font-medium">{data.label}</span>
      </div>

      {/* 摘要信息 */}
      {data.stepType === 'echo' && data.step.input && (
        <div className="mt-1.5 truncate text-xs text-muted-foreground">
          输入: {data.step.input}
        </div>
      )}
      {data.stepType === 'skill' && data.step.skill && (
        <div className="mt-1.5 truncate text-xs text-muted-foreground">
          技能: {data.step.skill}
        </div>
      )}
      {data.stepType === 'delay' && data.step.duration !== undefined && (
        <div className="mt-1.5 text-xs text-muted-foreground">
          延迟: {data.step.duration}ms
        </div>
      )}
      {data.stepType === 'loop' && data.step.count !== undefined && (
        <div className="mt-1.5 text-xs text-muted-foreground">
          循环: {data.step.count} 次
        </div>
      )}
      {data.stepType === 'condition' && data.step.condition && (
        <div className="mt-1.5 truncate text-xs text-muted-foreground">
          条件: {data.step.condition}
        </div>
      )}
      {data.stepType === 'parallel' && data.step.steps && (
        <div className="mt-1.5 text-xs text-muted-foreground">
          并行: {data.step.steps.length} 个子任务
        </div>
      )}

      {/* 输出连接点 */}
      {data.stepType !== 'condition' && (
        <Handle type="source" position={Position.Bottom} className="!border-2 !border-border !bg-background" />
      )}
      {/* 条件节点有两个输出 */}
      {data.stepType === 'condition' && (
        <>
          <Handle type="source" position={Position.Bottom} id="then" className="!border-2 !border-emerald-500 !bg-background" style={{ left: '30%' }} />
          <Handle type="source" position={Position.Bottom} id="else" className="!border-2 !border-red-500 !bg-background" style={{ left: '70%' }} />
        </>
      )}
    </div>
  )
}