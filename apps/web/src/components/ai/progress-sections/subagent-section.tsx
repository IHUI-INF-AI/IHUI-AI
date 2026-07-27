'use client'

import * as React from 'react'
import { Users, Loader2, Check, X, AlertTriangle, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FoldableSection, formatDuration } from './foldable-section'
import { ToolCallItem } from './tool-calls-section'
import type { Subagent, SubagentStatus } from '@/hooks/use-agent-progress'
import { SUBAGENT_COLOR_CLASS } from '@/hooks/use-agent-progress'

interface SubagentSectionProps {
  subagents: Subagent[]
}

const SUBAGENT_STATUS_ICON: Record<SubagentStatus, React.ComponentType<{ className?: string }>> = {
  spawned: Loader2,
  running: Loader2,
  done: Check,
  failed: X,
  dead: AlertTriangle,
}
const SUBAGENT_STATUS_CLS: Record<SubagentStatus, string> = {
  spawned: 'text-primary',
  running: 'text-primary',
  done: 'text-emerald-500',
  failed: 'text-red-500',
  dead: 'text-amber-500',
}
const SUBAGENT_STATUS_LABEL: Record<SubagentStatus, string> = {
  spawned: '已派发',
  running: '运行中',
  done: '已完成',
  failed: '失败',
  dead: '已死亡',
}

/** 格式化 ISO 时间为本地短时间(HH:MM:SS) */
function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString('zh-CN', { hour12: false })
  } catch {
    return iso
  }
}

/**
 * SubagentItem — 单个 subagent 项(可点击展开详情)
 *
 * v10 Phase 5:
 * - 点击 subagent 行展开/折叠详情(role/spawnedAt/duration/token/tools)
 * - 若 subagent.tools 非空,展示嵌套工具调用列表(复用 ToolCallItem)
 * - CSS grid 平滑高度动画
 * - memo 化:单个 subagent 变化不影响其他 subagent
 */
const SubagentItem = React.memo(function SubagentItem({ sa }: { sa: Subagent }) {
  const [expanded, setExpanded] = React.useState(false)
  const Icon = SUBAGENT_STATUS_ICON[sa.status]
  const hasTools = sa.tools !== undefined && sa.tools.length > 0
  const hasDetail =
    sa.role !== undefined ||
    sa.pendingApproval !== undefined ||
    sa.durationMs !== undefined ||
    sa.tokenUsage !== undefined ||
    sa.toolCalls !== undefined ||
    hasTools

  const toggleExpand = () => {
    if (hasDetail) setExpanded((v) => !v)
  }

  return (
    <div className="rounded-sm transition-colors hover:bg-accent/20">
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
        data-testid={`subagent-item-${sa.id}`}
      >
        {hasDetail && (
          <ChevronRight
            className={cn(
              'h-2 w-2 shrink-0 text-muted-foreground/40 transition-transform duration-150',
              expanded && 'rotate-90',
            )}
          />
        )}
        {!hasDetail && <span className="w-2 shrink-0" />}
        <Icon
          className={cn(
            'h-2.5 w-2.5 shrink-0',
            SUBAGENT_STATUS_CLS[sa.status],
            (sa.status === 'spawned' || sa.status === 'running') && 'animate-spin',
          )}
        />
        <span
          className={cn(
            'shrink-0 font-medium font-mono text-[10px]',
            SUBAGENT_COLOR_CLASS[sa.color],
          )}
        >
          {sa.handle}
        </span>
        {sa.failureReason && (sa.status === 'failed' || sa.status === 'dead') ? (
          <span
            className="flex-1 break-all text-[10px] text-red-500/70"
            title={sa.failureReason}
          >
            {sa.failureReason}
          </span>
        ) : sa.currentTask ? (
          <span className="flex-1 break-all text-muted-foreground/70">{sa.currentTask}</span>
        ) : null}
        {sa.durationMs !== undefined &&
          sa.status !== 'running' &&
          sa.status !== 'spawned' && (
            <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/50">
              {formatDuration(sa.durationMs)}
            </span>
          )}
        {sa.toolCalls !== undefined && sa.toolCalls > 0 && (
          <span
            className="shrink-0 text-[10px] tabular-nums text-muted-foreground/40"
            title={`${sa.toolCalls} 次工具调用`}
          >
            {sa.toolCalls}次
          </span>
        )}
        {sa.tokenUsage !== undefined && sa.tokenUsage > 0 && (
          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/50">
            {Math.round(sa.tokenUsage / 1000)}k
          </span>
        )}
      </div>
      {/* 详情展开区:subagent 元信息 + 嵌套工具调用列表 */}
      {hasDetail && (
        <div
          className="grid transition-[grid-template-rows] duration-150 ease-out"
          style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
        >
          <div className="overflow-hidden">
            <div className="space-y-1 px-3 pb-1 pt-0.5 text-[10px] leading-relaxed">
              {/* 元信息行 */}
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground/70">
                <span>
                  状态:<span className={SUBAGENT_STATUS_CLS[sa.status]}>{SUBAGENT_STATUS_LABEL[sa.status]}</span>
                </span>
                {sa.role && <span>角色:<span className="font-mono">{sa.role}</span></span>}
                {sa.pendingApproval && (
                  <span className="text-amber-500">待审批</span>
                )}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground/50">
                {sa.spawnedAt && <span>启动:{formatTime(sa.spawnedAt)}</span>}
                {sa.endedAt && <span>结束:{formatTime(sa.endedAt)}</span>}
                {sa.durationMs !== undefined && sa.status !== 'running' && (
                  <span>耗时:{formatDuration(sa.durationMs)}</span>
                )}
              </div>
              {sa.threadId && (
                <div className="break-all text-muted-foreground/40">
                  <span className="font-mono">threadId: {sa.threadId}</span>
                </div>
              )}
              {/* 嵌套工具调用列表 */}
              {hasTools && (
                <div className="mt-1 space-y-0.5">
                  <div className="font-medium text-muted-foreground/60">
                    工具调用({sa.tools!.length})
                  </div>
                  {sa.tools!.map((tool) => (
                    <ToolCallItem key={tool.id} tool={tool} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
})

/**
 * SubagentSection — Subagent 派单折叠子区
 *
 * 对齐 Trae Work Subagent 展示:
 * - 标题带 Users 图标
 * - @handle 彩色标签 + 状态 SVG 图标 + 当前任务 + 耗时 + token 消耗
 *
 * v10 Phase 5 嵌套展示:
 * - 每个 subagent 项可点击展开详情(role/time/threadId/tools)
 * - 若 subagent.tools 非空,展示嵌套工具调用列表(复用 ToolCallItem)
 * - React.memo 包装,subagents 引用稳定时跳过重渲染
 */
export const SubagentSection = React.memo(function SubagentSection({
  subagents,
}: SubagentSectionProps) {
  // v10: 摘要统计(活跃/死亡/失败)— useMemo 必须在 early return 之前
  const summary = React.useMemo(() => {
    if (subagents.length === 0) return ''
    const active = subagents.filter(
      (s) => s.status === 'running' || s.status === 'spawned',
    ).length
    const done = subagents.filter((s) => s.status === 'done').length
    const failed = subagents.filter((s) => s.status === 'failed' || s.status === 'dead').length
    const parts: string[] = []
    if (active > 0) parts.push(`${active} 活跃`)
    if (done > 0) parts.push(`${done} 完成`)
    if (failed > 0) parts.push(`${failed} 失败`)
    return parts.join(' · ')
  }, [subagents])

  if (subagents.length === 0) return null

  return (
    <FoldableSection
      title="Subagent 派单"
      count={subagents.length}
      icon={Users}
      data-testid="subagent-section"
    >
      <div className="space-y-0.5 text-[11px] leading-relaxed">
        {summary && <div className="text-[10px] text-muted-foreground/60">{summary}</div>}
        {subagents.map((sa) => (
          <SubagentItem key={sa.id} sa={sa} />
        ))}
      </div>
    </FoldableSection>
  )
})

export default SubagentSection
