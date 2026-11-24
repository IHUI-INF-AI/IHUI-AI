// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 客户端 Token 自动刷新工具。
 *
 * 背景：后端 accessToken TTL 通常 2h,refreshToken TTL 7d。避免用户长时间停留
 * 后突然 401,在 token 过期前 5 分钟自动调用 /api/auth/refresh 续期。
 *
 * 使用方式(在登录成功后):
 *   import { startAutoRefresh, stopAutoRefresh } from '@/lib/tokenUtils'
 *   startAutoRefresh(err => useLoginDialogStore.getState().open('login'))
 *
 * 依赖:useAuthStore 持久化 token + refreshToken(accessToken 必须是 JWT 带 exp 字段)。
 *
 * 共享层:延迟计算 / 飞行中去重 / 调度器抽象来自 @ihui/shared/auth/auto-refresh,
 *         本文件只保留 web 端 setTimeout 调度器实现 + 与 useAuthStore 的耦合逻辑。
 */
import { useAuthStore } from '@/stores/auth'
import {
  computeRefreshDelay,
  createInFlightRefresh,
  type InFlightRefresh,
  type RefreshScheduler,
  REFRESH_LEAD_MS,
  shouldRefreshNow,
} from '@ihui/shared/auth/auto-refresh'
import { type TokenPair } from '@ihui/types'
import { refreshAccessTokenOnce } from '@ihui/api-client'

/** web 端调度器:setTimeout / clearTimeout 实现 RefreshScheduler 接口 */
class WebRefreshScheduler implements RefreshScheduler {
  private timer: ReturnType<typeof setTimeout> | null = null

  scheduleOnce(delayMs: number, callback: () => void): void {
    this.clear()
    this.timer = setTimeout(callback, delayMs)
  }

  clear(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }
}

const scheduler = new WebRefreshScheduler()
const inFlight: InFlightRefresh<TokenPair> = createInFlightRefresh<TokenPair>()
let stopped = false

/** 回前台补刷的节流窗口:同一刻连点/连切标签页不重复打 /auth/refresh */
const WAKE_THROTTLE_MS = 15 * 1000
/** 当前这轮调度的入参(cookie 模式下 refreshToken 为 null);stopAutoRefresh 时清空 */
let currentOpts: ScheduleOptions | null = null
let wakeHandler: (() => void) | null = null
let lastWakeAt = 0

export function clearRefreshTimer(): void {
  scheduler.clear()
}

interface ScheduleOptions {
  accessToken: string
  /** cookie 模式下恒为 null —— 续期凭据是 httpOnly cookie,调度不以它为前提 */
  refreshToken: string | null
  onRefreshed: (tokens: TokenPair) => void
  onError?: (err: Error) => void
  leadMs?: number
}

/** 根据 accessToken 的 exp 在过期前 leadMs 调度 setTimeout 续期 */
function schedule(opts: ScheduleOptions): void {
  if (typeof window === 'undefined') return
  scheduler.clear()
  const delay = computeRefreshDelay(opts.accessToken, opts.leadMs ?? REFRESH_LEAD_MS)
  if (delay === null) return
  scheduler.scheduleOnce(delay, () => {
    void doRefresh(opts).catch((e) => opts.onError?.(e as Error))
  })
}

async function doRefresh(opts: ScheduleOptions): Promise<void> {
  const existing = inFlight.get()
  if (existing) {
    const tokens = await existing
    if (tokens) {
      opts.onRefreshed(tokens)
      schedule({ ...opts, ...tokens })
    }
    return
  }
  const promise = (async (): Promise<TokenPair | null> => {
    try {
      // 2026-09-04 根治刷新风暴:复用 api-client 全局单例 refreshAccessTokenOnce,
      // 与 401 拦截器共享同一 in-flight promise。此前直接调 refreshAccessToken(endpoint 函数)
      // 绕过单例,定时器续期与 401 续期各发一次 /auth/refresh,refresh token 单次轮转
      // 后到者 401 → RFC 6749 §10.4 family 吊销 → 登录态丢失 + 刷新风暴。
      // refreshAccessTokenOnce 内部(api.ts 注入的 refreshAccessToken)已 setToken 最新 pair,
      // 此处从 store 读回最新 refreshToken 构造成 TokenPair 供 schedule 续期。
      const accessToken = await refreshAccessTokenOnce()
      if (!accessToken) {
        opts.onError?.(new Error('refresh 失败: token 为空'))
        return null
      }
      const data: TokenPair = {
        accessToken,
        // cookie 模式下两边都取不到 rt,TokenPair 的 refreshToken 是可选的 ⇒ 给 undefined
        refreshToken: useAuthStore.getState().refreshToken ?? opts.refreshToken ?? undefined,
      }
      opts.onRefreshed(data)
      schedule({ ...opts, ...data })
      return data
    } catch (e) {
      opts.onError?.(e as Error)
      return null
    } finally {
      inFlight.clear()
    }
  })()
  inFlight.set(promise)
  await promise
}

function applyRefreshed(tokens: TokenPair): void {
  if (stopped) return
  useAuthStore.getState().setToken(tokens.accessToken, tokens)
}

/**
 * 回前台补刷(visibilitychange,2026-11-14 立)。
 *
 * 病灶:后台标签页 / 系统休眠会冻结 setTimeout —— 精确调度被错过就等于"回前台即 401"。
 * 故页面重新可见时必须主动补一次:已在续期窗口内 ⇒ 立即刷;还早 ⇒ 按当前 token 重新排程。
 * 不猜凭据:token 缺失一律不动(是否结束会话由 401 拦截器裁定)。
 */
function attachWakeListener(): void {
  if (typeof document === 'undefined' || wakeHandler) return
  wakeHandler = () => {
    if (document.visibilityState !== 'visible') return
    if (stopped) return
    const now = Date.now()
    if (now - lastWakeAt < WAKE_THROTTLE_MS) return
    lastWakeAt = now
    const opts = currentOpts
    if (!opts) return
    if (shouldRefreshNow(opts.accessToken, opts.leadMs)) {
      void doRefresh(opts).catch((e) => opts.onError?.(e as Error))
      return
    }
    schedule(opts)
  }
  document.addEventListener('visibilitychange', wakeHandler)
}

function detachWakeListener(): void {
  if (typeof document === 'undefined' || !wakeHandler) return
  document.removeEventListener('visibilitychange', wakeHandler)
  wakeHandler = null
}

/**
 * 启动自动刷新:从 useAuthStore 读取 token + refreshToken,过期前自动续期。
 * 通常在登录成功(setToken 同时持久化 refreshToken)后调用一次即可。
 *
 * **只以 accessToken 为前提**:浏览器 cookie 模式下 JS 读不到 refreshToken,
 * 续期凭据是浏览器自动附带的 httpOnly cookie —— 旧的 `!token || !refreshToken` 判据
 * 会让保活整条失效(15min 后必然 401、401 一抖就弹登录框)。
 */
export function startAutoRefresh(onError?: (err: Error) => void): void {
  if (typeof window === 'undefined') return
  stopped = false
  const { token, refreshToken } = useAuthStore.getState()
  if (!token) return
  currentOpts = {
    accessToken: token,
    refreshToken,
    onRefreshed: applyRefreshed,
    onError,
  }
  attachWakeListener()
  schedule(currentOpts)
}

/** 停止自动刷新(通常在 logout 时调用)。
 * 标记 stopped 以阻止飞行中的 refresh 完成后写回已注销的 store。 */
export function stopAutoRefresh(): void {
  stopped = true
  currentOpts = null
  detachWakeListener()
  clearRefreshTimer()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
