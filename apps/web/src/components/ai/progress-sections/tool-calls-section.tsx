'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { FoldableSection, formatDuration } from './foldable-section'
import type { AgentToolCall } from '@/hooks/use-agent-progress'

interface ToolCallsSectionProps {
  tools: AgentToolCall[]
}

/** 工具名称分类 */
const READ_TOOLS = new Set(['read_file', 'read', 'cat', 'head', 'tail'])
const SEARCH_TOOLS = new Set(['search', 'grep', 'glob', 'find', 'searchcodebase'])
const WRITE_TOOLS = new Set(['write_file', 'edit_file', 'write', 'edit', 'create_file'])
const EXEC_TOOLS = new Set(['execute_command', 'run_command', 'exec', 'bash', 'shell'])

const TOOL_STATUS_CHAR: Record<AgentToolCall['status'], string> = {
  running: '⠋',
  success: '✓',
  error: '✗',
}

const TOOL_STATUS_CLS: Record<AgentToolCall['status'], string> = {
  running: 'text-primary',
  success: 'text-emerald-500',
  error: 'text-red-500',
}

/**
 * ToolCallsSection — 工具调用折叠子区
 *
 * 对齐 Trae Work "已读取 10 个文件,浏览 1 个目录,搜索 5 次" 摘要:
 * - 折叠时:标题 "工具调用" + 计数
 * - 展开时:分类摘要 + 最近 10 条工具调用明细
 */
export function ToolCallsSection({ tools }: ToolCallsSectionProps) {
  if (tools.length === 0) return null

  const readCount = tools.filter((t) => READ_TOOLS.has(t.toolName)).length
  const searchCount = tools.filter((t) => SEARCH_TOOLS.has(t.toolName)).length
  const writeCount = tools.filter((t) => WRITE_TOOLS.has(t.toolName)).length
  const execCount = tools.filter((t) => EXEC_TOOLS.has(t.toolName)).length

  const summaryParts: string[] = []
  if (readCount > 0) summaryParts.push(`读取 ${readCount} 文件`)
  if (searchCount > 0) summaryParts.push(`搜索 ${searchCount} 次`)
  if (writeCount > 0) summaryParts.push(`编辑 ${writeCount} 文件`)
  if (execCount > 0) summaryParts.push(`执行 ${execCount} 命令`)
  const summary = summaryParts.join(', ')

  const recentTools = tools.slice(-10)

  return (
    <FoldableSection title="工具调用" count={tools.length} data-testid="tool-calls-section">
      <div className="space-y-0.5 text-[11px] leading-relaxed">
        {summary && <div className="text-muted-foreground/80">{summary}</div>}
        {recentTools.map((tool) => (
          <div key={tool.id} className="flex items-center gap-1.5">
            <span className={cn('w-3 shrink-0', TOOL_STATUS_CLS[tool.status])}>
              {TOOL_STATUS_CHAR[tool.status]}
            </span>
            <span className="flex-1 break-all text-muted-foreground">{tool.toolName}</span>
            {tool.durationMs !== undefined && tool.status !== 'running' && (
              <span className="shrink-0 text-[10px] text-muted-foreground/60">
                {formatDuration(tool.durationMs)}
              </span>
            )}
          </div>
        ))}
      </div>
    </FoldableSection>
  )
}

export default ToolCallsSection
