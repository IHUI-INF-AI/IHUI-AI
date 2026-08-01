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

export function startAutoRefresh(): void {
  // scheduleOnce 模式下,listener 由 scheduleRefreshAlarm 内部随 handler 绑定注册,
  // 不再需要常驻 onAlarm listener。保留函数以维持 API 兼容(background.ts 仍调用)。
}

export function stopAutoRefresh(): void {
  // clearSchedule 内部已封装 removeListener + clear(仅当存在已注册 listener 时移除)
  void platform.scheduler.clearSchedule(REFRESH_ALARM_NAME)
}
