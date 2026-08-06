import { refreshAccessToken } from '@ihui/api-client'
import { readExp } from '@ihui/shared/utils/jwt-utils'
import { createChromePlatform } from '@ihui/browser-platform'
import { computeRefreshDelay, createInFlightRefresh } from '@ihui/shared/auth/auto-refresh'
import { REFRESH_ALARM_NAME } from './config'
import { getRefreshToken, setTokenPair, clearAllTokens } from './token'

// re-export 保持外部引用不变(如 tests/refresh-token.test.ts 直接从 token-utils 导入 readExp)
export { readExp }

const platform = createChromePlatform()

const inFlight = createInFlightRefresh<boolean>()

export function scheduleRefreshAlarm(accessToken: string): void {
  const delayMs = computeRefreshDelay(accessToken)
  if (delayMs === null) return
  // scheduleOnce 内部已封装 create + addListener + 触发后自动 removeListener,
  // clampToMinutes 由 chrome-impl.ts 内部处理,无需双重 clamp。
  // doRefresh 完成后会递归调用 scheduleRefreshAlarm 排下一次,维持 refresh 链。
  void platform.scheduler.scheduleOnce(REFRESH_ALARM_NAME, delayMs, () => {
    void doRefresh()
  })
}

export async function doRefresh(): Promise<boolean> {
  const existing = inFlight.get()
  if (existing) {
    return (await existing) ?? false
  }
  const promise = (async (): Promise<boolean> => {
    const refreshToken = getRefreshToken()
    if (!refreshToken) {
      await clearAllTokens()
      return false
    }
    try {
      const res = await refreshAccessToken(refreshToken)
      if (res.success && res.data?.accessToken) {
        await setTokenPair({
          accessToken: res.data.accessToken,
          refreshToken: res.data.refreshToken || refreshToken,
          expiresIn: res.data.expiresIn,
        })
        scheduleRefreshAlarm(res.data.accessToken)
        return true
      }
      await clearAllTokens()
      return false
    } catch {
      await clearAllTokens()
      return false
    } finally {
      inFlight.clear()
    }
  })()
  inFlight.set(promise)
  return promise
}

// 兜底刷新定时器(scheduleRefreshAlarm 的 chrome.alarms 链若意外中断,由它保证 token 仍会续期)
let autoRefreshTimer: ReturnType<typeof setInterval> | null = null
const AUTO_REFRESH_INTERVAL_MS = 4 * 60 * 1000 // 4 分钟

export function startAutoRefresh(): void {
  // scheduleOnce 模式下,listener 由 scheduleRefreshAlarm 内部随 handler 绑定注册,
  // 无需常驻 onAlarm listener;这里额外挂一个 setInterval 兜底:
  // - alarm 链递归续期是主路径(MV3 SW 休眠期间仍可触发)
  // - 若 alarm 链意外断裂(浏览器清理 / schedule 丢失),interval 每 4 分钟兜底 doRefresh
  // - SW 被回收时 interval 自然失效,下次 startAutoRefresh 重新建立,不会重复注册
  if (autoRefreshTimer) return
  autoRefreshTimer = setInterval(() => {
    void doRefresh()
  }, AUTO_REFRESH_INTERVAL_MS)
}

export function stopAutoRefresh(): void {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer)
    autoRefreshTimer = null
  }
  // clearSchedule 内部已封装 removeListener + clear(仅当存在已注册 listener 时移除)
  void platform.scheduler.clearSchedule(REFRESH_ALARM_NAME)
}
