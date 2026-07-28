/**
 * Token 自动刷新核心逻辑(跨端共享,零平台依赖)
 *
 * 各端 web/extension/mobile-rn 的 token 自动刷新实现共享如下核心计算:
 * 1. REFRESH_LEAD_MS:提前续期时间(5 分钟,从 constants.ts re-export)
 * 2. MIN_DELAY_MS / MAX_DELAY_MS:setTimeout / chrome.alarms 调度边界
 * 3. computeRefreshDelay:从 JWT exp 计算下一次 refresh 延迟(带 clamp)
 * 4. createInFlightRefresh:飞行中请求去重器(同一时间只允许一个 refresh)
 *
 * 各端薄封装实现:
 * - web: setTimeout 调度器(inFlightRefresh + refreshTimer)
 * - extension: chrome.alarms 调度器(scheduleOnce + clearSchedule)
 * - mobile-rn: 暂未实现(未来可基于 setInterval / BackgroundFetch)
 */
import { readExp } from '../utils/jwt-utils'
import { REFRESH_LEAD_MS } from '../constants'

// re-export REFRESH_LEAD_MS 方便各端从统一入口 import(避免分别从 constants 与 auth 两处取)
export { REFRESH_LEAD_MS }

/** 调度最小延迟(30s),避免 setTimeout 越界 / chrome.alarms 立即触发 */
export const MIN_DELAY_MS = 30 * 1000

/** 调度最大延迟(24h),setTimeout 上限;chrome.alarms 端内可自行 clamp */
export const MAX_DELAY_MS = 24 * 60 * 60 * 1000

/**
 * 平台调度器抽象(各端实现并注入)。
 * - web:setTimeout / clearTimeout
 * - extension:chrome.alarms.create / clear
 * - mobile-rn:setInterval / BackgroundFetch
 */
export interface RefreshScheduler {
  scheduleOnce(delayMs: number, callback: () => void): void
  clear(): void
}

/**
 * 根据 accessToken 的 JWT exp 字段计算自动续期延迟(毫秒)。
 *
 * @param accessToken JWT 访问令牌(必须含 exp 字段)
 * @param leadMs 提前续期时间(默认 REFRESH_LEAD_MS = 5 分钟)
 * @returns 延迟毫秒数(已 clamp 到 [MIN_DELAY_MS, MAX_DELAY_MS]);null 表示 token 无有效 exp,不应调度
 */
export function computeRefreshDelay(
  accessToken: string,
  leadMs: number = REFRESH_LEAD_MS,
): number | null {
  const exp = readExp(accessToken)
  if (!exp) return null
  const delayMs = exp * 1000 - Date.now() - leadMs
  return Math.max(MIN_DELAY_MS, Math.min(delayMs, MAX_DELAY_MS))
}

/**
 * 创建 in-flight refresh 去重器(同一时间只允许一个 refresh 请求)。
 *
 * 各端调度器在发起 refresh 前调用 get() 检查是否已有飞行中请求,
 * 完成后调用 clear() 释放,避免并发 refresh 导致 token 失效。
 *
 * @typeParam T refresh 返回值类型(通常为 TokenPair 或 boolean)
 */
export interface InFlightRefresh<T> {
  get(): Promise<T | null> | null
  set(p: Promise<T | null>): void
  clear(): void
}

export function createInFlightRefresh<T>(): InFlightRefresh<T> {
  let inFlight: Promise<T | null> | null = null
  return {
    get: () => inFlight,
    set: (p: Promise<T | null>) => {
      inFlight = p
    },
    clear: () => {
      inFlight = null
    },
  }
}
