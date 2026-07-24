'use client'

import * as React from 'react'
import { Loader2, ChevronRight, ChevronDown } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@ihui/ui-react'
import { fetchApi } from '@/lib/api'

export interface ToolCallNode {
  id: string
  tool: string
  status: 'pending' | 'success' | 'failed' | 'skipped'
  duration?: number
  params?: Record<string, unknown>
  children?: ToolCallNode[]
}

interface ToolCallTreeProps {
  agentId: string
  timeRange: string
  refreshKey: number
}

const STATUS_META: Record<ToolCallNode['status'], { icon: string; color: string; label: string }> = {
  pending: { icon: '⏳', color: 'text-blue-500', label: '进行中' },
  success: { icon: '✅', color: 'text-green-600', label: '成功' },
  failed: { icon: '❌', color: 'text-red-600', label: '失败' },
  skipped: { icon: '⏭️', color: 'text-muted-foreground', label: '跳过' },
}

function TreeRow({
  node,
  prefix,
  isLast,
  depth,
}: {
  node: ToolCallNode
  prefix: string
  isLast: boolean
  depth: number
}) {
  const [expanded, setExpanded] = React.useState(true)
  const [paramsOpen, setParamsOpen] = React.useState(false)
  const meta = STATUS_META[node.status]
  const hasChildren = !!node.children && node.children.length > 0
  const branch = depth === 0 ? '' : isLast ? '└── ' : '├── '
  const childPrefix = depth === 0 ? '' : prefix + (isLast ? '    ' : '│   ')

  return (
    <div>
      <div className="flex items-center gap-1 px-1 py-0.5 font-mono text-xs hover:bg-muted/40 rounded-sm">
        <span className="select-none whitespace-pre text-muted-foreground">{prefix + branch}</span>
        {hasChildren ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label={expanded ? '折叠' : '展开'}
          >
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : (
          <span className="inline-block w-3 shrink-0" />
        )}
        <span className={meta.color}>{meta.icon}</span>
        <span className="font-medium">{node.tool}</span>
        {node.duration !== null && node.duration !== undefined && (
          <span className="text-muted-foreground">{node.duration}ms</span>
        )}
        {node.params && Object.keys(node.params).length > 0 && (
          <button
            onClick={() => setParamsOpen(!paramsOpen)}
            className="text-muted-foreground underline-offset-2 hover:underline"
          >
            {paramsOpen ? '收起' : '参数'}
          </button>
        )}
      </div>
      {paramsOpen && node.params && (
        <pre className="mb-1 ml-12 overflow-auto rounded bg-muted p-2 text-xs">
          {JSON.stringify(node.params, null, 2)}
        </pre>
      )}
      {expanded &&
        hasChildren &&
        node.children!.map((child, i) => (
          <TreeRow
            key={child.id}
            node={child}
            prefix={childPrefix}
            isLast={i === node.children!.length - 1}
            depth={depth + 1}
          />
        ))}
    </div>
  )
}

export function ToolCallTree({ agentId, timeRange, refreshKey }: ToolCallTreeProps) {
  const [data, setData] = React.useState<ToolCallNode[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState(false)

  React.useEffect(() => {
    if (!agentId) return
    let cancelled = false
    setLoading(true)
    fetchApi<ToolCallNode[]>(`/api/agents/${agentId}/tool-calls?range=${timeRange}`)
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
        <CardTitle className="text-base">工具调用流</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            加载中...
          </div>
        ) : data.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {error ? '接口暂不可用,暂无数据' : '暂无工具调用记录'}
          </p>
        ) : (
          <div className="max-h-[420px] space-y-0.5 overflow-auto">
            {data.map((node, i) => (
              <TreeRow
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
