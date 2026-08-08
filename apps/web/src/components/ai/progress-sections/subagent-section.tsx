'use client'

import * as React from 'react'
import { Users, Loader2, Check, X, AlertTriangle, ChevronRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/feedback'
import { FoldableSection, formatDuration, formatRelativeTime } from './foldable-section'
import { CopyButton } from './copy-button'
import { ToolCallItem } from './tool-calls-section'
import type { Subagent, SubagentStatus } from '@/hooks/use-agent-progress'
import { SUBAGENT_COLOR_CLASS } from '@/hooks/use-agent-progress'
import { formatDateByTemplate } from '@ihui/shared'

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
const SUBAGENT_STATUS_TKEY: Record<SubagentStatus, string> = {
  spawned: 'subagent.statusSpawned',
  running: 'subagent.statusRunning',
  done: 'subagent.statusDone',
  failed: 'subagent.statusFailed',
  dead: 'subagent.statusDead',
}

/** 格式化 ISO 时间为本地短时间(HH:MM:SS) */
function formatTime(iso: string): string {
  return formatDateByTemplate(iso, 'HH:mm:ss') || iso
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
  const t = useTranslations('ai.pane')
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
        data-testid={`subagent-item-${sa.id}`}
        data-status={sa.status}
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
            className="flex-1 break-all text-[10px] text-red-500/80"
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
            <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/70">
              {formatDuration(sa.durationMs)}
            </span>
          )}
        {sa.toolCalls !== undefined && sa.toolCalls > 0 && (
          <span
            className="shrink-0 text-[10px] tabular-nums text-muted-foreground/60"
            title={t('subagent.toolCallsTitle', { n: sa.toolCalls })}
          >
            {t('subagent.toolCallsCount', { n: sa.toolCalls })}
          </span>
        )}
        {sa.tokenUsage !== undefined && sa.tokenUsage > 0 && (
          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/70">
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
                  {t('subagent.state')}<span className={SUBAGENT_STATUS_CLS[sa.status]}>{t(SUBAGENT_STATUS_TKEY[sa.status])}</span>
                </span>
                {sa.role && <span>{t('subagent.role')}<span className="font-mono">{sa.role}</span></span>}
                {sa.pendingApproval && (
                  <span className="text-amber-500">{t('subagent.pendingApproval')}</span>
                )}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground/70">
                        {sa.spawnedAt && (
                          <Tooltip content={formatTime(sa.spawnedAt)}>
                            <span>
                              {t('subagent.startedAt')}{formatTime(sa.spawnedAt)} ({formatRelativeTime(sa.spawnedAt, t)})
                            </span>
                          </Tooltip>
                        )}
                        {sa.endedAt && (
                          <Tooltip content={formatTime(sa.endedAt)}>
                            <span>
                              {t('subagent.endedAt')}{formatTime(sa.endedAt)} ({formatRelativeTime(sa.endedAt, t)})
                            </span>
                          </Tooltip>
                        )}
                        {sa.durationMs !== undefined && sa.status !== 'running' && (
                          <span>{t('subagent.duration')}{formatDuration(sa.durationMs)}</span>
                        )}
                      </div>
              {sa.threadId && (
                <div className="flex items-center gap-1 break-all text-muted-foreground/60">
                  <span className="font-mono">threadId: {sa.threadId}</span>
                  <CopyButton
                    text={sa.threadId}
                    aria-label={t('subagent.copyThreadId')}
                    data-testid={`subagent-copy-thread-${sa.id}`}
                  />
                </div>
              )}
              {/* 嵌套工具调用列表 */}
              {hasTools && (
                <div className="mt-1 space-y-0.5">
                  <div className="font-medium text-muted-foreground/60">
                    {t('subagent.toolsCount', { n: sa.tools!.length })}
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
  const t = useTranslations('ai.pane')
  // v10: 摘要统计(活跃/死亡/失败)— useMemo 必须在 early return 之前
  const summary = React.useMemo(() => {
    if (subagents.length === 0) return ''
    const active = subagents.filter(
      (s) => s.status === 'running' || s.status === 'spawned',
    ).length
    const done = subagents.filter((s) => s.status === 'done').length
    const failed = subagents.filter((s) => s.status === 'failed' || s.status === 'dead').length
    const parts: string[] = []
    if (active > 0) parts.push(t('subagent.active', { n: active }))
    if (done > 0) parts.push(t('subagent.done', { n: done }))
    if (failed > 0) parts.push(t('subagent.failed', { n: failed }))
    return parts.join(' · ')
  }, [subagents, t])

  if (subagents.length === 0) return null

  return (
    <FoldableSection
      title={t('subagent.title')}
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
