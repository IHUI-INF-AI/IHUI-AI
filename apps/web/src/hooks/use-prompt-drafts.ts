// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// 平台特有:依赖 localStorage / React 状态,不适合放进 packages/shared 共享层。
// 截断上限与桶配额淘汰的纯逻辑在 packages/shared/src/chat/prompt-drafts.ts,
// 本 hook 只做 web 端接线(2026-09-24 从 MessageInput 的 W27 内联实现提取,行为对齐):
// - 按 conversationId 分桶持久化(`chat:draft:{id}`,未持久化会话用 `chat:draft`)
// - 输入变化防抖写入(共享层 PROMPT_DRAFT_WRITE_DEBOUNCE_MS)
// - 会话切换:旧桶回写当前输入(空则清桶)→ 载入新桶草稿(无则清空输入)
// - 发送成功后的清稿仍由 useMessageSend 按同一 draftKey remove(单一来源,不在此重复)
// - 每次写入 touch 桶索引并按族配额淘汰最旧桶(D36 验收"存储配额淘汰",编排见 lib/prompt-bucket-quota)
//
// ## 2026-10-06(O59⑤ 残留修复):草稿值走加密通道
// 过去三处都是裸 `localStorage.*`,桌面端明文落盘。现在统一走 `lib/chat-draft-storage`。
// 代价是**读变异步**(解密要 WebCrypto),因此:
// - 初始值用 `peekSync`:浏览器路径同步给真值(零行为变更);桌面端返 null ⇒ 输入框先显示空,
//   解密完成后一次性回填。机主 2026-10-06 拍板:宁可空一下,也不把旧明文闪一帧。
// - 所有 await 之后都重新核对 draftKey:解密期间用户可能已切会话,回填到错的桶比不回填更糟。

import * as React from 'react'
import {
  PROMPT_DRAFT_PREFIX,
  PROMPT_DRAFT_WRITE_DEBOUNCE_MS,
  truncatePromptDraft,
} from '@ihui/shared/chat/prompt-drafts'
import { touchAndEvictBuckets } from '@/lib/prompt-bucket-quota'
import { getChatDraftStorage } from '@/lib/chat-draft-storage'

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

/** 草稿桶 key 的初值(浏览器同步路径下由调用方 useState 初始化时消费) */
export function peekInitialDraft(draftKey: string): string {
  if (typeof window === 'undefined') return ''
  return getChatDraftStorage().peekSync(draftKey) ?? ''
}

export function usePromptDrafts(params: UsePromptDraftsParams): void {
  const { draftKey, value, setValue, onRestored } = params
  const valueRef = React.useRef(value)
  const draftKeyRef = React.useRef(draftKey)
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  React.useEffect(() => {
    valueRef.current = value
  }, [value])
  React.useEffect(() => {
    draftKeyRef.current = draftKey
  }, [draftKey])

  // b75-5#2:立即刷新当前桶草稿(绕过防抖)。pagehide/visibilitychange/blur 时调用,
  // 避免防抖窗口未到期页面就卸载/隐藏导致草稿丢失。从 ref 取值,不依赖闭包。
  // 不 await:写入已入队自保顺序(见 chat-draft-storage 文件头「remove 必须入队」),
  // 卸载场景没有等待的必要,也没有可靠的等待时机。
  const flushNow = React.useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (typeof window === 'undefined') return
    const key = draftKeyRef.current
    const current = valueRef.current
    if (!key) return
    void getChatDraftStorage()
      .write(key, truncatePromptDraft(current))
      .then(() => touchAndEvictBuckets(PROMPT_DRAFT_PREFIX, key))
  }, [])

  // 输入变化:防抖写入当前桶。draftKey 入依赖——切换会话时旧计时器先被清理,
  // 旧内容不会误写进新桶;旧桶内容由下方切换 effect 显式同步回写。
  React.useEffect(() => {
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      if (typeof window === 'undefined') return
      void getChatDraftStorage()
        .write(draftKey, truncatePromptDraft(value))
        .then(() => touchAndEvictBuckets(PROMPT_DRAFT_PREFIX, draftKey))
    }, PROMPT_DRAFT_WRITE_DEBOUNCE_MS)
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [value, draftKey])

  // b75-5#2:页面卸载/隐藏/失焦时立即刷新草稿(绕过防抖窗口)。
  // 监听器只建一次,从 ref 取最新 draftKey/value。
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const onPageHide = () => flushNow()
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushNow()
    }
    const onBlur = () => flushNow()
    window.addEventListener('pagehide', onPageHide)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('pagehide', onPageHide)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('blur', onBlur)
    }
  }, [flushNow])

  // 会话切换:旧桶回写当前输入(空则清桶),再载入新桶草稿(无则清空输入)。
  // 首次挂载也要跑一次异步载入:桌面端 peekSync 恒为 null,初值只能靠这里读回来。
  // 但 **首次挂载不回调 onRestored** —— 该回调的用途是"内容变了要 resize",
  // 挂载那一刻组件还没上过一次布局,多调一次只是白跑一次重排(旧实现也是首次挂载直接 return)。
  const prevKeyRef = React.useRef<string | null>(null)
  React.useEffect(() => {
    const prevKey = prevKeyRef.current
    if (prevKey === null) {
      // 首次挂载:只记录 key,不回写旧桶
      prevKeyRef.current = draftKey
    } else if (prevKey !== draftKey) {
      // 会话切换:先把旧桶回写掉(空草稿 ⇒ 通道内部清桶),再载入新桶
      prevKeyRef.current = draftKey
      const current = valueRef.current
      void getChatDraftStorage()
        .write(prevKey, truncatePromptDraft(current))
        .then(() => touchAndEvictBuckets(PROMPT_DRAFT_PREFIX, prevKey))
    } else {
      // 同一个 key 重跑(如 setValue 身份变化):不重复回写,也不重复载入
      return
    }

    // 载入新桶:解密是异步的,回来时可能已经又切了会话。
    // `cancelled` 是这里的**唯一**有效防线(draftKey 变化必触发 effect cleanup),
    // 回填到错的桶比不回填更糟 —— 宁可那一次恢复丢掉。
    const target = draftKey
    const firstRun = prevKey === null
    let cancelled = false
    void getChatDraftStorage()
      .read(target)
      .then((text) => {
        if (cancelled) return
        setValue(text)
        if (!firstRun) onRestored?.()
      })
    return () => {
      cancelled = true
    }
  }, [draftKey, setValue, onRestored])
}
