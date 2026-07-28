'use client'

import * as React from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FoldableSectionProps {
  title: string
  count?: number
  /** v15: 已完成数量(0-count),用于显示完成度小条 + "3/8" 格式 */
  doneCount?: number
  defaultOpen?: boolean
  children: React.ReactNode
  icon?: React.ComponentType<{ className?: string }>
  'data-testid'?: string
  /** v11: 可访问性 — section 标题用于 aria-label */
  'aria-label'?: string
}

/** FoldableSection context:支持"展开全部/折叠全部"批量控制 */
interface FoldableSectionContextValue {
  /** null=各子区独立控制 / true=强制展开 / false=强制折叠 */
  expandAll: boolean | null
  setExpandAll: (v: boolean | null) => void
}

const FoldableSectionContext = React.createContext<FoldableSectionContextValue | null>(null)

/** Provider:在父组件包裹所有 FoldableSection,提供批量展开/折叠控制 */
export function FoldableSectionProvider({
  children,
  value,
}: {
  children: React.ReactNode
  value: FoldableSectionContextValue
}) {
  return <FoldableSectionContext.Provider value={value}>{children}</FoldableSectionContext.Provider>
}

/** 格式化毫秒为紧凑耗时字符串 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  const min = Math.floor(ms / 60_000)
  const sec = Math.floor((ms % 60_000) / 1000)
  return `${min}m${sec}s`
}

/** 格式化秒数为短时长(v15 实时计时器)— 紧凑 "12s" / "1m23s" / "1h05m" */
export function formatElapsed(totalSec: number): string {
  if (totalSec < 60) return `${totalSec.toFixed(0)}s`
  if (totalSec < 3600) {
    const m = Math.floor(totalSec / 60)
    const s = totalSec % 60
    return s > 0 ? `${m}m${s.toString().padStart(2, '0')}s` : `${m}m`
  }
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  return `${h}h${m.toString().padStart(2, '0')}m`
}

/** 格式化 ISO 时间戳为相对时间字符串(刚刚 / 5s前 / 2m前 / 1h前)v11 */
export function formatRelativeTime(
  timestamp: string,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  const ms = Date.parse(timestamp)
  if (Number.isNaN(ms)) return ''
  const diff = Date.now() - ms
  if (diff < 0) return t('relativeTime.justNow')
  if (diff < 10_000) return t('relativeTime.justNow')
  if (diff < 60_000) return t('relativeTime.secondsAgo', { n: Math.floor(diff / 1000) })
  if (diff < 3_600_000) return t('relativeTime.minutesAgo', { n: Math.floor(diff / 60_000) })
  if (diff < 86_400_000) return t('relativeTime.hoursAgo', { n: Math.floor(diff / 3_600_000) })
  return t('relativeTime.daysAgo', { n: Math.floor(diff / 86_400_000) })
}

/**
 * FoldableSection — 共享折叠子区包装器(对齐 Trae Work)
 *
 * 特征:
 * - SVG chevron 图标(ChevronRight,展开时 rotate-90)
 * - 可选标题图标(通过 icon prop 传入 lucide-react 组件)
 * - 计数徽章(右对齐,tabular-nums)
 * - 平滑背景色 hover 反馈
 * - rounded-sm bg-muted/30 容器,无分割线
 *
 * 注:不 memo 化(children 是 React element,父组件每次 render 创建新引用,memo 无收益)
 */
export function FoldableSection({
  title,
  count,
  doneCount,
  defaultOpen = false,
  children,
  icon: Icon,
  'data-testid': testId,
  'aria-label': ariaLabel,
}: FoldableSectionProps) {
  const ctx = React.useContext(FoldableSectionContext)
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen)
  // ctx.expandAll 优先(null 时回退到 internalOpen)
  const open = ctx?.expandAll ?? internalOpen
  const toggle = () => {
    setInternalOpen((v) => !v)
    // 用户手动操作后恢复独立控制
    ctx?.setExpandAll(null)
  }

  // v15: 完成度派生(doneCount 与 count 都有且 doneCount <= count)
  const hasProgress =
    typeof doneCount === 'number' && typeof count === 'number' && count > 0
  const progressPct = hasProgress ? Math.min(100, Math.round(((doneCount as number) / (count as number)) * 100)) : 0
  const allDone = hasProgress && (doneCount as number) >= (count as number)

  return (
    <div
      className={cn(
        'mx-1.5 mt-1.5 rounded-sm border border-border/60 bg-muted/40 transition-colors',
        open && 'bg-muted/60',
      )}
      data-testid={testId}
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={ariaLabel ?? title}
        data-section-header="true"
        className="flex w-full items-center gap-1.5 px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/60 focus-visible:ring-offset-0"
      >
        <ChevronRight
          className={cn(
            'h-3 w-3 shrink-0 text-muted-foreground/60 transition-transform duration-150',
            open && 'rotate-90',
          )}
        />
        {Icon && <Icon className="h-3 w-3 shrink-0 text-muted-foreground/60" />}
        <span className="flex-1 text-left">{title}</span>
        {hasProgress && (
          <span
            className={cn(
              'shrink-0 tabular-nums text-[10px]',
              allDone ? 'font-medium text-emerald-500' : 'text-muted-foreground/70',
            )}
            data-testid={`${testId ?? 'foldable'}-progress-text`}
          >
            {doneCount}/{count}
          </span>
        )}
        {count !== undefined && count > 0 && (
          <span
            className={cn(
              'shrink-0 rounded-sm px-1 text-[10px] tabular-nums text-muted-foreground/80',
              hasProgress && 'ml-0.5',
            )}
          >
            {count}
          </span>
        )}
      </button>
      {/* v15: 完成度小条(若有 doneCount)— 全完成时 emerald,部分 primary,无 muted */}
      {hasProgress && (
        <div
          className="mx-2 h-0.5 -mt-0.5 overflow-hidden rounded-b-sm bg-muted/50"
          aria-hidden
          data-testid={`${testId ?? 'foldable'}-progress-bar`}
        >
          <div
            className={cn(
              'h-full transition-all duration-300',
              allDone ? 'bg-emerald-500/70' : 'bg-primary/60',
            )}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}
      {/* CSS grid 平滑高度动画:grid-template-rows 0fr→1fr,无 height auto 跳变 */}
      <div
        className="grid transition-[grid-template-rows] duration-150 ease-out"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="px-2 pb-1.5 pt-0.5">{children}</div>
        </div>
      </div>
    </div>
  )
}
