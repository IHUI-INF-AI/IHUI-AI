// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { X, Hash } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { ContextSelectorCategory } from '@/hooks/use-context-selector'

// ============================================================================
// W20 九类 # 上下文选择器弹层 + 类型徽章 chips(对标 Trae)
// 键盘导航(↑/↓/Enter/Tab/Esc)由 use-context-selector.ts 在 textarea 层拦截,
// 本组件只负责渲染:列表 + hover 高亮 + 点击选中 + chip 移除。
// ============================================================================

interface ContextSelectorPopoverProps {
  open: boolean
  query: string
  filtered: ContextSelectorCategory[]
  activeIndex: number
  onHover: (idx: number) => void
  onSelect: (category: ContextSelectorCategory) => void
}

export function ContextSelectorPopover({
  open,
  query,
  filtered,
  activeIndex,
  onHover,
  onSelect,
}: ContextSelectorPopoverProps) {
  const t = useTranslations('contextSelector')
  const listRef = React.useRef<HTMLUListElement>(null)

  React.useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${activeIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  if (!open) return null

  return (
    <div
      className="absolute bottom-full left-0 z-popover mb-2 w-80 overflow-hidden rounded-lg border bg-popover shadow-lg"
      data-testid="context-selector-popover"
    >
      <div className="flex items-center gap-2 bg-muted/40 px-3 py-2">
        <Hash className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="truncate text-xs text-muted-foreground">{t('title')}</span>
        {query && (
          <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {query}
          </span>
        )}
      </div>
      <ul ref={listRef} className="max-h-60 overflow-y-auto p-1">
        {filtered.length === 0 ? (
          <li
            className="px-3 py-6 text-center text-sm text-muted-foreground"
            data-testid="context-selector-no-match"
          >
            {t('noMatch')}
          </li>
        ) : (
          filtered.map((category, idx) => {
            const Icon = category.icon
            return (
              <li key={category.kind}>
                <button
                  type="button"
                  data-idx={idx}
                  data-testid={`context-selector-item-${category.kind}`}
                  onClick={() => onSelect(category)}
                  onMouseEnter={() => onHover(idx)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                    idx === activeIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50',
                  )}
                >
                  <Icon className={cn('h-4 w-4 shrink-0', category.colorClass)} />
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-medium">
                      {t(category.labelKey)}{' '}
                      <span className="font-mono text-xs text-muted-foreground">
                        {category.token}
                      </span>
                    </p>
                    <p className="break-words text-xs text-muted-foreground">
                      {t(category.descKey)}
                    </p>
                  </div>
                </button>
              </li>
            )
          })
        )}
      </ul>
    </div>
  )
}

interface ContextSelectorChipsProps {
  chips: ContextSelectorCategory[]
  onRemove: (token: string) => void
}

/** 类型徽章 chips 行(选中九类目后渲染在输入区上方,随消息发送 token) */
export function ContextSelectorChips({ chips, onRemove }: ContextSelectorChipsProps) {
  const t = useTranslations('contextSelector')
  if (chips.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5" data-testid="context-selector-chips">
      {chips.map((chip) => {
        const Icon = chip.icon
        return (
          <span
            key={chip.kind}
            className="inline-flex items-center gap-1 rounded-md border bg-muted/50 px-1.5 py-0.5 text-xs"
            data-testid={`context-selector-chip-${chip.kind}`}
          >
            <Icon className={cn('h-3 w-3', chip.colorClass)} />
            <span className="font-mono text-[11px]">{chip.token}</span>
            <span className="text-muted-foreground">{t(chip.labelKey)}</span>
            <button
              type="button"
              onClick={() => onRemove(chip.token)}
              aria-label={t('removeChip')}
              className="rounded-sm text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        )
      })}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
