// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 系统通知三态在设置页的展示判据(纯函数,不依赖 Tauri/React)。
// 单一真相源:三态语义与 tauri-bridge 的 SystemNotificationPermission 一致;
// 未知态一律按 unjudged 处理,绝不冒充 allowed,也不冒充 denied。

export type SystemPermissionViewState = 'allowed' | 'denied' | 'unjudged'

const KNOWN: ReadonlySet<string> = new Set(['allowed', 'denied', 'unjudged'])

export interface SystemPermissionView {
  state: SystemPermissionViewState
  labelKey: string
  showDeniedHint: boolean
  isJudged: boolean
}

/** 把桥接回执归一为展示态;非白名单一律 unjudged(fail-closed)。 */
export function resolveSystemPermissionView(raw: unknown): SystemPermissionView {
  const state: SystemPermissionViewState =
    typeof raw === 'string' && KNOWN.has(raw) ? (raw as SystemPermissionViewState) : 'unjudged'
  return {
    state,
    labelKey:
      state === 'allowed'
        ? 'systemPermissionStateAllowed'
        : state === 'denied'
          ? 'systemPermissionStateDenied'
          : 'systemPermissionStateUnjudged',
    showDeniedHint: state === 'denied',
    isJudged: state === 'allowed' || state === 'denied',
  }
}
