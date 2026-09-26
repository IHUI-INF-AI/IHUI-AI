// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// 提及的"落到正文 + 落到状态"接线(V3 第 61 票,2026-09-27 立)。
//
// 为什么单独成钩子而不是留在 message-input.tsx 里:`@` / `#` 两条选中路径的落点动作
// (写进那份唯一 store + 把 insertText 顶进正文 + 摘 chip 时同步删正文)是本票验收
// "选中后真的进消息"的那一段。留在 1400 行的组件里就只能靠人读代码确认;提取成
// 一个可 renderHook 的出口后,三段(出候选 / 选中 / 进消息)能在同一轮里被真的跑一遍。
// 判定与合并语义仍然全部在 @ihui/shared/chat/mention-engine,这里只做接线,不算第二份实现。

import * as React from 'react'

import { useContextMentionStore } from '@/stores/context-mention'
import {
  removeMentionInsert,
  replaceTrailingTrigger,
  type MentionSelection,
} from '@ihui/shared/chat/mention-engine'
import { MAX_LENGTH } from '@/components/chat/web-input-core'

export interface UseMentionWiringOptions {
  setValue: React.Dispatch<React.SetStateAction<string>>
  inputRef: React.RefObject<{ focus: () => void; resize: () => void } | null>
  /**
   * 插入后是否把光标交还输入框(默认 true)。渲染链上必须交还;测试里 `inputRef.current`
   * 常是 null,那个 rAF 回调会在 act() 收尾之外触发 React 的跨作用域泄漏告警,
   * 所以允许调用方关掉 —— 不影响正文与状态这两件真正被验的事。
   */
  refocusAfterInsert?: boolean
}

export interface UseMentionWiringResult {
  /** 只写状态(用于 `#` 侧 —— 正文替换由 useContextSelector 自己完成,避免改两遍) */
  addMention: (selection: MentionSelection) => void
  /** 选中一条提及(`@` 或 `#` 同一出口):写状态 + 把正文尾部触发段换成 insertText */
  applyAtSelection: (selection: MentionSelection) => void
  /** 摘 chip:清状态 + 把对应插入文本从正文里去掉 */
  removeSelection: (selection: MentionSelection) => void
}

export function useMentionWiring(options: UseMentionWiringOptions): UseMentionWiringResult {
  const { setValue, inputRef, refocusAfterInsert = true } = options
  const addMention = useContextMentionStore((s) => s.addMention)
  const removeMention = useContextMentionStore((s) => s.removeMention)

  const refocus = React.useCallback(() => {
    if (!refocusAfterInsert) return
    requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.resize()
    })
  }, [inputRef, refocusAfterInsert])

  const applyAtSelection = React.useCallback(
    (selection: MentionSelection) => {
      addMention(selection)
      setValue((prev) =>
        replaceTrailingTrigger(prev, selection.sigil, `${selection.insertText} `).slice(
          0,
          MAX_LENGTH,
        ),
      )
      refocus()
    },
    [addMention, setValue, refocus],
  )

  const removeSelection = React.useCallback(
    (selection: MentionSelection) => {
      removeMention(selection.id)
      setValue((prev) => removeMentionInsert(prev, selection.insertText))
    },
    [removeMention, setValue],
  )

  return { addMention, applyAtSelection, removeSelection }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
