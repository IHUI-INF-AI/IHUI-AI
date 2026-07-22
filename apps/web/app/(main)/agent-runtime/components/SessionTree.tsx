'use client'

import * as React from 'react'
import { Loader2, ChevronRight, ChevronDown, MessageSquare } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Collapsible, CollapsibleTrigger, CollapsibleContent } from '@ihui/ui'
import { fetchApi } from '@/lib/api'

export interface SessionMessage {
  role: string
  content: string
  createdAt: string
}

export interface SessionNode {
  id: string
  parentId?: string
  startedAt: string
  messageCount: number
  status: 'active' | 'completed' | 'archived' | 'error'
  messages?: SessionMessage[]
  children?: SessionNode[]
}

interface SessionTreeProps {
  agentId: string
  timeRange: string
  refreshKey: number
}

const STATUS_BADGE: Record<SessionNode['status'], { label: string; cls: string }> = {
  active: { label: '进行中', cls: 'bg-blue-500/15 text-blue-600' },
  completed: { label: '已完成', cls: 'bg-green-500/15 text-green-600' },
  archived: { label: '已归档', cls: 'bg-muted text-muted-foreground' },
  error: { label: '异常', cls: 'bg-red-500/15 text-red-600' },
}

const timeFmt = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

function shortId(id: string): string {
  return id.length > 8 ? id.slice(0, 8) + '…' : id
}

function SessionRow({ node, prefix, isLast, depth }: { node: SessionNode; prefix: string; isLast: boolean; depth: number }) {
  const [open, setOpen] = React.useState(false)
  const badge = STATUS_BADGE[node.status]
  const hasChildren = !!node.children && node.children.length > 0
  const branch = depth === 0 ? '' : isLast ? '└── ' : '├── '
  const childPrefix = depth === 0 ? '' : prefix + (isLast ? '    ' : '│   ')
  const msgs = node.messages ?? []

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="flex items-center gap-1.5 px-1 py-1 font-mono text-xs hover:bg-muted/40 rounded-sm">
        <span className="select-none whitespace-pre text-muted-foreground">{prefix + branch}</span>
        <CollapsibleTrigger className="flex flex-1 items-center gap-1.5 text-left">
          {open ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
          <span className="font-medium">{shortId(node.id)}</span>
          <span className="text-muted-foreground">{timeFmt.format(new Date(node.startedAt))}</span>
          <span className="flex items-center gap-0.5 text-muted-foreground">
            <MessageSquare className="h-3 w-3" />
            {node.messageCount}
          </span>
          <span className={`rounded px-1.5 py-0.5 text-[10px] ${badge.cls}`}>{badge.label}</span>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        {msgs.length > 0 ? (
          <div className={`mb-1 ml-8 space-y-1 rounded bg-muted/40 p-2`}>
            {msgs.slice(0, 6).map((m, i) => (
              <div key={i} className="flex gap-2 text-xs">
                <span className="shrink-0 font-medium text-primary">{m.role}</span>
                <span className="text-muted-foreground">{m.content.slice(0, 80)}</span>
              </div>
            ))}
            {msgs.length > 6 && (
              <p className="text-[10px] text-muted-foreground">还有 {msgs.length - 6} 条消息...</p>
            )}
          </div>
        ) : (
          <p className="mb-1 ml-8 py-1 text-xs text-muted-foreground">暂无消息记录</p>
        )}
      </CollapsibleContent>
      {hasChildren &&
        node.children!.map((child, i) => (
          <SessionRow
            key={child.id}
            node={child}
            prefix={childPrefix}
            isLast={i === node.children!.length - 1}
            depth={depth + 1}
          />
        ))}
    </Collapsible>
  )
}

export function SessionTree({ agentId, timeRange, refreshKey }: SessionTreeProps) {
  const [data, setData] = React.useState<SessionNode[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState(false)

  React.useEffect(() => {
    if (!agentId) return
    let cancelled = false
    setLoading(true)
    fetchApi<SessionNode[]>(`/api/agents/${agentId}/sessions?range=${timeRange}`)
      .then((r) => {
        if (cancelled) return
        if (r.success && r.data) setData(r.data)
        else {
          setData([])
          setError(true)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setData([])
          setError(true)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [agentId, timeRange, refreshKey])

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">会话树</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            加载中...
          </div>
        ) : data.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {error ? '接口暂不可用,暂无数据' : '暂无会话记录'}
          </p>
        ) : (
          <div className="max-h-[420px] space-y-0.5 overflow-auto">
            {data.map((node, i) => (
              <SessionRow
                key={node.id}
                node={node}
                prefix=""
                isLast={i === data.length - 1}
                depth={0}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
