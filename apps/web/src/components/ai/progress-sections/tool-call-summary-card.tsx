'use client'

import * as React from 'react'
import { FileSearch, Globe, FilePen, Plus, Minus, Wrench, Clock } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/feedback'
import { FoldableSection, formatDuration } from './foldable-section'
import type { ToolCallSummary } from '@ihui/types/ai'

/**
 * ToolCallSummaryCard — 工具调用汇总卡片(2026-07-31 立,AI 对话可视化深度接入)
 *
 * 用户痛点:"工具调用状态、搜索文件几个、搜索网页几个、改了多少代码、改了几个文件这种都要有提示显示"
 *
 * 数据来源:
 * - 优先用 SSE tool-summary 事件聚合结果(message.toolCallSummary,后端聚合)
 * - 缺失时降级从前端 toolCalls 数组本地聚合(deriveToolSummary)
 *
 * UI 设计:
 * - 折叠态:在消息气泡底部显示一行统计 chip(🔍 N / 🌐 N / ✏️ N / +N -N / ⏱ 1.2s)
 * - 展开态:完整 6 项统计 + 工具分类列表(toolsByCategory)
 * - inline 到 AI 回复末尾(不依赖 popover,提升信息可见性)
 */
interface ToolCallSummaryCardProps {
  /** SSE tool-summary 事件聚合结果(message.toolCallSummary)
   *  缺失时,可选传入 toolCalls 数组本地聚合 */
  summary?: ToolCallSummary
  /** 本地 toolCalls 数组(后端未发 tool-summary 时降级聚合)
   *  - 优先级低于 summary prop(summary 非空时直接用)
   *  - 仅当 summary 为 undefined 时才用本地聚合
   *  - status 可选:运行时携带工具状态(running/success/failed),用于 fingerprint */
  toolCalls?: Array<{ toolName: string; args?: Record<string, unknown>; status?: string }>
  /** 是否流式中(流式时折叠态显示 "统计中..." 提示,完成后显示数字) */
  isStreaming?: boolean
  'data-testid'?: string
}

// ─── 工具名分类常量(与后端 ai-service/app/routers/llm.py 的 _build_tool_summary 对齐) ──

const FILE_SEARCH_TOOLS = new Set(['read_file', 'search_codebase', 'file_search', 'list_dir'])
const WEB_SEARCH_TOOLS = new Set(['web_search', 'search_web', 'fetch_url'])
const FILE_MODIFY_TOOLS = new Set(['edit_file', 'write_file', 'create_file', 'delete_file'])

// ─── 本地聚合降级实现(后端未发 tool-summary 时使用) ──

function deriveToolSummary(
  toolCalls: Array<{ toolName: string; args?: Record<string, unknown>; status?: string }>,
): ToolCallSummary {
  const toolsByCategory: Record<string, number> = {}
  let filesSearched = 0
  let webSearched = 0
  const modifiedFiles = new Set<string>()

  for (const tc of toolCalls) {
    const name = tc.toolName
    toolsByCategory[name] = (toolsByCategory[name] ?? 0) + 1
    if (FILE_SEARCH_TOOLS.has(name)) filesSearched++
    if (WEB_SEARCH_TOOLS.has(name)) webSearched++
    if (FILE_MODIFY_TOOLS.has(name)) {
      const fp = tc.args?.file_path ?? tc.args?.path
      if (typeof fp === 'string') modifiedFiles.add(fp)
    }
  }

  return {
    filesSearched,
    webSearched,
    filesModified: modifiedFiles.size,
    linesAdded: 0, // 本地聚合无法准确计算行数,留 0(后端聚合才有)
    linesDeleted: 0,
    toolsByCategory,
    totalCalls: toolCalls.length,
    totalDurationMs: undefined,
  }
}

// ─── 统计项 chip 配置 ──

interface StatChipConfig {
  key: string
  Icon: React.ComponentType<{ className?: string }>
  value: number
  label: string
  /** 值为 0 时是否隐藏(默认隐藏,避免无意义展示) */
  hideOnZero?: boolean
  /** 颜色样式 */
  colorClass?: string
}

/** 单个统计 chip(折叠态一行显示) */
function StatChip({
  Icon,
  value,
  label,
  hideOnZero = true,
  colorClass,
  testId,
}: {
  Icon: React.ComponentType<{ className?: string }>
  value: number
  label: string
  hideOnZero?: boolean
  colorClass?: string
  testId: string
}) {
  if (hideOnZero && value === 0) return null
  return (
    <Tooltip content={label}>
      <span
        className={cn(
          'inline-flex shrink-0 items-center gap-0.5 rounded-sm bg-muted/50 px-1 py-0.5 text-[9px] tabular-nums text-muted-foreground/70',
          colorClass,
        )}
        aria-label={label}
        data-testid={testId}
      >
        <Icon className="h-2 w-2" aria-hidden />
        <span className="font-medium">{value}</span>
      </span>
    </Tooltip>
  )
}

// ─── i18n 动态 key 包装(与 timeline-tab.tsx 一致,允许新 key 缺失时回退) ──

const warnedSummaryKeys = new Set<string>()
type LooseTranslator = (key: string, values?: Record<string, unknown>) => string

function safeT(
  t: ReturnType<typeof useTranslations<'ai.pane'>>,
  key: string,
  fallback: string,
  values?: Record<string, unknown>,
): string {
  const looseT = t as unknown as LooseTranslator
  try {
    const v = looseT(key, values)
    if (v === key || !v) {
      if (!warnedSummaryKeys.has(key)) {
        warnedSummaryKeys.add(key)
        console.warn(
          `[tool-call-summary-card] i18n key 'ai.pane.${key}' missing, using fallback: "${fallback}"`,
        )
      }
      return fallback
    }
    return v
  } catch {
    return fallback
  }
}

/**
 * ToolCallSummaryCard — 工具调用汇总卡片
 *
 * inline 到 AI 回复末尾,显示本轮工具调用统计:
 * - 折叠态:一行 chip 展示 5 项核心统计(文件搜索 / 网页搜索 / 文件修改 / +行 / -行 / 耗时)
 * - 展开态:完整 6 项 + 工具分类列表(toolsByCategory 按调用次数排序)
 */
export const ToolCallSummaryCard = React.memo(function ToolCallSummaryCard({
  summary,
  toolCalls,
  isStreaming = false,
  'data-testid': testId,
}: ToolCallSummaryCardProps) {
  const t = useTranslations('ai.pane')

  // toolCalls fingerprint:基于内容(toolName + status)生成稳定字符串。
  // 父级每次 setMessages 会创建新数组引用(即使内容相同),直接依赖 toolCalls 引用
  // 会导致 useMemo 失效 & deriveToolSummary 在每个 token 上重算。改用 fingerprint 比较。
  const toolCallsFingerprint = React.useMemo(() => {
    if (!toolCalls || toolCalls.length === 0) return ''
    return toolCalls.map((tc) => `${tc.toolName}:${tc.status ?? ''}`).join('|')
  }, [toolCalls])

  // 优先用 summary prop,缺失时降级本地聚合。
  // 依赖 fingerprint 而非 toolCalls 引用:内容不变则跳过重算。
  const effectiveSummary = React.useMemo<ToolCallSummary | null>(() => {
    if (summary) return summary
    if (toolCalls && toolCalls.length > 0) return deriveToolSummary(toolCalls)
    return null
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 有意基于 fingerprint 比较,避免引用变化触发重算
  }, [summary, toolCallsFingerprint])

  // 工具分类列表(按调用次数降序)。必须无条件调用(Hook 规则),用可选链防御
  // effectiveSummary 为 null —— 该 useMemo 原位置在所有条件 return 之后,违反
  // rules-of-hooks(2026-08-06 修复)。
  const categoryEntries = React.useMemo(
    () =>
      Object.entries(effectiveSummary?.toolsByCategory ?? {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12), // 最多展示 12 项,避免过长
    [effectiveSummary],
  )

  // 流式中且无 summary 时,不渲染卡片(等首个 summary 到达再显示)
  if (!effectiveSummary) {
    if (isStreaming && toolCalls && toolCalls.length > 0) {
      // 流式中已有 toolCalls 但未到 summary 阶段:显示轻量"统计中..."提示
      return (
        <div
          className="mx-1.5 mt-1.5 rounded-sm border border-border/30 bg-muted/15 px-2 py-0.5"
          data-testid={testId ?? 'tool-call-summary-card'}
          data-state="streaming"
        >
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/60">
            <Clock className="h-2.5 w-2.5 animate-pulse" aria-hidden />
            {safeT(t, 'toolSummaryStreaming', '统计工具调用中…')}
          </span>
        </div>
      )
    }
    return null
  }

  // 完全没有工具调用,不渲染卡片(避免无意义展示)
  if (effectiveSummary.totalCalls === 0) return null

  // 折叠态 summary 文本(供 FoldableSection 显示)
  const chips: StatChipConfig[] = [
    {
      key: 'filesSearched',
      Icon: FileSearch,
      value: effectiveSummary.filesSearched,
      label: safeT(t, 'toolSummaryFilesSearched', '搜索文件'),
      colorClass: 'text-blue-500/80',
    },
    {
      key: 'webSearched',
      Icon: Globe,
      value: effectiveSummary.webSearched,
      label: safeT(t, 'toolSummaryWebSearched', '搜索网页'),
      colorClass: 'text-cyan-500/80',
    },
    {
      key: 'filesModified',
      Icon: FilePen,
      value: effectiveSummary.filesModified,
      label: safeT(t, 'toolSummaryFilesModified', '修改文件'),
      colorClass: 'text-amber-500/80',
    },
    {
      key: 'linesAdded',
      Icon: Plus,
      value: effectiveSummary.linesAdded,
      label: safeT(t, 'toolSummaryLinesAdded', '新增行数'),
      colorClass: 'text-emerald-500/80',
    },
    {
      key: 'linesDeleted',
      Icon: Minus,
      value: effectiveSummary.linesDeleted,
      label: safeT(t, 'toolSummaryLinesDeleted', '删除行数'),
      colorClass: 'text-rose-500/80',
    },
  ]

  const visibleChips = chips.filter((c) => c.value > 0)
  // 折叠态摘要文本(2-3 项最关键的统计)
  const summaryText = visibleChips
    .slice(0, 3)
    .map((c) => `${c.label} ${c.value}`)
    .join(' · ')

  const title = safeT(t, 'toolSummaryTitle', '工具调用汇总')
  const allChipsHidden = visibleChips.length === 0 && !effectiveSummary.totalDurationMs

  // 全部统计为 0 + 无耗时 → 不渲染卡片
  if (allChipsHidden) return null

  return (
    <FoldableSection
      title={title}
      count={effectiveSummary.totalCalls}
      icon={Wrench}
      summary={summaryText || undefined}
      defaultOpen={false}
      data-testid={testId ?? 'tool-call-summary-card'}
    >
      <div className="space-y-1.5 px-2 pb-1.5 pt-1" data-state={isStreaming ? 'streaming' : 'done'}>
        {/* 折叠态 chip 行(展开态隐藏,避免重复) */}
        <div className="flex flex-wrap items-center gap-1" data-testid="tool-call-summary-chips">
          {visibleChips.map((c) => {
            const Icon = c.Icon
            return (
              <StatChip
                key={c.key}
                Icon={Icon}
                value={c.value}
                label={c.label}
                colorClass={c.colorClass}
                testId={`tool-call-summary-chip-${c.key}`}
              />
            )
          })}
          {effectiveSummary.totalDurationMs !== undefined &&
            effectiveSummary.totalDurationMs > 0 && (
              <Tooltip content={safeT(t, 'toolSummaryDuration', '总耗时')}>
                <span
                  className="inline-flex shrink-0 items-center gap-0.5 rounded-sm bg-muted/50 px-1 py-0.5 text-[9px] tabular-nums text-muted-foreground/70"
                  aria-label={safeT(t, 'toolSummaryDuration', '总耗时')}
                  data-testid="tool-call-summary-chip-duration"
                >
                  <Clock className="h-2 w-2" aria-hidden />
                  <span className="font-medium">
                    {formatDuration(effectiveSummary.totalDurationMs)}
                  </span>
                </span>
              </Tooltip>
            )}
        </div>

        {/* 工具分类列表(展开态显示) */}
        {categoryEntries.length > 0 && (
          <div
            className="grid grid-cols-2 gap-x-3 gap-y-0.5 rounded-sm bg-muted/20 px-2 py-0.5 text-[9px]"
            data-testid="tool-call-summary-categories"
          >
            {categoryEntries.map(([name, count]) => (
              <div
                key={name}
                className="flex items-center justify-between gap-2 text-muted-foreground/70"
              >
                <span className="truncate font-mono">{name}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground/60">×{count}</span>
              </div>
            ))}
          </div>
        )}

        {/* 总览(展开态显示) */}
        <div
          className="flex items-center gap-3 text-[9px] text-muted-foreground/60"
          data-testid="tool-call-summary-overview"
        >
          <span>
            {safeT(t, 'toolSummaryTotalCalls', '总调用')}: {effectiveSummary.totalCalls}
          </span>
          {effectiveSummary.totalDurationMs !== undefined &&
            effectiveSummary.totalDurationMs > 0 && (
              <span>
                {safeT(t, 'toolSummaryDuration', '总耗时')}:{' '}
                {formatDuration(effectiveSummary.totalDurationMs)}
              </span>
            )}
        </div>
      </div>
    </FoldableSection>
  )
})

export default ToolCallSummaryCard
