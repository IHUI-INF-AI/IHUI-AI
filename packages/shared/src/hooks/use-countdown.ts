// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import * as React from 'react'
import { useDeadlineTicker } from './deadline-ticker'

export interface UseCountdownReturn {
  count: number
  isRunning: boolean
  start: () => void
  pause: () => void
  reset: (seconds?: number) => void
}

/**
 * 倒计时内部状态。
 * - `deadlineMs !== null` 表示运行中,剩余秒数一律由「截止戳 - 当前时刻」派生;
 * - `deadlineMs === null` 表示未运行,`count` 是暂停/初始时的剩余秒数。
 */
export interface CountdownState {
  deadlineMs: number | null
  count: number
  isRunning: boolean
}

/** 剩余毫秒 → 剩余秒(向上取整,已过期钳到 0)。全模块唯一一处取整口径。 */
export function remainingSeconds(deadlineMs: number, now: number): number {
  const ms = deadlineMs - now
  return ms <= 0 ? 0 : Math.ceil(ms / 1000)
}

export function createCountdownState(seconds: number): CountdownState {
  return { deadlineMs: null, count: Math.max(0, Math.floor(seconds)), isRunning: false }
}

/** 启动/恢复:以「当前剩余秒数」重建截止戳,后台被节流也不会少走。 */
export function startCountdown(state: CountdownState, now: number = Date.now()): CountdownState {
  const remaining = state.deadlineMs === null ? state.count : remainingSeconds(state.deadlineMs, now)
  if (remaining <= 0) return { deadlineMs: null, count: 0, isRunning: false }
  return { deadlineMs: now + remaining * 1000, count: remaining, isRunning: true }
}

/** 暂停:把当前墙钟剩余固化成静态 count,并清掉截止戳。 */
export function pauseCountdown(state: CountdownState, now: number = Date.now()): CountdownState {
  if (!state.isRunning) return state
  const remaining = state.deadlineMs === null ? state.count : remainingSeconds(state.deadlineMs, now)
  return { deadlineMs: null, count: remaining, isRunning: false }
}

export function resetCountdown(seconds: number): CountdownState {
  return { deadlineMs: null, count: Math.max(0, Math.floor(seconds)), isRunning: false }
}

/** 运行期对表:只从截止戳派生,绝不按帧自减。 */
export function tickCountdown(state: CountdownState, now: number = Date.now()): CountdownState {
  if (state.deadlineMs === null) return state
  const remaining = remainingSeconds(state.deadlineMs, now)
  if (remaining <= 0) return { deadlineMs: null, count: 0, isRunning: false }
  if (remaining === state.count) return state
  return { ...state, count: remaining }
}

/**
 * 倒计时 Hook,常用于验证码倒计时。
 *
 * **实现选择(2026-11-08):直接替换原 tick 自减实现,保留 `UseCountdownReturn` 签名,
 * 不另起 deprecated 别名。** 理由:两版签名与语义完全一致(start/pause/reset 的操作含义不变),
 * 唯一差异是「后台节流后按墙钟对表」——属修正;而保留旧导出让缺陷实现继续可达,
 * 调用方仍可能选错,排查时还要先分辨用的是哪一版。本包被全端引用,单一路径比双路径安全。
 */
export function useCountdown(seconds: number): UseCountdownReturn {
  const [state, setState] = React.useState<CountdownState>(() => createCountdownState(seconds))

  const deadlineMs = state.deadlineMs
  useDeadlineTicker(deadlineMs, () => {
    setState((prev) => (prev.deadlineMs === deadlineMs ? tickCountdown(prev) : prev))
  })

  const start = React.useCallback(() => setState((prev) => startCountdown(prev)), [])
  const pause = React.useCallback(() => setState((prev) => pauseCountdown(prev)), [])
  const reset = React.useCallback(
    (resetSeconds?: number) => setState(resetCountdown(resetSeconds ?? seconds)),
    [seconds],
  )

  return { count: state.count, isRunning: state.isRunning, start, pause, reset }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
