// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 平台特有:依赖 DOM keydown / textarea selection,不适合放进 packages/shared 共享层。
// 栈的纯逻辑(push/去重/50 上限/游标导航)在 packages/shared/src/chat/prompt-history.ts,
// 本 hook 只做 web 端接线:
// - 按 conversationId 分桶持久化(localStorage: `chat:prompt-history:{id}`,未持久化会话用 `chat:prompt-history`)
// - 维护翻历史游标 / 草稿备份(React Refs,不触发渲染)
// - 暴露 pushSent / handleArrowKey / resetCursor 给 MessageInput

import * as React from 'react'
import {
  navigateCursor,
  parsePromptHistory,
  pushPromptEntry,
  resolveHistoryText,
} from '@ihui/shared/chat'

/** keydown 事件的最小子集(handleArrowKey 不依赖真实 React 事件,便于单测) */
export interface HistoryKeyLike {
  key: string
  preventDefault: () => void
  nativeEvent?: { isComposing?: boolean }
}

export interface UsePromptHistoryParams {
  /** 动态返回当前历史 key(随 conversationId 变化);push/load 时求值,保证用的是最新会话桶 */
  getHistoryKey: () => string
  /** 读取 textarea 当前光标位置(selectionStart),用于多行首行判定 */
  getCaretPosition: () => number
  /** 把历史文本回填到输入框并把光标移到行尾(调用方负责 setValue + focus + setSelectionRange) */
  applyText: (text: string) => void
}

export interface UsePromptHistoryResult {
  /** 发送成功后推送该条用户文本(写入 localStorage + 重置翻历史游标) */
  pushSent: (text: string) => void
  /** 输入框 keydown 拦截:处理 ↑/↓ 翻历史,返回 true 表示已消费(调用方应 preventDefault) */
  handleArrowKey: (e: HistoryKeyLike, ctx: { value: string }) => boolean
  /** 用户手动编辑输入框时调用:清空翻历史游标 / 草稿备份,避免回填上一条时误用旧游标 */
  resetCursor: () => void
}

export function usePromptHistory(params: UsePromptHistoryParams): UsePromptHistoryResult {
  const { getHistoryKey, getCaretPosition, applyText } = params
  const entriesRef = React.useRef<string[]>([])
  const cursorRef = React.useRef(0)
  const draftBackupRef = React.useRef('')
  const prevKeyRef = React.useRef('')

  // 会话切换:加载目标桶历史;若新桶为空而旧桶有内容(新会话首条消息时机),
  // 把旧桶内容迁移到新桶,避免首条消息历史丢失(会话隔离不被破坏,仅跨桶搬运当前数据)。
  React.useEffect(() => {
    const newKey = getHistoryKey()
    const prevKey = prevKeyRef.current
    if (prevKey && prevKey !== newKey) {
      const oldEntries = parsePromptHistory(
        typeof window !== 'undefined' ? localStorage.getItem(prevKey) : null,
      )
      const newRaw = typeof window !== 'undefined' ? localStorage.getItem(newKey) : null
      if ((!newRaw || parsePromptHistory(newRaw).length === 0) && oldEntries.length > 0) {
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(newKey, JSON.stringify(oldEntries))
          } catch {
            // 忽略存储异常(隐私模式 / 配额)
          }
        }
      }
    }
    prevKeyRef.current = newKey
    entriesRef.current = parsePromptHistory(
      typeof window !== 'undefined' ? localStorage.getItem(newKey) : null,
    )
    cursorRef.current = 0
    draftBackupRef.current = ''
  }, [getHistoryKey])

  const pushSent = React.useCallback(
    (text: string) => {
      const key = getHistoryKey()
      const next = pushPromptEntry(entriesRef.current, text)
      entriesRef.current = next
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(key, JSON.stringify(next))
        } catch {
          // 忽略存储异常(隐私模式 / 配额)
        }
      }
      cursorRef.current = 0
      draftBackupRef.current = ''
    },
    [getHistoryKey],
  )

  const handleArrowKey = React.useCallback(
    (e: HistoryKeyLike, ctx: { value: string }): boolean => {
      const keyName = e.key
      if (keyName !== 'ArrowUp' && keyName !== 'ArrowDown') return false
      if (e.nativeEvent?.isComposing) return false
      const entries = entriesRef.current
      if (entries.length === 0) return false
      const caret = getCaretPosition()
      if (keyName === 'ArrowUp') {
        // 多行:光标不在第一行时只移动光标,不劫持翻历史(行业惯例,防多行编辑被劫持)
        const onFirstLine = !ctx.value.slice(0, caret).includes('\n')
        if (!onFirstLine) return false
        // 第一次从草稿上翻:保存当前未发送文本,供 ↓ 返回(Codex 语义)
        if (cursorRef.current === 0 && ctx.value.length > 0) {
          draftBackupRef.current = ctx.value
        }
        cursorRef.current = navigateCursor(cursorRef.current, 'prev', entries.length)
        applyText(resolveHistoryText(entries, cursorRef.current, draftBackupRef.current))
        return true
      }
      // ArrowDown:已回到草稿则不拦截,让光标在草稿内正常下移
      if (cursorRef.current === 0) return false
      cursorRef.current = navigateCursor(cursorRef.current, 'next', entries.length)
      applyText(resolveHistoryText(entries, cursorRef.current, draftBackupRef.current))
      return true
    },
    [getCaretPosition, applyText],
  )

  const resetCursor = React.useCallback(() => {
    cursorRef.current = 0
    draftBackupRef.current = ''
  }, [])

  return { pushSent, handleArrowKey, resetCursor }
}
