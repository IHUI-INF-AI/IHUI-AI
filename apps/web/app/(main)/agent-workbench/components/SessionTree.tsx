'use client'

import * as React from 'react'
import { Loader2, ChevronRight } from 'lucide-react'
import { Badge, cn } from '@ihui/ui-react'
import type { AgentSession } from '@/hooks/use-agent-runtime'

interface Props {
  nodes: AgentSession[]
  loading?: boolean
}

const DEFAULT_STYLE: { label: string; className: string } = {
  label: '草稿',
  className: 'border-transparent bg-muted text-muted-foreground',
}

const STATUS_STYLE: Record<string, { label: string; className: string }> = {
  draft: DEFAULT_STYLE,
  published: {
    label: '已发布',
    className: 'border-transparent bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
  },
  running: {
    label: '运行中',
    className: 'border-transparent bg-sky-500/10 text-sky-600 dark:text-sky-400',
  },
  paused: {
    label: '已暂停',
    className: 'border-transparent bg-amber-500/10 text-amber-600 dark:text-amber-500',
  },
  error: { label: '异常', className: 'border-transparent bg-destructive/10 text-destructive' },
  stopped: { label: '已停止', className: 'border-transparent bg-muted text-muted-foreground' },
}

function truncate(id: string, len = 8): string {
  return id.length <= len ? id : `${id.slice(0, len)}...`
}

function TreeNode({ node, depth }: { node: AgentSession; depth: number }) {
  const [expanded, setExpanded] = React.useState(true)
  const hasChildren = !!node.children && node.children.length > 0
  const style = STATUS_STYLE[node.status] ?? DEFAULT_STYLE
  return (
    <div className="relative" style={{ paddingLeft: depth * 14 }}>
      {depth > 0 && (
        <span
          className="absolute top-0 bottom-0 w-px bg-border"
          style={{ left: (depth - 1) * 14 + 6 }}
        />
      )}
      <div className="flex items-center gap-1.5 py-1">
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
            aria-label={expanded ? '折叠' : '展开'}
          >
            <ChevronRight
              className={cn('h-3 w-3 transition-transform', expanded && 'rotate-90')}
            />
          </button>
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <span className="truncate font-mono text-xs">{truncate(node.id)}</span>
        <Badge variant="outline" className={cn('ml-auto px-1.5 py-0 text-[10px]', style.className)}>
          {style.label}
        </Badge>
      </div>
      {hasChildren && expanded && (
        <div>
          {node.children!.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

export function SessionTree({ nodes, loading }: Props) {
  return (
    <div className="flex h-full flex-col rounded-lg border bg-card">
      <div className="px-3 py-2 text-sm font-medium">
        Session 树
        <span className="ml-2 text-xs font-normal text-muted-foreground">{nodes.length}</span>
      </div>
      <div className="flex-1 overflow-auto px-2 py-1">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 加载中...
          </div>
        ) : nodes.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">暂无 Session</div>
        ) : (
          <div className="space-y-0.5">
            {nodes.map((n) => (
              <TreeNode key={n.id} node={n} depth={0} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
