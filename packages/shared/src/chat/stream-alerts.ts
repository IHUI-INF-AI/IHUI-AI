// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D155 下行告警三档 —— 「原始载荷 → 告警记录」判据层(2026-11-13 立)。
 *
 * ## 为什么要有这一层
 *
 * 契约段(`sse/contract.ts` 的 `SSE_ALERT_EVENTS`)定义了载荷类型,
 * `normalizeSSEAlertSeverity` 定义了强度归一 —— 但缺**中间这一层**:
 * 「一个来路不明的 unknown 对象,要不要当成告警上屏?上屏时取哪些字段?」。
 *
 * 此前这个判据在每个消费端各写一遍(api-client 的 tryParseConfigWarning /
 * tryParseDeprecationNotice / tryParseGuardianWarning 三份近乎逐字相同的代码),
 * 而 mobile-rn / miniapp-taro / extension / cli / packages/app 五端**根本没有**
 * —— 它们的流解析走共享 `sse-parse`,那里从未认领这三帧,于是后端即便产帧,
 * 这五端也会静默丢弃。这正是本仓反复出现的"协议有、消费声明有、帧到不了"。
 *
 * 本模块是这五端(以及未来任何走共享解析面的端)的**唯一判据出口**:
 * 不复制 api-client 的解析器,而是把同一把尺子做成纯函数,谁都能调。
 *
 * ## 判据(与 api-client client.ts 逐字同源,三档共用)
 *
 * 1. `type` 必须命中三个已知帧名之一;
 * 2. `message` 必须是非空字符串 —— **没有话可说的告警不是告警**
 *    (只有 severity 没有 message 的帧,端上渲染出来是一行空白);
 * 3. `severity` 表外/缺省/非串 ⇒ 回退 `'warning'`,**不丢帧**
 *    (D34/D40 教训:未知强度是要上屏的事实,不是丢弃整帧的理由);
 * 4. 各档专属可选字段只在 `typeof === 'string'` 时透传,非串垃圾当缺省
 *    (不把 `{capability: 123}` 渲染成 "123" 这种猜出来的内容)。
 *
 * ## 与 api-client 的分工(重要,别重复实现)
 *
 * api-client 仍保留自己的三份 tryParse —— 它跑在**逐行 SSE 文本**上,
 * 要做 `data:` 前缀剥离、`[DONE]` 跳过、注释行跳过,那是传输层职责。
 * 本模块只负责**已经 JSON.parse 出来的对象**,不碰文本。
 * 两层的共同真相是"哪些字段、什么条件下算数",由本模块钉住;
 * api-client 的解析器在解析成功后可以照旧直连消费端,行为不变。
 */

import {
  normalizeSSEAlertSeverity,
  type SSEAlertEventPayload,
  type SSEAlertSeverity,
} from '../sse/contract'

/** 告警三档的判别键(与 `SSE_ALERT_EVENTS` 的值逐字一致,不另立表)。 */
export const STREAM_ALERT_TYPES = [
  'config-warning',
  'deprecation-notice',
  'guardian-warning',
] as const

export type StreamAlertType = (typeof STREAM_ALERT_TYPES)[number]

const TYPE_SET: ReadonlySet<string> = new Set<string>(STREAM_ALERT_TYPES)

/** 是否为我方已知的告警帧名(类型守卫;表外值一律不放行)。 */
export function isStreamAlertType(value: string): value is StreamAlertType {
  return TYPE_SET.has(value)
}

/** 一档告警的规范化记录(上屏只用这个形状,不再回读原始对象)。 */
export interface StreamAlertRecord {
  type: StreamAlertType
  severity: SSEAlertSeverity
  /** 人可读正文(生产端措辞);端上原样渲染,不自己编文案 */
  message: string
  /** 各档专属可选字段,已逐字段收窄;缺席即不写键 */
  detail: Readonly<Record<string, string>>
}

/**
 * 各档专属可选字段表。键顺序即对外契约顺序,值域只校验"是非空串"。
 *
 * 为什么不在这里给每档写一个独立 interface:可选字段的**收窄规则完全相同**
 * (非串即丢),差异只在键名。为三个键名写三份结构相同的代码,下一次加档
 * 就要再抄一份 —— 那正是本模块要消除的重复。
 */
const DETAIL_KEYS: Readonly<Record<StreamAlertType, readonly string[]>> = {
  'config-warning': ['field', 'provider', 'effectiveValue'],
  'deprecation-notice': ['capability', 'alternative', 'sunsetAt'],
  'guardian-warning': ['category', 'reviewId'],
}

/**
 * 原始载荷 → 告警记录。不是告警帧(或形状不合格)⇒ `null`,调用方静默跳过。
 *
 * **不抛异常**:这个函数跑在 SSE 逐帧路径上,一个坏帧绝不能把整条流打断。
 */
export function readStreamAlert(raw: unknown): StreamAlertRecord | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Record<string, unknown>
  const type = item.type
  if (typeof type !== 'string' || !isStreamAlertType(type)) return null
  // message 非空串:没有正文的告警上屏就是一行空白,不如不上。
  const message = item.message
  if (typeof message !== 'string' || message === '') return null
  const detail: Record<string, string> = {}
  for (const key of DETAIL_KEYS[type]) {
    const v = item[key]
    // 空串同样不收:契约里这些键的语义是"有值才出现",
    // 空串会让前端渲染出一个空选项/空替换建议。
    if (typeof v === 'string' && v !== '') detail[key] = v
  }
  return {
    type,
    severity: normalizeSSEAlertSeverity(item.severity),
    message,
    detail,
  }
}

/**
 * 帧 → 判别联合成员(需要原始类型化载荷时用这个;只要上屏内容用 `readStreamAlert`)。
 *
 * 与 `readStreamAlert` 同源判据,只是保留 `SSEEventWithMeta` 的透传字段
 * (traceId 等元信息)。两者不要各写一套条件 —— 本函数内部就调它。
 */
export function readStreamAlertEvent(raw: unknown): SSEAlertEventPayload | null {
  const rec = readStreamAlert(raw)
  if (!rec) return null
  const meta = raw as Record<string, unknown>
  const passthrough: Record<string, unknown> = {}
  // 只透传契约声明的元字段,不把整个原始对象摊出去(防止上游塞任意键到端上)。
  for (const key of ['traceId', 'agentId', 'timestamp', 'messageId'] as const) {
    const v = meta[key]
    if (typeof v === 'string' && v !== '') passthrough[key] = v
  }
  return {
    ...passthrough,
    type: rec.type,
    severity: rec.severity,
    message: rec.message,
    ...rec.detail,
  } as SSEAlertEventPayload
}

/**
 * 同一档在一条流里可能要显示多次(不同模型各自的弃用预告)。
 * 用 `type + 主键` 去重,而不是"只要 type 一样就覆盖":
 * 后者会让第二条告警把第一条挤掉,用户只看到其中一条。
 *
 * 主键优先取该档最有辨识度的字段(capability/field/category),
 * 全缺时退到 message 本身(逐字相同才算同一条)。
 */
export function streamAlertKey(rec: StreamAlertRecord): string {
  const primary = rec.detail.capability ?? rec.detail.field ?? rec.detail.category ?? rec.message
  return `${rec.type}:${primary}`
}

/** 按 `streamAlertKey` 去重(保序:先到的在前),供端上维护列表用。 */
export function dedupeStreamAlerts(list: readonly StreamAlertRecord[]): StreamAlertRecord[] {
  const seen = new Set<string>()
  const out: StreamAlertRecord[] = []
  for (const rec of list) {
    const key = streamAlertKey(rec)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(rec)
  }
  return out
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
