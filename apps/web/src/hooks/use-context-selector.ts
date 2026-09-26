// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// W20 九类 # 上下文选择器 —— 现在只是统一提及引擎的 **`#` 侧键盘导航 adapter**。
//
// V3 第 61 票(2026-09-27):九类目表与 `#` 触发解析原先都住在本文件里,与
// message-input.tsx 里那份 `@` 触发解析各写一遍「是哪几个维度、trigger 怎么解」——
// 这就是票面说的「两套引擎」。表和解析现在都归到
// `@ihui/shared/chat/mention-engine`(MENTION_DIMENSIONS / parseMentionTrigger),
// 本文件只保留:键盘导航、高亮游标、Esc 抑制,以及把选中结果交回调用方写进唯一那份 store。
// 新增维度只在引擎表里加,不得在这里再抄一份(常驻对账:守门 W2/W3)。

import * as React from 'react'

import { MAX_LENGTH } from '@/components/chat/web-input-core'
import { viewOfDimensionId } from '@/components/chat/mention/dimension-views'
import {
  dimensionsForSigil,
  parseMentionTrigger,
  replaceTrailingTrigger,
  selectionFromDimension,
  type MentionDimension,
  type MentionSelection,
} from '@ihui/shared/chat/mention-engine'

/** `#` 侧一个类目的渲染视图(引擎维度 + web 外观),供浮层直接消费 */
export interface ContextSelectorCategory {
  /** 引擎维度 id(`hash:<类>`),浮层 testid 与埋点锚它 */
  dimensionId: string
  /** 旧字段名保留:即类目短名(file / folder / code / …) */
  kind: string
  token: string
  /** 取词位置跟着表走,不在组件里假定命名空间 */
  labelNs: string
  labelKey: string
  descKey: string
  icon: React.ComponentType<{ className?: string }>
  colorClass: string
}

/** 九类目 = 引擎表里 sigil === '#' 的那些维度(一份表驱动,非第二份清单) */
export const CONTEXT_SELECTOR_CATEGORIES: ContextSelectorCategory[] = dimensionsForSigil('#').map(
  (dim) => {
    const view = viewOfDimensionId(dim.id)
    return {
      dimensionId: dim.id,
      kind: dim.id.replace(/^hash:/, ''),
      token: dim.token,
      labelNs: dim.labelNs,
      labelKey: dim.labelKey,
      descKey: dim.descKey ?? dim.labelKey,
      icon: view.icon,
      colorClass: view.colorClass,
    }
  },
)

/** 渲染视图 ↔ 引擎维度:浮层拿到的是视图,选中要还原成维度才能建 selection */
function dimensionOf(category: ContextSelectorCategory): MentionDimension | undefined {
  return dimensionsForSigil('#').find((d) => d.id === category.dimensionId)
}

export interface UseContextSelectorResult {
  open: boolean
  query: string
  filtered: ContextSelectorCategory[]
  activeIndex: number
  setActiveIndex: (idx: number) => void
  select: (category: ContextSelectorCategory) => void
  /** textarea keydown 前置拦截;返回 true 表示事件已被选择器消费 */
  handleKeyDown: (e: React.KeyboardEvent) => boolean
}

/**
 * `#` 侧选择器:
 * - 触发态一律问 `parseMentionTrigger`(与 `@` 同一把尺子)
 * - 选中 → 正文尾部触发段替换为类目 token,并把 MentionSelection 交回 onSelect
 *   (调用方写进 context-mention store —— 唯一那份提及状态)
 * - open 由 value 派生;Esc 关闭后直到触发态消失才复位
 */
export function useContextSelector(options: {
  /** 当前输入值(open 状态由 value 派生) */
  value: string
  setValue: React.Dispatch<React.SetStateAction<string>>
  inputRef: React.RefObject<{ focus: () => void; resize: () => void } | null>
  onSelect: (selection: MentionSelection) => void
}): UseContextSelectorResult {
  const { setValue, inputRef, onSelect } = options
  const [dismissed, setDismissed] = React.useState(false)
  const [activeIndex, setActiveIndex] = React.useState(0)

  const trigger = React.useMemo(() => parseMentionTrigger(options.value), [options.value])
  const hashTrigger = trigger?.sigil === '#' ? trigger : null

  React.useEffect(() => {
    if (hashTrigger === null) setDismissed(false)
  }, [hashTrigger])

  const query = hashTrigger?.query ?? ''
  const open = hashTrigger !== null && !dismissed

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return CONTEXT_SELECTOR_CATEGORIES
    return CONTEXT_SELECTOR_CATEGORIES.filter(
      (c) => c.token.toLowerCase().includes(q) || c.kind.toLowerCase().includes(q),
    )
  }, [query])

  React.useEffect(() => {
    setActiveIndex(0)
  }, [query])

  const select = React.useCallback(
    (category: ContextSelectorCategory) => {
      const dim = dimensionOf(category)
      const token = dim?.token ?? category.token
      setValue((prev) => replaceTrailingTrigger(prev, '#', `${token} `).slice(0, MAX_LENGTH))
      setDismissed(true)
      if (dim) onSelect(selectionFromDimension(dim))
      requestAnimationFrame(() => {
        inputRef.current?.focus()
        inputRef.current?.resize()
      })
    },
    [setValue, onSelect, inputRef],
  )

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent): boolean => {
      if (!open) return false
      if (e.key === 'ArrowDown' && filtered.length > 0) {
        e.preventDefault()
        setActiveIndex((prev) => Math.min(prev + 1, filtered.length - 1))
        return true
      }
      if (e.key === 'ArrowUp' && filtered.length > 0) {
        e.preventDefault()
        setActiveIndex((prev) => Math.max(prev - 1, 0))
        return true
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        // 无匹配项时不拦截,让 Enter 正常发送
        if (filtered.length === 0) return false
        e.preventDefault()
        const current = filtered[Math.min(activeIndex, filtered.length - 1)]
        if (current) select(current)
        return true
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setDismissed(true)
        return true
      }
      return false
    },
    [open, filtered, activeIndex, select],
  )

  return {
    open,
    query,
    filtered,
    activeIndex,
    setActiveIndex,
    select,
    handleKeyDown,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
