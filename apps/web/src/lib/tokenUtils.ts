/**
 * 客户端 Token 自动刷新工具。
 *
 * 背景：后端 accessToken TTL 通常 2h,refreshToken TTL 7d。避免用户长时间停留
 * 后突然 401,在 token 过期前 5 分钟自动调用 /api/auth/refresh 续期。
 *
 * 使用方式(在登录成功后):
 *   import { startAutoRefresh, stopAutoRefresh } from '@/lib/tokenUtils'
 *   startAutoRefresh(err => router.push('/login'))
 *
 * 依赖:useAuthStore 持久化 token + refreshToken(accessToken 必须是 JWT 带 exp 字段)。
 */
import { useAuthStore } from '@/stores/auth'

const REFRESH_LEAD_MS = 5 * 60 * 1000 // 提前 5 分钟续期
const REFRESH_ENDPOINT = '/api/auth/refresh'
const MIN_DELAY_MS = 30 * 1000 // 最小 30s,避免 setTimeout 越界
const MAX_DELAY_MS = 24 * 60 * 60 * 1000 // 上限 24h

let refreshTimer: ReturnType<typeof setTimeout> | null = null
let inFlightRefresh: Promise<TokenPair | null> | null = null
let stopped = false

interface JWTPayload {
  exp?: number
  iat?: number
}

export interface TokenPair {
  accessToken: string
  refreshToken?: string
  expiresIn?: number
}

function base64UrlDecode(input: string): string {
  const s = input.replace(/-/g, '+').replace(/_/g, '/')
  const padded = s + '='.repeat((4 - (s.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function readExp(token: string): number | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const payloadPart = parts[1]
  if (!payloadPart) return null
  try {
    const decoded = JSON.parse(base64UrlDecode(payloadPart)) as JWTPayload
    return typeof decoded.exp === 'number' ? decoded.exp : null
  } catch {
    return null
  }
}

export function clearRefreshTimer(): void {
  if (refreshTimer) {
    clearTimeout(refreshTimer)
    refreshTimer = null
  }
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
  clearRefreshTimer()
  const exp = readExp(opts.accessToken)
  if (!exp) return
  const expMs = exp * 1000
  const delay = Math.max(
    MIN_DELAY_MS,
    Math.min(MAX_DELAY_MS, expMs - Date.now() - (opts.leadMs ?? REFRESH_LEAD_MS)),
  )
  refreshTimer = setTimeout(() => {
    void doRefresh(opts).catch((e) => opts.onError?.(e as Error))
  }, delay)
}

async function doRefresh(opts: ScheduleOptions): Promise<void> {
  if (inFlightRefresh) {
    const tokens = await inFlightRefresh
    if (tokens) {
      opts.onRefreshed(tokens)
      schedule({ ...opts, ...tokens })
    }
    return
  }
  inFlightRefresh = (async () => {
    try {
      const res = await fetch(REFRESH_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: opts.refreshToken }),
      })
      if (!res.ok) {
        opts.onError?.(new Error(`refresh 失败: HTTP ${res.status}`))
        return null
      }
      const json = (await res.json()) as { data?: TokenPair; code?: number }
      const data = json.data
      if (!data?.accessToken) {
        opts.onError?.(new Error('refresh 响应缺少 accessToken'))
        return null
      }
      opts.onRefreshed(data)
      schedule({ ...opts, ...data })
      return data
    } catch (e) {
      opts.onError?.(e as Error)
      return null
    } finally {
      inFlightRefresh = null
    }
  })()
  await inFlightRefresh
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
