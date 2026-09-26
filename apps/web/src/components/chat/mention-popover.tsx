// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// 已选提及 chips 面板(V3 第 61 票收口)。
//
// 61 票之前它读 `useContextMentionStore().mentions`,而那份数组**全仓没有任何写入方**
// (addMention 零调用),所以第 33 行的「空即 null」早退恒成立 —— 组件是好的、渲染点也是好的
// (message-input.tsx 一直挂着 <MentionChips />),坏的是没有任何生产者。
// 现在 `@` 与 `#` 两条路都写进同一份 store,它成为两个 sigil 共用的唯一 chip 面。

import * as React from 'react'

import { useContextMentionStore } from '@/stores/context-mention'
import { ContextSelectorChips } from '@/components/ai/context-selector-popover'
import { useMentionTranslator } from '@/hooks/use-mention-dimension-label'
import {
  dimensionsForSigil,
  type MentionDimension,
  type MentionSelection,
} from '@ihui/shared/chat/mention-engine'

/** `#` 侧的 chip 补一个类目名(`@` 侧的标签来自数据本身,不再叠一层文案) */
function useHashCategoryNames(): (selection: MentionSelection) => string | undefined {
  const tm = useMentionTranslator()
  const byToken = React.useMemo(() => {
    const map = new Map<string, MentionDimension>()
    for (const dim of dimensionsForSigil('#')) {
      if (dim.token) map.set(dim.token, dim)
    }
    return map
  }, [])
  return React.useCallback(
    (selection: MentionSelection) => {
      const dim = byToken.get(selection.insertText)
      return dim ? tm(dim.labelNs, dim.labelKey) : undefined
    },
    [byToken, tm],
  )
}

interface MentionChipsProps {
  /**
   * 摘 chip 的完整落点(渲染点注入 `useMentionWiring().removeSelection`)。
   * 传了就直接交给它(状态 + 正文一起收);没传时只清状态 —— 单测与只读场景可用。
   */
  onRemove?: (selection: MentionSelection) => void
}

/**
 * 已选提及 chips(显示在输入框上方)。
 *
 * 由 message-input.tsx 挂进输入区;每个 chip:维度图标 + 插入文本 + 类目名 + × 删除。
 * 删除走 `@ihui/shared/chat/mention-engine` 的那份状态与正文同步出口,不留
 * "chip 没了、引用还在正文里"的分叉。
 */
export function MentionChips({ onRemove }: MentionChipsProps) {
  const mentions = useContextMentionStore((s) => s.mentions)
  const removeMention = useContextMentionStore((s) => s.removeMention)
  const nameOf = useHashCategoryNames()

  const rows = React.useMemo(
    () => mentions.map((selection) => ({ selection, name: nameOf(selection) })),
    [mentions, nameOf],
  )

  const handleRemove = React.useCallback(
    (selection: MentionSelection) => {
      if (onRemove) {
        onRemove(selection)
        return
      }
      removeMention(selection.id)
    },
    [removeMention, onRemove],
  )

  return <ContextSelectorChips rows={rows} onRemove={handleRemove} />
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
