'use client'

/**
 * ReferenceSection — 参考内容折叠块(2026-07-28 立,Phase 19.7)
 *
 * 截图特征(Trae Work AI 消息流):
 * - 标题: "参考内容" (11px, 灰)
 * - 折叠箭头 chevron-right(展开时旋转 90°)
 * - 内容: 任意 ReactNode(参考链接/文件列表/搜索结果)
 * - 默认折叠
 * - 与 TraeBlock 风格一致: 浅色背景 + 左侧 1px 强调条
 *
 * 与 trae-block.tsx 的区别:这是消息内嵌套的"参考内容"块,
 * 不依赖 TraeBlock,自行实现折叠逻辑(更紧凑、更轻量)。
 */

import * as React from 'react'
import { ChevronRight, Link2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ReferenceSectionProps {
  /** 标题,默认 "参考内容" */
  title?: string
  /** 右侧 meta(链接数 / 搜索条数等) */
  count?: number
  /** 折叠状态(可受控或非受控) */
  collapsed?: boolean
  defaultCollapsed?: boolean
  onCollapsedChange?: (v: boolean) => void
  /** 内容:任意 ReactNode(参考链接/文件列表/搜索结果) */
  children?: React.ReactNode
  className?: string
  'data-testid'?: string
}

export const ReferenceSection = React.memo(function ReferenceSection({
  title = '参考内容',
  count,
  collapsed: collapsedProp,
  defaultCollapsed = true,
  onCollapsedChange,
  children,
  className,
  'data-testid': testId = 'reference-section',
}: ReferenceSectionProps) {
  const [internalCollapsed, setInternalCollapsed] = React.useState(defaultCollapsed)
  const collapsed = collapsedProp ?? internalCollapsed

  const onHeaderClick = () => {
    const next = !collapsed
    if (collapsedProp === undefined) setInternalCollapsed(next)
    onCollapsedChange?.(next)
  }

  const onHeaderKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onHeaderClick()
    }
  }

  return (
    <div
      className={cn(
        'relative my-1.5 overflow-hidden rounded-md border border-border/60 bg-muted/30 text-[11px] leading-relaxed',
        className,
      )}
      data-testid={testId}
    >
      {/* 左侧 1px 强调条 */}
      <div
        className="absolute left-0 top-0 bottom-0 w-0.5 bg-muted-foreground/40"
        aria-hidden
      />
      {/* 头部 */}
      <div
        className="flex cursor-pointer items-center gap-1.5 px-2 py-1 transition-colors hover:bg-accent/30"
        onClick={onHeaderClick}
        onKeyDown={onHeaderKeyDown}
        role="button"
        aria-expanded={!collapsed}
        tabIndex={0}
      >
        <ChevronRight
          className={cn(
            'h-3 w-3 shrink-0 text-muted-foreground/60 transition-transform duration-150',
            !collapsed && 'rotate-90',
          )}
        />
        <Link2 className="h-3 w-3 shrink-0 text-muted-foreground/80" aria-hidden />
        <span className="flex-1 truncate text-[11px] font-medium text-muted-foreground">
          {title}
        </span>
        {count !== undefined && count > 0 && (
          <span className="shrink-0 rounded-sm bg-muted px-1 text-[10px] tabular-nums text-muted-foreground/80">
            {count}
          </span>
        )}
      </div>
      {/* 内容区:CSS grid 平滑高度 */}
      {children !== undefined && (
        <div
          className="grid transition-[grid-template-rows] duration-200 ease-out"
          style={{ gridTemplateRows: collapsed ? '0fr' : '1fr' }}
        >
          <div className="overflow-hidden">
            <div className="px-2 pb-1.5 pt-0.5">{children}</div>
          </div>
        </div>
      )}
    </div>
  )
})

export default ReferenceSection
