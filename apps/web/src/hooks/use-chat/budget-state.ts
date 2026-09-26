// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// V3 #69(2026-09-27 立):会话窗口额度实时进度 —— budget 命名帧的唯一落点。
//
// 为什么是模块级外部 store 而不是 use-chat.ts 里的 useState:
//   帧生产点在 send-message.ts 的 SSE 回调里(非 React 渲染树内),消费点是
//   message-input.tsx 输入区的 ContextBudgetBar。两者既非同组件树也非父子,按 props
//   穿到 ai-side-panel 会改到本票清单外的文件;与 useChatStore 的 compactionStatus
//   同型(帧 → 模块级态 → 输入框上方条),但刻意**不进 stores/chat.ts**——那不在本票
//   可动面。形状直接复用 `@ihui/api-client` 的 `BudgetEvent`,不重定义字段表
//   (生产端真值见 apps/api/src/routes/ai-chat-stream.ts checkTokenBudget 的 payload)。

import type { BudgetEvent } from '@ihui/api-client'

let currentBudgetEvent: BudgetEvent | null = null
const budgetListeners = new Set<() => void>()

function notifyBudgetListeners(): void {
  for (const listener of budgetListeners) listener()
}

/** send-message.ts onBudget 收到帧时的唯一写点 */
export function setBudgetEvent(event: BudgetEvent): void {
  currentBudgetEvent = event
  notifyBudgetListeners()
}

/** 显式回收(如离开额度语境的新会话);无帧可清时零通知,不做无谓重渲 */
export function clearBudgetEvent(): void {
  if (currentBudgetEvent === null) return
  currentBudgetEvent = null
  notifyBudgetListeners()
}

/** useSyncExternalStore 的 client snapshot 口 */
export function getBudgetEvent(): BudgetEvent | null {
  return currentBudgetEvent
}

/** SSR/首帧前的 server snapshot 口:未收到帧一律不渲染 */
export function getBudgetEventServerSnapshot(): null {
  return null
}

export function subscribeBudgetEvent(listener: () => void): () => void {
  budgetListeners.add(listener)
  return () => {
    budgetListeners.delete(listener)
  }
}

/**
 * 进度条百分比:优先帧上的 `percent`(生产端已向下取整到 0.1,展示值与档位判定同源),
 * 缺字段时退回 used/limit 比值同式计算;两者都拿不到 ⇒ 0(条不假装有任何进度)。
 * 钳到 0..100:block 档 percent=100 走 429 不进本条,但帧在途竞态下不得画出超宽条。
 */
export function budgetBarPercent(event: BudgetEvent): number {
  if (typeof event.percent === 'number' && Number.isFinite(event.percent)) {
    return Math.min(100, Math.max(0, event.percent))
  }
  const used = event.usedTokens
  const limit = event.limitTokens
  if (typeof used === 'number' && typeof limit === 'number' && limit > 0) {
    return Math.min(100, Math.max(0, Math.floor((used / limit) * 1000) / 10))
  }
  return 0
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
