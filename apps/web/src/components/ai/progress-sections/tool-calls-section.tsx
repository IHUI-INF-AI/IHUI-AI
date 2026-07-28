'use client'

import * as React from 'react'
import {
  Wrench,
  Loader2,
  Check,
  X,
  FileText,
  Search,
  FileEdit,
  Terminal,
  ChevronRight,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { FoldableSection, formatDuration } from './foldable-section'
import { CopyButton } from './copy-button'
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
const CATEGORY_TKEY: Record<ToolCategory, string> = {
  read: 'tools.categoryRead',
  search: 'tools.categorySearch',
  write: 'tools.categoryWrite',
  exec: 'tools.categoryExec',
  other: 'tools.categoryOther',
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

/** 格式化 args 为可读 JSON 字符串(用于详情展开) */
function formatArgsJson(args: Record<string, unknown>): string {
  try {
    return JSON.stringify(args, null, 2)
  } catch {
    return String(args)
  }
}

/** 格式化 result 为可读字符串(用于详情展开) */
function formatResultJson(result: unknown): string {
  if (result === undefined || result === null) return ''
  if (typeof result === 'string') return result
  try {
    return JSON.stringify(result, null, 2)
  } catch {
    return String(result)
  }
}

/** 截断超长字符串(详情区最大 500 字符) */
function truncateForDisplay(s: string, max = 500): string {
  if (s.length <= max) return s
  return s.slice(0, max) + `\n…(已截断,共 ${s.length} 字符)`
}

/**
 * ToolCallItem — 单个工具调用项(可点击展开详情)
 *
 * v10 Phase 4.3:
 * - 点击工具行展开/折叠完整 args + result
 * - CSS grid 平滑高度动画(复用 foldable-section 模式)
 * - memo 化:tool 引用稳定时跳过重渲染
 *
 * v10 Phase 5:导出供 SubagentSection 嵌套展示复用
 */
export const ToolCallItem = React.memo(function ToolCallItem({ tool }: { tool: AgentToolCall }) {
  const t = useTranslations('ai.pane')
  const [expanded, setExpanded] = React.useState(false)
  const cat = categorize(tool.toolName)
  const CatIcon = CATEGORY_ICON[cat]
  const StatusIcon = TOOL_STATUS_ICON[tool.status]
  const argPreview = extractArgPreview(tool.args)
  const resultText = formatResultJson(tool.result)
  const hasDetail = Object.keys(tool.args).length > 0 || resultText.length > 0

  const toggleExpand = () => {
    if (hasDetail) setExpanded((v) => !v)
  }

  return (
    <div className="rounded-sm transition-colors hover:bg-accent/40">
      <div
        className={cn(
          'flex items-center gap-1.5 px-1 py-0.5',
          hasDetail && 'cursor-pointer',
        )}
        onClick={toggleExpand}
        role={hasDetail ? 'button' : undefined}
        aria-expanded={hasDetail ? expanded : undefined}
        tabIndex={hasDetail ? 0 : undefined}
        onKeyDown={(e) => {
          if (hasDetail && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            toggleExpand()
          }
        }}
        data-testid={`tool-item-${tool.id}`}
      >
        {hasDetail && (
          <ChevronRight
            className={cn(
              'h-2 w-2 shrink-0 text-muted-foreground/60 transition-transform duration-150',
              expanded && 'rotate-90',
            )}
          />
        )}
        {!hasDetail && <span className="w-2 shrink-0" />}
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
            className="flex-1 truncate font-mono text-[10px] text-muted-foreground/70"
            title={argPreview}
          >
            {argPreview}
          </span>
        )}
        {tool.durationMs !== undefined && tool.status !== 'running' && (
          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/70">
            {formatDuration(tool.durationMs)}
          </span>
        )}
      </div>
      {/* 详情展开区:完整 args + result */}
      {hasDetail && (
        <div
          className="grid transition-[grid-template-rows] duration-150 ease-out"
          style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
        >
          <div className="overflow-hidden">
            <div className="space-y-1 px-3 pb-1 pt-0.5 text-[10px] leading-relaxed">
              {Object.keys(tool.args).length > 0 && (
                <div>
                  <div className="flex items-center gap-1">
                    <span className="font-medium text-muted-foreground/60">{t('tools.args')}</span>
                    <CopyButton
                      text={formatArgsJson(tool.args)}
                      aria-label={t('tools.copyArgs')}
                      data-testid={`tool-copy-args-${tool.id}`}
                    />
                  </div>
                  <pre className="mt-0.5 max-h-24 overflow-auto whitespace-pre-wrap break-all rounded-sm bg-muted/60 p-1 font-mono text-[10px] text-muted-foreground/90">
                    {truncateForDisplay(formatArgsJson(tool.args))}
                  </pre>
                </div>
              )}
              {resultText && (
                <div>
                  <div className="flex items-center gap-1">
                    <span className="font-medium text-muted-foreground/60">{t('tools.result')}</span>
                    <CopyButton
                      text={resultText}
                      aria-label={t('tools.copyResult')}
                      data-testid={`tool-copy-result-${tool.id}`}
                    />
                  </div>
                  <pre
                    className={cn(
                      'mt-0.5 max-h-24 overflow-auto whitespace-pre-wrap break-all rounded-sm p-1 font-mono text-[10px]',
                      tool.status === 'error'
                        ? 'bg-red-500/10 text-red-500/90'
                        : 'bg-muted/60 text-muted-foreground/90',
                    )}
                  >
                    {truncateForDisplay(resultText)}
                  </pre>
                </div>
              )}
              {tool.error && (
                <div>
                  <div className="flex items-center gap-1">
                    <span className="font-medium text-red-500/80">{t('tools.error')}</span>
                    <CopyButton
                      text={tool.error}
                      aria-label={t('tools.copyError')}
                      data-testid={`tool-copy-error-${tool.id}`}
                    />
                  </div>
                  <pre className="mt-0.5 max-h-24 overflow-auto whitespace-pre-wrap break-all rounded-sm bg-red-500/10 p-1 font-mono text-[10px] text-red-500/90">
                    {tool.error}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
})

type ToolStatusFilter = 'all' | 'running' | 'success' | 'error'

const STATUS_FILTER_TKEY: Record<ToolStatusFilter, string> = {
  all: 'tools.filterAll',
  running: 'tools.filterRunning',
  success: 'tools.filterSuccess',
  error: 'tools.filterError',
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
 *
 * v10 Phase 4.1 memo + Phase 4.3 详情展开:
 * - React.memo 包装,tools 引用稳定时跳过重渲染
 * - ToolCallItem 子组件 memo 化,单个 tool 变化不影响其他 tool
 * - 点击工具行展开完整 args + result(CSS grid 动画)
 *
 * v11: 复制按钮 + 状态过滤
 */
export const ToolCallsSection = React.memo(function ToolCallsSection({
  tools,
}: ToolCallsSectionProps) {
  const t = useTranslations('ai.pane')
  // v9: 搜索过滤(hooks 必须在条件返回之前调用)
  const [searchQuery, setSearchQuery] = React.useState('')
  // v11: 状态过滤
  const [statusFilter, setStatusFilter] = React.useState<ToolStatusFilter>('all')

  const statusCounts = React.useMemo(() => {
    const counts = { all: tools.length, running: 0, success: 0, error: 0 }
    for (const tool of tools) {
      counts[tool.status]++
    }
    return counts
  }, [tools])

  const filteredTools = React.useMemo(() => {
    let result = tools
    if (statusFilter !== 'all') {
      result = result.filter((tool) => tool.status === statusFilter)
    }
    if (!searchQuery.trim()) return result
    const q = searchQuery.toLowerCase()
    return result.filter(
      (tool) =>
        tool.toolName.toLowerCase().includes(q) ||
        JSON.stringify(tool.args).toLowerCase().includes(q),
    )
  }, [tools, searchQuery, statusFilter])

  // v10: 分类计数 + 摘要用 useMemo 缓存(避免每次 render 重新计算)
  const { summary, recentTools } = React.useMemo(() => {
    if (tools.length === 0) return { summary: '', recentTools: [] }
    const categoryCounts: Record<ToolCategory, number> = {
      read: 0,
      search: 0,
      write: 0,
      exec: 0,
      other: 0,
    }
    for (const tool of tools) {
      categoryCounts[categorize(tool.toolName)]++
    }
    const summaryParts: string[] = []
    for (const cat of ['read', 'search', 'write', 'exec', 'other'] as const) {
      if (categoryCounts[cat] > 0) {
        summaryParts.push(`${t(CATEGORY_TKEY[cat])} ${categoryCounts[cat]}`)
      }
    }
    return {
      summary: summaryParts.join(' · '),
      recentTools: filteredTools.slice(-10),
    }
  }, [tools, filteredTools, t])

  if (tools.length === 0) return null

  const showStatusFilter = statusCounts.error > 0 || statusCounts.running > 0

  return (
    <FoldableSection
      title={t('tools.title')}
      count={tools.length}
      icon={Wrench}
      data-testid="tool-calls-section"
    >
      <div className="space-y-0.5 text-[11px] leading-relaxed">
        {summary && <div className="text-[10px] text-muted-foreground/60">{summary}</div>}
        {/* v11: 状态过滤 chips(有失败/运行中时显示) */}
        {showStatusFilter && (
          <div className="flex items-center gap-0.5" data-testid="tool-status-filter">
            {(['all', 'running', 'success', 'error'] as const).map((f) => {
              const count = statusCounts[f]
              if (f !== 'all' && count === 0) return null
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setStatusFilter(f)}
                  aria-pressed={statusFilter === f}
                  className={cn(
                    'rounded-sm px-1 py-0.5 text-[10px] transition-colors',
                    statusFilter === f
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground/60 hover:bg-accent/40 hover:text-foreground',
                  )}
                  data-testid={`tool-filter-${f}`}
                >
                  {t(STATUS_FILTER_TKEY[f])} {count}
                </button>
              )
            })}
          </div>
        )}
        {/* v9: 搜索框(工具数量>5时显示) */}
        {tools.length > 5 && (
          <div className="relative mb-1">
            <Search className="absolute left-1 top-1/2 h-2.5 w-2.5 -translate-y-1/2 text-muted-foreground/60" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('tools.searchPlaceholder')}
              className="w-full rounded-sm border border-border/60 bg-muted/50 py-0.5 pl-5 pr-2 text-[10px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/50"
              data-testid="tool-search-input"
            />
          </div>
        )}
        {recentTools.map((tool) => (
          <ToolCallItem key={tool.id} tool={tool} />
        ))}
        {filteredTools.length > 10 && (
          <div className="text-[10px] text-muted-foreground/60">
            {t('tools.moreItems', { n: filteredTools.length - 10 })}
          </div>
        )}
        {searchQuery && filteredTools.length === 0 && (
          <div className="text-[10px] text-muted-foreground/60">{t('tools.noMatch')}</div>
        )}
      </div>
    </FoldableSection>
  )
})

export default ToolCallsSection
