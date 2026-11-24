// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * RUM 同意闸（默认关闭）。
 *
 * 与既有「使用情况分析」埋点不同：RUM 采用 **opt-in**，且同意只存本地 localStorage，
 * **不写后端偏好**。理由：
 * - 服务端若能下发"允许"，等于平台可以替用户打开性能采集，违反"显式同意"；
 * - 本地开关关闭时，采集层连事件都不入队，网络请求数严格为 0（不是"发了再丢"）。
 *
 * Do Not Track 是硬闸：即使本地已存 '1'，DNT 生效时仍判未同意（DNT 优先级高于应用内偏好）。
 */

export const RUM_CONSENT_STORAGE_KEY = 'ihui_rum_consent_v1'
export const RUM_CONSENT_CHANGE_EVENT = 'ihui-rum-consent-change'

type DoNotTrackNavigator = Navigator & {
  doNotTrack?: string | null
  msDoNotTrack?: string
}

type DoNotTrackWindow = Window & { doNotTrack?: string }

function getStorage(): Storage | null {
  try {
    return typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage
  } catch {
    // 隐私模式 / 被策略禁用时读 localStorage 本身就可能抛异常：按"未同意"处理（fail closed）。
    return null
  }
}

export function isDoNotTrackEnabled(
  nav: DoNotTrackNavigator | undefined = typeof navigator !== 'undefined'
    ? (navigator as DoNotTrackNavigator)
    : undefined,
  win: DoNotTrackWindow | undefined = typeof window !== 'undefined'
    ? (window as DoNotTrackWindow)
    : undefined,
): boolean {
  if (nav?.doNotTrack === '1' || nav?.msDoNotTrack === '1') return true
  return win?.doNotTrack === '1'
}

/** 默认关闭：只有本地显式写入 '1' 且 DNT 未开启，才返回 true。 */
export function isRumConsentGranted(): boolean {
  if (typeof window === 'undefined') return false
  if (isDoNotTrackEnabled()) return false
  try {
    return getStorage()?.getItem(RUM_CONSENT_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

/** 显式同意/撤回。撤回时立刻广播，采集层会清空缓冲并停止定时器。 */
export function setRumConsent(granted: boolean): void {
  if (typeof window === 'undefined') return
  try {
    getStorage()?.setItem(RUM_CONSENT_STORAGE_KEY, granted ? '1' : '0')
  } catch {
    // 写不进去也不影响广播：本次会话内仍按用户的选择执行（下一次刷新回到默认关闭）。
  }
  window.dispatchEvent(
    new CustomEvent(RUM_CONSENT_CHANGE_EVENT, { detail: { granted: Boolean(granted) } }),
  )
}

export function onRumConsentChange(callback: (granted: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<{ granted?: unknown }>).detail
    callback(Boolean(detail?.granted))
  }
  window.addEventListener(RUM_CONSENT_CHANGE_EVENT, handler)
  return () => window.removeEventListener(RUM_CONSENT_CHANGE_EVENT, handler)
}

/** 仅供测试：清除本地同意状态，避免用例相互污染。 */
export function resetRumConsentForTests(): void {
  try {
    getStorage()?.removeItem(RUM_CONSENT_STORAGE_KEY)
  } catch {
    // ignore
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
