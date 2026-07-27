'use client'

import * as React from 'react'

/** 格式化耗时(ms → 可读字符串) */
export function formatDuration(ms?: number): string {
  if (ms === undefined) return ''
  if (ms < 1000) return ''
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s`
  const m = Math.floor(ms / 60_000)
  const s = Math.floor((ms % 60_000) / 1000)
  return `${m}m${s}s`
}

interface FoldableSectionProps {
  title: string
  count?: number
  defaultOpen?: boolean
  children: React.ReactNode
  'data-testid'?: string
}

/**
 * FoldableSection — 可折叠子区共享组件(对齐 Trae Work 风格)
 *
 * - 紧凑 popover 风格,text-[11px] 与 pane 主体一致
 * - bg-muted/30 + rounded-sm 区隔(不使用 border-t 分割线,符合 AGENTS.md §4)
 * - Unicode chevron ▸ 旋转 90° 表示展开态
 */
export function FoldableSection({
  title,
  count,
  defaultOpen = false,
  children,
  'data-testid': testId,
}: FoldableSectionProps) {
  const [open, setOpen] = React.useState(defaultOpen)

  return (
    <div className="mx-1 mt-1 rounded-sm bg-muted/30" data-testid={testId}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent/50"
      >
        <span
          className="shrink-0 text-[10px] transition-transform duration-150"
          style={{ transform: open ? 'rotate(90deg)' : 'none' }}
        >
          ▸
        </span>
        <span className="flex-1 text-left">{title}</span>
        {count !== undefined && count > 0 && (
          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/60">{count}</span>
        )}
      </button>
      {open && <div className="px-2 pb-1.5">{children}</div>}
    </div>
  )
}

export default FoldableSection
