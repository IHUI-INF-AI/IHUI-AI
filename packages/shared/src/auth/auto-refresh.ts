// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
 * - mobile-rn / miniapp-taro: setInterval 轮询调度器(经 createTokenAutoRefresh 注入
 *   getToken / refresh / isSessionLoggedOut;RN 见 apps/mobile-rn/src/lib/token.ts 的
 *   startTokenAutoRefresh,小程序见 apps/miniapp-taro/src/utils/auth.ts 的同名出口)
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

/**
 * 是否已到该续期的时刻(2026-10-26)。
 *
 * 与 `computeRefreshDelay` 的分工:那个算"下一次精确调度延迟"(web 的 setTimeout 用),
 * 这个答"这一次检查要不要刷"(周期检查型宿主用)。两者共用同一个 `readExp` 与 lead。
 * token 缺失 / 无 exp / 解析失败一律 false(不猜"应该能刷")。
 */
export function shouldRefreshNow(
  accessToken: string | null,
  leadMs: number = REFRESH_LEAD_MS,
  nowMs: number = Date.now(),
): boolean {
  if (!accessToken) return false
  const exp = readExp(accessToken)
  if (!exp) return false
  return exp * 1000 - nowMs <= leadMs
}

/**
 * 周期检查型自动续期循环(2026-10-26,mobile-rn / miniapp-taro 共用)。
 *
 * 为什么不用 web 那套"按 exp 精确 setTimeout":这两端有后台挂起/进程冻结 ——
 * 定时器在后台不按时触发,回到前台时那一次调度早就错过了,于是"打开 App 就要重新登录"。
 * 周期检查把"错过的调度"自然收敛成"下一次检查(≤ intervalMs)补上",不需要 AppState 钩子。
 *
 * 平台无关:`setInterval` 在 RN / Taro / 浏览器都存在;`packages/shared` 纯度守门只禁
 * `node:` 内建。web 继续用 `tokenUtils.ts` 的精确调度(不让两套调度互相覆盖)。
 *
 * 失效方向:token 取不到 / 已显式登出 / 刷新失败 ⇒ 静默跳过本轮,绝不清凭据 ——
 * 是否结束会话由 401 拦截器与各端 bootstrap 裁定,调度器不越权。
 */
export interface TokenAutoRefreshOptions {
  /** 当前 access token(同步取值;无则本轮跳过) */
  getToken: () => string | null
  /** 续期实现(应复用各端注入 api-client 的同一份单飞实现) */
  refresh: () => Promise<string | null>
  /** 用户已显式登出 ⇒ 不续期(否则会把刚退出的会话刷回来) */
  isSessionLoggedOut?: () => boolean
  /** 检查周期,默认 60s */
  intervalMs?: number
  /** 提前续期时间,默认 5 分钟 */
  leadMs?: number
  /** 测试注入口:时钟 */
  now?: () => number
  /** 测试注入口:定时器(返回句柄) */
  setIntervalFn?: (cb: () => void, ms: number) => unknown
  /** 测试注入口:清定时器 */
  clearIntervalFn?: (handle: unknown) => void
}

export interface TokenAutoRefreshHandle {
  start: () => void
  stop: () => void
  /** 立即检查一次;返回本轮是否真的发起了续期(调用方/测试用) */
  checkNow: () => Promise<boolean>
}

export const AUTO_REFRESH_CHECK_INTERVAL_MS = 60 * 1000

export function createTokenAutoRefresh(options: TokenAutoRefreshOptions): TokenAutoRefreshHandle {
  const intervalMs = options.intervalMs ?? AUTO_REFRESH_CHECK_INTERVAL_MS
  const now = options.now ?? Date.now
  const setIntervalFn =
    options.setIntervalFn ?? ((cb: () => void, ms: number) => setInterval(cb, ms) as unknown)
  const clearIntervalFn =
    options.clearIntervalFn ??
    ((handle: unknown) => clearInterval(handle as ReturnType<typeof setInterval>))
  let timer: unknown = null
  let inFlight = false

  const checkNow = async (): Promise<boolean> => {
    if (inFlight) return false
    if (options.isSessionLoggedOut?.()) return false
    if (!shouldRefreshNow(options.getToken(), options.leadMs, now())) return false
    inFlight = true
    try {
      await options.refresh()
      // 返回值不参与判定:成功与否由各端注入的续期实现自己落账(失败冷却/cookie 清理),
      // 本器只负责"到点发起",不越权清凭据。
      return true
    } catch {
      return false
    } finally {
      inFlight = false
    }
  }

  return {
    start: () => {
      if (timer !== null) return
      timer = setIntervalFn(() => {
        void checkNow()
      }, intervalMs)
    },
    stop: () => {
      if (timer === null) return
      clearIntervalFn(timer)
      timer = null
    },
    checkNow,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
