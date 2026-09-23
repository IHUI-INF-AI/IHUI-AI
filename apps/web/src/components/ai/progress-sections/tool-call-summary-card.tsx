// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { FileSearch, Globe, FilePen, Plus, Minus, Wrench, Clock } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/feedback'
import { FoldableSection, formatDuration } from './foldable-section'
import { ShowMoreList } from './show-more-list'
import { toolDisplayKey } from '@ihui/shared/chat'
import { useAnalytics } from '@/hooks/use-analytics'
import {
  aggregateCategoryRuns,
  summarizeCategoriesByTool,
  type CategoryRun,
} from '@/components/chat/message-list/fold-policy'
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
   *  - status 可选:运行时携带工具状态(running/success/failed),用于 fingerprint
   *  - durationMs 可选:本地聚合总耗时(W11 起与后端 totalDurationMs 口径一致) */
  toolCalls?: Array<{
    toolName: string
    args?: Record<string, unknown>
    status?: string
    durationMs?: number
  }>
  /** 是否流式中(流式时折叠态显示 "统计中..." 提示,完成后显示数字) */
  isStreaming?: boolean
  'data-testid'?: string
}

// ─── 工具名分类常量(与后端 ai-service/app/routers/llm.py 的 _build_tool_summary 对齐) ──

const FILE_SEARCH_TOOLS = new Set(['read_file', 'search_codebase', 'file_search', 'list_dir'])
const WEB_SEARCH_TOOLS = new Set(['web_search', 'search_web', 'fetch_url'])
// edit_file/file_edit 双写:后端 llm.py 用 file_edit,前端历史用 edit_file,取并集对齐
const FILE_MODIFY_TOOLS = new Set([
  'edit_file',
  'file_edit',
  'write_file',
  'create_file',
  'delete_file',
])

// ─── 本地聚合降级实现(后端未发 tool-summary 时使用) ──

/**
 * 按 Python str.splitlines() 口径切分行(W11 修复:对齐后端 llm.py 的算法,
 * 覆盖 \r\n / \r / \n / \v / \f / \u0085 / \u2028 / \u2029,并去除末尾空行)
 */
function pySplitLines(s: string): string[] {
  const parts = s.split(/\r\n|\r|\n|\u000B|\u000C|\u0085|\u2028|\u2029/)
  if (parts.length > 0 && parts[parts.length - 1] === '') parts.pop()
  return parts
}

/**
 * 从单个 tool_call 的 args 提取新增行数(W11 修复:原降级路径恒写 0,
 * 现复刻后端 ai-service/app/routers/llm.py calculate_added_lines 的口径):
 * - diff 字符串:统计以 + 开头但非 +++ 的行(unified diff added 行)
 * - content 字符串:整体写入,全部算 added(write_file)
 * - new_string 字符串:统计行数(file_edit)
 */
function calculateAddedLines(args: Record<string, unknown> | undefined): number {
  if (!args) return 0
  const diff = args['diff']
  if (typeof diff === 'string' && diff) {
    return pySplitLines(diff).filter((l) => l.startsWith('+') && !l.startsWith('+++')).length
  }
  const content = args['content']
  if (typeof content === 'string' && content) return pySplitLines(content).length
  const newString = args['new_string']
  if (typeof newString === 'string' && newString) return pySplitLines(newString).length
  return 0
}

/**
 * 从单个 tool_call 的 args 提取删除行数(复刻后端 calculate_deleted_lines 口径):
 * - diff 字符串:统计以 - 开头但非 --- 的行(unified diff deleted 行)
 * - old_string 字符串:统计行数(file_edit)
 * - content 整体写入无删除 → 0
 */
function calculateDeletedLines(args: Record<string, unknown> | undefined): number {
  if (!args) return 0
  const diff = args['diff']
  if (typeof diff === 'string' && diff) {
    return pySplitLines(diff).filter((l) => l.startsWith('-') && !l.startsWith('---')).length
  }
  const oldString = args['old_string']
  if (typeof oldString === 'string' && oldString) return pySplitLines(oldString).length
  return 0
}

function deriveToolSummary(
  toolCalls: Array<{
    toolName: string
    args?: Record<string, unknown>
    status?: string
    durationMs?: number
  }>,
): ToolCallSummary {
  const toolsByCategory: Record<string, number> = {}
  let filesSearched = 0
  let webSearched = 0
  const modifiedFiles = new Set<string>()
  let linesAdded = 0
  let linesDeleted = 0
  let totalDurationMs = 0

  for (const tc of toolCalls) {
    const name = tc.toolName
    toolsByCategory[name] = (toolsByCategory[name] ?? 0) + 1
    if (FILE_SEARCH_TOOLS.has(name)) filesSearched++
    if (WEB_SEARCH_TOOLS.has(name)) webSearched++
    if (FILE_MODIFY_TOOLS.has(name)) {
      const fp = tc.args?.['file_path'] ?? tc.args?.['path']
      if (typeof fp === 'string' && fp) modifiedFiles.add(fp)
      linesAdded += calculateAddedLines(tc.args)
      linesDeleted += calculateDeletedLines(tc.args)
    }
    totalDurationMs += tc.durationMs ?? 0
  }

  return {
    filesSearched,
    webSearched,
    filesModified: modifiedFiles.size,
    linesAdded,
    linesDeleted,
    toolsByCategory,
    totalCalls: toolCalls.length,
    totalDurationMs: totalDurationMs > 0 ? totalDurationMs : undefined,
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
          'inline-flex h-4 min-w-4 shrink-0 items-center gap-1 rounded-sm bg-muted/50 px-1 text-[11px] leading-none tabular-nums text-muted-foreground',
          colorClass,
        )}
        aria-label={label}
        data-testid={testId}
      >
        <Icon className="h-3 w-3" aria-hidden />
        <span className="font-medium">{value}</span>
      </span>
    </Tooltip>
  )
}

/**
 * ToolCallSummaryCard — 工具调用汇总卡片
 *
 * inline 到 AI 回复末尾,显示本轮工具调用统计:
 * - 折叠态:一行 chip 展示 5 项核心统计(文件搜索 / 网页搜索 / 文件修改 / +行 / -行 / 耗时)
 * - 展开态:完整 6 项 + 工具分类列表(toolsByCategory 按调用次数排序)
 */
// ─── D58 类目卡(单个类目 → 一张折叠卡,含折叠点击埋点) ──

type TFn = (key: string, values?: Record<string, string | number>) => string

interface CategoryCardProps {
  run: CategoryRun
  t: TFn
  tStatus: TFn
  toolDisplayKeyFn: (toolName: string) => string | null
}

/**
 * CategoryCard — D58 单个类目卡。
 * 沿用既有 FoldableSection(不新建折叠组件),仅在其 onOpenChange 上补折叠点击埋点:
 *   cardType / group_key / children_count 三字段,经既有 useAnalytics 通道上报。
 * 受控展开态由本组件内部 state 维护,用户显式展开/收起即更新,不被任何自动策略覆盖(D21 规则①)。
 */
function CategoryCard({ run, t, tStatus, toolDisplayKeyFn }: CategoryCardProps) {
  const { track } = useAnalytics()
  const [open, setOpen] = React.useState(run.expandStrategy === 'expand')

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    // 折叠点击埋点(D58 验收):cardType / group_key / children_count,复用既有通道
    track({
      name: 'tool_category_toggle',
      category: 'ai',
      label: run.categoryKey,
      props: {
        cardType: 'tool_category',
        group_key: run.categoryKey,
        children_count: run.totalCount,
      },
    })
  }

  // 词包键缺失时(主会话统一入库前)回退到类目键,避免 next-intl 抛错中断渲染
  let title: string
  try {
    title = t(run.labelKey)
  } catch {
    title = run.categoryKey
  }

  return (
    <FoldableSection
      title={title}
      count={run.countable ? run.totalCount : undefined}
      open={open}
      onOpenChange={handleOpenChange}
      defaultOpen={run.expandStrategy === 'expand'}
      data-testid={`tool-call-category-${run.categoryKey}`}
    >
      <div className="space-y-0.5 rounded-sm bg-muted/15 px-2 py-0.5 text-[11px]">
        {run.tools.map((tool, i) => {
          const dk = toolDisplayKeyFn(tool.toolName)
          return (
            <div
              key={`${tool.toolName}-${i}`}
              className="flex items-center justify-between gap-2 text-muted-foreground/70"
            >
              <span className="truncate">{dk ? tStatus(dk) : tool.toolName}</span>
              {tool.count > 1 && (
                <span className="shrink-0 tabular-nums text-muted-foreground/60">×{tool.count}</span>
              )}
            </div>
          )
        })}
      </div>
    </FoldableSection>
  )
}

export const ToolCallSummaryCard = React.memo(function ToolCallSummaryCard({
  summary,
  toolCalls,
  isStreaming = false,
  'data-testid': testId,
}: ToolCallSummaryCardProps) {
  const t = useTranslations('ai.pane')
  const tStatus = useTranslations('taskStatus')

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

  // D58 工具类目聚合层(2026-09-23 · G-71/G-72):
  // 把工具调用按"类目"聚合(同类连续步骤合并成一张卡)。
  //  1. 优先用有序 toolCalls:保留时序,实现"同类连续 → 一卡 / 被中断 → 断卡"
  //  2. 仅在有聚合计数(toolsByCategory)而无 toolCalls 时,退化为每类目单一 run
  //     (无顺序信息,无法做连续判断)。
  // 必须无条件调用(Hook 规则);effectiveSummary 为 null 时返回空数组。
  const categoryRuns = React.useMemo<CategoryRun[]>(() => {
    if (toolCalls && toolCalls.length > 0) {
      return aggregateCategoryRuns(toolCalls.map((tc) => ({ toolName: tc.toolName, count: 1 })))
    }
    if (effectiveSummary?.toolsByCategory) {
      return summarizeCategoriesByTool(effectiveSummary.toolsByCategory)
    }
    return []
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 有意基于 effectiveSummary / fingerprint 比较
  }, [effectiveSummary, toolCallsFingerprint])

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
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/60">
            <Clock className="h-2.5 w-2.5 animate-pulse" aria-hidden />
            {t('toolSummaryStreaming')}
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
      label: t('toolSummaryFilesSearched'),
      colorClass: 'text-blue-500/80',
    },
    {
      key: 'webSearched',
      Icon: Globe,
      value: effectiveSummary.webSearched,
      label: t('toolSummaryWebSearched'),
      colorClass: 'text-cyan-500/80',
    },
    {
      key: 'filesModified',
      Icon: FilePen,
      value: effectiveSummary.filesModified,
      label: t('toolSummaryFilesModified'),
      colorClass: 'text-amber-500/80',
    },
    {
      key: 'linesAdded',
      Icon: Plus,
      value: effectiveSummary.linesAdded,
      label: t('toolSummaryLinesAdded'),
      colorClass: 'text-emerald-500/80',
    },
    {
      key: 'linesDeleted',
      Icon: Minus,
      value: effectiveSummary.linesDeleted,
      label: t('toolSummaryLinesDeleted'),
      colorClass: 'text-rose-500/80',
    },
  ]

  const visibleChips = chips.filter((c) => c.value > 0)
  // 折叠态摘要文本(2-3 项最关键的统计)
  const summaryText = visibleChips
    .slice(0, 3)
    .map((c) => `${c.label} ${c.value}`)
    .join(' · ')

  const title = t('toolSummaryTitle')
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
              <Tooltip content={t('toolSummaryDuration')}>
                <span
                  className="inline-flex shrink-0 items-center gap-0.5 rounded-sm bg-muted/50 px-1 py-0.5 text-[11px] tabular-nums text-muted-foreground/70"
                  aria-label={t('toolSummaryDuration')}
                  data-testid="tool-call-summary-chip-duration"
                >
                  <Clock className="h-3 w-3" aria-hidden />
                  <span className="font-medium">
                    {formatDuration(effectiveSummary.totalDurationMs)}
                  </span>
                </span>
              </Tooltip>
            )}
        </div>

        {/* D58 类目聚合层:按类目分组渲染(同类连续步骤聚合成一张卡) */}
        {categoryRuns.length > 0 && (
          <div className="space-y-1" data-testid="tool-call-summary-categories">
            <ShowMoreList
              items={categoryRuns}
              initialCount={6}
              testId="tool-call-summary-category-list"
              moreLabel={t('toolSummaryShowMore')}
              lessLabel={t('toolSummaryShowLess')}
              renderItem={(run) => (
                <CategoryCard
                  key={run.categoryKey}
                  run={run}
                  t={t}
                  tStatus={tStatus}
                  toolDisplayKeyFn={toolDisplayKey}
                />
              )}
            />
          </div>
        )}

        {/* 总览(展开态显示) */}
        <div
          className="flex items-center gap-3 text-[11px] text-muted-foreground/60"
          data-testid="tool-call-summary-overview"
        >
          <span>
            {t('toolSummaryTotalCalls')}: {effectiveSummary.totalCalls}
          </span>
          {effectiveSummary.totalDurationMs !== undefined &&
            effectiveSummary.totalDurationMs > 0 && (
              <span>
                {t('toolSummaryDuration')}: {formatDuration(effectiveSummary.totalDurationMs)}
              </span>
            )}
        </div>
      </div>
    </FoldableSection>
  )
})

export default ToolCallSummaryCard
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
