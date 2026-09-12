// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import {
  Bot,
  Wrench,
  UserCheck,
  CircleDot,
  Loader2,
  CircleCheck,
  CircleX,
  MinusCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { NODE_TYPE_META, type CanvasNodeData, type CanvasNodeType } from '../types'

const TYPE_ICON: Record<CanvasNodeType, React.ComponentType<{ className?: string }>> = {
  agent: Bot,
  tool: Wrench,
  'human-review': UserCheck,
}

/** 运行状态角标 */
function StatusIcon({ status }: { status: CanvasNodeData['status'] }) {
  const t = useTranslations('agentCanvas')
  if (status === 'running')
    return (
      <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" aria-label={t('statusRunning')} />
    )
  if (status === 'success')
    return <CircleCheck className="h-3.5 w-3.5 text-emerald-500" aria-label={t('statusSuccess')} />
  if (status === 'failed')
    return <CircleX className="h-3.5 w-3.5 text-red-500" aria-label={t('statusFailed')} />
  if (status === 'skipped')
    return (
      <MinusCircle
        className="h-3.5 w-3.5 text-muted-foreground/70"
        aria-label={t('statusSkipped')}
      />
    )
  return <CircleDot className="h-3.5 w-3.5 text-muted-foreground/50" aria-label={t('statusIdle')} />
}

/** 画布任务节点(带输入/输出连接点 + 运行状态 + 最近一条日志摘要) */
export function CanvasTaskNode({ data, selected }: NodeProps<Node<CanvasNodeData>>) {
  const meta = NODE_TYPE_META[data.nodeType]
  const Icon = TYPE_ICON[data.nodeType]
  const lastLog = data.logs[data.logs.length - 1]

  return (
    <div
      className={cn(
        'min-w-[190px] rounded-lg border-2 bg-card px-3.5 py-2.5 shadow-sm transition-shadow',
        meta.border,
        meta.bg,
        selected && 'shadow-md ring-2 ring-primary/30',
        data.status === 'running' && 'border-blue-500/70',
        data.status === 'failed' && 'border-red-500/70',
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-2.5 !w-2.5 !border-2 !border-border !bg-background"
      />
      <div className="flex items-center gap-2">
        <div
          className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded', meta.badge)}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{data.label}</span>
        <StatusIcon status={data.status} />
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className={cn('text-[10px] font-semibold uppercase tracking-wide', meta.accentText)}>
          {meta.title}
        </span>
        {lastLog && (
          <span className="max-w-[120px] truncate text-[10px] text-muted-foreground">
            {lastLog.message}
          </span>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2.5 !w-2.5 !border-2 !border-border !bg-background"
      />
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
