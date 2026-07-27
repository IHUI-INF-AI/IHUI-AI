'use client'

import * as React from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FoldableSectionProps {
  title: string
  count?: number
  defaultOpen?: boolean
  children: React.ReactNode
  icon?: React.ComponentType<{ className?: string }>
  'data-testid'?: string
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

/**
 * FoldableSection — 共享折叠子区包装器(对齐 Trae Work)
 *
 * 特征:
 * - SVG chevron 图标(ChevronRight,展开时 rotate-90)
 * - 可选标题图标(通过 icon prop 传入 lucide-react 组件)
 * - 计数徽章(右对齐,tabular-nums)
 * - 平滑背景色 hover 反馈
 * - rounded-sm bg-muted/30 容器,无分割线
 */
export function FoldableSection({
  title,
  count,
  defaultOpen = false,
  children,
  icon: Icon,
  'data-testid': testId,
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

  return (
    <div
      className={cn(
        'mx-1.5 mt-1.5 rounded-sm border border-border/40 bg-muted/20 transition-colors',
        open && 'bg-muted/40',
      )}
      data-testid={testId}
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
      >
        <ChevronRight
          className={cn(
            'h-3 w-3 shrink-0 text-muted-foreground/60 transition-transform duration-150',
            open && 'rotate-90',
          )}
        />
        {Icon && <Icon className="h-3 w-3 shrink-0 text-muted-foreground/60" />}
        <span className="flex-1 text-left">{title}</span>
        {count !== undefined && count > 0 && (
          <span className="shrink-0 rounded-sm bg-muted px-1 text-[10px] tabular-nums text-muted-foreground/80">
            {count}
          </span>
        )}
      </button>
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
