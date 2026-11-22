// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D155(2026-09-29 立):下行告警三档(config-warning / deprecation-notice /
// guardian-warning)的 web 落点 —— 形状与 V3 #69 的 budget-state 同型(模块级外部
// store):帧生产点在 send-message.ts 的 SSE 回调里(非 React 渲染树内),消费点是
// message-input.tsx 输入区的 StreamAlertBar,两者既非同组件树也非父子。
// 帧类型直接复用 `@ihui/api-client` 的事件接口,不重定义字段表(生产端真值见
// shared contract.ts 的 SSE_ALERT_EVENTS 段;生产判定点在 ai-service,现场释放)。

import type {
  AlertSeverity,
  ConfigWarningEvent,
  DeprecationNoticeEvent,
  GuardianWarningEvent,
} from '@ihui/api-client'
import { normalizeSSEAlertSeverity } from '@ihui/shared'

/** 告警档位键(同时是 i18n 键片段 `streamAlert.<kind>.title`) */
export type StreamAlertKind = 'configWarning' | 'deprecationNotice' | 'guardianWarning'

export const STREAM_ALERT_KINDS: readonly StreamAlertKind[] = [
  'configWarning',
  'deprecationNotice',
  'guardianWarning',
]

/** 三档帧的判别联合(severity 已是归一后的封闭域) */
export type StreamAlertFrame = ConfigWarningEvent | DeprecationNoticeEvent | GuardianWarningEvent

export type StreamAlertSnapshot = Readonly<Record<StreamAlertKind, StreamAlertFrame | null>>

const EMPTY_SNAPSHOT: StreamAlertSnapshot = {
  configWarning: null,
  deprecationNotice: null,
  guardianWarning: null,
}

let snapshot: StreamAlertSnapshot = EMPTY_SNAPSHOT
const listeners = new Set<() => void>()

function notifyListeners(): void {
  for (const listener of listeners) listener()
}

/**
 * send-message.ts 三条 on* 回调的唯一写点。severity 在此再归一一次:
 * api-client 解析层已归一,但本落点是"上屏真相"的最后一道闸 —— 直写(测试/未来
 * 生产点绕过解析层)带进来的表外强度值不得把条染成未知色。
 */
export function setStreamAlert(kind: StreamAlertKind, event: StreamAlertFrame): void {
  const severity: AlertSeverity = normalizeSSEAlertSeverity(event.severity)
  snapshot = { ...snapshot, [kind]: { ...event, severity } }
  notifyListeners()
}

/** 用户点掉某一条;无帧可清时零通知,不做无谓重渲 */
export function clearStreamAlert(kind: StreamAlertKind): void {
  if (snapshot[kind] === null) return
  snapshot = { ...snapshot, [kind]: null }
  notifyListeners()
}

/** 新会话/离开页面时整表回收;整表已空时零通知 */
export function clearAllStreamAlerts(): void {
  if (
    STREAM_ALERT_KINDS.every((kind) => snapshot[kind] === null)
  ) {
    return
  }
  snapshot = EMPTY_SNAPSHOT
  notifyListeners()
}

/** useSyncExternalStore 的 client snapshot 口 */
export function getStreamAlerts(): StreamAlertSnapshot {
  return snapshot
}

/** SSR/首帧前的 server snapshot 口:未收到帧一律不渲染 */
export function getStreamAlertsServerSnapshot(): StreamAlertSnapshot {
  return EMPTY_SNAPSHOT
}

export function subscribeStreamAlerts(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
