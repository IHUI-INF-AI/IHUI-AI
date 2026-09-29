// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { X, Hash } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { ContextSelectorCategory } from '@/hooks/use-context-selector'
import { useMentionTranslator } from '@/hooks/use-mention-dimension-label'
import { viewOfSelection } from '@/components/chat/mention/dimension-views'
import type { MentionSelection } from '@ihui/shared/chat/mention-engine'
// 2026-09-15 治理:定位/portal 逻辑统一收敛到 PortalPanel(全项目浮层一套逻辑)
import { PortalPanel } from '@/components/feedback/portal-panel'

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
  /** 锚点元素(输入区容器),弹层以它为参照 portal 到 body 上方弹出 */
  anchorRef: React.RefObject<HTMLElement | null>
  onHover: (idx: number) => void
  onSelect: (category: ContextSelectorCategory) => void
}

export function ContextSelectorPopover({
  open,
  query,
  filtered,
  activeIndex,
  anchorRef,
  onHover,
  onSelect,
}: ContextSelectorPopoverProps) {
  const t = useTranslations('contextSelector')
  // 类目名/说明的命名空间跟着维度表走(不在组件里假定 ns)—— 见 use-mention-dimension-label
  const tm = useMentionTranslator()
  const listRef = React.useRef<HTMLUListElement>(null)

  React.useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${activeIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  return (
    <PortalPanel
      open={open}
      anchorRef={anchorRef}
      side="top"
      align="start"
      gap={8}
      testId="context-selector-popover"
      className="flex w-80 flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-md"
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
      <ul ref={listRef} className="max-h-60 min-h-0 flex-1 overflow-y-auto p-1">
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
                    'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors',
                    idx === activeIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50',
                  )}
                >
                  <Icon className={cn('h-4 w-4 shrink-0', category.colorClass)} />
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-medium">
                      {tm(category.labelNs, category.labelKey)}{' '}
                      <span className="font-mono text-xs text-muted-foreground">
                        {category.token}
                      </span>
                    </p>
                    <p className="break-words text-xs text-muted-foreground">
                      {tm(category.labelNs, category.descKey)}
                    </p>
                  </div>
                </button>
              </li>
            )
          })
        )}
      </ul>
    </PortalPanel>
  )
}

interface MentionChipRow {
  selection: MentionSelection
  /** 类目名(`#` 侧解自 i18n;`@` 侧标签来自数据本身,可留空) */
  name?: string
}

interface ContextSelectorChipsProps {
  /** 已选提及(`@` 与 `#` 同一份 —— 唯一那份 mention engine 状态) */
  rows: MentionChipRow[]
  onRemove: (selection: MentionSelection) => void
}

/**
 * 提及 chip 行(无状态渲染器)。
 *
 * V3 第 61 票:原先它只渲染 `#` 侧、且吃 message-input 的局部 state,与 `@` 侧的
 * MentionChips 是「两份状态两个面」。现在它是**唯一的 chip 渲染器**,由 MentionChips
 * 喂 store 里那份统一 selections —— 组件保持无状态,状态只在 context-mention 一处。
 */
export function ContextSelectorChips({ rows, onRemove }: ContextSelectorChipsProps) {
  const t = useTranslations('contextSelector')
  if (rows.length === 0) return null
  return (
    // 间距由唯一挂载点 ContextChipsRow 容器统一接管(2026-09-30 深度对标二轮),不再自带 mb-2;
    // E 节:限高 4.5rem 滚动 —— chips 再多也不把输入区顶高(独立约束,不参与 toolbar 容器查询)
    <div
      className="flex max-h-[4.5rem] flex-wrap items-center gap-1.5 overflow-y-auto"
      data-testid="mention-chip-row"
    >
      {rows.map(({ selection, name }) => {
        const view = viewOfSelection(selection)
        const Icon = view.icon
        return (
          <span
            key={selection.id}
            className="inline-flex h-6 max-w-full items-center gap-1 rounded-md bg-muted px-2 text-xs text-muted-foreground"
            data-testid={`mention-chip-${selection.id}`}
          >
            <Icon className={cn('h-3 w-3 shrink-0', view.colorClass)} />
            <span className="truncate font-mono text-[11px]">{selection.insertText}</span>
            {name && <span className="truncate">{name}</span>}
            <button
              type="button"
              data-testid={`mention-chip-remove-${selection.id}`}
              onClick={() => onRemove(selection)}
              aria-label={t('removeChip')}
              className="ml-0.5 inline-flex shrink-0 items-center rounded-sm text-muted-foreground/70 transition-colors hover:text-foreground"
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
