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
} from '@ihui/shared/auth/auto-refresh'
import { type TokenPair } from '@ihui/types'
import { refreshAccessToken } from '@ihui/api-client'

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

export function clearRefreshTimer(): void {
  scheduler.clear()
}

interface ScheduleOptions {
  accessToken: string
  refreshToken: string
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
      const result = await refreshAccessToken(opts.refreshToken)
      if (!result.success || !result.data?.accessToken) {
        opts.onError?.(new Error(`refresh 失败: ${'error' in result ? result.error : 'unknown'}`))
        return null
      }
      const data = result.data
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
 * 启动自动刷新:从 useAuthStore 读取 token + refreshToken,过期前自动续期。
 * 通常在登录成功(setToken 同时持久化 refreshToken)后调用一次即可。
 */
export function startAutoRefresh(onError?: (err: Error) => void): void {
  if (typeof window === 'undefined') return
  stopped = false
  const { token, refreshToken } = useAuthStore.getState()
  if (!token || !refreshToken) return
  schedule({
    accessToken: token,
    refreshToken,
    onRefreshed: applyRefreshed,
    onError,
  })
}

/** 停止自动刷新(通常在 logout 时调用)。
 * 标记 stopped 以阻止飞行中的 refresh 完成后写回已注销的 store。 */
export function stopAutoRefresh(): void {
  stopped = true
  clearRefreshTimer()
}
