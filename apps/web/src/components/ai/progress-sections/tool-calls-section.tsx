'use client'

import * as React from 'react'
import { Wrench, Loader2, Check, X, FileText, Search, FileEdit, Terminal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FoldableSection, formatDuration } from './foldable-section'
import type { AgentToolCall } from '@/hooks/use-agent-progress'

interface ToolCallsSectionProps {
  tools: AgentToolCall[]
}

// ─── 工具分类 ────────────────────────────────────────────────────────
type ToolCategory = 'read' | 'search' | 'write' | 'exec' | 'other'

const READ_TOOLS = new Set(['read_file', 'Read', 'list_dir', 'glob', 'ls'])
const SEARCH_TOOLS = new Set(['grep', 'search', 'search_codebase', 'Grep'])
const WRITE_TOOLS = new Set(['edit_file', 'write_file', 'Edit', 'Write', 'apply_patch'])
const EXEC_TOOLS = new Set(['run_command', 'execute', 'bash', 'shell', 'RunCommand'])

function categorize(toolName: string): ToolCategory {
  if (READ_TOOLS.has(toolName)) return 'read'
  if (SEARCH_TOOLS.has(toolName)) return 'search'
  if (WRITE_TOOLS.has(toolName)) return 'write'
  if (EXEC_TOOLS.has(toolName)) return 'exec'
  return 'other'
}

const CATEGORY_ICON: Record<ToolCategory, React.ComponentType<{ className?: string }>> = {
  read: FileText,
  search: Search,
  write: FileEdit,
  exec: Terminal,
  other: Wrench,
}
const CATEGORY_CLS: Record<ToolCategory, string> = {
  read: 'text-blue-500',
  search: 'text-purple-500',
  write: 'text-amber-500',
  exec: 'text-cyan-500',
  other: 'text-muted-foreground',
}

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

/** 从 args 提取关键参数预览(文件路径/搜索词/命令) */
function extractArgPreview(args: Record<string, unknown>): string {
  const pickStr = (keys: string[]): string => {
    for (const k of keys) {
      const v = args[k]
      if (typeof v === 'string' && v.length > 0) return v
    }
    return ''
  }

  const filePath = pickStr(['path', 'file_path', 'filePath', 'filename'])
  if (filePath) {
    const parts = filePath.split(/[\\/]/)
    return parts[parts.length - 1] || filePath
  }

  const query = pickStr(['query', 'pattern', 'search', 'q'])
  if (query) return query.length > 20 ? query.slice(0, 20) + '…' : query

  const command = pickStr(['command', 'cmd'])
  if (command) return command.length > 20 ? command.slice(0, 20) + '…' : command

  const glob = pickStr(['glob', 'pattern'])
  if (glob) return glob

  return ''
}

/**
 * ToolCallsSection — 工具调用折叠子区(v8 极致版)
 *
 * 对齐 Trae Work 工具调用展示:
 * - 标题带 Wrench 图标
 * - 分类颜色编码(read=blue / search=purple / write=amber / exec=cyan)
 * - 分类图标(FileText / Search / FileEdit / Terminal)
 * - 参数预览(文件 basename / 搜索词 / 命令)
 * - 状态 SVG 图标(Loader2/Check/X)
 */
export function ToolCallsSection({ tools }: ToolCallsSectionProps) {
  if (tools.length === 0) return null

  const readCount = tools.filter((t) => categorize(t.toolName) === 'read').length
  const searchCount = tools.filter((t) => categorize(t.toolName) === 'search').length
  const writeCount = tools.filter((t) => categorize(t.toolName) === 'write').length
  const execCount = tools.filter((t) => categorize(t.toolName) === 'exec').length

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
          const cat = categorize(tool.toolName)
          const CatIcon = CATEGORY_ICON[cat]
          const StatusIcon = TOOL_STATUS_ICON[tool.status]
          const argPreview = extractArgPreview(tool.args)
          return (
            <div key={tool.id} className="flex items-center gap-1.5">
              {/* 分类图标(颜色编码) */}
              <CatIcon className={cn('h-2.5 w-2.5 shrink-0', CATEGORY_CLS[cat])} />
              {/* 状态图标 */}
              <StatusIcon
                className={cn(
                  'h-2.5 w-2.5 shrink-0',
                  TOOL_STATUS_CLS[tool.status],
                  tool.status === 'running' && 'animate-spin',
                )}
              />
              {/* 工具名 */}
              <code className="shrink-0 font-mono text-[10px] text-muted-foreground">
                {tool.toolName}
              </code>
              {/* 参数预览 */}
              {argPreview && (
                <span className="flex-1 truncate text-[10px] text-muted-foreground/50" title={argPreview}>
                  {argPreview}
                </span>
              )}
              {!argPreview && <span className="flex-1" />}
              {/* 耗时 */}
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
