// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

'use client'

import * as React from 'react'
import { Badge, Input, Label } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { NODE_TYPE_META, type CanvasLogEntry, type CanvasNodeData } from '../types'

interface InspectorPanelProps {
  node: CanvasNodeData | null
  nodeId: string | null
  onUpdateParams: (nodeId: string, patch: Partial<CanvasNodeData['params']>) => void
  onRename: (nodeId: string, name: string) => void
}

const LEVEL_STYLE: Record<CanvasLogEntry['level'], string> = {
  info: 'text-foreground/80',
  warn: 'text-amber-500',
  error: 'text-red-500',
  exit: 'text-muted-foreground font-medium',
}

/** 归一化日志消息:兼容 stdout/stderr/exitCode 等后端字段命名 */
function logMessage(log: CanvasLogEntry): string {
  return log.message
}

function LogList({ logs }: { logs: CanvasLogEntry[] }) {
  const scrollRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [logs.length])

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto rounded-md border bg-background p-2">
      {logs.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">暂无运行日志</p>
      ) : (
        <ul className="space-y-1 font-mono text-[11px] leading-relaxed">
          {logs.map((log) => (
            <li key={log.id} className="flex gap-2">
              <span className="shrink-0 text-muted-foreground/60">
                {new Date(log.timestamp).toLocaleTimeString('zh-CN', { hour12: false })}
              </span>
              <span className={cn('min-w-0 break-all whitespace-pre-wrap', LEVEL_STYLE[log.level])}>
                {logMessage(log)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** 右侧检查器:选中节点参数编辑 + 该节点运行日志流 */
export function InspectorPanel({ node, nodeId, onUpdateParams, onRename }: InspectorPanelProps) {
  if (!node || !nodeId) {
    return (
      <div className="flex w-72 shrink-0 flex-col border-l bg-card">
        <div className="border-b px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          属性 / 日志
        </div>
        <div className="flex flex-1 items-center justify-center p-4 text-center text-xs text-muted-foreground">
          点击画布中的节点以编辑参数并查看运行日志
        </div>
      </div>
    )
  }

  const meta = NODE_TYPE_META[node.nodeType]
  const { params } = node

  return (
    <div className="flex w-72 shrink-0 flex-col border-l bg-card">
      <div className="flex items-center justify-between border-b px-3 py-2.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          属性 / 日志
        </span>
        <Badge className={cn('border-0', meta.badge)}>{meta.title}</Badge>
      </div>

      <div className="flex flex-col gap-3 border-b p-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="canvas-node-name">节点名称</Label>
          <Input
            id="canvas-node-name"
            value={node.label}
            onChange={(e) => onRename(nodeId, e.target.value)}
          />
        </div>

        {node.nodeType === 'agent' && (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="canvas-node-skill">技能 (skill)</Label>
              <Input
                id="canvas-node-skill"
                value={params.skill ?? ''}
                placeholder="如 text-summary"
                onChange={(e) => onUpdateParams(nodeId, { skill: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="canvas-node-input-agent">输入 (input)</Label>
              <textarea
                id="canvas-node-input-agent"
                value={params.input ?? ''}
                placeholder="传给该 Agent 的文本输入"
                onChange={(e) => onUpdateParams(nodeId, { input: e.target.value })}
                className="h-20 w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </>
        )}

        {node.nodeType === 'tool' && (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="canvas-node-tool">工具名 (tool)</Label>
              <Input
                id="canvas-node-tool"
                value={params.tool ?? ''}
                placeholder="如 shell / read_file"
                onChange={(e) => onUpdateParams(nodeId, { tool: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="canvas-node-input-tool">参数 / 命令 (input)</Label>
              <textarea
                id="canvas-node-input-tool"
                value={params.input ?? ''}
                placeholder="工具调用参数或命令行"
                onChange={(e) => onUpdateParams(nodeId, { input: e.target.value })}
                className="h-20 w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </>
        )}

        {node.nodeType === 'human-review' && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="canvas-node-prompt">审核提示语 (prompt)</Label>
            <textarea
              id="canvas-node-prompt"
              value={params.prompt ?? ''}
              placeholder="人工审核时展示的说明"
              onChange={(e) => onUpdateParams(nodeId, { prompt: e.target.value })}
              className="h-20 w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col p-3">
        <span className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          运行日志
        </span>
        <div className="min-h-0 flex-1">
          <LogList logs={node.logs} />
        </div>
      </div>
    </div>
  )
}
