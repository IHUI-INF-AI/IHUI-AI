import { refreshAccessToken } from '@ihui/api-client'
import { REFRESH_LEAD_MS, REFRESH_ALARM_NAME } from './config'
import { getRefreshToken, setTokenPair, clearAllTokens } from './token'

let inFlightRefresh: Promise<boolean> | null = null
let alarmListener: ((alarm: chrome.alarms.Alarm) => void) | null = null

interface JWTPayload {
  exp?: number
}

function base64UrlDecode(input: string): string {
  const s = input.replace(/-/g, '+').replace(/_/g, '/')
  const padded = s + '='.repeat((4 - (s.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function readExp(token: string): number | null {
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
