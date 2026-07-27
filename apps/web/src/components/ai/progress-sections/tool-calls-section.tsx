'use client'

import * as React from 'react'
import { Wrench, Loader2, Check, X, FileText, Search, FileEdit, Terminal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FoldableSection, formatDuration } from './foldable-section'
import type { AgentToolCall } from '@/hooks/use-agent-progress'

interface ToolCallsSectionProps {
  tools: AgentToolCall[]
}

type ToolCategory = 'read' | 'search' | 'write' | 'exec' | 'other'

const READ_TOOLS = new Set(['read_file', 'Read', 'list_dir', 'glob', 'ls'])
const SEARCH_TOOLS = new Set(['grep', 'search', 'search_codebase'])
const WRITE_TOOLS = new Set(['edit_file', 'write_file', 'Edit', 'Write', 'apply_patch'])
const EXEC_TOOLS = new Set(['run_command', 'execute', 'bash', 'shell'])

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
const CATEGORY_LABEL: Record<ToolCategory, string> = {
  read: '读取',
  search: '搜索',
  write: '编辑',
  exec: '执行',
  other: '其他',
}

const TOOL_STATUS_ICON: Record<
  AgentToolCall['status'],
  React.ComponentType<{ className?: string }>
> = {
  running: Loader2,
  success: Check,
  error: X,
}
const TOOL_STATUS_CLS: Record<AgentToolCall['status'], string> = {
  running: 'text-primary',
  success: 'text-emerald-500',
  error: 'text-red-500',
}

/** 从工具 args 提取关键参数预览(如 file_path / query / command) */
function extractArgPreview(args: Record<string, unknown>): string {
  const keys = ['file_path', 'filePath', 'path', 'filename', 'query', 'pattern', 'command', 'cmd']
  for (const k of keys) {
    const v = args[k]
    if (typeof v === 'string' && v.length > 0) {
      // 路径只取 basename
      if (k.includes('path') || k.includes('file')) {
        const parts = v.split(/[\\/]/)
        return parts[parts.length - 1] ?? v
      }
      // 查询/命令截断
      return v.length > 30 ? v.slice(0, 30) + '…' : v
    }
  }
  return ''
}

/**
 * ToolCallsSection — 工具调用折叠子区
 *
 * v8 对齐 Trae Work:
 * - 标题带 Wrench 图标
 * - 分类颜色编码(read=蓝/search=紫/write=琥珀/exec=青)
 * - 分类图标(FileText/Search/FileEdit/Terminal)
 * - 参数预览(file_path basename / query / command)
 * - 状态 SVG 图标(Loader2/Check/X)
 */
export function ToolCallsSection({ tools }: ToolCallsSectionProps) {
  // v9: 搜索过滤(hooks 必须在条件返回之前调用)
  const [searchQuery, setSearchQuery] = React.useState('')
  const filteredTools = React.useMemo(() => {
    if (!searchQuery.trim()) return tools
    const q = searchQuery.toLowerCase()
    return tools.filter(
      (t) =>
        t.toolName.toLowerCase().includes(q) ||
        JSON.stringify(t.args).toLowerCase().includes(q),
    )
  }, [tools, searchQuery])

  if (tools.length === 0) return null

  // 分类计数
  const categoryCounts: Record<ToolCategory, number> = {
    read: 0,
    search: 0,
    write: 0,
    exec: 0,
    other: 0,
  }
  for (const t of tools) {
    categoryCounts[categorize(t.toolName)]++
  }

  // 摘要(仅显示 >0 的分类)
  const summaryParts: string[] = []
  for (const cat of ['read', 'search', 'write', 'exec', 'other'] as const) {
    if (categoryCounts[cat] > 0) {
      summaryParts.push(`${CATEGORY_LABEL[cat]} ${categoryCounts[cat]}`)
    }
  }
  const summary = summaryParts.join(' · ')

  const recentTools = filteredTools.slice(-10)

  return (
    <FoldableSection
      title="工具调用"
      count={tools.length}
      icon={Wrench}
      data-testid="tool-calls-section"
    >
      <div className="space-y-0.5 text-[11px] leading-relaxed">
        {summary && <div className="text-[10px] text-muted-foreground/60">{summary}</div>}
        {/* v9: 搜索框(工具数量>5时显示) */}
        {tools.length > 5 && (
          <div className="relative mb-1">
            <Search className="absolute left-1 top-1/2 h-2.5 w-2.5 -translate-y-1/2 text-muted-foreground/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索工具..."
              className="w-full rounded-sm border border-border/40 bg-muted/30 py-0.5 pl-5 pr-2 text-[10px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30"
              data-testid="tool-search-input"
            />
          </div>
        )}
        {recentTools.map((tool) => {
          const cat = categorize(tool.toolName)
          const CatIcon = CATEGORY_ICON[cat]
          const StatusIcon = TOOL_STATUS_ICON[tool.status]
          const argPreview = extractArgPreview(tool.args)
          return (
            <div key={tool.id} className="flex items-center gap-1.5">
              <CatIcon className={cn('h-2.5 w-2.5 shrink-0', CATEGORY_CLS[cat])} />
              <StatusIcon
                className={cn(
                  'h-2.5 w-2.5 shrink-0',
                  TOOL_STATUS_CLS[tool.status],
                  tool.status === 'running' && 'animate-spin',
                )}
              />
              <code className="shrink-0 font-mono text-[10px] text-muted-foreground">
                {tool.toolName}
              </code>
              {argPreview && (
                <span
                  className="flex-1 truncate font-mono text-[10px] text-muted-foreground/50"
                  title={argPreview}
                >
                  {argPreview}
                </span>
              )}
              {tool.durationMs !== undefined && tool.status !== 'running' && (
                <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/50">
                  {formatDuration(tool.durationMs)}
                </span>
              )}
            </div>
          )
        })}
        {filteredTools.length > 10 && (
          <div className="text-[10px] text-muted-foreground/40">…还有 {filteredTools.length - 10} 项</div>
        )}
        {searchQuery && filteredTools.length === 0 && (
          <div className="text-[10px] text-muted-foreground/40">无匹配结果</div>
        )}
      </div>
    </FoldableSection>
  )
}

export default ToolCallsSection
