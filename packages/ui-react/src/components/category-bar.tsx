// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { cn } from '../lib/utils'

/** 统一分类项:文案与计数一律由调用方注入,组件内零文案 */
export interface CategoryBarItem {
  id: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
  count?: number
}

export interface CategoryBarProps {
  items: readonly CategoryBarItem[]
  /** 当前选中 id;null 表示全未选 */
  value: string | null
  onChange: (id: string) => void
  className?: string
  /** 计数徽章的 aria 前缀由调用方 i18n 传入,组件不拼中文 */
  countAriaLabel?: (item: CategoryBarItem) => string
}

const ITEM =
  'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-3 text-[13px] leading-[18px] whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
const ITEM_IDLE = 'border-border bg-card text-muted-foreground hover:bg-muted'
const ITEM_ACTIVE = 'border-primary bg-cta text-cta-foreground font-semibold'
/** §4 数字计数徽章确定性居中模板(任意位数不偏移,等宽数字不抖) */
const BADGE =
  'inline-flex h-4 min-w-4 items-center justify-center rounded px-1 text-[10px] font-semibold leading-none tabular-nums'

/**
 * 横滑分类条 — RN 侧 CategoryInlineBar 的 web 同形实现。
 * 只滚不折行:选项再多也不撑破布局;选中项变化时才滚入视野(避免父层重渲染把用户滚动位置拽回)。
 */
export function CategoryBar({
  items,
  value,
  onChange,
  className,
  countAriaLabel,
}: CategoryBarProps) {
  const itemRefs = React.useRef(new Map<string, HTMLButtonElement>())

  const selectedIndex = value === null ? -1 : items.findIndex((item) => item.id === value)

  // 只认"选中项下标":调用方常内联 items={x.map(...)},数组 identity 每轮都变。
  // 若把 items 放进依赖,用户手动横滑之后,父层任意一次 setState 都会把滚动位置拽回选中项。
  React.useEffect(() => {
    if (selectedIndex < 0) return
    itemRefs.current.get(items[selectedIndex]?.id ?? '')?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    })
  }, [selectedIndex])

  if (items.length === 0) return null

  return (
    <div
      role="tablist"
      className={cn(
        'flex w-full items-center gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      {items.map((item) => {
        const active = item.id === value
        const Icon = item.icon
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={countAriaLabel ? countAriaLabel(item) : item.label}
            ref={(node) => {
              if (node) itemRefs.current.set(item.id, node)
              else itemRefs.current.delete(item.id)
            }}
            onClick={() => onChange(item.id)}
            className={cn(ITEM, active ? ITEM_ACTIVE : ITEM_IDLE)}
          >
            {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
            <span className="truncate">{item.label}</span>
            {typeof item.count === 'number' ? (
              <span
                className={cn(
                  BADGE,
                  active ? 'bg-primary-foreground text-primary' : 'bg-muted text-muted-foreground',
                )}
              >
                {item.count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
