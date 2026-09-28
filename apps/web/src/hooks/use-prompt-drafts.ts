// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。
// 平台特有:依赖 localStorage / React 状态,不适合放进 packages/shared 共享层。
// 截断上限与桶配额淘汰的纯逻辑在 packages/shared/src/chat/prompt-drafts.ts,
// 本 hook 只做 web 端接线(2026-09-24 从 MessageInput 的 W27 内联实现提取,行为对齐):
// - 按 conversationId 分桶持久化(localStorage: `chat:draft:{id}`,未持久化会话用 `chat:draft`)
// - 输入变化防抖写入(共享层 PROMPT_DRAFT_WRITE_DEBOUNCE_MS)
// - 会话切换:旧桶回写当前输入(空则 removeItem 清桶)→ 载入新桶草稿(无则清空输入)
// - 发送成功后的清稿仍由 useMessageSend 按同一 draftKey removeItem(单一来源,不在此重复)
// - 每次写入 touch 桶索引并按族配额淘汰最旧桶(D36 验收"存储配额淘汰",编排见 lib/prompt-bucket-quota)
// 与 prompt-history 一致:key 分桶由调用方决定,hook 消费 draftKey 字符串。

import * as React from 'react'
import {
  PROMPT_DRAFT_PREFIX,
  PROMPT_DRAFT_WRITE_DEBOUNCE_MS,
  parsePromptDraft,
  truncatePromptDraft,
} from '@ihui/shared/chat/prompt-drafts'
import { touchAndEvictBuckets } from '@/lib/prompt-bucket-quota'

export interface UsePromptDraftsParams {
  /** 当前草稿桶 key(随 conversationId 变化;与 useMessageSend 的 draftKey 同源) */
  draftKey: string
  /** 输入框内容(唯一真相源,由调用方持有) */
  value: string
  /** 会话切换恢复时回填输入框(载入新桶草稿 / 无草稿时传空串清空) */
  setValue: (text: string) => void
  /** 会话切换恢复完成后回调(如 textarea resize) */
  onRestored?: () => void
}

export function usePromptDrafts(params: UsePromptDraftsParams): void {
  const { draftKey, value, setValue, onRestored } = params
  const valueRef = React.useRef(value)
  React.useEffect(() => {
    valueRef.current = value
  }, [value])

  // 输入变化:防抖写入当前桶。draftKey 入依赖——切换会话时旧计时器先被清理,
  // 旧内容不会误写进新桶;旧桶内容由下方切换 effect 显式同步回写。
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (typeof window === 'undefined') return
      try {
        localStorage.setItem(draftKey, truncatePromptDraft(value))
        touchAndEvictBuckets(PROMPT_DRAFT_PREFIX, draftKey)
      } catch {
        // 忽略存储异常(隐私模式 / 配额)
      }
    }, PROMPT_DRAFT_WRITE_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [value, draftKey])

  // 会话切换:旧桶回写当前输入(空则 removeItem),再载入新桶草稿(无则清空输入)。
  // 首次挂载只记录 key:初始 value 已由调用方按该 key 读取。
  const prevKeyRef = React.useRef<string | null>(null)
  React.useEffect(() => {
    if (prevKeyRef.current === null) {
      prevKeyRef.current = draftKey
      return
    }
    if (prevKeyRef.current === draftKey) return
    const prevKey = prevKeyRef.current
    prevKeyRef.current = draftKey
    if (typeof window !== 'undefined') {
      try {
        const current = valueRef.current
        if (current) {
          localStorage.setItem(prevKey, truncatePromptDraft(current))
          touchAndEvictBuckets(PROMPT_DRAFT_PREFIX, prevKey)
        } else {
          localStorage.removeItem(prevKey)
        }
      } catch {
        // 忽略存储异常(隐私模式 / 配额)
      }
      try {
        setValue(parsePromptDraft(localStorage.getItem(draftKey)))
      } catch {
        // 忽略存储异常(隐私模式 / 配额)
      }
    }
    onRestored?.()
  }, [draftKey, setValue, onRestored])
}
