import { refreshAccessToken } from '@ihui/api-client'
import { readExp } from '@ihui/shared/utils/jwt-utils'
import { REFRESH_LEAD_MS, REFRESH_ALARM_NAME } from './config'
import { getRefreshToken, setTokenPair, clearAllTokens } from './token'

// re-export 保持外部引用不变(如 tests/refresh-token.test.ts 直接从 token-utils 导入 readExp)
export { readExp }

let inFlightRefresh: Promise<boolean> | null = null
let alarmListener: ((alarm: chrome.alarms.Alarm) => void) | null = null

export function scheduleRefreshAlarm(accessToken: string): void {
  const exp = readExp(accessToken)
  if (!exp) return
  const delayMs = exp * 1000 - Date.now() - REFRESH_LEAD_MS
  if (delayMs <= 0) {
    void doRefresh()
    return
  }
  const delayInMinutes = Math.max(1, Math.ceil(delayMs / (60 * 1000)))
  chrome.alarms.create(REFRESH_ALARM_NAME, { delayInMinutes })
}

export async function doRefresh(): Promise<boolean> {
  if (inFlightRefresh) return inFlightRefresh
  inFlightRefresh = (async () => {
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
      inFlightRefresh = null
    }
  })()
  return inFlightRefresh
}

export function startAutoRefresh(): void {
  if (alarmListener) return
  alarmListener = (alarm: chrome.alarms.Alarm) => {
    if (alarm.name === REFRESH_ALARM_NAME) {
      void doRefresh().catch((err) => {
        console.error('[IHUI AI] refresh token alarm failed:', err)
      })
    }
  }
  chrome.alarms.onAlarm.addListener(alarmListener)
}

export function stopAutoRefresh(): void {
  chrome.alarms.clear(REFRESH_ALARM_NAME).catch(() => {})
  if (alarmListener) {
    chrome.alarms.onAlarm.removeListener(alarmListener)
    alarmListener = null
  }
}
