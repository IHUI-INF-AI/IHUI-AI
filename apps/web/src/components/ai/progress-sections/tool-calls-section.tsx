'use client'

import * as React from 'react'
import { Wrench, Loader2, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FoldableSection, formatDuration } from './foldable-section'
import type { AgentToolCall } from '@/hooks/use-agent-progress'

interface ToolCallsSectionProps {
  tools: AgentToolCall[]
}

const READ_TOOLS = new Set(['read_file', 'Read', 'list_dir', 'glob', 'ls'])
const SEARCH_TOOLS = new Set(['grep', 'search', 'search_codebase'])
const WRITE_TOOLS = new Set(['edit_file', 'write_file', 'Edit', 'Write', 'apply_patch'])
const EXEC_TOOLS = new Set(['run_command', 'execute', 'bash', 'shell'])

const TOOL_STATUS_ICON: Record<AgentToolCall['status'], React.ComponentType<{ className?: string }>> = {
  running: Loader2,
  success: Check,
  error: X,
}
const TOOL_STATUS_CLS: Record<AgentToolCall['status'], string> = {
  running: 'text-primary',
  success: 'text-emerald-500',
  error: 'text-red-500',
}

/**
 * ToolCallsSection — 工具调用折叠子区
 *
 * 对齐 Trae Work 工具调用展示:
 * - 标题带 Wrench 图标
 * - 聚合分类(读取/搜索/编辑/执行)+ 最近 10 条明细
 * - 状态用 SVG 图标(Loader2/Check/X)替代 Unicode 字符
 */
export function ToolCallsSection({ tools }: ToolCallsSectionProps) {
  if (tools.length === 0) return null

  const readCount = tools.filter((t) => READ_TOOLS.has(t.toolName)).length
  const searchCount = tools.filter((t) => SEARCH_TOOLS.has(t.toolName)).length
  const writeCount = tools.filter((t) => WRITE_TOOLS.has(t.toolName)).length
  const execCount = tools.filter((t) => EXEC_TOOLS.has(t.toolName)).length

  const summaryParts: string[] = []
  if (readCount > 0) summaryParts.push(`读取 ${readCount}`)
  if (searchCount > 0) summaryParts.push(`搜索 ${searchCount}`)
  if (writeCount > 0) summaryParts.push(`编辑 ${writeCount}`)
  if (execCount > 0) summaryParts.push(`执行 ${execCount}`)
  const summary = summaryParts.join(' · ')

  const recentTools = tools.slice(-10)

  return (
    <FoldableSection title="工具调用" count={tools.length} icon={Wrench} data-testid="tool-calls-section">
      <div className="space-y-0.5 text-[11px] leading-relaxed">
        {summary && (
          <div className="text-[10px] text-muted-foreground/60">{summary}</div>
        )}
        {recentTools.map((tool) => {
          const Icon = TOOL_STATUS_ICON[tool.status]
          return (
            <div key={tool.id} className="flex items-center gap-1.5">
              <Icon
                className={cn(
                  'h-2.5 w-2.5 shrink-0',
                  TOOL_STATUS_CLS[tool.status],
                  tool.status === 'running' && 'animate-spin',
                )}
              />
              <code className="flex-1 break-all font-mono text-[10px] text-muted-foreground">
                {tool.toolName}
              </code>
              {tool.durationMs !== undefined && tool.status !== 'running' && (
                <span className="shrink-0 text-[10px] text-muted-foreground/50">
                  {formatDuration(tool.durationMs)}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </FoldableSection>
  )
}

export default ToolCallsSection
