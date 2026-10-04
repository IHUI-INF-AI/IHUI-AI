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
import {
  resolveContextUsedSample,
  type ContextSamplePhase,
  type ContextTrustedZeroPhase,
} from '@ihui/shared/utils/context-used-sample'
import { clampPercent } from '@ihui/shared/utils/clamp-percent'

let currentBudgetEvent: BudgetEvent | null = null
const budgetListeners = new Set<() => void>()

// G-404(2026-09-29 立):瞬时 0 投影的两枚模块级状态 ——
// ① pendingTrustedZeroPhase:结构化重置信号的**一次性**登记位(auto-compaction 帧 /
//    手动 /compact / /compress 三个生产点写入;下一次 setBudgetEvent 消费后即清)。
//    阶段只从结构化信号来,禁止从消息文案猜(守门 135 同族禁令)。
// ② heldBudgetFrame:最近一枚被判为瞬时噪声而整帧丢弃的帧 —— 只作诊断出口
//    (getHeldBudgetFrame),供测试与排障回答"0% 没出现是因为被 held 了",不参与渲染。
let pendingTrustedZeroPhase: ContextTrustedZeroPhase | null = null
let heldBudgetFrame: BudgetEvent | null = null

function notifyBudgetListeners(): void {
  for (const listener of budgetListeners) listener()
}

/**
 * G-404 例外登记的唯一入口:结构化压缩/重置信号落定时调用,使紧随其后的那一枚
 * used=0 采样被接受为真值而不是被 held。参数类型收窄到封闭例外表
 * (`CONTEXT_TRUSTED_ZERO_PHASES`)—— 端内想登记表外阶段,编译期就过不去。
 */
export function noteBudgetTrustedZeroPhase(phase: ContextTrustedZeroPhase): void {
  pendingTrustedZeroPhase = phase
}

/** G-404 诊断口:最近一次被 held 丢弃的帧;没有则 null。仅供测试/排障。 */
export function getHeldBudgetFrame(): BudgetEvent | null {
  return heldBudgetFrame
}

/**
 * send-message.ts onBudget 收到帧时的唯一写点。
 * G-404:帧上的 usedTokens 先过 `resolveContextUsedSample` 投影 ——
 * 非例外阶段收到的 0 ⇒ 整帧丢弃(条继续挂上一个可信采样,percent/level/文本
 * 都源于同一枚坏采样,逐字段部分采信会把坏值劈成半真半假),并在 heldBudgetFrame
 * 留诊断;其余情形(含 usedTokens=undefined 的"未收到"语义)维持原覆盖+通知行为。
 */
export function setBudgetEvent(event: BudgetEvent): void {
  const phase: ContextSamplePhase = pendingTrustedZeroPhase ?? 'streaming'
  pendingTrustedZeroPhase = null
  const resolution = resolveContextUsedSample(
    currentBudgetEvent ? { used: currentBudgetEvent.usedTokens } : null,
    { used: event.usedTokens },
    phase,
  )
  if (resolution.held) {
    heldBudgetFrame = event
    return
  }
  heldBudgetFrame = null
  currentBudgetEvent = event
  notifyBudgetListeners()
}

/** 显式回收(如离开额度语境的新会话);无帧可清时零通知,不做无谓重渲 */
export function clearBudgetEvent(): void {
  pendingTrustedZeroPhase = null
  heldBudgetFrame = null
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
    return clampPercent(event.percent)
  }
  const used = event.usedTokens
  const limit = event.limitTokens
  if (typeof used === 'number' && typeof limit === 'number' && limit > 0) {
    return clampPercent(Math.floor((used / limit) * 1000) / 10)
  }
  return 0
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
